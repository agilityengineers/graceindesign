import Link from "next/link";
import { asc } from "drizzle-orm";
import { requireArea } from "@/lib/auth/session";
import { db, products } from "@/lib/db";
import { getMediaMap, resolveImg } from "@/lib/data/media";
import { env } from "@/lib/env";
import { RETAILERS, asRetailer, retailerLabel, asinFromUrl } from "@/lib/retailers";
import { paapiReady, getAmazonShop, searchAmazon, type AmazonItem } from "@/lib/server/amazon";
import AdminShell from "@/components/admin/AdminShell";
import { Card } from "@/components/admin/ui";
import Toast from "@/components/admin/Toast";
import ConfirmButton from "@/components/admin/Confirm";
import Sortable from "@/components/admin/Sortable";
import { addProduct, addAmazonItem, productAction, syncProductsNow, reorderProducts, importSeedProducts } from "@/lib/actions/catalog";
import { missingSeedProducts } from "@/lib/server/product-import";
import { PRODUCTS } from "@/lib/seed-data/products";
import { relativeDay } from "@/lib/utils";

export const metadata = { title: "Products" };
export const dynamic = "force-dynamic";
const DEFAULT_CATEGORIES = ["Bathroom safety", "Bedroom", "Kitchen", "Lighting", "Mobility", "Movement", "Hydration", "Health tracking", "Entry & stairs", "Daily living", "Guides & checklists", "Uncategorized"];
const COLS = "56px minmax(0, 2fr) 150px 90px 110px 70px auto";

export default async function ProductsAdmin({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireArea("products");
  const [rows, map, paapi, shop, sp, missing] = await Promise.all([db.select().from(products).orderBy(asc(products.sort), asc(products.id)), getMediaMap(), paapiReady(), getAmazonShop(), searchParams, missingSeedProducts()]);
  const q = (sp.q || "").trim();
  let search: { items: AmazonItem[]; total: number } | null = null; let searchError = "";
  if (paapi && q) { try { search = await searchAmazon(q); } catch (e) { searchError = (e as Error).message; } }
  const featured = rows.filter((p) => p.featured && p.isActive).length;
  const visible = rows.filter((p) => p.isActive).length;
  const categories = Array.from(new Set([...rows.map((r) => r.category), ...DEFAULT_CATEGORIES])).filter(Boolean);
  const counts = rows.reduce<Record<string, number>>((acc, p) => { const k = asRetailer(p.retailer); acc[k] = (acc[k] || 0) + 1; return acc; }, {});
  const subtitle = [`${rows.length} listing${rows.length === 1 ? "" : "s"} (${visible} shown)`, ...Object.entries(counts).map(([k, n]) => `${n} on ${RETAILERS[asRetailer(k)].name}`), `${featured} featured on the homepage`].join(" · ");
  const cartOn = !!shop.tag && shop.cartButtons;
  return (
    <AdminShell user={user} active="products" title="Products" subtitle={subtitle} actions={<form action={syncProductsNow}><button type="submit" className="btn btn-ghost btn-sm" style={{ height: 40, borderRadius: 10 }}>Refresh prices & photos</button></form>}>
      <Toast />
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 10, background: cartOn ? "#eaf6ee" : "#fff6e5", border: `1px solid ${cartOn ? "#cfe8d6" : "#f3dfb6"}`, fontSize: 12.5, color: "#1a2238" }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: cartOn ? "#1f6b3f" : "#d98e04", flex: "none" }} />
        {shop.tag ? <span>Amazon links carry your tracking id <strong>{shop.tag}</strong> · “Add to Amazon cart” buttons are <strong>{shop.cartButtons ? "on" : "off"}</strong> · {paapi ? "Product Advertising API connected" : "Product Advertising API not set (links still work)"}.</span> : <span>No Associates tracking id yet, so Amazon links are plain and the “Add to Amazon cart” buttons stay hidden.</span>}
        <Link href="/admin/content/settings" className="link-btn" style={{ marginLeft: "auto", whiteSpace: "nowrap" }}>Amazon shop settings →</Link>
      </div>
      {missing.length > 0 && (
        <Card title="Previous site's product list" sub={`${missing.length} of the ${PRODUCTS.length} listings carried over from the previous site (${PRODUCTS.filter((p) => p.active !== false).length} shown on the page, the rest kept hidden) are not in this catalog yet.`}>
          <form action={importSeedProducts} style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <button type="submit" className="btn btn-navy btn-xs" style={{ borderRadius: 8 }}>Import {missing.length} product{missing.length === 1 ? "" : "s"}</button>
            <span style={{ fontSize: 12, color: "#6b7486" }}>Adds them in order with their descriptions and categories; nothing already in the catalog changes. Afterwards press “Refresh prices & photos” to pull photos, prices and ratings from Amazon.</span>
          </form>
        </Card>)}
      <Card title="Add a product" sub={<>Paste an Amazon or Etsy product link. We read the title, photo, price and rating from the listing{paapi ? " (through the Amazon API for Amazon links)" : ""}; Amazon sometimes declines automated requests, so check the card and fill in anything missing. Toggle <strong>Featured</strong> to show it on the homepage row. Etsy shop: <a href={env.etsyShopUrl} target="_blank" rel="noreferrer" style={{ color: "#3f9ad9" }}>{env.etsyShopUrl}</a></>}>
        <form action={addProduct} style={{ display: "grid", gridTemplateColumns: "minmax(0, 2fr) 180px auto auto", gap: 8, alignItems: "center" }}>
          <input name="url" placeholder="Paste an Amazon or Etsy product link…" className="admin-input admin-input-sm" required />
          <input name="category" list="pcats" placeholder="Category" className="admin-input admin-input-sm" /><datalist id="pcats">{categories.map((c) => <option key={c} value={c} />)}</datalist>
          <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12 }}><input type="checkbox" name="featured" />Featured</label>
          <button type="submit" className="btn btn-navy btn-xs" style={{ borderRadius: 8 }}>Fetch & add</button>
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
                  <form action={addAmazonItem} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <input type="hidden" name="asin" value={it.asin} />
                    <input name="category" list="pcats" placeholder="Category" className="admin-input admin-input-sm" style={{ width: 150 }} />
                    <label style={{ display: "flex", gap: 4, alignItems: "center", fontSize: 11 }}><input type="checkbox" name="featured" />Featured</label>
                    <button type="submit" className="btn btn-navy btn-xs" style={{ borderRadius: 8 }}>Add</button>
                  </form>)}
              </div>); })}
          </div>)}
      </Card>
      <Card title="Catalog" sub="Drag to reorder the AIP Products page. Titles and descriptions you type here are kept; the scheduled refresh only updates prices, ratings and photos you haven't replaced.">
        <div className="th" style={{ display: "grid", gridTemplateColumns: COLS, gap: 12, padding: "0 0 8px" }}><span /><span>Product</span><span>Category</span><span>Price</span><span>Rating</span><span>Featured</span><span /></div>
        <Sortable ids={rows.map((r) => r.id)} onReorder={reorderProducts}>
          {rows.map((p) => { const r = asRetailer(p.retailer); const asin = r === "amazon" ? asinFromUrl(p.url) : null; return (
            <div key={p.id} style={{ display: "flex", flexDirection: "column", gap: 6, opacity: p.isActive ? 1 : .55 }}>
              <form action={productAction} encType="multipart/form-data" style={{ display: "grid", gridTemplateColumns: COLS, gap: 12, alignItems: "center" }}>
                <input type="hidden" name="productId" value={p.id} /><input type="hidden" name="op" value="update" />
                <div style={{ width: 56, height: 56, borderRadius: 8, overflow: "hidden", background: "#f2f4f7" }}>{p.imageUrl && <img src={resolveImg(map, p.imageUrl)} alt="" style={{ width: "100%", height: "100%", objectFit: r === "amazon" ? "contain" : "cover" }} />}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                  <input name="title" defaultValue={p.title} className="admin-input admin-input-sm" aria-label="Title" />
                  <span style={{ fontSize: 11, color: "#8c95a8", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "2px 8px", borderRadius: 999, background: "#f2f4f7", color: "#1a2238", fontWeight: 600 }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: RETAILERS[r].dot }} />{RETAILERS[r].name}</span>
                    <a href={p.url} target="_blank" rel="noreferrer" style={{ color: "#3f9ad9" }}>View on {retailerLabel(r)} ↗</a>
                    {r === "amazon" && (asin ? <span>ASIN {asin}{cartOn ? " · cart button on" : ""}</span> : <span style={{ color: "#b45309" }}>no ASIN in this link — paste the full product link (…/dp/…) to get the cart button</span>)}
                    <span>{p.lastSyncedAt ? `synced ${relativeDay(p.lastSyncedAt)}` : "not synced"}</span>
                    <input type="file" name="image_file" accept="image/*" style={{ fontSize: 10, width: 150 }} aria-label="Replace photo" />
                  </span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}><input name="category" defaultValue={p.category} list="pcats" className="admin-input admin-input-sm" aria-label="Category" /><input name="tag" defaultValue={p.tag || ""} placeholder="Tag (e.g. Best seller)" className="admin-input admin-input-sm" aria-label="Tag" /></div>
                <input name="price" defaultValue={p.price} className="admin-input admin-input-sm" aria-label="Price" />
                <div style={{ display: "flex", gap: 4 }}><input name="rating" defaultValue={p.rating} className="admin-input admin-input-sm" style={{ width: 44 }} aria-label="Rating" /><input name="reviews" defaultValue={p.reviews} className="admin-input admin-input-sm" style={{ width: 58 }} aria-label="Reviews" /></div>
                <span style={{ fontSize: 12, fontWeight: 600, color: p.featured ? "#1f6b3f" : "#8c95a8" }}>{p.featured ? "Yes" : "No"}</span>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}><input name="type" defaultValue={p.type} placeholder="Line beside price" className="admin-input admin-input-sm" style={{ width: 120 }} aria-label="Type" /><button type="submit" className="link-btn">Save</button></div>
                <div style={{ gridColumn: "2 / -1", display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.4fr) 110px", gap: 8, alignItems: "start" }}>
                  <input name="url" defaultValue={p.url} className="admin-input admin-input-sm" aria-label="Product link" placeholder="Product link" />
                  <textarea name="description" defaultValue={p.description || ""} rows={2} className="admin-input admin-input-sm" style={{ height: "auto", padding: "6px 10px", lineHeight: 1.45 }} aria-label="Description" placeholder="Short description shown on the product card (optional)" />
                  <select name="retailer" defaultValue={r} className="admin-input admin-input-sm" aria-label="Store">{Object.entries(RETAILERS).map(([k, v]) => <option key={k} value={k}>{v.name}</option>)}</select>
                </div>
              </form>
              <div style={{ display: "flex", gap: 14, justifyContent: "flex-end", fontSize: 11 }}>
                <form action={productAction}><input type="hidden" name="productId" value={p.id} /><input type="hidden" name="op" value="feature" /><button type="submit" className="link-btn">{p.featured ? "Remove from homepage" : "Feature on homepage"}</button></form>
                <form action={productAction}><input type="hidden" name="productId" value={p.id} /><input type="hidden" name="op" value="refresh" /><button type="submit" className="link-btn link-muted">Refresh from {r === "other" ? "the store" : RETAILERS[r].name}</button></form>
                <form action={productAction}><input type="hidden" name="productId" value={p.id} /><input type="hidden" name="op" value="active" /><button type="submit" className="link-btn link-muted">{p.isActive ? "Hide" : "Show"}</button></form>
                <form action={productAction}><input type="hidden" name="productId" value={p.id} /><input type="hidden" name="op" value="delete" /><ConfirmButton message={`Remove “${p.title}” from the catalog?`}>Remove</ConfirmButton></form>
              </div>
            </div>); })}
        </Sortable>
      </Card>
    </AdminShell>
  );
}
