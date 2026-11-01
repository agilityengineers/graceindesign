# Products (AIP Products page)

`/healthy-home-resources/aip-products` lists products Grace recommends. Each card links to the store that sells it (Amazon for the curated home-safety picks, Etsy for her own downloads); checkout never happens on the site. Think of the page as a curated shelf in a showroom: the site shows the pick, the store rings it up.

## Where the content lives

| Piece | Where | Edited in |
| --- | --- | --- |
| The listings (link, store, title, description, category, price, photo, tag, line beside the price, rating, featured, visibility, order) | `products` table | Admin → Products |
| Where each listing shows: the **AIP Products** page, **WELLness-Products** (bottom of Healthy Home Resources), the homepage featured row | `products.shelves` (`aip`, `wellness`) and `products.featured` | Admin → Products: the **Shows on** boxes when adding a product and on each card |
| WELLness-Products heading, intro, link and "add all" button | CMS page `hhr`, `product_shelf` block with `shelf: wellness` | Content → Pages → Healthy Home Resources |
| Page copy (header, badge, filter order, disclosure line) | CMS page `aip-products` | Content → Pages → AIP Products |
| Seed list for new databases and for the import below | `src/lib/seed-data/products.ts` | code |

The homepage "featured" row shows the listings marked **Homepage (featured row)** (up to four); the AIP Products carousel and grid show the listings on the `aip` shelf, and the grid filters by the categories those listings actually use; WELLness-Products shows the listings on the `wellness` shelf. Hidden listings appear nowhere.

## Where a product shows: shelves

Think of the catalog as the stockroom and each page section as a display table. Every listing is in the stockroom; the **Shows on** boxes in Admin → Products decide which tables it sits on:

| Box | Where it shows | Empty shelf |
| --- | --- | --- |
| **AIP Products** | the carousel and grid on `/healthy-home-resources/aip-products` | the page shows its "new picks are being added" message |
| **WELLness-Products** | the section at the bottom of `/healthy-home-resources` (`#wellness`) | the section hides itself, so no empty heading |
| **Homepage (featured row)** | the featured row on the homepage (first four) | the row hides itself |

Both shelf boxes are ticked by default when you add a product (one paste puts an Amazon product on the AIP Products page *and* in WELLness-Products); untick either, or untick it later on the card and **Save**. Each box says where it puts the product (hover it, or read the line under the boxes on the add form). The strip at the top of Admin → Products counts what is on each shelf and links to each page and to its copy in Content → Pages.

**Showing a shelf on another page** (say, WELLness-Products on the WELLness Resources page): Content → Pages → that page → **Add block** → “WELLness-Products section” (or “AIP Products section”). The block arrives with its heading, intro, link and "add all" button filled in; edit them if you like, drag the block where it belongs, then **Publish**. In the block editor, **Which products** is a dropdown: every visible product, AIP Products, or WELLness-Products, so no block internals are needed. The same products appear wherever that shelf is shown; ticking or unticking a product in Admin → Products changes every copy at once.

Shelves are declared in `src/lib/shelves.ts`; adding another (say, a Caribbean picks shelf) is one entry there, and the boxes, counts, strip and the "… section" entries in the Add block menu follow automatically.

## Adding and editing a product

**Add a product** takes the product link, the **Store** (detected from the link unless you pick Amazon, Etsy or Other store yourself), a category, the **Shows on** boxes and an optional photo. "Fetch & add" reads the title, photo, price, rating and description from the store, then opens the card for checking. Every card is a labeled form: title, store, link, category, tag (the small badge on the photo), price, rating, reviews, the line beside the price, the description shown on the card, the photo and the Shows on boxes, with **Save** at the end. Under each card: view on the store, refresh from the store, hide/show, remove.

**Photos.** The store's photo is read automatically when a product is added, when its link is changed, when you press "Refresh from …" and by the scheduled refresh: through the Product Advertising API for Amazon when the keys are set, otherwise from the public listing page, and for Amazon items whose page declined the request, from Amazon's image-by-ASIN endpoint (adopted only when it answers with a real image). To use a different photo, **Upload from computer** or **Choose from library** on the card (or attach one when adding); a photo chosen that way is never replaced by a refresh. A card with no photo says so under the form.

**Prices.** The Price field is empty until a price is known (the store sets it on add/refresh, or type one such as `$24.99`); the card on the site shows no price while it is empty.

## Bringing over the previous site's products

The previous site listed its Amazon products at https://graceindesign.funnelpages.com/products. Two ways to carry them across:

1. **In the admin** (a few products): Admin → Products → paste each Amazon link → "Fetch & add". Amazon sometimes declines automated requests; when it does, type the title, price and description and upload a photo on the card.
2. **In code** (the whole list at once): add each product to `PRODUCTS` in `src/lib/seed-data/products.ts` (`url`, `title`, `description`, `category`, `image`, optional `tag`/`price`), then run the import below. Fresh databases pick the list up from `npm run db:seed`.

## Rolling out to an existing database

```bash
npm run db:migrate                                  # 0003 retailer + description, 0004 products.shelves, 0006 every listing onto the AIP Products shelf
npm run content:products -- --dry-run               # preview: every listing it would add, every text change, the shelf steps
npm run content:products -- --images                # add the listings, self-host their photos, update the page wording, point the AIP blocks at the shelf, add WELLness-Products

# production: Replit → Database → Production → connection string
DATABASE_URL='postgresql://…' npm run db:migrate
DATABASE_URL='postgresql://…' npm run content:products -- --dry-run
DATABASE_URL='postgresql://…' npm run content:products -- --images
```

The import is idempotent: listings are matched by URL and only added when missing; the header, badge, filters, Healthy Home Resources card and meta description change only where they still carry the old "our Etsy shop" wording; the AIP Products grid and carousel get `shelf: "aip"` only when they have no `shelf` yet; every listing is put on the AIP Products shelf if migration 0006 somehow left one off; the WELLness-Products block is added to the bottom of Healthy Home Resources once (skipped when a `product_shelf` block on the `wellness` shelf is already there); and that shelf is stocked with every Amazon listing in the catalog only when nothing is on it yet, so the admin's choices survive a rerun. Add `--refresh` to read the live price, photo and rating from each store page as the listings are added. The script stops with a clear message if migrations 0004/0006 have not been applied.

Afterwards, open Admin → Products: check photos and prices, drag to order the pages, and use the **Shows on** boxes to decide where each listing appears.

## Amazon shop: tracking id, cart buttons, live search

Amazon has no embeddable cart, but it has the next best thing: an Associates **Add to Cart** link that drops one or more items straight into the visitor's Amazon cart, on Amazon, where they check out as usual. The site uses that everywhere a product appears.

| Capability | What turns it on | Where it shows |
| --- | --- | --- |
| Tracking id on every Amazon link | Associates tracking id (Site settings → Amazon shop, or `AMAZON_ASSOCIATE_TAG`) | every product card, carousel and shelf |
| "Add to Amazon cart" button per product | the tracking id + an ASIN in the product link (`…/dp/B0…`) + the "cart buttons" switch | product cards on every page |
| "Add all to your Amazon cart" (one click, several items) | same, two or more Amazon items in the block | AIP Products grid header and product shelves |
| Search Amazon from the admin, add items with live title, photo, price, rating | `AMAZON_PAAPI_ACCESS_KEY` + `AMAZON_PAAPI_SECRET_KEY` (Product Advertising API 5) | Admin → Products → Search Amazon |
| Prices and ratings refreshed through the API (batches of ten) | same keys | scheduled `etsy` job, "Refresh" buttons |

The Product Advertising API needs an Associates account that qualifies for it (Amazon grants access after the account has referred qualifying sales; see Associates Central → Tools → Product Advertising API). Without the keys everything else still works: links carry the tag, cart buttons appear, and listing details are read from the public product page.

**Putting the shop anywhere.** Content → Pages → any block-based page → Add block → a ready-made “WELLness-Products section” / “AIP Products section”, or a plain **product shelf** block. Its fields: `eyebrow`, `title`, `body`, `shelf` (`aip` or `wellness`: only the listings ticked for that shelf; empty = the whole catalog), `categories` (empty = every category), `featuredOnly`, `limit` (`0` = no limit), `linkLabel`/`linkHref`, `cartAll` + `cartAllLabel` (the one-click "add all" button), `disclosure`, `tone` (`white` for a white background). A block with a `shelf` gets that key as its anchor (`/healthy-home-resources#wellness`). The AIP Products page keeps its own header, carousel and filterable grid; the homepage keeps its featured row. Service landing pages are rendered from the services table rather than blocks, so a shelf there is a small follow-up.

**Short links.** `amzn.to` and `a.co` links hide the ASIN, so they get the tag only through Amazon's own redirect and no cart button. Paste the full product link (…/dp/ASIN) instead; the admin flags any Amazon listing without one.

## Notes

- **Amazon and automated requests.** Amazon's product pages answer bots inconsistently (a bot-check page or HTTP 503). "Refresh from Amazon" and the scheduled job try again later; every field on the card is editable in the meantime.
- **What the scheduled refresh touches.** The `etsy` cron job (part of `all`, every 15 minutes) refreshes prices, ratings and photos that were not uploaded here, for every store. Titles and descriptions are never overwritten automatically; the per-listing "Refresh" button is the explicit way to re-read them.
- **Affiliate links.** If the Amazon links carry an Associates tag, put the required disclosure in the `disclosure` field of the page's product grid block (Content → Pages → AIP Products); it prints in small type under the grid. Amazon links already carry `rel="sponsored"`.
- **Photos.** Amazon's CDN URLs work as-is; `--images` or an upload on the card stores a copy in the media library so the site does not depend on them. The image-by-ASIN fallback (`amazonImageByAsin` in `src/lib/server/listings.ts`) is an unofficial Amazon endpoint: if Amazon retires it the fallback simply finds nothing, and the Product Advertising API remains the reliable source.
