import { useEffect, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { api } from "./api";
type Outcome = "SCHEDULED" | "PERFORMED" | "NOT_PERFORMED";
type Receipt = { receiptNumber: string; receiptSnapshot: { customerName: string; bookingCode: string; type: string; amount: string; currency: string; method: string; paidAt: string; externalReference: string; salon: { name: string; address: string; phone: string } | null; services?: { name: string; amount: string }[] } };
type Appointment = { bookingCode: string; status: string; revision: string; completionType: string | null; customer: { firstName: string; lastName: string }; eligibleAppointmentFee: string; carriedFee: boolean; amountDue: string;
  services: { id: string; name: string; staff: string; price: string; outcome: Outcome; actualChargedAmount: string | null }[];
  payments: { id: string; type: string; status: string; amount: string; receipt: Receipt | null }[];
  commissions?: { appointmentServiceId: string; serviceAmount: string; allocatedAppointmentFee: string; commissionBase: string; commissionRate: string; commissionAmount: string }[] };
function ReceiptContent({ receipt }: { receipt: Receipt }) {
  const r = receipt.receiptSnapshot;
  return <><h3>{r.salon?.name ?? "Salon"}</h3>{r.salon && <p>{r.salon.address}<br />{r.salon.phone}</p>}
    <h4>Receipt {receipt.receiptNumber}</h4><p>{r.customerName} · {r.bookingCode}<br />{r.type.replaceAll("_", " ")}</p>
    {r.services && <table><thead><tr><th>Performed service</th><th>PHP</th></tr></thead><tbody>{r.services.map((s, i) => <tr key={i}><td>{s.name}</td><td>{s.amount}</td></tr>)}</tbody></table>}
    <p><strong>Paid: {r.currency} {r.amount}</strong><br />{r.method} · {r.externalReference}<br />{new Date(r.paidAt).toLocaleString("en-PH", { timeZone: "Asia/Manila" })} (Asia/Manila)</p>
  </>;
}
function ReceiptView({ receipt }: { receipt: Receipt }) {
  const [printing, setPrinting] = useState(false);
  useEffect(() => {
    if (!printing) return;
    const done = () => setPrinting(false);
    window.addEventListener("afterprint", done, { once: true });
    window.print();
    return () => window.removeEventListener("afterprint", done);
  }, [printing]);
  return <><article className="settlement-receipt"><ReceiptContent receipt={receipt} />
    <button className="receipt-print" onClick={() => setPrinting(true)}>Print receipt</button>
  </article>{printing && createPortal(<div className="receipt-print-root"><article className="settlement-receipt"><ReceiptContent receipt={receipt} /></article></div>, document.body)}</>;
}

export function SettlementWorkspace({ admin }: { admin: boolean }) {
  const [row, setRow] = useState<Appointment | null>(null); const [outcomes, setOutcomes] = useState<Record<string, Outcome>>({});
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  const key = useRef(crypto.randomUUID());
  function accept(appointment: Appointment) { setRow(appointment); setOutcomes(Object.fromEntries(appointment.services.map(s => [s.id, s.outcome]))); }
  async function act(fn: () => Promise<void>) { setBusy(true); setError(""); setNotice(""); try { await fn(); } catch (err) { setError(err instanceof Error ? err.message : "Please try again."); } finally { setBusy(false); } }
  async function lookup(code: string) { accept((await api<{ appointment: Appointment }>("/settlement/lookup", { method: "POST", body: JSON.stringify({ bookingCode: code }) })).appointment); }
  async function save(event: FormEvent) { event.preventDefault(); if (!row) return; await act(async () => {
    accept((await api<{ appointment: Appointment }>("/settlement/outcomes", { method: "POST", body: JSON.stringify({ bookingCode: row.bookingCode, revision: row.revision, services: row.services.map(s => ({ id: s.id, outcome: outcomes[s.id] })) }) })).appointment);
    setNotice("Service outcomes saved. Review before finalizing.");
  }); }
  const ready = row?.services.every(s => s.outcome !== "SCHEDULED");
  const performed = row?.services.some(s => s.outcome === "PERFORMED");
  const dirty = row?.services.some(s => outcomes[s.id] !== s.outcome);
  return <section><h2>{admin ? "Service outcomes & commissions" : "Service settlement"}</h2><p>{admin ? "Review appointments and correct recorded outcomes before finalization." : "Record service outcomes, then settle the full performed-service charge or close an appointment with no performed services."}</p>
    <form className="account-form" onSubmit={event => { event.preventDefault(); const code = String(new FormData(event.currentTarget).get("code")).trim(); void act(async () => { setRow(null); await lookup(code); key.current = crypto.randomUUID(); }); }}><label>Booking code<input name="code" required maxLength={100} /></label><button disabled={busy}>Find appointment</button></form>
    {error && <p role="alert" className="error">{error}</p>}{notice && <p role="status" className="success">{notice}</p>}
    {row && <div className="account-form"><h3>{row.bookingCode} · {row.customer.firstName} {row.customer.lastName}</h3><p>{row.status} {row.completionType?.replaceAll("_", " ")}</p><button disabled={busy} onClick={() => void act(() => lookup(row.bookingCode))}>Refresh appointment</button>
      <p>Eligible appointment fee: PHP {row.eligibleAppointmentFee}{row.carriedFee ? " (carried from original booking)" : ""}. The service charge is collected separately.</p>
      <form onSubmit={event => void save(event)}><fieldset disabled={busy || row.status !== "CONFIRMED"}><legend>Service outcomes</legend>{row.services.map(s => <label key={s.id}>{s.name} · {s.staff} · PHP {s.price}<select aria-label={`Outcome for ${s.name}`} value={outcomes[s.id]} disabled={admin ? s.outcome === "SCHEDULED" : s.outcome !== "SCHEDULED"} onChange={event => setOutcomes({ ...outcomes, [s.id]: event.target.value as Outcome })}><option value="SCHEDULED" disabled>Select outcome</option><option value="PERFORMED">Performed</option><option value="NOT_PERFORMED">Not performed</option></select></label>)}
        {row.status === "CONFIRMED" && <button disabled={busy || !dirty || Object.values(outcomes).some(o => o === "SCHEDULED")}>Save {admin ? "corrections" : "outcomes"}</button>}</fieldset></form>
      {row.status === "CONFIRMED" && !admin && ready && !dirty && (performed ? <form key={row.bookingCode} onSubmit={event => {
        event.preventDefault(); const data = new FormData(event.currentTarget); if (!window.confirm(`Finalize service payment of PHP ${row.amountDue}? Outcomes and commissions will become final.`)) return;
        void act(async () => { accept((await api<{ appointment: Appointment }>("/settlement/pay", { method: "POST", body: JSON.stringify({ bookingCode: row.bookingCode, revision: row.revision, idempotencyKey: key.current, amount: row.amountDue, currency: "PHP", method: data.get("method"), externalReference: String(data.get("reference")).trim() }) })).appointment); key.current = crypto.randomUUID(); setNotice("Service payment settled and receipt issued."); });
      }}><fieldset disabled={busy}><legend>Full service payment · PHP {row.amountDue}</legend><label>Method<select name="method"><option value="CASH">Cash</option><option value="GCASH">GCash</option><option value="OTHER">Other</option></select></label><label>Original collection / transaction reference<input name="reference" required maxLength={120} /></label><label className="checkbox"><input type="checkbox" required /> I have verified receipt of PHP {row.amountDue}.</label><button className="primary">Finalize received service payment</button></fieldset></form> : <button disabled={busy} onClick={() => {
        if (!window.confirm("Close this appointment with all services not performed? The appointment fee is retained and outcomes become final.")) return;
        void act(async () => { accept((await api<{ appointment: Appointment }>("/settlement/close", { method: "POST", body: JSON.stringify({ bookingCode: row.bookingCode, revision: row.revision }) })).appointment); setNotice("Appointment closed with no performed services."); });
      }}>Finalize no-service closure</button>)}
      {admin && row.commissions && row.commissions.length > 0 && <div className="table-wrap"><h3>Final commissions</h3><table><thead><tr><th>Service</th><th>Service amount</th><th>Fee allocation</th><th>Base</th><th>Rate</th><th>Commission</th></tr></thead><tbody>{row.commissions.map(c => <tr key={c.appointmentServiceId}><td>{row.services.find(s => s.id === c.appointmentServiceId)?.name}</td><td>{c.serviceAmount}</td><td>{c.allocatedAppointmentFee}</td><td>{c.commissionBase}</td><td>{c.commissionRate}</td><td>{c.commissionAmount}</td></tr>)}</tbody></table></div>}
      {row.payments.map(p => <div key={p.id}><p>{p.type.replaceAll("_", " ")} · {p.status} · PHP {p.amount}</p>{p.receipt && <div id={p.receipt.receiptNumber}><ReceiptView receipt={p.receipt} /></div>}</div>)}
    </div>}
  </section>;
}
