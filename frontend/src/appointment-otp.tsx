import { PhoneInput } from "./phone-input";
import { philippinePhoneNumber } from "./phone-number";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { api, ApiError } from "./api";
import type { Appointment } from "./booking";

export function AppointmentOtp({ onVerified }: { onVerified: (appointment: Appointment) => void }) {
  const verified = useRef(onVerified); verified.current = onVerified;
  const [available, setAvailable] = useState(false);
  const [bookingCode, setBookingCode] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const sending = useRef(false);
  useEffect(() => {
    let active = true;
    void api<{ available: boolean }>("/appointments/otp/options").then(async options => {
      if (!active) return;
      setAvailable(options.available);
      if (!options.available) { setError("SMS verification is unavailable. Try again later or contact the salon."); return; }
      try {
        const result = await api<{ appointment: Appointment }>("/appointments/otp/session");
        if (active) verified.current(result.appointment);
      } catch (err) {
        if (active && !(err instanceof ApiError && err.status === 401)) setError("Could not restore your visit. You can request a new code below.");
      }
    }).catch(() => { if (active) setError("SMS verification is unavailable. Try again later or contact the salon."); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    const timer = window.setInterval(() => setCooldown(value => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, []);
  async function requestCode(event?: FormEvent) {
    event?.preventDefault();
    if (sending.current || cooldown) return;
    sending.current = true; setBusy(true); setError("");
    try {
      const result = await api<{ challengeId: string; message: string; retryAfterSeconds: number }>("/appointments/otp/request", {
        method: "POST", body: JSON.stringify({ bookingCode: bookingCode.trim().toUpperCase(), phone: philippinePhoneNumber(phone) }),
      });
      setChallengeId(result.challengeId); setCode(""); setNotice(result.message); setCooldown(result.retryAfterSeconds);
    } catch (err) { setError(err instanceof Error ? err.message : "Please try again."); }
    finally { sending.current = false; setBusy(false); }
  }
  async function verify(event: FormEvent) {
    event.preventDefault();
    if (sending.current) return;
    sending.current = true; setBusy(true); setError("");
    try {
      const result = await api<{ appointment: Appointment }>("/appointments/otp/verify", {
        method: "POST", body: JSON.stringify({ challengeId, code }),
      });
      verified.current(result.appointment);
    } catch (err) { setError(err instanceof Error ? err.message : "Please try again."); }
    finally { sending.current = false; setBusy(false); }
  }
  return <section className="account-form" aria-label="Verify appointment by SMS">
    {available && <><h3>Find your appointment</h3>
      <p>Enter your booking code and the phone number you used when booking. We’ll send you a verification code.</p>
      <form onSubmit={requestCode}><fieldset disabled={busy || Boolean(challengeId)}>
        <label>Booking code<input required value={bookingCode} onChange={e => setBookingCode(e.target.value)} autoCapitalize="characters" maxLength={100} /></label>
        <label>Phone number<PhoneInput value={phone} onChange={setPhone} /></label>
        {!challengeId && <button className="primary" disabled={busy || cooldown > 0}>{busy ? "Requesting code…" : cooldown ? `Wait ${cooldown}s` : "Send verification code"}</button>}
      </fieldset></form>
      {notice && <p role="status">{notice}</p>}
      {challengeId && <form onSubmit={verify}>
        <label>Verification code<input required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ""))} /></label>
        <button className="primary" disabled={busy}>{busy ? "Please wait…" : "Verify and view appointment"}</button>
        <button type="button" disabled={busy || cooldown > 0} onClick={() => void requestCode()}>{cooldown ? `Resend in ${cooldown}s` : "Resend code"}</button>
        <button type="button" disabled={busy} onClick={() => { setChallengeId(""); setNotice(""); setCode(""); setError(""); }}>Change booking details</button>
        <p className="muted">Your appointment stays accessible on this browser for two hours. Use “Close appointment” when finished on a shared device.</p>
      </form>}
    </>}
    {error && <p role="alert" className="error">{error}</p>}
  </section>;
}
