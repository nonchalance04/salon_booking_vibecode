export type ChatReply = {
  mode?: string;
  notice?: string;
  answer: string;
  links: { label: string; href: string }[];
  recommendations?: { id: string; name: string; description: string | null; price: string; durationMinutes: number; reason: string; href: string }[];
};
export type ChatSession = { history: { question: string; reply: ChatReply }[]; draft: string };
type SessionStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export const CHAT_SESSION_KEY = "clique.chatbot.session.v1";
const empty = (): ChatSession => ({ history: [], draft: "" });
const record = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;
const text = (value: unknown, max = 20000): value is string => typeof value === "string" && value.length <= max;
// Only restore local navigation links, never executable or external URLs from storage.
const localHref = (value: unknown): value is string => text(value, 2000) && /^\/(?!\/)/.test(value) && !/[\\\s]/.test(value);
function validReply(value: unknown): value is ChatReply {
  if (!record(value) || !text(value.answer) || !Array.isArray(value.links) || value.links.length > 20) return false;
  if (value.mode !== undefined && !text(value.mode, 100)) return false;
  if (value.notice !== undefined && !text(value.notice)) return false;
  if (!value.links.every(link => record(link) && text(link.label, 1000) && localHref(link.href))) return false;
  return value.recommendations === undefined || (Array.isArray(value.recommendations) && value.recommendations.length <= 50 && value.recommendations.every(service =>
    record(service) && text(service.id, 1000) && text(service.name, 1000) && (service.description === null || text(service.description)) &&
    text(service.price, 100) && Number.isFinite(Number(service.price)) && typeof service.durationMinutes === "number" && Number.isFinite(service.durationMinutes) &&
    text(service.reason) && localHref(service.href)));
}
export function readChatSession(storage?: SessionStorage): ChatSession {
  try {
    const target = storage ?? window.sessionStorage;
    const raw = target.getItem(CHAT_SESSION_KEY);
    if (!raw) return empty();
    if (raw.length > 1000000) throw new Error("Oversized chat session");
    const value: unknown = JSON.parse(raw);
    if (!record(value) || value.version !== 1 || !text(value.draft, 1000) || !Array.isArray(value.history) || value.history.length > 20 ||
      !value.history.every(turn => record(turn) && text(turn.question, 1000) && validReply(turn.reply))) return empty();
    return { history: value.history, draft: value.draft };
  } catch { return empty(); }
}
export function saveChatSession(session: ChatSession, storage?: SessionStorage): void {
  try {
    const target = storage ?? window.sessionStorage;
    if (!session.history.length && !session.draft) target.removeItem(CHAT_SESSION_KEY);
    else target.setItem(CHAT_SESSION_KEY, JSON.stringify({ version: 1, history: session.history.slice(-20), draft: session.draft.slice(0, 1000) }));
  } catch { /* Chat remains usable when browser storage is unavailable or full. */ }
}
