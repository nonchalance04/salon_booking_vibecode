import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { CalendarDays } from "lucide-react";
import { useBooking } from "../context/BookingContext";
import Button from "../components/ui/Button";
export default function ManagePage() {
  const { appointments } = useBooking();
  const [reference, setReference] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();
  return (
    <section className="container page-section">
      <div className="manage-panel mx-auto">
        <CalendarDays className="gold" size={32} />
        <h1 className="section-title mt-5">Your appointment</h1>
        <p className="muted mt-4 mb-7">
          Enter your booking reference and email to view or update your
          appointment.
        </p>
        <form
          className="customer-form grid gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            const match = appointments.find(
              (a) =>
                a.reference.toLowerCase() === reference.trim().toLowerCase() &&
                a.customer.email.toLowerCase() === email.trim().toLowerCase(),
            );
            if (match) navigate(`/confirmation/${match.reference}`);
            else
              setError(
                "We couldn’t find that appointment. Check your reference and email. Demo bookings are only stored in this browser tab.",
              );
          }}
        >
          <label>
            Reference number
            <input
              required
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="CH-XXXXXXXX"
            />
          </label>
          <label>
            Email address
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <Button type="submit">Find appointment</Button>
        </form>
        <p className="muted text-sm mt-6">
          Planning your first visit?{" "}
          <Link className="underline" to="/booking">
            Book an appointment
          </Link>
        </p>
      </div>
    </section>
  );
}
