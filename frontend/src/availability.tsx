import { useEffect, useRef, useState, type FormEvent } from "react";
import { Temporal } from "@js-temporal/polyfill";
import { api } from "./api";
import { BookingForm, AppointmentView } from "./booking";

type Service = { id: string; name: string; description: string | null; price: string; durationMinutes: number };
type Staff = { id: string; firstName: string; lastName: string; serviceIds: string[] };
type Selection = { key: number; serviceId: string; staffId: string };
type Slot = { startAt: string; endAt: string; services: { sequenceNo: number; serviceId: string; serviceName: string; staffName: string; startAt: string; endAt: string; reservedUntilAt: string; bufferMinutes: number }[] };
type Result = { timeZone: string; generatedAt: string; earliest: string; latest: string; slots: Slot[] };
const message = (error: unknown) => error instanceof Error ? error.message : "Please try again.";
export function Availability() {
  const [services, setServices] = useState<Service[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [timeZone, setTimeZone] = useState("");
  const [date, setDate] = useState("");
  const [selections, setSelections] = useState<Selection[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [selected, setSelected] = useState<Slot | null>(null);
  const [hour, setHour] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [bookingBusy, setBookingBusy] = useState(false);
  const [booked, setBooked] = useState<Parameters<typeof AppointmentView>[0] | null>(null);
  const request = useRef(0);
  const nextKey = useRef(0);
  async function load() {
    setLoading(true); setError("");
    try {
      const [catalog, people] = await Promise.all([api<{ services: Service[] }>("/services"), api<{ timeZone: string; staff: Staff[] }>("/availability/staff")]);
      setServices(catalog.services); setStaff(people.staff); setTimeZone(people.timeZone);
      setDate(Temporal.Now.zonedDateTimeISO(people.timeZone).toPlainDate().toString());
      setSelections(catalog.services[0] ? [{ key: nextKey.current++, serviceId: catalog.services[0].id, staffId: "" }] : []);
    } catch (err) { setError(message(err)); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); return () => { request.current++; }; }, []);
  function invalidate() { request.current++; setResult(null); setSelected(null); setHour(""); setBusy(false); setError(""); }
  function change(key: number, values: Partial<Selection>) {
    invalidate(); setSelections(rows => rows.map(row => row.key === key ? { ...row, ...values } : row));
  }
  async function search(event: FormEvent) {
    event.preventDefault();
    const generation = ++request.current;
    setBusy(true); setError(""); setResult(null); setSelected(null); setHour("");
    try {
      const response = await api<Result>("/availability", { method: "POST", body: JSON.stringify({ date,
        services: selections.map(row => row.staffId ? { serviceId: row.serviceId, assignmentMode: "SPECIFIC", staffId: row.staffId } : { serviceId: row.serviceId, assignmentMode: "ANY_AVAILABLE" }),
      }) });
      if (generation !== request.current) return;
      setResult(response);
      if (response.slots[0]) setHour(hourKey(response.slots[0].startAt, response.timeZone));
    } catch (err) { if (generation === request.current) setError(message(err)); }
    finally { if (generation === request.current) setBusy(false); }
  }
  const format = (instant: string) => new Intl.DateTimeFormat(undefined, { timeZone, hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(new Date(instant));
  const hourKey = (instant: string, zone = timeZone) => Temporal.Instant.from(instant).toZonedDateTimeISO(zone).toString().slice(0, 13) + Temporal.Instant.from(instant).toZonedDateTimeISO(zone).offset;
  const groups = [...new Map((result?.slots ?? []).map(slot => [hourKey(slot.startAt), slot.startAt])).entries()];
  return <div className="workspace"><header><a className="wordmark" href="/availability">CLIQUE<span>SALON</span></a><a href="/">Staff sign in</a><a href="/help">Salon help</a></header>
    <main className="workspace-main availability-page"><p className="eyebrow">MAKE TIME FOR YOURSELF</p><h1>Find your salon time.</h1>
      <p className="welcome">Choose your services in the order you’d like them, then find a time that fits.</p>
      {booked ? <AppointmentView initial={booked.initial} token={booked.token} /> : <fieldset disabled={bookingBusy} className="booking-selection">
      {loading ? <p role="status">Loading services…</p> : <>
        {timeZone && <p className="muted">All dates and times are in {timeZone}.</p>}
        {!timeZone ? <button onClick={() => void load()}>Retry loading services</button> : !services.length ? <p>No services are available yet. Please check back later.</p> : <form onSubmit={search} className="account-form">
          <h2>Your visit</h2>
          {selections.map((row, index) => {
            const service = services.find(s => s.id === row.serviceId);
            return <fieldset key={row.key} className="visit-service"><legend>Service {index + 1}</legend><div className="form-grid">
              <label>Service<select value={row.serviceId} onChange={e => change(row.key, { serviceId: e.target.value, staffId: "" })}>{services.map(s => <option key={s.id} value={s.id}>{s.name} · PHP {s.price} · {s.durationMinutes} min</option>)}</select></label>
              <label>Staff<select value={row.staffId} onChange={e => change(row.key, { staffId: e.target.value })}><option value="">Any available staff</option>{staff.filter(s => s.serviceIds.includes(row.serviceId)).map(s => <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>)}</select></label>
            </div>{service?.description && <p className="muted">{service.description}</p>}
              <div className="actions"><button type="button" disabled={index === 0} aria-label={`Move service ${index + 1} earlier`} onClick={() => { invalidate(); setSelections(rows => { const copy = [...rows]; [copy[index - 1], copy[index]] = [copy[index]!, copy[index - 1]!]; return copy; }); }}>Move earlier</button>
                <button type="button" disabled={selections.length === 1} aria-label={`Remove service ${index + 1}`} onClick={() => { invalidate(); setSelections(rows => rows.filter(s => s.key !== row.key)); }}>Remove</button></div>
            </fieldset>;
          })}
          <button type="button" disabled={selections.length >= 20} onClick={() => { invalidate(); setSelections(rows => [...rows, { key: nextKey.current++, serviceId: services[0]!.id, staffId: "" }]); }}>+ Add another service</button>
          <label className="visit-date">Visit date<input type="date" required value={date} onChange={e => { invalidate(); setDate(e.target.value); }} /></label>
          <p className="muted">Services run one after another, including any buffer between them.</p>
          <button className="primary" disabled={busy || !selections.length}>{busy ? "Finding times…" : "Find available times"}</button>
        </form>}
      </>}
      {error && <p role="alert" className="error">{error}</p>}
      {result && <section className="availability-results" aria-labelledby="times-title"><h2 id="times-title">Available starting times</h2>
        <p className="muted">Times are advisory. Availability will be checked again when you submit a booking.</p>
        {!result.slots.length ? <p role="status">No times match this visit. Try another date, different staff, or fewer services.</p> : <>
          <label>Browse by hour<select value={hour} onChange={e => setHour(e.target.value)}>{groups.map(([key, instant]) => <option key={key} value={key}>{new Intl.DateTimeFormat(undefined, { timeZone, hour: "numeric", timeZoneName: "short" }).format(new Date(instant))}</option>)}</select></label>
          <div className="time-options" aria-label="Available starting times">{result.slots.filter(slot => hourKey(slot.startAt) === hour).map(slot => <button type="button" key={slot.startAt} aria-pressed={selected?.startAt === slot.startAt} onClick={() => setSelected(slot)}>{format(slot.startAt)}</button>)}</div>
        </>}
        {selected && <section className="visit-summary" aria-label="Selected visit"><h3>Your selected visit</h3><p>{date} · {format(selected.startAt)} – {format(selected.endAt)}</p>
          <ol>{selected.services.map(s => <li key={s.sequenceNo}><strong>{s.serviceName}</strong> with {s.staffName}<br />{format(s.startAt)} – {format(s.endAt)}{s.bufferMinutes > 0 && <span className="muted"> · {s.bufferMinutes} min buffer, through {format(s.reservedUntilAt)}</span>}</li>)}</ol>
          <BookingForm key={selected.startAt} plan={{ date, startAt: selected.startAt, services: selections.map(row => row.staffId ? { serviceId: row.serviceId, assignmentMode: "SPECIFIC", staffId: row.staffId } : { serviceId: row.serviceId, assignmentMode: "ANY_AVAILABLE" }) }} onBusy={setBookingBusy} onBooked={response => setBooked({ initial: response.appointment, token: response.guestToken })} /></section>}
      </section>}
      </fieldset>}
    </main><footer>Clique Salon · A little care. A beautiful day.</footer></div>;
}
