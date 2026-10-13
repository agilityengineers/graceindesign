import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveBaseUrl } from "../src/lib/base-url";

test("development uses its own preview instead of inherited canonical settings", () => {
  assert.equal(resolveBaseUrl({
    NODE_ENV: "development", BASE_URL: "https://main.example",
    REPLIT_DEV_DOMAIN: "fork.example", REPLIT_DOMAINS: "other.example",
  }), "https://fork.example");
});
test("production preserves the configured canonical origin", () => {
  assert.equal(resolveBaseUrl({
    NODE_ENV: "production", BASE_URL: "https://main.example/",
    REPLIT_DEV_DOMAIN: "fork.example",
  }), "https://main.example");
});
test("local development and deployment domain fallbacks remain supported", () => {
  assert.equal(resolveBaseUrl({ BASE_URL: "http://localhost:5000/" }), "http://localhost:5000");
  assert.equal(resolveBaseUrl({ NODE_ENV: "production", REPLIT_DOMAINS: "main.example,other.example" }), "https://main.example");
  assert.equal(resolveBaseUrl({}), "http://localhost:5000");
});
