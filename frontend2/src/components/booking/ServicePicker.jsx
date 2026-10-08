import { useState } from "react";
import { Plus, Check, ListFilter } from "lucide-react";
import {
  categories,
  services,
  money,
  durationLabel,
} from "../../data/services";
import Modal from "../ui/Modal";
import Button from "../ui/Button";
export default function ServicePicker({ items, onChange }) {
  const [category, setCategory] = useState(categories[0]);
  const [all, setAll] = useState(false);
  const [selected, setSelected] = useState(null);
  const [blowDry, setBlowDry] = useState(false);
  function choose(service) {
    if (items.some((s) => s.id === service.id)) {
      onChange(items.filter((s) => s.id !== service.id));
      return;
    }
    if (service.addon) {
      setSelected(service);
      setBlowDry(false);
    } else onChange([...items, service]);
  }
  return (
    <>
      <div className="flex gap-2 flex-wrap mb-6">
        {categories.slice(0, all ? 5 : 3).map((c) => (
          <button
            key={c}
            className={`category-chip ${category === c ? "selected" : ""}`}
            onClick={() => setCategory(c)}
          >
            {c}
          </button>
        ))}
        <button
          className="icon-button"
          aria-label="Show all service categories"
          aria-expanded={all}
          onClick={() => setAll(!all)}
        >
          <ListFilter size={18} />
        </button>
      </div>
      <h2 className="text-xl font-semibold mb-4">{category}</h2>
      <div className="grid gap-3">
        {services
          .filter((s) => s.category === category)
          .map((service) => {
            const active = items.some((s) => s.id === service.id);
            return (
              <button
                key={service.id}
                className={`service-option text-left ${active ? "selected" : ""}`}
                onClick={() => choose(service)}
                aria-pressed={active}
              >
                <div className="flex justify-between gap-4">
                  <div>
                    <h3 className="font-semibold text-lg">{service.name}</h3>
                    <p className="muted text-sm mt-1">
                      {durationLabel(service.duration)}
                    </p>
                    <strong className="block mt-5">
                      {money(service.price)}
                    </strong>
                  </div>
                  <span
                    className={`select-circle self-end ${active ? "selected" : ""}`}
                  >
                    {active ? <Check size={19} /> : <Plus size={20} />}
                  </span>
                </div>
              </button>
            );
          })}
        {category === categories[4] && (
          <div className="empty-state">
            <h3 className="font-semibold">
              A little relaxation is on its way.
            </h3>
            <p className="muted mt-2">
              Spa services are not available for online booking yet. Please
              explore our other services.
            </p>
          </div>
        )}
      </div>
      {selected && (
        <Modal title={selected.name} onClose={() => setSelected(null)}>
          <p className="muted text-sm mb-5">
            Personalize your appointment with an optional add-on.
          </p>
          <label
            className={`addon-choice flex gap-4 items-center ${blowDry ? "selected" : ""}`}
          >
            <input
              type="checkbox"
              checked={blowDry}
              onChange={(e) => setBlowDry(e.target.checked)}
            />
            <div className="grow">
              <strong>With Blow Dry</strong>
              <p className="muted text-sm mt-1">A smooth, styled finish</p>
            </div>
            <strong>+{money(170)}</strong>
          </label>
          <div className="flex justify-between mt-8 mb-5 font-bold">
            <span>Total</span>
            <span>{money(selected.price + (blowDry ? 170 : 0))}</span>
          </div>
          <Button
            className="w-full"
            onClick={() => {
              onChange([...items, { ...selected, blowDry }]);
              setSelected(null);
            }}
          >
            Add to appointment
          </Button>
        </Modal>
      )}
    </>
  );
}
