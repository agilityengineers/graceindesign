import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSlackPayload } from "../src/lib/server/slack";

test("builds a Block Kit message with header, fields, buttons and a plain-text fallback", () => {
  const p = buildSlackPayload({
    title: "New consultation request: Jane <Doe>",
    fields: [["Name", "Jane <Doe>"], ["Phone", ""], ["Budget", "$10k–$50k"]],
    buttons: [{ label: "Open in admin", url: "https://site/admin/leads?open=1", primary: true }, { label: "Open Call Flow Tracker", url: "https://site/go/cft/abc" }],
    context: "Consultation form · graceindesign.net",
  });
  const types = p.blocks.map((b) => b.type);
  assert.deepEqual(types, ["header", "section", "actions", "context"]);
  const section = p.blocks[1] as { fields: { text: string }[] };
  assert.equal(section.fields.length, 2, "empty values are dropped");
  assert.match(section.fields[0].text, /Jane &lt;Doe&gt;/);
  const actions = p.blocks[2] as { elements: { url: string; style?: string }[] };
  assert.equal(actions.elements[0].style, "primary");
  assert.equal(actions.elements[1].url, "https://site/go/cft/abc");
  assert.match(p.text, /New consultation request/);
  assert.match(p.text, /https:\/\/site\/go\/cft\/abc/);
});

test("splits more than ten fields across sections (Slack's per-section limit)", () => {
  const fields = Array.from({ length: 13 }, (_, i) => [`k${i}`, `v${i}`] as [string, string]);
  const p = buildSlackPayload({ title: "t", fields });
  const sections = p.blocks.filter((b) => b.type === "section") as { fields: unknown[] }[];
  assert.deepEqual(sections.map((s) => s.fields.length), [10, 3]);
});
