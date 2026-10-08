import { createContext, useContext, useState } from "react";
const BookingContext = createContext(null);
export const emptyBooking = {
  items: [],
  professional: "any",
  date: "",
  time: "",
  customer: { name: "", phone: "", email: "", notes: "", payment: "GCash QR" },
};
export function BookingProvider({ children }) {
  const [booking, setBooking] = useState(emptyBooking);
  const [appointments, setAppointments] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem("clique-demo") || "[]");
    } catch {
      return [];
    }
  });
  const update = (patch) => setBooking((current) => ({ ...current, ...patch }));
  const save = (value) => {
    const next = [
      ...appointments.filter((item) => item.reference !== value.reference),
      value,
    ];
    setAppointments(next);
    setBooking(emptyBooking);
    try {
      sessionStorage.setItem("clique-demo", JSON.stringify(next));
    } catch {
      /* Session memory still works when browser storage is unavailable. */
    }
  };
  return (
    <BookingContext.Provider
      value={{ booking, setBooking, update, appointments, save }}
    >
      {children}
    </BookingContext.Provider>
  );
}
export const useBooking = () => useContext(BookingContext);
