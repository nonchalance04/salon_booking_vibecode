import assert from "node:assert/strict";
import { test } from "node:test";
import { chatbotHistory } from "../src/chatbot-history.ts";

test("chat history preserves complete recent turns and recommended service context", () => {
  const result = chatbotHistory([{ question: "dry hair", reply: { answer: "Tell me more", recommendations: [{ name: "Hair Treatment", reason: "For dryness" }] } }]);
  assert.deepEqual(result, [{ role: "user", text: "dry hair" }, { role: "model", text: "Tell me more\nHair Treatment: For dryness" }]);
});
test("long conversations respect backend bounds without orphaning model replies", () => {
  const turns = Array.from({ length: 20 }, (_, i) => ({ question: `${i}: ${"q".repeat(1000)}`, reply: { answer: "a".repeat(8000) } }));
  const result = chatbotHistory(turns);
  assert.ok(result.length <= 12);
  assert.ok(result.reduce((sum, item) => sum + item.text.length, 0) <= 20000);
  assert.match(result.at(-2)!.text, /^19:/);
  result.forEach((item, index) => assert.equal(item.role, index % 2 === 0 ? "user" : "model"));
  assert.deepEqual(chatbotHistory([]), []);
});
