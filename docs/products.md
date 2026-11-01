# Products (AIP Products page)

`/healthy-home-resources/aip-products` lists products Grace recommends. Each card links to the store that sells it (Amazon for the curated home-safety picks, Etsy for her own downloads); checkout never happens on the site. Think of the page as a curated shelf in a showroom: the site shows the pick, the store rings it up.

## The process: from merge to products on the page

Think of it as three doors, each opened once. Nothing shows on the live site until all three are open.

1. **Merge the pull request.** Replit's post-merge hook installs dependencies and runs `db:setup --if-empty`, which applies migration 0003 (the two new product columns) to the workspace database.
2. **Publish.** The publish flow builds the app and carries the schema change to the production database (this project does not run migrations in the production build; see `replit.md`).
3. **Import the list.** Open Admin → Products on the published site. A card at the top says how many of the previous site's listings are missing; press **Import**. The listings appear on `/healthy-home-resources/aip-products` immediately, with the affiliate disclosure under the grid. Then press **Refresh prices & photos** to pull each product's photo, price and rating from Amazon (Amazon occasionally declines automated requests; press again later or upload a photo on the card).

Do the same in the workspace to see it there. The terminal route (`npm run content:products`) does exactly what the button does.

**Adding or changing products afterwards** never needs a deploy: Admin → Products → paste an Amazon link (or search Amazon once the API keys are set) → the card appears on the page. Drag to reorder, "Feature on homepage" for the homepage row, "Hide" to take one off the page.

**Tracking id.** Enter the Associates tracking id once in Site settings → Amazon shop. From then on every Amazon link carries it and the "Add to Amazon cart" buttons appear on every listing whose link contains an ASIN (all fifteen).

## Where the content lives

| Piece | Where | Edited in |
| --- | --- | --- |
| The listings (link, store, title, description, category, price, photo, tag, line beside the price, rating, featured, visibility, order) | `products` table | Admin → Products |
| Page copy (header, badge, filter order, disclosure line) | CMS page `aip-products` | Content → Pages → AIP Products |
| Seed list for new databases and for the import below | `src/lib/seed-data/products.ts` | code |

The homepage "featured" row shows the listings marked **Featured** (up to four); the AIP Products carousel shows every visible listing; the grid filters by the categories the listings actually use.

## The previous site's list

The previous site's "Recommended Products" page (graceindesign.funnelpages.com/products) is carried in `src/lib/seed-data/products.ts`: fifteen Amazon listings in the original order (night lights, grab bars, a transfer bench, a bed rail, a fire blanket, a weather radio, a companion plush and two books), each with a condensed description, a category and the Amazon product page with its ASIN. Fourteen links point at the exact product page; the hand-crank radio links to the closest match (several near-identical listings exist), so swap the link on its card if a different one was meant. The affiliate disclosure from that page is the grid's `disclosure` text. The four fitness items sent during the migration (water bottle, two resistance band sets, Amazfit watch) are in the seed too but hidden; "Show" on their cards puts them on the page.

Fresh databases get the list from `npm run db:seed`; existing ones from the Import button or `npm run content:products`.

## Rolling out to an existing database

```bash
npm run db:migrate                                  # adds products.retailer and products.description (migration 0003)
npm run content:products -- --dry-run               # preview: lists every listing it would add and every text change
npm run content:products -- --images                # add the listings, self-host their photos, update the page wording

# production: Replit → Database → Production → connection string
DATABASE_URL='postgresql://…' npm run db:migrate
DATABASE_URL='postgresql://…' npm run content:products -- --dry-run
DATABASE_URL='postgresql://…' npm run content:products -- --images
```

The import is idempotent: listings are matched by URL and only added when missing; the header, badge, filters, Healthy Home Resources card and meta description change only where they still carry the old "our Etsy shop" wording. Add `--refresh` to read the live price, photo and rating from each store page as the listings are added.

Afterwards, open Admin → Products: check photos and prices, drag to order the page, and feature up to four listings for the homepage row.

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

**Putting the shop anywhere.** Content → Pages → any block-based page → add a **product shelf** block. Its fields: `eyebrow`, `title`, `body`, `categories` (empty = every visible product), `featuredOnly`, `limit`, `linkLabel`/`linkHref`, `cartAll` + `cartAllLabel` (the one-click "add all" button), `disclosure`, `tone` (`white` for a white background). The AIP Products page keeps its own header, carousel and filterable grid; the homepage keeps its featured row. Service landing pages are rendered from the services table rather than blocks, so a shelf there is a small follow-up.

**Short links.** `amzn.to` and `a.co` links hide the ASIN, so they get the tag only through Amazon's own redirect and no cart button. Paste the full product link (…/dp/ASIN) instead; the admin flags any Amazon listing without one.

## Notes

- **Amazon and automated requests.** Amazon's product pages answer bots inconsistently (a bot-check page or HTTP 503). "Refresh from Amazon" and the scheduled job try again later; every field on the card is editable in the meantime.
- **What the scheduled refresh touches.** The `etsy` cron job (part of `all`, every 15 minutes) refreshes prices, ratings and photos that were not uploaded here, for every store. Titles and descriptions are never overwritten automatically; the per-listing "Refresh" button is the explicit way to re-read them.
- **Affiliate links.** If the Amazon links carry an Associates tag, put the required disclosure in the `disclosure` field of the page's product grid block (Content → Pages → AIP Products); it prints in small type under the grid. Amazon links already carry `rel="sponsored"`.
- **Photos.** Amazon's CDN URLs work as-is; `--images` or an upload on the card stores a copy in the media library so the site does not depend on them.
