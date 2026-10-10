import { useRef, useState, type FormEvent } from "react";
import { api } from "./api";
import { chatbotHistory } from "./chatbot-history";
import "./chatbot.css";
type Reply = { mode?: string; notice?: string; answer: string; links: { label: string; href: string }[];
  recommendations?: { id: string; name: string; description: string | null; price: string; durationMinutes: number; reason: string; href: string }[] };
const price = (value: string) => new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(Number(value));
export function Chatbot({ embedded = false }: { embedded?: boolean } = {}) {
  const [history, setHistory] = useState<{ question: string; reply: Reply }[]>([]);
  const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const submitting = useRef(false);
  async function ask(question: string) {
    if (!question.trim() || submitting.current) return;
    submitting.current = true;
    setBusy(true); setError("");
    try { const reply = await api<Reply>("/chatbot", { method: "POST", body: JSON.stringify({ message: question, history: chatbotHistory(history) }) }); setHistory(h => [...h.slice(-19), { question, reply }]); setMessage(""); }
    catch (err) { setError(err instanceof Error ? err.message : "Please try again."); }
    finally { submitting.current = false; setBusy(false); }
  }
  function submit(e: FormEvent) { e.preventDefault(); void ask(message); }
  return <section className={embedded ? "container page-section salon-guide" : "workspace-main"}>{!embedded && <a className="wordmark" href="/">CLIQUE<span>SALON</span></a>}<p className="eyebrow">SALON GUIDANCE</p><h1 className="section-title">How can we help?</h1>
    <p>Tell us about your hair, nail, beauty or spa concern, or ask about salon services and policies. AI-assisted answers may ask follow-up questions before recommending a service.</p>
    <p className="muted">When AI consultation is enabled, your messages and recent conversation are sent to Google Gemini. This chat keeps its history only while this page is open. Keep appointment references, guest tokens, verification codes and payment details private.</p>
    <nav className="workspace-tabs" aria-label="Suggested questions">{["Help me choose a service", "Services and prices", "Opening hours", "Booking policies", "How to book", "Reschedule", "Cancel"].map(q => <button key={q} disabled={busy} onClick={() => void ask(q)}>{q}</button>)}</nav>
    {history.length > 0 && <button disabled={busy} onClick={() => { setHistory([]); setMessage(""); setError(""); }}>Start a new conversation</button>}
    <div className="chat-history" aria-live="polite" aria-busy={busy}>{history.map((h, i) => <section className="account-form" key={i}>
      <h2>{h.question}</h2>
      <p className="muted">{h.reply.mode === "gemini" ? "AI-assisted salon consultation" : "Salon guide"}</p>
      {h.reply.notice && <p role="status">{h.reply.notice}</p>}
      <p className="chat-answer">{h.reply.answer}</p>
      {h.reply.recommendations?.map(service => <article className="chat-recommendation" key={service.id}>
        <p className="eyebrow">RECOMMENDED SERVICE</p><h3>{service.name}</h3><p>{service.reason}</p>
        {service.description && <p>{service.description}</p>}
        <p><strong>{price(service.price)}</strong> · Estimated duration: {service.durationMinutes} minutes</p>
        <a className="text-link" href={service.href}>Book this service →</a>
      </article>)}
      <div className="actions">{h.reply.links.map(l => <a key={l.href} href={l.href}>{l.label} →</a>)}</div>
    </section>)}</div>
    {error && <p role="alert" className="error">{error}</p>}
    <form className="account-form" onSubmit={submit}><label>Your question<input value={message} onChange={e => setMessage(e.target.value)} required maxLength={1000} disabled={busy} /></label><button className="primary" disabled={busy}>{busy ? "Looking up salon information…" : "Ask"}</button></form>
    <p><a href="/availability">Find a time and book →</a> · <a href="/appointment">Manage my appointment →</a></p>
  </section>;
}
