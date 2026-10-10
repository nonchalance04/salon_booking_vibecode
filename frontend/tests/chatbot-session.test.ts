import assert from "node:assert/strict";
import { test } from "node:test";
import { CHAT_SESSION_KEY, readChatSession, saveChatSession } from "../src/chatbot-session.ts";
function storage() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
}
const turn = { question: "Manage my appointment", reply: { answer: "Open appointment management.", links: [{ label: "Manage appointment", href: "/appointment" }], recommendations: [{ id: "care", name: "Hair care", description: null, price: "900", durationMinutes: 60, reason: "For dryness", href: "/booking?service=care" }] } };
test("chat session restores complete conversation and draft after navigation and clears on new chat", () => {
  const target = storage();
  saveChatSession({ history: [turn], draft: "Can I reschedule?" }, target);
  assert.deepEqual(readChatSession(target), { history: [turn], draft: "Can I reschedule?" });
  saveChatSession({ history: [], draft: "" }, target);
  assert.equal(target.getItem(CHAT_SESSION_KEY), null);
  assert.deepEqual(readChatSession(target), { history: [], draft: "" });
});
test("chat session keeps the latest twenty turns", () => {
  const target = storage();
  saveChatSession({ history: Array.from({ length: 25 }, (_, i) => ({ ...turn, question: String(i) })), draft: "" }, target);
  const restored = readChatSession(target);
  assert.equal(restored.history.length, 20);
  assert.equal(restored.history[0].question, "5");
});
test("invalid or unsafe stored sessions and unavailable storage do not break chat", () => {
  const target = storage();
  for (const value of ["broken JSON", "null", JSON.stringify({ version: 2, history: [], draft: "" }), JSON.stringify({ version: 1, history: [{ ...turn, reply: { ...turn.reply, links: [{ label: "Bad", href: "javascript:alert(1)" }] } }], draft: "" })]) {
    target.setItem(CHAT_SESSION_KEY, value);
    assert.deepEqual(readChatSession(target), { history: [], draft: "" });
  }
  const blocked = { getItem() { throw new Error("Blocked"); }, setItem() { throw new Error("Full"); }, removeItem() { throw new Error("Blocked"); } };
  assert.deepEqual(readChatSession(blocked), { history: [], draft: "" });
  assert.doesNotThrow(() => saveChatSession({ history: [turn], draft: "" }, blocked));
  assert.doesNotThrow(() => saveChatSession({ history: [], draft: "" }, blocked));
});
