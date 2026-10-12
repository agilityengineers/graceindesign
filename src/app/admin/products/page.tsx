import { asc } from "drizzle-orm";
import { requireArea } from "@/lib/auth/session";
import { db, products } from "@/lib/db";
import { getMediaMap, resolveImg } from "@/lib/data/media";
import { env } from "@/lib/env";
import AdminShell from "@/components/admin/AdminShell";
import { Card } from "@/components/admin/ui";
import Toast from "@/components/admin/Toast";
import ConfirmButton from "@/components/admin/Confirm";
import Sortable from "@/components/admin/Sortable";
import { addProduct, productAction, syncProductsNow, reorderProducts } from "@/lib/actions/catalog";
import { relativeDay } from "@/lib/utils";

export const metadata = { title: "Etsy products" };
export const dynamic = "force-dynamic";
const CATEGORIES = ["Bathroom safety", "Lighting", "Mobility", "Kitchen", "Guides & checklists", "Printables", "Home office", "Uncategorized"];

export default async function ProductsAdmin() {
  const user = await requireArea("products");
  const [rows, map] = await Promise.all([db.select().from(products).orderBy(asc(products.sort), asc(products.id)), getMediaMap()]);
  const featured = rows.filter((p) => p.featured && p.isActive).length;
  return (
    <AdminShell user={user} active="products" title="Etsy products" subtitle={`${rows.length} listings · ${featured} featured on the homepage`} actions={<form action={syncProductsNow}><button type="submit" className="btn btn-ghost btn-sm" style={{ height: 40, borderRadius: 10 }}>Refresh all from Etsy</button></form>}>
      <Toast />
      <Card title="Add an Etsy listing" sub={<>We pull the title, photo, price and rating from Etsy. Toggle <strong>Featured</strong> to show it on the homepage row. Shop: <a href={env.etsyShopUrl} target="_blank" rel="noreferrer" style={{ color: "#3f9ad9" }}>{env.etsyShopUrl}</a></>}>
        <form action={addProduct} style={{ display: "grid", gridTemplateColumns: "minmax(0, 2fr) 180px auto auto", gap: 8, alignItems: "center" }}>
          <input name="etsyUrl" placeholder="Paste an Etsy listing URL…" className="admin-input admin-input-sm" required />
          <input name="category" list="pcats" placeholder="Category" className="admin-input admin-input-sm" /><datalist id="pcats">{CATEGORIES.map((c) => <option key={c} value={c} />)}</datalist>
          <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12 }}><input type="checkbox" name="featured" />Featured</label>
          <button type="submit" className="btn btn-navy btn-xs" style={{ borderRadius: 8 }}>Fetch & add</button>
        </form>
      </Card>
      <Card title="Catalog" sub="Drag to reorder the AIP Products page">
        <div className="th" style={{ display: "grid", gridTemplateColumns: "56px minmax(0, 2fr) 150px 90px 110px 70px auto", gap: 12, padding: "0 0 8px" }}><span /><span>Product</span><span>Category</span><span>Price</span><span>Rating</span><span>Featured</span><span /></div>
        <Sortable ids={rows.map((r) => r.id)} onReorder={reorderProducts}>
          {rows.map((p) => (
            <div key={p.id} style={{ display: "flex", flexDirection: "column", gap: 6, opacity: p.isActive ? 1 : .55 }}>
              <form action={productAction} encType="multipart/form-data" style={{ display: "grid", gridTemplateColumns: "56px minmax(0, 2fr) 150px 90px 110px 70px auto", gap: 12, alignItems: "center" }}>
                <input type="hidden" name="productId" value={p.id} /><input type="hidden" name="op" value="update" />
                <div style={{ width: 56, height: 56, borderRadius: 8, overflow: "hidden", background: "#f2f4f7" }}>{p.imageUrl && <img src={resolveImg(map, p.imageUrl)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}><input name="title" defaultValue={p.title} className="admin-input admin-input-sm" aria-label="Title" /><span style={{ fontSize: 11, color: "#8c95a8" }}><a href={p.etsyUrl} target="_blank" rel="noreferrer" style={{ color: "#3f9ad9" }}>View on Etsy ↗</a>{p.lastSyncedAt ? ` · synced ${relativeDay(p.lastSyncedAt)}` : " · not synced"} · <input type="file" name="image_file" accept="image/*" style={{ fontSize: 10, width: 150 }} /></span></div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}><input name="category" defaultValue={p.category} list="pcats" className="admin-input admin-input-sm" aria-label="Category" /><input name="tag" defaultValue={p.tag || ""} placeholder="Tag (e.g. Best seller)" className="admin-input admin-input-sm" aria-label="Tag" /></div>
                <input name="price" defaultValue={p.price} className="admin-input admin-input-sm" aria-label="Price" />
                <div style={{ display: "flex", gap: 4 }}><input name="rating" defaultValue={p.rating} className="admin-input admin-input-sm" style={{ width: 44 }} aria-label="Rating" /><input name="reviews" defaultValue={p.reviews} className="admin-input admin-input-sm" style={{ width: 58 }} aria-label="Reviews" /></div>
                <span style={{ fontSize: 12, fontWeight: 600, color: p.featured ? "#1f6b3f" : "#8c95a8" }}>{p.featured ? "Yes" : "No"}</span>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}><input name="type" defaultValue={p.type} className="admin-input admin-input-sm" style={{ width: 120 }} aria-label="Type" /><button type="submit" className="link-btn">Save</button></div>
              </form>
              <div style={{ display: "flex", gap: 14, justifyContent: "flex-end", fontSize: 11 }}>
                <form action={productAction}><input type="hidden" name="productId" value={p.id} /><input type="hidden" name="op" value="feature" /><button type="submit" className="link-btn">{p.featured ? "Remove from homepage" : "Feature on homepage"}</button></form>
                <form action={productAction}><input type="hidden" name="productId" value={p.id} /><input type="hidden" name="op" value="refresh" /><button type="submit" className="link-btn link-muted">Refresh from Etsy</button></form>
                <form action={productAction}><input type="hidden" name="productId" value={p.id} /><input type="hidden" name="op" value="active" /><button type="submit" className="link-btn link-muted">{p.isActive ? "Hide" : "Show"}</button></form>
                <form action={productAction}><input type="hidden" name="productId" value={p.id} /><input type="hidden" name="op" value="delete" /><ConfirmButton message={`Remove “${p.title}” from the catalog?`}>Remove</ConfirmButton></form>
              </div>
            </div>))}
        </Sortable>
      </Card>
    </AdminShell>
  );
}
