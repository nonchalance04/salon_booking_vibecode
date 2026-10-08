import { useState } from "react";
import { Check, Sparkles } from "lucide-react";
import { professionals } from "../../data/services";
import Modal from "../ui/Modal";
export default function ProfessionalPicker({ value, onChange }) {
  const [profile, setProfile] = useState(null);
  const [tab, setTab] = useState("Profile");
  return (
    <>
      <div className="grid gap-3">
        {professionals.map((p) => (
          <div
            key={p.id}
            className={`professional-option flex items-center gap-4 ${value === p.id ? "selected" : ""}`}
          >
            {p.image ? (
              <img className="avatar" src={p.image} alt={p.name} />
            ) : (
              <div className="avatar any-avatar">
                <Sparkles />
              </div>
            )}
            <div className="grow">
              <h2 className="font-semibold">{p.name}</h2>
              <p className="muted text-sm mt-1">{p.role}</p>
              {p.image && (
                <button
                  className="profile-link"
                  onClick={() => {
                    setProfile(p);
                    setTab("Profile");
                  }}
                >
                  View profile
                </button>
              )}
            </div>
            <button
              className={`category-chip ${value === p.id ? "selected" : ""}`}
              onClick={() => onChange(p.id)}
              aria-label={`Select ${p.name}`}
              aria-pressed={value === p.id}
            >
              {value === p.id ? <Check size={18} /> : "Select"}
            </button>
          </div>
        ))}
      </div>
      {profile && (
        <Modal title="Meet your professional" onClose={() => setProfile(null)}>
          <div className="text-center">
            <img
              className="profile-avatar mx-auto"
              src={profile.image}
              alt={profile.name}
            />
            <h3 className="text-xl font-bold mt-4">{profile.name}</h3>
            <p className="muted mt-1">{profile.role}</p>
          </div>
          <div className="flex justify-center gap-3 my-6">
            {["Profile", "Portfolio", "Reviews"].map((t) => (
              <button
                key={t}
                className={`category-chip ${tab === t ? "selected" : ""}`}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
          </div>
          {tab === "Profile" ? (
            <div className="text-sm flex justify-between">
              <span>Languages</span>
              <span>English · Tagalog</span>
            </div>
          ) : (
            <p className="muted text-center py-4">
              {tab === "Portfolio"
                ? "Portfolio photos will be available soon."
                : "No published reviews yet."}
            </p>
          )}
        </Modal>
      )}
    </>
  );
}
