import Link from "next/link";
import type { CSSProperties } from "react";
import { asc } from "drizzle-orm";
import { requireArea } from "@/lib/auth/session";
import { db, products } from "@/lib/db";
import { getMediaMap, resolveImg } from "@/lib/data/media";
import { env } from "@/lib/env";
import { RETAILERS, RETAILER_KEYS, asRetailer, retailerLabel, asinFromUrl } from "@/lib/retailers";
import { SHELVES, SHELF_KEYS, onShelf } from "@/lib/shelves";
import { paapiReady, getAmazonShop, searchAmazon, type AmazonItem } from "@/lib/server/amazon";
import AdminShell from "@/components/admin/AdminShell";
import { Card, Field } from "@/components/admin/ui";
import Toast from "@/components/admin/Toast";
import ConfirmButton from "@/components/admin/Confirm";
import Sortable from "@/components/admin/Sortable";
import ImagePicker from "@/components/admin/ImagePicker";
import { addProduct, addAmazonItem, productAction, syncProductsNow, reorderProducts } from "@/lib/actions/catalog";
import { relativeDay } from "@/lib/utils";

export const metadata = { title: "Products" };
export const dynamic = "force-dynamic";
const DEFAULT_CATEGORIES = ["Bathroom safety", "Bedroom", "Kitchen", "Lighting", "Mobility", "Movement", "Hydration", "Health tracking", "Entry & stairs", "Daily living", "Guides & checklists", "Uncategorized"];
const hasPrice = (p: string) => !!p && p !== "$—" && p !== "—";
const strip: CSSProperties = { display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 10, fontSize: 12.5, color: "#1a2238" };

/** "Shows on" checkboxes: every named shelf (src/lib/shelves.ts) plus the homepage featured row. `shelves`/`featured` are the boxes ticked at first; `hint` spells out where each box puts the product. */
function ShowsOn({ shelves, featured, size = 12, hint = false }: { shelves: readonly string[]; featured: boolean; size?: number; hint?: boolean }) {
  const box: CSSProperties = { display: "flex", gap: 6, alignItems: "center", fontSize: size, whiteSpace: "nowrap", cursor: "pointer" };
  return (
    <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
      <span className="label-caps">Shows on</span>
      {SHELF_KEYS.map((k) => <label key={k} style={box} title={`Shows on ${SHELVES[k].where}`}><input type="checkbox" name="shelves" value={k} defaultChecked={onShelf(shelves, k)} />{SHELVES[k].name}</label>)}
      <label style={box} title="Shows in the featured row on the homepage"><input type="checkbox" name="featured" defaultChecked={featured} />Homepage (featured row)</label>
      {hint && <span style={{ flexBasis: "100%", fontSize: 11, color: "#8c95a8" }}>Tick where this product should appear: {SHELF_KEYS.map((k) => `${SHELVES[k].name} = ${SHELVES[k].where}`).join(" · ")} · Homepage = the featured row. You can change this any time on the product's card.</span>}
    </div>
  );
}

export default async function ProductsAdmin({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireArea("products");
  const [rows, map, paapi, shop, sp] = await Promise.all([db.select().from(products).orderBy(asc(products.sort), asc(products.id)), getMediaMap(), paapiReady(), getAmazonShop(), searchParams]);
  const q = (sp.q || "").trim();
  let search: { items: AmazonItem[]; total: number } | null = null; let searchError = "";
  if (paapi && q) { try { search = await searchAmazon(q); } catch (e) { searchError = (e as Error).message; } }
  const featured = rows.filter((p) => p.featured && p.isActive).length;
  const visible = rows.filter((p) => p.isActive).length;
  const categories = Array.from(new Set([...rows.map((r) => r.category), ...DEFAULT_CATEGORIES])).filter(Boolean);
  const counts = rows.reduce<Record<string, number>>((acc, p) => { const k = asRetailer(p.retailer); acc[k] = (acc[k] || 0) + 1; return acc; }, {});
  const shelfCounts = SHELF_KEYS.map((k) => ({ shelf: SHELVES[k], n: rows.filter((p) => p.isActive && onShelf(p.shelves, k)).length }));
  const subtitle = [`${rows.length} listing${rows.length === 1 ? "" : "s"} (${visible} shown)`, ...Object.entries(counts).map(([k, n]) => `${n} on ${RETAILERS[asRetailer(k)].name}`), ...shelfCounts.map(({ shelf, n }) => `${n} on ${shelf.name}`), `${featured} featured on the homepage`].join(" · ");
  const cartOn = !!shop.tag && shop.cartButtons;
  return (
    <AdminShell user={user} active="products" title="Products" subtitle={subtitle} actions={<form action={syncProductsNow}><button type="submit" className="btn btn-ghost btn-sm" style={{ height: 40, borderRadius: 10 }}>Refresh prices & photos</button></form>}>
      <Toast />
      <div style={{ ...strip, background: cartOn ? "#eaf6ee" : "#fff6e5", border: `1px solid ${cartOn ? "#cfe8d6" : "#f3dfb6"}` }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: cartOn ? "#1f6b3f" : "#d98e04", flex: "none" }} />
        {shop.tag ? <span>Amazon links carry your tracking id <strong>{shop.tag}</strong> · “Add to Amazon cart” buttons are <strong>{shop.cartButtons ? "on" : "off"}</strong> · {paapi ? "Product Advertising API connected" : "Product Advertising API not set (links still work)"}.</span> : <span>No Associates tracking id yet, so Amazon links are plain and the “Add to Amazon cart” buttons stay hidden.</span>}
        <Link href="/admin/content/settings" className="link-btn" style={{ marginLeft: "auto", whiteSpace: "nowrap" }}>Amazon shop settings →</Link>
      </div>
      <div style={{ ...strip, background: "#eef6fc", border: "1px solid #cfe3f3", flexWrap: "wrap", rowGap: 6 }}>
        <span style={{ fontWeight: 700, whiteSpace: "nowrap" }}>Where products show</span>
        {shelfCounts.map(({ shelf, n }) => (
          <span key={shelf.key} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "4px 10px", borderRadius: 999, background: "#fff", border: "1px solid #cfe3f3", whiteSpace: "nowrap" }}>
            <strong>{shelf.name}</strong><span style={{ color: "#4b5569" }}>{n ? `${n} listing${n === 1 ? "" : "s"}` : `empty — ${shelf.whenEmpty}`}</span>
            <Link href={`${shelf.href}#${shelf.key}`} target="_blank" className="link-btn">page ↗</Link><Link href={`/admin/content?page=${shelf.pageKey}`} className="link-btn link-muted">copy →</Link>
          </span>))}
        <span style={{ color: "#4b5569" }}>Tick the boxes under <strong>Shows on</strong> when you add a product or on its card. To show one of these sections on another page (say, WELLness Resources): Content → Pages → that page → Add block → “{SHELVES.wellness.name} section”.</span>
      </div>

      <Card title="Add a product" sub={<>Paste a product link. We read the title, photo, price and rating from the store{paapi ? " (through the Amazon API for Amazon links)" : ""}; Amazon sometimes declines automated requests, so check the card afterwards and fill in anything missing. Choose your own photo here, or on the card later, when you'd rather not use the store's. Etsy shop: <a href={env.etsyShopUrl} target="_blank" rel="noreferrer" style={{ color: "#3f9ad9" }}>{env.etsyShopUrl}</a></>}>
        <form action={addProduct} encType="multipart/form-data" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 2fr) 170px 190px", gap: 10, alignItems: "end" }}>
            <Field label="Product link"><input name="url" placeholder="https://www.amazon.com/dp/… or https://www.etsy.com/listing/…" className="admin-input admin-input-sm" required /></Field>
            <Field label="Store"><select name="retailer" defaultValue="" className="admin-input admin-input-sm"><option value="">Detect from the link</option>{RETAILER_KEYS.map((k) => <option key={k} value={k}>{RETAILERS[k].name}</option>)}</select></Field>
            <Field label="Category"><input name="category" list="pcats" placeholder="e.g. Hydration" className="admin-input admin-input-sm" /></Field>
          </div>
          <datalist id="pcats">{categories.map((c) => <option key={c} value={c} />)}</datalist>
          <div style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
            <ShowsOn shelves={SHELF_KEYS} featured={false} hint />
            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 11, color: "#4b5569" }}><span className="label-caps">Photo</span><input type="file" name="image_file" accept="image/*" style={{ fontSize: 11, maxWidth: 220 }} /><span>optional — read from the store when empty</span></label>
            <button type="submit" className="btn btn-navy btn-xs" style={{ marginLeft: "auto", borderRadius: 8 }}>Fetch & add</button>
          </div>
        </form>
      </Card>

      <Card title="Search Amazon" sub={paapi ? "Find a product and add it with its live title, photo, price and rating (Product Advertising API)." : "Searching Amazon from here needs the Product Advertising API keys (AMAZON_PAAPI_ACCESS_KEY and AMAZON_PAAPI_SECRET_KEY in Replit → Secrets) and your Associates tracking id. Until then, paste product links above."}>
        {paapi && (
          <form method="get" action="/admin/products" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 8, alignItems: "center" }}>
            <input name="q" defaultValue={q} placeholder="e.g. shower grab bar, motion-sensor night light…" className="admin-input admin-input-sm" />
            <button type="submit" className="btn btn-navy btn-xs" style={{ borderRadius: 8 }}>Search</button>
          </form>)}
        {searchError && <p style={{ margin: "8px 0 0", fontSize: 12, color: "#9a3c1e" }}>{searchError}</p>}
        {search && search.items.length === 0 && <p style={{ margin: "8px 0 0", fontSize: 12, color: "#6b7486" }}>No results for “{q}”.</p>}
        {search && search.items.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
            {search.items.map((it) => { const inCatalog = rows.some((p) => asinFromUrl(p.url) === it.asin); return (
              <div key={it.asin} style={{ display: "grid", gridTemplateColumns: "48px minmax(0, 1fr) auto", gap: 12, alignItems: "center", padding: "8px 0", borderTop: "1px solid #f2f4f7" }}>
                <div style={{ width: 48, height: 48, borderRadius: 8, overflow: "hidden", background: "#f2f4f7" }}>{it.image && <img src={it.image} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                  <a href={it.url} target="_blank" rel="noreferrer" style={{ fontSize: 13, fontWeight: 600, color: "#1a2238", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.title}</a>
                  <span style={{ fontSize: 11, color: "#6b7486" }}>{[it.byline, it.price !== "$—" ? it.price : null, it.reviews !== "(0)" ? `${it.reviews.replace(/[()]/g, "")} ratings` : null, `ASIN ${it.asin}`].filter(Boolean).join(" · ")}</span>
                </div>
                {inCatalog ? <span style={{ fontSize: 11, fontWeight: 600, color: "#1f6b3f" }}>In catalog</span> : (
                  <form action={addAmazonItem} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                    <input type="hidden" name="asin" value={it.asin} />
                    <input name="category" list="pcats" placeholder="Category" className="admin-input admin-input-sm" style={{ width: 150 }} />
                    <ShowsOn shelves={SHELF_KEYS} featured={false} size={11} />
                    <button type="submit" className="btn btn-navy btn-xs" style={{ borderRadius: 8 }}>Add</button>
                  </form>)}
              </div>); })}
          </div>)}
      </Card>

      <Card title="Catalog" sub="Drag to reorder; every page follows this order. Titles and descriptions you type here are kept; the scheduled refresh only updates prices, ratings and photos you haven't replaced. Changing a product's link reads the new listing's photo, price and rating.">
        {rows.length === 0 && <p style={{ fontSize: 13, color: "#8c95a8", margin: 0 }}>No products yet — add one above.</p>}
        <Sortable ids={rows.map((r) => r.id)} onReorder={reorderProducts} handleTop>
          {rows.map((p) => { const r = asRetailer(p.retailer); const asin = r === "amazon" ? asinFromUrl(p.url) : null; return (
            <div key={p.id} style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 10, padding: 14, borderRadius: 12, border: "1px solid #eef0f4", background: p.isActive ? "#fff" : "#f7f9fc", opacity: p.isActive ? 1 : .65 }}>
              <form action={productAction} encType="multipart/form-data" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <input type="hidden" name="productId" value={p.id} /><input type="hidden" name="op" value="update" />
                <div style={{ display: "grid", gridTemplateColumns: "minmax(280px, 1fr) minmax(0, 2fr)", gap: 14, alignItems: "start" }}>
                  <ImagePicker label="Photo" name="imageUrl" fileName="image_file" defaultValue={p.imageUrl || ""} preview={p.imageUrl ? resolveImg(map, p.imageUrl) : undefined} width={96} height={96} />
                  <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 150px", gap: 10 }}>
                    <Field label="Title"><input name="title" defaultValue={p.title} className="admin-input admin-input-sm" /></Field>
                    <Field label="Store"><select name="retailer" defaultValue={r} className="admin-input admin-input-sm">{RETAILER_KEYS.map((k) => <option key={k} value={k}>{RETAILERS[k].name}</option>)}</select></Field>
                    <Field label="Product link" span><input name="url" defaultValue={p.url} placeholder="https://…" className="admin-input admin-input-sm" /></Field>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "minmax(140px, 1.3fr) minmax(130px, 1fr) 110px 80px 100px minmax(130px, 1fr)", gap: 10 }}>
                  <Field label="Category"><input name="category" defaultValue={p.category} list="pcats" className="admin-input admin-input-sm" /></Field>
                  <Field label="Tag (badge on the photo)"><input name="tag" defaultValue={p.tag || ""} placeholder="e.g. Best seller" className="admin-input admin-input-sm" /></Field>
                  <Field label="Price"><input name="price" defaultValue={hasPrice(p.price) ? p.price : ""} placeholder="$24.99" className="admin-input admin-input-sm" /></Field>
                  <Field label="Rating"><input name="rating" defaultValue={p.rating} placeholder="4.7" className="admin-input admin-input-sm" /></Field>
                  <Field label="Reviews"><input name="reviews" defaultValue={p.reviews !== "(0)" ? p.reviews : ""} placeholder="1,204" className="admin-input admin-input-sm" /></Field>
                  <Field label="Line beside the price"><input name="type" defaultValue={p.type} placeholder="e.g. Digital download" className="admin-input admin-input-sm" /></Field>
                </div>
                <Field label="Description (shown on the product card)"><textarea name="description" defaultValue={p.description || ""} rows={2} className="admin-input admin-input-sm" style={{ height: "auto", padding: "6px 10px", lineHeight: 1.45 }} placeholder="Optional short description" /></Field>
                <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
                  <ShowsOn shelves={p.shelves} featured={p.featured} />
                  <button type="submit" className="btn btn-navy btn-xs" style={{ marginLeft: "auto", borderRadius: 8 }}>Save</button>
                </div>
              </form>
              <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", fontSize: 11, color: "#8c95a8", borderTop: "1px solid #f2f4f7", paddingTop: 8 }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "2px 8px", borderRadius: 999, background: "#f2f4f7", color: "#1a2238", fontWeight: 600 }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: RETAILERS[r].dot }} />{RETAILERS[r].name}</span>
                <a href={p.url} target="_blank" rel="noreferrer" style={{ color: "#3f9ad9" }}>View on {retailerLabel(r)} ↗</a>
                {r === "amazon" && (asin ? <span>ASIN {asin}{cartOn ? " · cart button on" : ""}</span> : <span style={{ color: "#b45309" }}>no ASIN in this link — paste the full product link (…/dp/…) to get the photo and the cart button</span>)}
                <span>{p.lastSyncedAt ? `synced ${relativeDay(p.lastSyncedAt)}` : "not synced"}</span>
                {!p.imageUrl && <span style={{ color: "#b45309" }}>no photo yet — upload one above or refresh from the store</span>}
                {!p.isActive && <span style={{ color: "#b45309", fontWeight: 600 }}>hidden everywhere</span>}
                <span style={{ marginLeft: "auto", display: "flex", gap: 14, alignItems: "center" }}>
                  <form action={productAction}><input type="hidden" name="productId" value={p.id} /><input type="hidden" name="op" value="refresh" /><button type="submit" className="link-btn link-muted">Refresh from {r === "other" ? "the store" : RETAILERS[r].name}</button></form>
                  <form action={productAction}><input type="hidden" name="productId" value={p.id} /><input type="hidden" name="op" value="active" /><button type="submit" className="link-btn link-muted">{p.isActive ? "Hide" : "Show"}</button></form>
                  <form action={productAction}><input type="hidden" name="productId" value={p.id} /><input type="hidden" name="op" value="delete" /><ConfirmButton message={`Remove “${p.title}” from the catalog?`}>Remove</ConfirmButton></form>
                </span>
              </div>
            </div>); })}
        </Sortable>
      </Card>
    </AdminShell>
  );
}
