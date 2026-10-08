import { Heart, UsersRound, Star } from "lucide-react";
export default function AboutSection() {
  return (
    <section className="container about-section grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
      <img
        className="about-image"
        src="/images/salon-interior.jpg"
        alt="Bright Clique salon interior with styling chairs and illuminated mirrors"
        loading="lazy"
      />
      <div>
        <p className="eyebrow">A LITTLE ABOUT CLIQUE</p>
        <h2 className="section-title mt-3">
          Your beauty.
          <br />
          <span className="gold">Our passion.</span>
        </h2>
        <p className="muted mt-6 leading-relaxed">
          At Clique Salon, we believe beauty is about feeling good in your own
          skin. Our mission is to provide exceptional salon services in a
          relaxing and welcoming environment.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-10">
          {[
            [
              Heart,
              "Quality Service",
              "High-quality products and professional techniques.",
            ],
            [
              UsersRound,
              "Expert Stylists",
              "Experienced hands to bring out the best in you.",
            ],
            [Star, "Customer Care", "Your satisfaction is our top priority."],
          ].map(([Icon, title, text]) => (
            <div key={title}>
              <Icon className="gold mb-4" size={27} strokeWidth={1.5} />
              <h3 className="font-bold mb-2">{title}</h3>
              <p className="text-sm muted leading-relaxed">{text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
