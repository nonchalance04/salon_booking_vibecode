import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, CalendarDays } from "lucide-react";
import ServiceCard from "../components/services/ServiceCard";
import AboutSection from "../components/services/AboutSection";
import { services } from "../data/services";
export default function HomePage() {
  const navigate = useNavigate();
  return (
    <>
      <section className="container hero grid lg:grid-cols-[0.88fr_1.12fr]">
        <div className="hero-copy flex flex-col justify-center">
          <p className="eyebrow">BEAUTY. CONFIDENCE. YOU.</p>
          <h1>
            Look Good.
            <br />
            <span>Feel Amazing.</span>
          </h1>
          <p className="hero-description">
            Discover our professional salon services
            <br className="hidden xl:block" /> and book your appointment with
            ease.
          </p>
          <div className="flex flex-col items-start gap-4 mt-8">
            <Link
              className="button button--primary hero-cta inline-flex items-center justify-between gap-5"
              to="/booking"
            >
              <span>Book an Appointment</span>
              <ArrowRight size={19} />
            </Link>
            <Link className="manage-link flex items-center gap-2" to="/manage">
              <CalendarDays size={16} />
              Manage Existing Appointment
            </Link>
          </div>
        </div>
        <div className="hero-image-wrap">
          <img
            src="/images/salon-hero.jpg"
            className="hero-image"
            alt="A stylist caring for a client's hair in the salon"
          />
          <div className="hero-image-caption">
            <span className="tiny-line" /> A little time for yourself.
          </div>
        </div>
      </section>
      <section className="container services-section">
        <div className="flex flex-wrap items-end justify-between gap-5 mb-9">
          <div>
            <p className="eyebrow">MADE FOR YOUR MOMENT</p>
            <h2 className="section-title mt-3">Browse Services</h2>
            <p className="muted mt-3">
              Explore our most popular salon services.
            </p>
          </div>
          <Link
            to="/services"
            className="text-link inline-flex items-center gap-2"
          >
            View all services <ArrowRight size={18} />
          </Link>
        </div>
        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-5">
          {services
            .filter((s) => s.featured)
            .map((service) => (
              <ServiceCard
                key={service.id}
                service={service}
                onDetails={(s) => navigate(`/services?service=${s.id}`)}
              />
            ))}
        </div>
      </section>
      <AboutSection />
    </>
  );
}
