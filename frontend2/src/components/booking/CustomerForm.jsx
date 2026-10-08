export default function CustomerForm({ value, onChange, onSubmit }) {
  const field = (key) => ({
    value: value[key],
    onChange: (e) => onChange({ ...value, [key]: e.target.value }),
  });
  return (
    <form
      id="customer-form"
      className="customer-form grid gap-5"
      onSubmit={onSubmit}
    >
      <label>
        Full name <span>*</span>
        <input
          required
          pattern=".*\S.*"
          title="Enter your name"
          maxLength={100}
          autoComplete="name"
          placeholder="Your full name"
          {...field("name")}
        />
      </label>
      <div className="grid sm:grid-cols-2 gap-5">
        <label>
          Contact number <span>*</span>
          <input
            required
            type="tel"
            autoComplete="tel"
            pattern="[+0-9 ()-]{7,20}"
            title="Enter a valid contact number (7–20 characters)"
            placeholder="09XX XXX XXXX"
            {...field("phone")}
          />
        </label>
        <label>
          Email address <span>*</span>
          <input
            required
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            {...field("email")}
          />
        </label>
      </div>
      <label>
        Mode of payment
        <select {...field("payment")}>
          <option>GCash QR</option>
          <option>Debit or Credit Card</option>
          <option>Bank Transfer</option>
        </select>
      </label>
      <label>
        Notes or requests{" "}
        <small className="muted font-normal">(optional)</small>
        <textarea
          rows={4}
          placeholder="Anything you would like your stylist to know?"
          maxLength={500}
          {...field("notes")}
        />
      </label>
      <div className="demo-note">
        This is a frontend demo. Please use sample details. No real appointment
        or payment will be made. Demo bookings stay in this browser tab’s
        session.
      </div>
    </form>
  );
}
