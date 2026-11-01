-- Custom migration: the AIP Products page now shows the listings on the "aip" shelf (Admin → Products → "Shows on"), so every
-- existing listing goes on it and nothing disappears from the page when this version deploys.
UPDATE "products" SET "shelves" = array_append("shelves", 'aip') WHERE NOT ('aip' = ANY("shelves"));