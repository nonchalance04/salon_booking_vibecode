import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, X, ChevronRight } from "lucide-react";
import { useBooking } from "../context/BookingContext";
import BookingSummary from "../components/booking/BookingSummary";
import ServicePicker from "../components/booking/ServicePicker";
import ProfessionalPicker from "../components/booking/ProfessionalPicker";
import DateTimePicker from "../components/booking/DateTimePicker";
import CustomerForm from "../components/booking/CustomerForm";
import Button from "../components/ui/Button";
const steps = ["Services", "Professional", "Date & Time", "Information"];
export default function BookingPage() {
  const { booking, update } = useBooking();
  const [step, setStep] = useState(0);
  const navigate = useNavigate();
  const valid = [
    booking.items.length > 0,
    !!booking.professional,
    !!booking.date && !!booking.time,
    true,
  ];
  const duration = booking.items.reduce((sum, i) => sum + i.duration, 0);
  return (
    <div className="booking-shell container">
      <div className="flex items-center justify-between mb-7">
        <Button
          variant="text"
          onClick={() => (step > 0 ? setStep(step - 1) : navigate("/"))}
        >
          <ArrowLeft size={18} />
          Back
        </Button>
        <Link to="/" className="icon-button" aria-label="Close booking">
          <X size={19} />
        </Link>
      </div>
      <div className="grid lg:grid-cols-[1.4fr_1fr] gap-8 xl:gap-16 items-start">
        <div>
          <nav
            className="booking-steps flex items-center flex-wrap gap-2"
            aria-label="Booking progress"
          >
            {steps.map((s, i) => (
              <span key={s} className="inline-flex items-center gap-2">
                <button
                  disabled={i > step}
                  onClick={() => setStep(i)}
                  aria-current={i === step ? "step" : undefined}
                  className={i === step ? "current" : ""}
                >
                  {s}
                </button>
                {i < 3 && <ChevronRight size={13} />}
              </span>
            ))}
          </nav>
          <h1 className="booking-title">
            {
              [
                "Select Services",
                "Select Professional",
                "Select Date and Time",
                "Customer Information",
              ][step]
            }
          </h1>
          {step === 0 && (
            <ServicePicker
              items={booking.items}
              onChange={(items) => update({ items, time: "" })}
            />
          )}{" "}
          {step === 1 && (
            <ProfessionalPicker
              value={booking.professional}
              onChange={(professional) => update({ professional })}
            />
          )}{" "}
          {step === 2 && (
            <DateTimePicker
              date={booking.date}
              time={booking.time}
              duration={duration}
              onChange={update}
            />
          )}{" "}
          {step === 3 && (
            <CustomerForm
              value={booking.customer}
              onChange={(customer) => update({ customer })}
              onSubmit={(e) => {
                e.preventDefault();
                if (booking.customer.name.trim()) navigate("/payment");
              }}
            />
          )}
        </div>
        <BookingSummary
          booking={booking}
          onRemove={
            step === 0
              ? (id) =>
                  update({
                    items: booking.items.filter((i) => i.id !== id),
                    time: "",
                  })
              : undefined
          }
          onContinue={step === 3 ? () => {} : () => setStep(step + 1)}
          disabled={!valid[step]}
          form={step === 3 ? "customer-form" : undefined}
          label={step === 3 ? "Proceed to Payment" : "Continue"}
        />
      </div>
    </div>
  );
}
