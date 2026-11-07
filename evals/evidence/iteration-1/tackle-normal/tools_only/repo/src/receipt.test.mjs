import assert from "node:assert/strict";
import test from "node:test";
import { renderReceipt } from "./receipt.mjs";

test("includes the total", () => {
  const text = renderReceipt({ item: "Tea", total: "$4.00" });
  assert.match(text, /Total: \$4\.00/);
});

test("includes the return line", () => {
  const text = renderReceipt({ item: "Tea", total: "$4.00" });
  assert.equal(text.split("\n").at(-1), "Returns within 14 days with receipt.");
});
