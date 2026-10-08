import { Navigate, useNavigate } from "react-router-dom";
import { CreditCard, ShieldCheck } from "lucide-react";
import { useBooking } from "../context/BookingContext";
import BookingSummary from "../components/booking/BookingSummary";
import Button from "../components/ui/Button";
export default function PaymentPage() {
  const { booking, save } = useBooking();
  const navigate = useNavigate();
  if (
    !booking.items.length ||
    !booking.date ||
    !booking.time ||
    !booking.customer.name.trim()
  )
    return <Navigate to="/booking" replace />;
  function confirm() {
    const reference =
      booking.reference ||
      `CH-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    save({ ...booking, reference, status: "Confirmed (demo)" });
    navigate(`/confirmation/${reference}`, { replace: true });
  }
  return (
    <section className="container booking-shell">
      <Button variant="text" onClick={() => navigate("/booking")}>
        ← Back to booking
      </Button>
      <div className="grid lg:grid-cols-[1.4fr_1fr] gap-12 mt-8">
        <div className="payment-panel">
          <div className="payment-symbol">
            <CreditCard size={34} />
          </div>
          <p className="eyebrow mt-7">ONE LAST STEP</p>
          <h1 className="section-title mt-3">Review your payment</h1>
          <p className="muted mt-5 leading-relaxed">
            Selected method:{" "}
            <strong className="text-stone-700">
              {booking.customer.payment}
            </strong>
          </p>
          <div className="demo-note mt-7 flex gap-3">
            <ShieldCheck size={24} className="shrink-0" />
            <p>
              This payment screen is a demo. No live QR code or payment account
              is connected, and you will not be charged.
            </p>
          </div>
          <p className="muted my-6">
            Review your appointment details, then simulate a successful payment
            to preview your confirmation.
          </p>
          <Button className="w-full sm:w-auto" onClick={confirm}>
            Simulate payment & confirm
          </Button>
        </div>
        <BookingSummary booking={booking} />
      </div>
    </section>
  );
}
