import { useEffect, useRef, useState, type FormEvent } from "react";
import { api } from "./api";
import { AppointmentManagement } from "./appointment-management";
import { FeePaymentControls, FeePaymentHistory, type FeePayment } from "./payments";
export type BookingPlan = { date: string; startAt: string; services: ({ serviceId: string; assignmentMode: "ANY_AVAILABLE" } | { serviceId: string; assignmentMode: "SPECIFIC"; staffId: string })[] };
export type Appointment = {
  rescheduleCount: number; cancelledAt: string | null; noShowAt: string | null; noShowGraceExpiresAt: string | null;
  recoveryAppointment: { bookingCode: string } | null; carriedAppointmentFeePaymentId: string | null;
  bookingPolicyVersion: { maxReschedules: number; rescheduleCutoffHours: number; cancellationCutoffHours: number; noShowGraceHours: number };
  payments: FeePayment[];
  bookingCode: string; status: string; startAt: string; endAt: string; holdExpiresAt: string | null;
  appointmentFeeAmount: string; serverTime: string; timeZone: string;
  customer: { firstName: string; lastName: string };
  appointmentServices: { id: string; serviceId: string; staffId: string; sequenceNo: number; serviceNameSnapshot: string; priceSnapshot: string; scheduledStartAt: string; scheduledEndAt: string; staff: { firstName: string; lastName: string } }[];
};
type BookingResult = { appointment: Appointment; guestToken: string };
const message = (error: unknown) => error instanceof Error ? error.message : "Please try again.";
export function BookingForm({ plan, onBusy, onBooked }: { plan: BookingPlan; onBusy: (busy: boolean) => void; onBooked: (result: BookingResult) => void }) {
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending.current) return;
    const data = new FormData(event.currentTarget);
    sending.current = true; setBusy(true); onBusy(true); setError("");
    try {
      const email = String(data.get("email")).trim();
      const result = await api<BookingResult>("/appointments", { method: "POST", body: JSON.stringify({ ...plan,
        customer: { firstName: String(data.get("firstName")).trim(), lastName: String(data.get("lastName")).trim(), phone: String(data.get("phone")).trim(), ...(email ? { email } : {}) },
      }) });
      onBooked(result);
    } catch (err) { setError(message(err)); }
    finally { sending.current = false; setBusy(false); onBusy(false); }
  }
  return <form className="account-form" onSubmit={submit}><h3>Your contact details</h3>
    <fieldset disabled={busy}><div className="form-grid">
      <label>First name<input name="firstName" required maxLength={100} autoComplete="given-name" /></label>
      <label>Last name<input name="lastName" required maxLength={100} autoComplete="family-name" /></label>
      <label>Phone<input name="phone" type="tel" required minLength={5} maxLength={32} autoComplete="tel" /></label>
      <label>Email (optional)<input name="email" type="email" maxLength={254} autoComplete="email" /></label>
    </div></fieldset>
    <p>Submitting reserves a temporary hold. Your booking is confirmed only after appointment-fee payment.</p>
    <p className="muted">Availability, fees, and Any Available staff assignments are checked again when you submit.</p>
    {error && <p role="alert" className="error">{error}</p>}
    <button className="primary" disabled={busy}>{busy ? "Reserving your visit…" : "Reserve a temporary hold"}</button>
  </form>;
}
export function AppointmentView({ initial, token: initialToken }: { initial: Appointment; token: string }) {
  const [appointment, setAppointment] = useState(initial);
  const [token, setToken] = useState(initialToken);
  const [error, setError] = useState("");
  const [remaining, setRemaining] = useState(0);
  // Monotonic elapsed time avoids relying on the customer's wall clock.
  const clock = useRef({ received: performance.now(), server: Date.parse(initial.serverTime) });
  const refreshBusy = useRef(false);
  const activeCode = useRef(appointment.bookingCode); activeCode.current = appointment.bookingCode;
  async function refresh() {
    if (refreshBusy.current) return;
    refreshBusy.current = true;
    try {
      const response = await api<{ appointment: Appointment }>("/appointments/access", { method: "POST", body: JSON.stringify({ bookingCode: appointment.bookingCode, token }) });
      if (response.appointment.bookingCode !== activeCode.current) return;
      clock.current = { received: performance.now(), server: Date.parse(response.appointment.serverTime) };
      setAppointment(response.appointment); setError("");
    } catch (err) { setError(message(err)); }
    finally { refreshBusy.current = false; }
  }
  useEffect(() => {
    const tick = () => setRemaining(appointment.holdExpiresAt ? Math.max(0, Math.ceil((Date.parse(appointment.holdExpiresAt) - clock.current.server - (performance.now() - clock.current.received)) / 1000)) : 0);
    tick(); const timer = setInterval(tick, 1000); return () => clearInterval(timer);
  }, [appointment]);
  useEffect(() => {
    const timer = setInterval(() => { void refresh(); }, 15_000);
    return () => clearInterval(timer);
  }, [appointment.bookingCode, token]);
  const format = (value: string) => new Intl.DateTimeFormat(undefined, { timeZone: appointment.timeZone, dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  const privateLink = `${window.location.origin}/appointment#${new URLSearchParams({ code: appointment.bookingCode, token })}`;
  return <section className="visit-summary" aria-label="Your booking"><h2>Your booking</h2><p><strong>{appointment.bookingCode}</strong></p>
    <p>{appointment.customer.firstName} {appointment.customer.lastName} · {format(appointment.startAt)}</p>
    <p>Status: <strong>{appointment.status.replaceAll("_", " ")}</strong></p>
    {appointment.status === "PENDING_PAYMENT" && <><p role="status">{remaining > 0 ? `Temporary hold: ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")} remaining` : "The hold deadline has passed. Refresh to check the latest status."}</p>
      <p>Appointment fee: <strong>PHP {appointment.appointmentFeeAmount}</strong>, separate from your service charges.</p>
      <FeePaymentControls bookingCode={appointment.bookingCode} token={token} onChange={refresh} pending={appointment.payments?.find(p => p.status === "PENDING")} /></>}
    {appointment.status === "CONFIRMED" && <p role="status" className="success">Your appointment is confirmed. We look forward to seeing you.</p>}
    <FeePaymentHistory payments={appointment.payments ?? []} />
    {appointment.status === "EXPIRED" && <p>This hold has expired and the time is released. <a href="/availability">Find another time</a>.</p>}
    <ol>{appointment.appointmentServices.map(s => <li key={s.sequenceNo}><strong>{s.serviceNameSnapshot}</strong> · PHP {s.priceSnapshot}<br />{s.staff.firstName} {s.staff.lastName} · {format(s.scheduledStartAt)} – {format(s.scheduledEndAt)}</li>)}</ol>
    <p>All times are in {appointment.timeZone}.</p>
    <label>Private booking link<input readOnly value={privateLink} onFocus={e => e.currentTarget.select()} /></label>
    <p className="muted">Save this link to return to your booking. Anyone with it can view and manage your appointment. Keep it private.</p>
    <AppointmentManagement key={appointment.bookingCode} appointment={appointment} token={token} onChange={(updated, newToken) => {
      clock.current = { received: performance.now(), server: Date.parse(updated.serverTime) };
      setAppointment(updated); if (newToken) setToken(newToken);
    }} />
    <button type="button" onClick={() => void refresh()}>Refresh status</button>
    {error && <p role="alert" className="error">{error}</p>}
  </section>;
}
function readGuestCredentials() {
    const params = new URLSearchParams(window.location.hash.slice(1));
    // Fragments never go to the server. Remove it from the current history entry
    // after reading; keep the token in component memory, not browser storage.
    window.history.replaceState(null, "", "/appointment");
    return { bookingCode: params.get("code") ?? "", token: params.get("token") ?? "" };
}
export function GuestAppointment() {
  const [credentials, setCredentials] = useState(readGuestCredentials);
  const [result, setResult] = useState<Appointment | null>(null);
  const [token, setToken] = useState(credentials.token);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const requestGeneration = useRef(0);
  async function retrieve(bookingCode: string, accessToken: string) {
    const generation = ++requestGeneration.current;
    setBusy(true); setError(""); setResult(null);
    try { const response = await api<{ appointment: Appointment }>("/appointments/access", { method: "POST", body: JSON.stringify({ bookingCode, token: accessToken }) });
      if (generation === requestGeneration.current) { setToken(accessToken); setResult(response.appointment); }
    }
    catch (err) { if (generation === requestGeneration.current) setError(message(err)); }
    finally { if (generation === requestGeneration.current) setBusy(false); }
  }
  useEffect(() => {
    const changed = () => {
      if (!window.location.hash) return;
      requestGeneration.current++;
      setResult(null); setToken(""); setError(""); setBusy(false);
      setCredentials(readGuestCredentials());
    };
    window.addEventListener("hashchange", changed);
    return () => { window.removeEventListener("hashchange", changed); requestGeneration.current++; };
  }, []);
  useEffect(() => { if (credentials.bookingCode && credentials.token) void retrieve(credentials.bookingCode, credentials.token); }, [credentials]);
  return <div className="workspace"><header><a className="wordmark" href="/availability">CLIQUE<span>SALON</span></a><a href="/availability">Find a salon time</a><a href="/help">Salon help</a></header>
    <main className="workspace-main availability-page"><h1>Your appointment</h1>
      {result ? <AppointmentView key={result.bookingCode} initial={result} token={token} /> : <form key={credentials.bookingCode} className="account-form" onSubmit={event => { event.preventDefault(); const data = new FormData(event.currentTarget); void retrieve(String(data.get("code")).trim(), String(data.get("token")).trim()); }}>
        <p>If you just returned from PayMongo, switch back to your original booking tab and check payment status, or reopen your saved private booking link.</p>
        <label>Booking code<input name="code" required defaultValue={credentials.bookingCode} /></label>
        <label>Private access token<input name="token" type="password" required autoComplete="off" defaultValue={credentials.token} /></label>
        <button disabled={busy}>{busy ? "Loading…" : "View appointment"}</button>
      </form>}{error && <p role="alert" className="error">{error}</p>}
    </main></div>;
}
