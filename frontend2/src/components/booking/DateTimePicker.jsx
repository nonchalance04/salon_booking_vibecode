import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
export default function DateTimePicker({ date, time, onChange, duration }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [month, setMonth] = useState(() =>
    date
      ? new Date(`${date.slice(0, 7)}-01T12:00`)
      : new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const key = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const slots = Array.from({ length: 9 }, (_, i) => i + 8).filter(
    (hour) => hour * 60 + duration <= 18 * 60,
  );
  const label = (h) => `${h > 12 ? h - 12 : h}:00 ${h >= 12 ? "PM" : "AM"}`;
  return (
    <>
      <div className="calendar">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-bold text-lg">
            {month.toLocaleDateString("en-US", {
              month: "long",
              year: "numeric",
            })}
          </h2>
          <div className="flex gap-2">
            <button
              className="icon-button"
              aria-label="Previous month"
              disabled={
                month.getFullYear() === today.getFullYear() &&
                month.getMonth() === today.getMonth()
              }
              onClick={() =>
                setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))
              }
            >
              <ChevronLeft size={18} />
            </button>
            <button
              className="icon-button"
              aria-label="Next month"
              onClick={() =>
                setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))
              }
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-2 text-center">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <span key={d} className="text-xs muted py-2">
              {d}
            </span>
          ))}
          {Array.from({ length: month.getDay() }, (_, i) => (
            <span key={`blank-${i}`} />
          ))}
          {Array.from(
            {
              length: new Date(
                month.getFullYear(),
                month.getMonth() + 1,
                0,
              ).getDate(),
            },
            (_, i) => {
              const d = new Date(month.getFullYear(), month.getMonth(), i + 1);
              return (
                <button
                  key={i}
                  className={`calendar-day ${date === key(d) ? "selected" : ""}`}
                  disabled={d < today}
                  aria-label={d.toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                  aria-pressed={date === key(d)}
                  onClick={() => onChange({ date: key(d), time: "" })}
                >
                  {i + 1}
                </button>
              );
            },
          )}
        </div>
      </div>
      <h2 className="font-semibold text-lg mt-7 mb-3">Available times</h2>
      <p className="text-sm muted mb-4">
        {date
          ? "Choose your preferred start time. Availability is illustrative."
          : "Select a date to see appointment times."}
      </p>
      {date && (
        <div className="grid grid-cols-3 gap-3">
          {slots.map((hour) => (
            <button
              key={hour}
              disabled={
                hour < 10 ||
                (date === key(today) && hour <= new Date().getHours())
              }
              className={`time-slot ${time === label(hour) ? "selected" : ""}`}
              onClick={() => onChange({ date, time: label(hour) })}
              aria-pressed={time === label(hour)}
            >
              {label(hour)}
              {hour < 10 && <small>Fully booked</small>}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
