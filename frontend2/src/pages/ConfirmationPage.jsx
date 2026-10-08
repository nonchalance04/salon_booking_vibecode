import { useParams, Link, useNavigate } from "react-router-dom";
import { Check, Download, Pencil } from "lucide-react";
import { useBooking } from "../context/BookingContext";
import { money, professionals } from "../data/services";
import Button from "../components/ui/Button";
export default function ConfirmationPage() {
  const { reference } = useParams();
  const { appointments, setBooking } = useBooking();
  const appointment = appointments.find((a) => a.reference === reference);
  const navigate = useNavigate();
  if (!appointment)
    return (
      <section className="container page-section text-center">
        <h1 className="section-title">Appointment not found</h1>
        <p className="muted my-5">
          Demo appointments are available only in the browser tab where they
          were created.
        </p>
        <Link className="text-link" to="/manage">
          Find an appointment
        </Link>
      </section>
    );
  const total = appointment.items.reduce(
    (sum, i) => sum + i.price + (i.blowDry ? 170 : 0),
    0,
  );
  const staff = professionals.find(
    (p) => p.id === appointment.professional,
  )?.name;
  function download() {
    const text = `CLIQUE SALON & SPA\nDEMO RECEIPT — NO PAYMENT COLLECTED\nReference: ${reference}\nCustomer: ${appointment.customer.name}\nProfessional: ${staff}\nDate: ${appointment.date}\nTime: ${appointment.time}\nServices:\n${appointment.items.map((i) => `${i.name}${i.blowDry ? " + Blow Dry" : ""}: ${money(i.price + (i.blowDry ? 170 : 0))}`).join("\n")}\nTotal: ${money(total)}\nPayment method: ${appointment.customer.payment}\nStatus: Simulated confirmation`;
    const url = URL.createObjectURL(
      new Blob([text], { type: "text/plain;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `clique-${reference}.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <section className="container confirmation page-section">
      <div className="text-center">
        <div className="confirmation-check mx-auto">
          <Check size={30} />
        </div>
        <p className="eyebrow mt-6">YOU’RE ALL SET</p>
        <h1 className="section-title mt-3">Booking Confirmed!</h1>
        <p className="muted mt-4">
          Reference number: <strong className="gold">{reference}</strong>
        </p>
        <p className="text-sm muted mt-2">
          Demo confirmation · No real reservation or payment
        </p>
      </div>
      <div className="grid md:grid-cols-[1.4fr_1fr] gap-6 mt-10">
        <article className="confirmation-card">
          <p className="eyebrow">BOOKING DETAILS</p>
          <h2 className="text-2xl font-bold mt-5">
            {appointment.customer.name}
          </h2>
          <dl className="grid gap-3 mt-5 text-sm">
            <div>
              <dt>Hairdresser</dt>
              <dd>{staff}</dd>
            </div>
            <div>
              <dt>Services</dt>
              <dd>
                {appointment.items
                  .map((i) => i.name + (i.blowDry ? " + Blow Dry" : ""))
                  .join(", ")}
              </dd>
            </div>
            <div>
              <dt>Payment</dt>
              <dd>{appointment.customer.payment}</dd>
            </div>
          </dl>
          <div className="receipt-totals grid grid-cols-3 gap-3 mt-7">
            <div>
              <small>DATE</small>
              <p>{appointment.date}</p>
            </div>
            <div>
              <small>TIME</small>
              <p>{appointment.time}</p>
            </div>
            <div>
              <small>TOTAL</small>
              <p>{money(total)}</p>
            </div>
          </div>
        </article>
        <div className="flex flex-col gap-3">
          <Button
            onClick={() => {
              setBooking(appointment);
              navigate("/booking");
            }}
          >
            <Pencil size={16} />
            Edit Information
          </Button>
          <Button variant="secondary" onClick={download}>
            <Download size={16} />
            Download E-Receipt
          </Button>
          <div className="contact-card grow">
            <h2 className="font-bold">Contact Us</h2>
            <p className="text-sm muted my-3">
              Have a concern? Our team is happy to assist.
            </p>
            <a
              className="text-sm break-all underline"
              href="mailto:cliquecustomersupport@gmail.com"
            >
              cliquecustomersupport@gmail.com
            </a>
          </div>
        </div>
      </div>
      <div className="text-center mt-8">
        <Link className="text-link" to="/">
          Back to home
        </Link>
      </div>
    </section>
  );
}
