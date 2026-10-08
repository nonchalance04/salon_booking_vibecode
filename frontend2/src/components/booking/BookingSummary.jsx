import { MapPin, CalendarDays, Clock3, X } from "lucide-react";
import { money, professionals } from "../../data/services";
import Button from "../ui/Button";
export default function BookingSummary({
  booking,
  onRemove,
  onContinue,
  disabled,
  label = "Continue",
  form,
}) {
  const total = booking.items.reduce(
    (sum, item) => sum + item.price + (item.blowDry ? 170 : 0),
    0,
  );
  return (
    <aside className="booking-summary flex flex-col">
      <div className="flex items-center gap-4 pb-6 border-b border-stone-200">
        <img
          className="salon-thumb"
          src="/images/salon-thumb.jpg"
          alt="Hair styling at Clique"
        />
        <div>
          <h2 className="text-xl font-bold">Clique Salon</h2>
          <p className="muted text-xs mt-2 flex gap-1">
            <MapPin size={14} className="shrink-0" />
            79 Geronimo St., Brgy. Bagong Silang
          </p>
        </div>
      </div>
      <div className="py-6 grow">
        {booking.items.length === 0 ? (
          <p className="muted text-sm text-center py-8">
            Your moment of self-care starts here.
            <br />
            Add a service to your appointment.
          </p>
        ) : (
          booking.items.map((item) => (
            <div key={item.id} className="summary-item">
              <div className="flex justify-between gap-3">
                <strong className="text-sm">{item.name}</strong>
                <div className="flex gap-2 items-center text-sm">
                  <span>{money(item.price)}</span>
                  {onRemove && (
                    <button
                      aria-label={`Remove ${item.name}`}
                      onClick={() => onRemove(item.id)}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>
              {item.blowDry && (
                <p className="flex justify-between text-xs muted mt-2">
                  <span>With blow dry</span>
                  <span>{money(170)}</span>
                </p>
              )}
              <p className="text-xs muted mt-2">
                {item.duration} min ·{" "}
                {professionals.find((p) => p.id === booking.professional)?.name}
              </p>
            </div>
          ))
        )}
        {booking.date && (
          <div className="summary-schedule">
            <p className="flex gap-2 items-center">
              <CalendarDays size={15} />
              {new Date(`${booking.date}T12:00`).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </p>
            {booking.time && (
              <p className="flex gap-2 items-center mt-2">
                <Clock3 size={15} />
                {booking.time}
              </p>
            )}
          </div>
        )}
      </div>
      <div className="flex justify-between border-t border-stone-200 py-5 font-bold">
        <span>Total</span>
        <span className="text-xl">{money(total)}</span>
      </div>
      {onContinue && (
        <Button
          key={label}
          variant="dark"
          className="w-full"
          disabled={disabled}
          onClick={onContinue}
          type={form ? "submit" : "button"}
          form={form}
        >
          {label}
        </Button>
      )}
      <p className="text-xs muted text-center mt-4">
        Frontend demo · No payment is collected
      </p>
    </aside>
  );
}
