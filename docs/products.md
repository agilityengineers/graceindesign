# Products (AIP Products page)

`/healthy-home-resources/aip-products` lists products Grace recommends. Each card links to the store that sells it (Amazon for the curated home-safety picks, Etsy for her own downloads); checkout never happens on the site. Think of the page as a curated shelf in a showroom: the site shows the pick, the store rings it up.

## Where the content lives

| Piece | Where | Edited in |
| --- | --- | --- |
| The listings (link, store, title, description, category, price, photo, tag, line beside the price, rating, featured, visibility, order) | `products` table | Admin → Products |
| Which listings sit on **WELLness-Products** (the product section at the bottom of Healthy Home Resources) | `products.shelves` | Admin → Products: the WELLness-Products box when adding, "Add to / Remove from WELLness-Products" on each card |
| WELLness-Products heading, intro, link and "add all" button | CMS page `hhr`, `product_shelf` block with `shelf: wellness` | Content → Pages → Healthy Home Resources |
| Page copy (header, badge, filter order, disclosure line) | CMS page `aip-products` | Content → Pages → AIP Products |
| Seed list for new databases and for the import below | `src/lib/seed-data/products.ts` | code |

The homepage "featured" row shows the listings marked **Featured** (up to four); the AIP Products carousel shows every visible listing; the grid filters by the categories the listings actually use; WELLness-Products shows the visible listings on the `wellness` shelf.

## WELLness-Products on Healthy Home Resources

The bottom of `/healthy-home-resources` carries a **WELLness-Products** section (`#wellness`): a `product_shelf` block that shows the catalog listings sitting on the `wellness` shelf. Think of the catalog as the stockroom and the shelf as one display table: every listing is in the stockroom (the AIP Products page lists them all), some are also on the table, and the admin decides which.

| To… | Do this |
| --- | --- |
| Put a new Amazon product on it | Admin → Products → paste the link → **Fetch & add**. The WELLness-Products box is ticked by default; untick it to keep the product off the section. The same box sits on the "Search Amazon" results. |
| Put an existing listing on it, or take one off | On the listing's card: **Add to WELLness-Products** / **Remove from WELLness-Products**. |
| Hide a product everywhere | **Hide** on the card (hidden listings never appear, on any shelf or page). **Remove** deletes it from the catalog. |
| Change the order | Drag the cards; the section follows the catalog order. |
| Change the heading, intro, link or the "add all" button | Content → Pages → Healthy Home Resources → the `product shelf` block. Its `shelf` field (`wellness`) is what ties it to the shelf; leave it as is. |

The section hides itself while nothing is on the shelf, so an empty shelf never shows an empty heading; the status strip at the top of Admin → Products says how many listings are on it. Fresh databases start the shelf with the seeded Amazon picks; the import below does the same for an existing database.

Shelves are declared in `src/lib/shelves.ts`. Adding another (say, a Caribbean picks shelf) is one entry there plus a `product_shelf` block carrying its key; the admin's checkboxes, card links and counts follow automatically.

## Bringing over the previous site's products

The previous site listed its Amazon products at https://graceindesign.funnelpages.com/products. Two ways to carry them across:

1. **In the admin** (a few products): Admin → Products → paste each Amazon link → "Fetch & add". Amazon sometimes declines automated requests; when it does, type the title, price and description and upload a photo on the card.
2. **In code** (the whole list at once): add each product to `PRODUCTS` in `src/lib/seed-data/products.ts` (`url`, `title`, `description`, `category`, `image`, optional `tag`/`price`), then run the import below. Fresh databases pick the list up from `npm run db:seed`.

## Rolling out to an existing database

```bash
npm run db:migrate                                  # adds products.retailer + products.description (0003) and products.shelves (0004)
npm run content:products -- --dry-run               # preview: every listing it would add, every text change, the WELLness-Products step
npm run content:products -- --images                # add the listings, self-host their photos, update the page wording, add WELLness-Products

# production: Replit → Database → Production → connection string
DATABASE_URL='postgresql://…' npm run db:migrate
DATABASE_URL='postgresql://…' npm run content:products -- --dry-run
DATABASE_URL='postgresql://…' npm run content:products -- --images
```

The import is idempotent: listings are matched by URL and only added when missing; the header, badge, filters, Healthy Home Resources card and meta description change only where they still carry the old "our Etsy shop" wording; the WELLness-Products block is added to the bottom of Healthy Home Resources once (skipped when a `product_shelf` block on the `wellness` shelf is already there); and the shelf is stocked with every Amazon listing in the catalog only when nothing is on it yet, so the admin's choices survive a rerun. Add `--refresh` to read the live price, photo and rating from each store page as the listings are added. The script stops with a clear message if migration 0004 has not been applied.

Afterwards, open Admin → Products: check photos and prices, drag to order the page, feature up to four listings for the homepage row, and take any listing off WELLness-Products that should not be there.

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

**Putting the shop anywhere.** Content → Pages → any block-based page → add a **product shelf** block. Its fields: `eyebrow`, `title`, `body`, `shelf` (a named shelf such as `wellness`: only the listings the admin put on it; empty = the whole catalog), `categories` (empty = every category), `featuredOnly`, `limit` (`0` = no limit), `linkLabel`/`linkHref`, `cartAll` + `cartAllLabel` (the one-click "add all" button), `disclosure`, `tone` (`white` for a white background). A block with a `shelf` gets that key as its anchor (`/healthy-home-resources#wellness`). The AIP Products page keeps its own header, carousel and filterable grid; the homepage keeps its featured row. Service landing pages are rendered from the services table rather than blocks, so a shelf there is a small follow-up.

**Short links.** `amzn.to` and `a.co` links hide the ASIN, so they get the tag only through Amazon's own redirect and no cart button. Paste the full product link (…/dp/ASIN) instead; the admin flags any Amazon listing without one.

## Notes

- **Amazon and automated requests.** Amazon's product pages answer bots inconsistently (a bot-check page or HTTP 503). "Refresh from Amazon" and the scheduled job try again later; every field on the card is editable in the meantime.
- **What the scheduled refresh touches.** The `etsy` cron job (part of `all`, every 15 minutes) refreshes prices, ratings and photos that were not uploaded here, for every store. Titles and descriptions are never overwritten automatically; the per-listing "Refresh" button is the explicit way to re-read them.
- **Affiliate links.** If the Amazon links carry an Associates tag, put the required disclosure in the `disclosure` field of the page's product grid block (Content → Pages → AIP Products); it prints in small type under the grid. Amazon links already carry `rel="sponsored"`.
- **Photos.** Amazon's CDN URLs work as-is; `--images` or an upload on the card stores a copy in the media library so the site does not depend on them.
