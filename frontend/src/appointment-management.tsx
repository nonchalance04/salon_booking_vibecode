import { useEffect, useRef, useState } from "react";
import { api } from "./api";
import type { Appointment } from "./booking";

type Selection = { key: number; serviceId: string; appointmentServiceId?: string; staffId: string; label: string };
type Catalog = { id: string; name: string; price: string };
type Staff = { id: string; firstName: string; lastName: string; serviceIds: string[] };
type Slot = { startAt: string; endAt: string; services: { serviceName: string; staffName: string }[] };
const message = (error: unknown) => error instanceof Error ? error.message : "Please try again.";
export function AppointmentManagement({ appointment, token, onChange }: { appointment: Appointment; token: string;
  onChange: (appointment: Appointment, token?: string) => void }) {
  const recovery = appointment.status === "NO_SHOW";
  const [editing, setEditing] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [services, setServices] = useState<Catalog[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [rows, setRows] = useState<Selection[]>([]);
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [startAt, setStartAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const key = useRef(0);
  const generation = useRef(0);
  const policy = appointment.bookingPolicyVersion;
  const now = Date.parse(appointment.serverTime);
  const canChange = appointment.rescheduleCount < policy.maxReschedules && (recovery
    ? !appointment.recoveryAppointment && now <= Date.parse(appointment.startAt) + policy.noShowGraceHours * 3_600_000
    : appointment.status === "CONFIRMED" && now <= Date.parse(appointment.startAt) - policy.rescheduleCutoffHours * 3_600_000);
  const canCancel = appointment.status === "CONFIRMED" && now <= Date.parse(appointment.startAt) - policy.cancellationCutoffHours * 3_600_000;
  const format = (value: string) => new Intl.DateTimeFormat(undefined, { timeZone: appointment.timeZone, dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  function invalidate() { generation.current++; setSlots(null); setStartAt(""); }
  async function open() {
    setBusy(true); setError("");
    try {
      const [catalog, people] = await Promise.all([api<{ services: Catalog[] }>("/services"), api<{ staff: Staff[] }>("/availability/staff")]);
      setServices(catalog.services); setStaff(people.staff);
      setRows(appointment.appointmentServices.filter(s => !recovery || catalog.services.some(c => c.id === s.serviceId)).map(s => ({
        key: key.current++, serviceId: s.serviceId, ...(recovery ? {} : { appointmentServiceId: s.id }), staffId: s.staffId, label: s.serviceNameSnapshot,
      })));
      setEditing(true); invalidate();
    } catch (err) { setError(message(err)); } finally { setBusy(false); }
  }
  const body = () => ({ bookingCode: appointment.bookingCode, token, recovery, date,
    services: rows.map(row => ({ serviceId: row.serviceId, ...(row.appointmentServiceId ? { appointmentServiceId: row.appointmentServiceId } : {}),
      ...(row.staffId ? { assignmentMode: "SPECIFIC", staffId: row.staffId } : { assignmentMode: "ANY_AVAILABLE" }) })) });
  async function search() {
    const request = ++generation.current; setBusy(true); setError(""); setSlots(null); setStartAt("");
    try { const result = await api<{ slots: Slot[] }>("/appointments/change-options", { method: "POST", body: JSON.stringify(body()) });
      if (generation.current === request) setSlots(result.slots);
    } catch (err) { setError(message(err)); } finally { setBusy(false); }
  }
  async function save() {
    setBusy(true); setError("");
    try { const result = await api<{ appointment: Appointment; guestToken?: string }>("/appointments/change", { method: "POST", body: JSON.stringify({ ...body(), startAt, reason }) });
      setEditing(false); invalidate(); onChange(result.appointment, result.guestToken);
    } catch (err) { setError(message(err)); invalidate(); } finally { setBusy(false); }
  }
  async function cancel() {
    setBusy(true); setError("");
    try {
      await api("/appointments/cancel", { method: "POST", body: JSON.stringify({ bookingCode: appointment.bookingCode, token, reason }) });
      const result = await api<{ appointment: Appointment }>("/appointments/access", { method: "POST", body: JSON.stringify({ bookingCode: appointment.bookingCode, token }) });
      setConfirmCancel(false); setEditing(false); onChange(result.appointment);
    } catch (err) { setError(message(err)); } finally { setBusy(false); }
  }
  return <section aria-label="Manage appointment"><h3>Manage your appointment</h3>
    <p>{appointment.rescheduleCount} of {policy.maxReschedules} allowed changes used.</p>
    {appointment.carriedAppointmentFeePaymentId && <p>Appointment fee satisfied by credit from the missed booking. No additional appointment-fee payment is due.</p>}
    {appointment.recoveryAppointment && <p>Replacement booking: {appointment.recoveryAppointment.bookingCode}. Use the replacement’s saved private link to manage it.</p>}
    {canChange && !editing && <button disabled={busy} onClick={() => void open()}>{recovery ? "Request a recovery booking" : "Reschedule or change services"}</button>}
    {canCancel && <button disabled={busy} onClick={() => setConfirmCancel(true)}>Cancel appointment</button>}
    {!canChange && !canCancel && !appointment.recoveryAppointment && <p>No customer changes are currently available. Please contact the salon for assistance.</p>}
    {confirmCancel && <fieldset disabled={busy}><legend>Confirm cancellation</legend><p>This releases your reserved time. The appointment fee is not automatically refunded.</p>
      <button onClick={() => void cancel()}>Confirm cancellation</button><button onClick={() => setConfirmCancel(false)}>Keep appointment</button></fieldset>}
    {editing && <form className="account-form" onSubmit={e => { e.preventDefault(); void search(); }}><fieldset disabled={busy}>
      <legend>{recovery ? "Replacement visit" : "Replacement schedule"}</legend>
      <p>{recovery ? "The original policy applies. An eligible unused appointment fee is carried automatically; otherwise the new booking requires payment." : "Retained services keep their booked prices and durations. Added services use current values."}</p>
      {rows.map((row, index) => <fieldset key={row.key}><legend>Service {index + 1}</legend>
        {row.appointmentServiceId ? <p>{row.label} · retained booked service</p> : <label>Service<select value={row.serviceId} onChange={e => { invalidate(); setRows(items => items.map(r => r.key === row.key ? { ...r, serviceId: e.target.value, staffId: "" } : r)); }}>{services.map(s => <option key={s.id} value={s.id}>{s.name} · PHP {s.price}</option>)}</select></label>}
        <label>Staff<select value={row.staffId} onChange={e => { invalidate(); setRows(items => items.map(r => r.key === row.key ? { ...r, staffId: e.target.value } : r)); }}><option value="">Any available staff</option>
          {row.staffId && !staff.some(s => s.id === row.staffId && s.serviceIds.includes(row.serviceId)) && <option value={row.staffId}>Previous staff (availability will be checked)</option>}
          {staff.filter(s => s.serviceIds.includes(row.serviceId)).map(s => <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>)}</select></label>
        <button type="button" disabled={index === 0} onClick={() => { invalidate(); setRows(items => { const copy = [...items]; [copy[index - 1], copy[index]] = [copy[index]!, copy[index - 1]!]; return copy; }); }}>Move earlier</button>
        <button type="button" onClick={() => { invalidate(); setRows(items => items.filter(r => r.key !== row.key)); }}>Remove service {index + 1}</button>
      </fieldset>)}
      <button type="button" disabled={!services.length || rows.length >= 20} onClick={() => { invalidate(); setRows(items => [...items, { key: key.current++, serviceId: services[0]!.id, staffId: "", label: services[0]!.name }]); }}>Add service</button>
      <label>Visit date ({appointment.timeZone})<input type="date" value={date} required onChange={e => { invalidate(); setDate(e.target.value); }} /></label>
      <label>Reason (optional)<textarea maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} /></label>
      <button disabled={!rows.length}>Find available times</button><button type="button" onClick={() => setEditing(false)}>Close changes</button>
      {slots && (slots.length ? <><label>Available start<select value={startAt} onChange={e => setStartAt(e.target.value)}><option value="">Choose a time</option>{slots.map(s => <option key={s.startAt} value={s.startAt}>{format(s.startAt)}</option>)}</select></label>
        {startAt && <><ol>{slots.find(s => s.startAt === startAt)?.services.map((s, i) => <li key={i}>{s.serviceName} with {s.staffName}</li>)}</ol><p>Availability and eligibility are checked again when you confirm.</p><button type="button" onClick={() => void save()}>{recovery ? "Create replacement booking" : "Confirm appointment changes"}</button></>}
      </> : <p role="status">No available times. Try another date or staff member.</p>)}
    </fieldset></form>}
    {busy && <p role="status">Working…</p>}{error && <p role="alert" className="error">{error}</p>}
  </section>;
}
export function AdminAppointments() {
  const [rows, setRows] = useState<Appointment[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [marking, setMarking] = useState<string | null>(null);
  async function load(next?: string) {
    setBusy(true); setError("");
    try { const result = await api<{ appointments: Appointment[]; nextCursor: string | null }>(`/appointments${next ? `?cursor=${encodeURIComponent(next)}` : ""}`);
      setRows(previous => next ? [...previous, ...result.appointments] : result.appointments); setCursor(result.nextCursor);
    } catch (err) { setError(message(err)); } finally { setBusy(false); }
  }
  useEffect(() => { void load(); }, []);
  async function mark(code: string) {
    setBusy(true); setError("");
    try { await api("/appointments/no-show", { method: "POST", body: JSON.stringify({ bookingCode: code }) }); setMarking(null); await load(); }
    catch (err) { setError(message(err)); } finally { setBusy(false); }
  }
  return <section><h2>Appointments</h2><button disabled={busy} onClick={() => void load()}>Refresh appointments</button>
    {rows.map(row => <article className="visit-summary" key={row.bookingCode}><h3>{row.bookingCode}</h3><p>{row.customer.firstName} {row.customer.lastName} · {row.status}</p>
      <p>{new Intl.DateTimeFormat(undefined, { timeZone: row.timeZone, dateStyle: "medium", timeStyle: "short" }).format(new Date(row.startAt))} · {row.timeZone}</p>
      <ol>{row.appointmentServices.map(s => <li key={s.id}>{s.serviceNameSnapshot} · {s.staff.firstName} {s.staff.lastName} · PHP {s.priceSnapshot}</li>)}</ol>
      <p>Appointment fee: PHP {row.appointmentFeeAmount}{row.carriedAppointmentFeePaymentId ? " · carried credit" : ""}</p>
      {row.status === "CONFIRMED" && Date.parse(row.startAt) <= Date.parse(row.serverTime) && <button disabled={busy} onClick={() => setMarking(row.bookingCode)}>Mark no-show</button>}
      {marking === row.bookingCode && <div><p>Confirm the customer failed to appear according to salon procedure. This releases the reservation and preserves the missed visit.</p><button disabled={busy} onClick={() => void mark(row.bookingCode)}>Confirm no-show</button><button disabled={busy} onClick={() => setMarking(null)}>Keep confirmed</button></div>}
    </article>)}{cursor && <button disabled={busy} onClick={() => void load(cursor)}>Load more</button>}
    {busy && <p role="status">Loading…</p>}{error && <p role="alert" className="error">{error}</p>}
  </section>;
}
