import { useState } from "react";
import { philippinePhoneDigits } from "./phone-number";

export function PhoneInput({ name, value, onChange }: { name?: string; value?: string; onChange?: (value: string) => void }) {
  const [digits, setDigits] = useState("");
  return <span className="phone-field">
    <span className="phone-input-group"><span className="phone-country" aria-hidden="true">+63</span><input
      name={name} type="tel" inputMode="numeric" autoComplete="tel-national" required
      aria-label="Phone number (Philippines, +63)" pattern="[0-9]{10}" minLength={10} maxLength={32}
      placeholder="917 123 4567" value={value ?? digits}
      onChange={event => { const next = philippinePhoneDigits(event.target.value); setDigits(next); onChange?.(next); }}
    /></span>
    <small className="phone-help">Philippines · 10 digits, without the leading 0.</small>
  </span>;
}
