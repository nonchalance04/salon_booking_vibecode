import { useEffect, useRef, useState } from "react";
import { Temporal } from "@js-temporal/polyfill";
import { api } from "./api";
import { AppointmentView, BookingForm, type BookingPlan } from "./booking";
import { money, type CatalogService, type Salon } from "./public-site";

type Staff = { id: string; firstName: string; lastName: string; serviceIds: string[] };
type Selection = { key: number; serviceId: string; staffId: string };
type Slot = { startAt: string; endAt: string; services: { sequenceNo: number; serviceName: string; staffName: string; startAt: string; endAt: string }[] };
type Result = { timeZone: string; slots: Slot[] };
const steps = ["Services", "Professional", "Date & Time", "Information"];
const message = (error: unknown) => error instanceof Error ? error.message : "Please try again.";

export function PublicBooking({ salon }: { salon: Salon | null }) {
  const [services, setServices] = useState<CatalogService[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [timeZone, setTimeZone] = useState("");
  const [selections, setSelections] = useState<Selection[]>([]);
  const [date, setDate] = useState("");
  const [month, setMonth] = useState("");
  const [step, setStep] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [hour, setHour] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [bookingBusy, setBookingBusy] = useState(false);
  const [error, setError] = useState("");
  const [booked, setBooked] = useState<Parameters<typeof AppointmentView>[0] | null>(null);
  const generation = useRef(0);
  const key = useRef(0);
  async function load() {
    setLoading(true); setError("");
    try {
      const [catalog, people] = await Promise.all([api<{ services: CatalogService[] }>("/services"), api<{ timeZone: string; staff: Staff[] }>("/availability/staff")]);
      setServices(catalog.services); setStaff(people.staff); setTimeZone(people.timeZone);
      const today = Temporal.Now.zonedDateTimeISO(people.timeZone).toPlainDate().toString(); setDate(today); setMonth(today.slice(0, 7));
      const serviceId = new URLSearchParams(window.location.search).get("service");
      setSelections(catalog.services.some(s => s.id === serviceId) ? [{ key: key.current++, serviceId: serviceId!, staffId: "" }] : []);
    } catch (err) { setError(message(err)); } finally { setLoading(false); }
  }
  useEffect(() => { void load(); return () => { generation.current++; }; }, []);
  function invalidate() { generation.current++; setResult(null); setSlot(null); setHour(""); setBusy(false); setError(""); }
  const planServices = (): BookingPlan["services"] => selections.map(s => s.staffId ? { serviceId: s.serviceId, assignmentMode: "SPECIFIC", staffId: s.staffId } : { serviceId: s.serviceId, assignmentMode: "ANY_AVAILABLE" });
  const hourKey = (instant: string, zone = timeZone) => Temporal.Instant.from(instant).toZonedDateTimeISO(zone).toString().slice(0, 13) + Temporal.Instant.from(instant).toZonedDateTimeISO(zone).offset;
  const format = (instant: string) => new Intl.DateTimeFormat("en-PH", { timeZone, hour: "numeric", minute: "2-digit" }).format(new Date(instant));
  async function search() {
    const attempt = ++generation.current; setBusy(true); setError(""); setResult(null); setSlot(null);
    try { const response = await api<Result>("/availability", { method: "POST", body: JSON.stringify({ date, services: planServices() }) });
      if (attempt !== generation.current) return;
      setResult(response); setHour(response.slots[0] ? hourKey(response.slots[0].startAt, response.timeZone) : "");
    } catch (err) { if (attempt === generation.current) setError(message(err)); }
    finally { if (attempt === generation.current) setBusy(false); }
  }
  const today = timeZone ? Temporal.Now.zonedDateTimeISO(timeZone).toPlainDate().toString() : "";
  const first = month ? Temporal.PlainDate.from(`${month}-01`) : null;
  const groups = [...new Map((result?.slots || []).map(s => [hourKey(s.startAt), s.startAt])).entries()];
  const total = selections.reduce((sum, row) => sum + Math.round(Number(services.find(s => s.id === row.serviceId)?.price || 0) * 100), 0) / 100;
  if (booked) return <section className="container page-section confirmation"><p className="eyebrow">YOUR VISIT</p><h1 className="section-title">Your reservation</h1><AppointmentView initial={booked.initial} token={booked.token} /></section>;
  return <section className="container booking-shell"><div className="booking-top"><button onClick={() => step ? setStep(step - 1) : window.location.assign("/")} disabled={bookingBusy}>← Back</button><a className="icon-button" href="/" aria-label="Close booking">×</a></div>
    {loading ? <p role="status">Loading salon services…</p> : !timeZone ? <><p className="error" role="alert">{error}</p><button onClick={() => void load()}>Retry</button></> : !services.length ? <p className="empty-state">No services are available yet.</p> : <fieldset disabled={bookingBusy} className="booking-selection booking-grid"><div>
      <nav className="booking-steps" aria-label="Booking progress">{steps.map((label, i) => <button key={label} disabled={i > step} aria-current={i === step ? "step" : undefined} className={step === i ? "current" : ""} onClick={() => setStep(i)}>{label}{i < 3 && <span aria-hidden="true"> ›</span>}</button>)}</nav>
      <h1 className="booking-title">{["Select Services", "Select Professional", "Select Date and Time", "Customer Information"][step]}</h1>
      {error && <p role="alert" className="error">{error}</p>}
      {step === 0 && <div className="picker-list">{services.map(service => <button className={`service-option ${selections.some(s => s.serviceId === service.id) ? "selected" : ""}`} key={service.id} disabled={selections.length >= 20} onClick={() => { invalidate(); setSelections(rows => [...rows, { key: key.current++, serviceId: service.id, staffId: "" }]); }}><div><h3>{service.name}</h3><p className="muted">{service.durationMinutes} min</p>{service.description && <p className="muted">{service.description}</p>}<strong>{money(service.price)}</strong></div><span className="select-circle" aria-hidden="true">＋</span></button>)}</div>}
      {step === 1 && <><p className="muted">Choose a qualified professional for each service, or let the salon find available staff.</p><div className="picker-list">{selections.map((row, i) => <div className="professional-option" key={row.key}><h3>{i + 1}. {services.find(s => s.id === row.serviceId)?.name}</h3><label>Professional<select value={row.staffId} onChange={e => { invalidate(); setSelections(rows => rows.map(s => s.key === row.key ? { ...s, staffId: e.target.value } : s)); }}><option value="">Any available professional</option>{staff.filter(s => s.serviceIds.includes(row.serviceId)).map(s => <option value={s.id} key={s.id}>{s.firstName} {s.lastName}</option>)}</select></label></div>)}</div></>}
      {step === 2 && <><p className="timezone-note">All dates and times are in {timeZone}.</p><div className="calendar"><div className="calendar-heading"><h2>{first?.toLocaleString("en", { month: "long", year: "numeric" })}</h2><div><button aria-label="Previous month" disabled={month <= today.slice(0, 7)} onClick={() => setMonth(first!.subtract({ months: 1 }).toString().slice(0, 7))}>‹</button><button aria-label="Next month" onClick={() => setMonth(first!.add({ months: 1 }).toString().slice(0, 7))}>›</button></div></div><div className="calendar-grid">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => <span key={d}>{d}</span>)}{Array.from({ length: (first?.dayOfWeek || 0) % 7 }, (_, i) => <span key={`blank-${i}`} />)}{Array.from({ length: first?.daysInMonth || 0 }, (_, i) => { const day = first!.add({ days: i }).toString(); return <button key={day} className={`calendar-day ${date === day ? "selected" : ""}`} aria-label={day} aria-pressed={date === day} disabled={day < today} onClick={() => { invalidate(); setDate(day); }}>{i + 1}</button>; })}</div></div><label className="visit-date">Visit date<input type="date" value={date} min={today} required onChange={e => { invalidate(); setDate(e.target.value); if (e.target.value) setMonth(e.target.value.slice(0, 7)); }} /></label><button className="button button--dark" disabled={busy || !date} onClick={() => void search()}>{busy ? "Finding times…" : "Find available times"}</button>
        {result && <section className="availability-results"><h2>Available times</h2><p className="muted">Availability is checked again when you reserve your visit.</p>{!result.slots.length ? <p role="status">No times match this visit. Try another date or professional.</p> : <><label>Browse by hour<select value={hour} onChange={e => setHour(e.target.value)}>{groups.map(([group, instant]) => <option value={group} key={group}>{new Intl.DateTimeFormat("en-PH", { timeZone, hour: "numeric" }).format(new Date(instant))}</option>)}</select></label><div className="time-options">{result.slots.filter(s => hourKey(s.startAt) === hour).map(s => <button className={`time-slot ${slot?.startAt === s.startAt ? "selected" : ""}`} key={s.startAt} aria-pressed={slot?.startAt === s.startAt} onClick={() => setSlot(s)}>{format(s.startAt)}</button>)}</div></>}</section>}
      </>}
      {step === 3 && slot && <><p className="muted">Your appointment begins with a temporary hold. Pay the appointment fee to confirm it.</p><BookingForm plan={{ date, startAt: slot.startAt, services: planServices() }} onBusy={setBookingBusy} onBooked={response => setBooked({ initial: response.appointment, token: response.guestToken })} /></>}
    </div><aside className="booking-summary"><h2>{salon?.profile?.name || "Clique Salon"}</h2>{salon?.profile?.address && <p className="muted">⌖ {salon.profile.address}</p>}<div className="summary-items">{!selections.length && <p className="muted">Your moment of self-care starts here.<br />Add a service to your appointment.</p>}{selections.map((row, i) => { const service = services.find(s => s.id === row.serviceId); const person = staff.find(s => s.id === row.staffId); return <div className="summary-item" key={row.key}><div className="card-actions"><strong>{i + 1}. {service?.name}</strong><span>{money(service?.price || "0")}</span></div><p className="muted">{service?.durationMinutes} min · {person ? `${person.firstName} ${person.lastName}` : "Any available professional"}</p>{step === 0 && <div className="summary-actions"><button aria-label={`Remove service ${i + 1}`} onClick={() => { invalidate(); setSelections(rows => rows.filter(s => s.key !== row.key)); }}>Remove</button><button disabled={i === 0} aria-label={`Move service ${i + 1} earlier`} onClick={() => { invalidate(); setSelections(rows => { const next = [...rows]; [next[i - 1], next[i]] = [next[i]!, next[i - 1]!]; return next; }); }}>Move earlier</button></div>}</div>; })}</div>{date && <div className="summary-schedule"><p>{date} · {timeZone}</p>{slot && <><p>{format(slot.startAt)} – {format(slot.endAt)}</p><ol>{slot.services.map(s => <li key={s.sequenceNo}>{s.serviceName} · {s.staffName}<br />{format(s.startAt)} – {format(s.endAt)}</li>)}</ol></>}</div>}<div className="card-actions summary-total"><strong>Service total</strong><strong>{money(total)}</strong></div><p className="muted">The appointment fee is separate from service charges. Final prices and assignments are confirmed when the hold is created.</p>{step < 3 && <button className="button button--dark" disabled={!selections.length || (step === 2 && !slot)} onClick={() => setStep(step + 1)}>Continue →</button>}</aside></fieldset>}
  </section>;
}

