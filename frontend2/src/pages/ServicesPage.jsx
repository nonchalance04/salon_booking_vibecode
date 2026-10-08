import { useNavigate, useSearchParams } from "react-router-dom";
import { useState } from "react";
import { Search } from "lucide-react";
import { services, categories, money, durationLabel } from "../data/services";
import ServiceCard from "../components/services/ServiceCard";
import Modal from "../components/ui/Modal";
import Button from "../components/ui/Button";
import { useBooking } from "../context/BookingContext";
export default function ServicesPage() {
  const [params, setParams] = useSearchParams();
  const [category, setCategory] = useState("All services");
  const navigate = useNavigate();
  const { booking, update } = useBooking();
  const query = params.get("q") || "";
  const detail = services.find((s) => s.id === params.get("service"));
  const filtered = services.filter(
    (s) =>
      (category === "All services" || s.category === category) &&
      s.name.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <section className="container page-section">
      <p className="eyebrow">FIND YOUR NEXT FAVORITE</p>
      <h1 className="section-title mt-3">Our Services</h1>
      <p className="muted mt-4">
        A fresh look. A little care. A moment just for you.
      </p>
      <div className="flex flex-wrap justify-between gap-5 my-8">
        <div className="flex flex-wrap gap-2">
          {["All services", ...categories].map((c) => (
            <button
              key={c}
              className={`category-chip ${category === c ? "selected" : ""}`}
              onClick={() => setCategory(c)}
            >
              {c}
            </button>
          ))}
        </div>
        <label className="search-box flex items-center gap-2">
          <Search size={17} />
          <input
            aria-label="Filter services"
            placeholder="Search services"
            value={query}
            onChange={(e) =>
              setParams(e.target.value ? { q: e.target.value } : {})
            }
          />
        </label>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.map((s) => (
          <ServiceCard
            key={s.id}
            service={s}
            onDetails={(s) =>
              setParams({ ...(query ? { q: query } : {}), service: s.id })
            }
          />
        ))}
      </div>
      {filtered.length === 0 && (
        <div className="empty-state">
          <h2 className="font-bold">No services available</h2>
          <p className="muted mt-2">Try another category or search term.</p>
          <Button
            variant="secondary"
            className="mt-5"
            onClick={() => {
              setCategory("All services");
              setParams({});
            }}
          >
            Show all services
          </Button>
        </div>
      )}
      {detail && (
        <Modal
          title={detail.name}
          onClose={() => setParams(query ? { q: query } : {})}
        >
          <p className="muted leading-relaxed">{detail.description}</p>
          <div className="flex justify-between my-7">
            <span>{durationLabel(detail.duration)}</span>
            <strong>{money(detail.price)}</strong>
          </div>
          {detail.addon && (
            <p className="text-sm muted mb-5">
              Optional blow dry is available for ₱170 during booking.
            </p>
          )}
          <Button
            className="w-full"
            onClick={() => {
              if (!booking.items.some((i) => i.id === detail.id))
                update({ items: [...booking.items, detail] });
              navigate("/booking");
            }}
          >
            Book this service
          </Button>
        </Modal>
      )}
    </section>
  );
}
