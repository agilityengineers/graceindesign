import { test } from "node:test";
import assert from "node:assert/strict";
import { DevLinkStore, DEV_LINK_TTL_SECONDS } from "../src/lib/auth/dev-link-store";

test("opaque handles isolate browsers and expire even if cookies are retained", () => {
  const store = new DevLinkStore();
  const handle = store.put("synthetic-link", 100);
  assert.match(handle, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(store.get(handle, 100), "synthetic-link");
  assert.equal(store.get(undefined, 100), null);
  assert.equal(store.get("forged", 100), null);
  assert.equal(store.get(handle, 100 + DEV_LINK_TTL_SECONDS * 1000), null);
});

test("replacement, eviction and process restart fail closed", () => {
  const store = new DevLinkStore(1);
  const first = store.put("first");
  const second = store.put("second");
  assert.equal(store.get(first), null);
  assert.equal(store.get(second), "second");
  assert.equal(new DevLinkStore().get(second), null);
  store.delete(second);
  assert.equal(store.get(second), null);
});
