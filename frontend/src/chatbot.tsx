import { useState, type FormEvent } from "react";
import { api } from "./api";
type Reply = { answer: string; links: { label: string; href: string }[] };
export function Chatbot() {
  const [history, setHistory] = useState<{ question: string; reply: Reply }[]>([]);
  const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function ask(question: string) {
    if (!question.trim() || busy) return;
    setBusy(true); setError("");
    try { const reply = await api<Reply>("/chatbot", { method: "POST", body: JSON.stringify({ message: question }) }); setHistory(h => [...h.slice(-19), { question, reply }]); setMessage(""); }
    catch (err) { setError(err instanceof Error ? err.message : "Please try again."); }
    finally { setBusy(false); }
  }
  function submit(e: FormEvent) { e.preventDefault(); void ask(message); }
  return <main className="workspace-main"><a className="wordmark" href="/">CLIQUE<span>SALON</span></a><p className="eyebrow">SALON GUIDANCE</p><h1>How can we help?</h1>
    <p>Ask about our services, hours or booking policies. This guided assistant uses current salon information. Keep your guest token and payment details private.</p>
    <nav className="workspace-tabs" aria-label="Suggested questions">{["Services and prices", "Opening hours", "Booking policies", "How to book", "Reschedule", "Cancel"].map(q => <button key={q} disabled={busy} onClick={() => void ask(q)}>{q}</button>)}</nav>
    <div className="chat-history" aria-live="polite">{history.map((h, i) => <section className="account-form" key={i}><h2>{h.question}</h2><p className="chat-answer">{h.reply.answer}</p><div className="actions">{h.reply.links.map(l => <a key={l.href} href={l.href}>{l.label} →</a>)}</div></section>)}</div>
    {error && <p role="alert" className="error">{error}</p>}
    <form className="account-form" onSubmit={submit}><label>Your question<input value={message} onChange={e => setMessage(e.target.value)} required maxLength={1000} disabled={busy} /></label><button className="primary" disabled={busy}>{busy ? "Looking up salon information…" : "Ask"}</button></form>
    <p><a href="/availability">Find a time and book →</a> · <a href="/appointment">Manage my appointment →</a></p>
  </main>;
}
