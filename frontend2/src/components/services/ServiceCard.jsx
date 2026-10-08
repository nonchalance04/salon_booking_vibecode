import { Scissors, Palette, Sparkles, Hand, ArrowUpRight } from "lucide-react";
import Button from "../ui/Button";
import { money } from "../../data/services";
const icons = {
  scissors: Scissors,
  palette: Palette,
  sparkles: Sparkles,
  hand: Hand,
};
export default function ServiceCard({ service, onDetails }) {
  const Icon = icons[service.icon] || Scissors;
  return (
    <article className="service-card flex flex-col">
      <div
        className={`service-icon service-icon--${service.icon || "scissors"}`}
      >
        <Icon size={35} strokeWidth={1.4} />
      </div>
      <h3 className="text-xl font-bold mt-6">{service.name}</h3>
      <p className="muted mt-3 grow">{service.description}</p>
      <div className="flex items-center justify-between gap-3 mt-7">
        <strong className="text-xl">{money(service.price)}</strong>
        <Button variant="text" onClick={() => onDetails(service)}>
          View details <ArrowUpRight size={17} />
        </Button>
      </div>
    </article>
  );
}
