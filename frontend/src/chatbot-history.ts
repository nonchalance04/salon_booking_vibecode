export type ConversationTurn = {
  question: string;
  reply: { answer: string; recommendations?: { name: string; reason: string }[] };
};

// Keep only complete recent turns, within the backend's 20,000-character budget.
export function chatbotHistory(turns: ConversationTurn[]) {
  const history: { role: "user" | "model"; text: string }[] = [];
  let length = 0;
  for (const turn of turns.slice(-6).reverse()) {
    const user = turn.question.slice(0, 1000);
    const model = [turn.reply.answer, ...(turn.reply.recommendations ?? []).map(s => `${s.name}: ${s.reason}`)]
      .join("\n").slice(0, 4000);
    if (length + user.length + model.length > 20000) break;
    length += user.length + model.length;
    history.unshift({ role: "user", text: user }, { role: "model", text: model });
  }
  return history;
}
