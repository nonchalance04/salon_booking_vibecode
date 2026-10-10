import { useEffect, useRef, useState } from "react";
import type { StaffPublicProfile } from "./staff-profile";
import type { CatalogService } from "./public-site";

export type BookingStaff = { id: string; firstName: string; lastName: string; serviceIds: string[]; publicProfile?: StaffPublicProfile | null; statistics?: { appointmentsCompleted: number; clientsServed: number } };
type Selection = { key: number; serviceId: string; staffId: string };
const tabs = ["Profile", "Portfolio", "Reviews"] as const;

function Portrait({ person, large = false }: { person: BookingStaff; large?: boolean }) {
  const [failedPhoto, setFailedPhoto] = useState<string | null>(null);
  if (person.publicProfile?.photoUrl && failedPhoto !== person.publicProfile.photoUrl) return <img className={`professional-portrait${large ? " portrait-large" : ""}`} src={person.publicProfile.photoUrl} alt="" referrerPolicy="no-referrer" onError={() => setFailedPhoto(person.publicProfile!.photoUrl)} />;
  const hue = Array.from(person.id).reduce((sum, char) => sum + char.charCodeAt(0), 0) % 4;
  return <span className={`professional-portrait portrait-tone-${hue}${large ? " portrait-large" : ""}`} aria-hidden="true">
    <svg viewBox="0 0 80 80" fill="none"><path d="M10 80c0-21 12-32 30-32s30 11 30 32" fill="currentColor"/><ellipse cx="40" cy="32" rx="16" ry="19" fill="#e8c7ac"/><path d="M23 31c-3-17 6-23 17-23 14 0 21 11 17 26l-7-16c-7 8-15 8-27 13Z" fill="#35332f"/><path d="M34 47h12v10l-6 6-6-6" fill="#e8c7ac"/></svg>
    <span>{person.firstName[0]}{person.lastName[0]}</span>
  </span>;
}

function PortfolioImage({ url, title }: { url: string; title: string }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  return failedUrl === url ? <div className="portfolio-art portfolio-unavailable">Image unavailable</div> : <img className="portfolio-photo" src={url} alt={title} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailedUrl(url)} />;
}

function Profile({ person, services, onClose, onSelect }: { person: BookingStaff; services: CatalogService[]; onClose: () => void; onSelect: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [tab, setTab] = useState<(typeof tabs)[number]>("Profile");
  const profile = person.publicProfile;
  const qualified = services.filter(service => person.serviceIds.includes(service.id));
  useEffect(() => {
    const element = dialog.current;
    const trigger = document.activeElement;
    element?.showModal();
    return () => { element?.close(); if (trigger instanceof HTMLElement) trigger.focus(); };
  }, []);
  return <dialog ref={dialog} className="professional-dialog" aria-label={`${person.firstName} ${person.lastName} profile`} onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="professional-modal-content"><button type="button" className="profile-close" aria-label="Close profile" onClick={onClose} autoFocus>×</button>
      <header className="professional-profile-header"><Portrait person={person} large /><h2>{person.firstName} {person.lastName}</h2><p>{profile?.title || "Salon professional"}</p></header>
      <div className="profile-tabs" role="tablist" aria-label="Professional details">{tabs.map((name, i) => <button type="button" key={name} id={`profile-tab-${name}`} role="tab" aria-selected={tab === name} aria-controls="professional-tab-panel" tabIndex={tab === name ? 0 : -1} onClick={() => setTab(name)} onKeyDown={event => {
        const next = event.key === "ArrowRight" ? (i + 1) % tabs.length : event.key === "ArrowLeft" ? (i + tabs.length - 1) % tabs.length : event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : -1;
        if (next >= 0) { event.preventDefault(); setTab(tabs[next]!); document.getElementById(`profile-tab-${tabs[next]}`)?.focus(); }
      }}>{name}</button>)}</div>
      <div id="professional-tab-panel" className="professional-tab-panel" role="tabpanel" aria-labelledby={`profile-tab-${tab}`} tabIndex={0}>
        {tab === "Profile" && <><p className="profile-bio">{profile?.bio || "Meet your salon professional. Choose from their bookable services below."}</p><dl className="professional-facts"><div><dt>Appointments completed</dt><dd>{person.statistics?.appointmentsCompleted ?? 0}</dd></div><div><dt>Clients served</dt><dd>{person.statistics?.clientsServed ?? 0}</dd></div><div><dt>Languages</dt><dd>{profile?.languages.length ? profile.languages.join(", ") : "Not listed"}</dd></div></dl><h3>Bookable services</h3><div className="professional-specialties">{qualified.map(service => <span key={service.id}>{service.name}</span>)}</div></>}
        {tab === "Portfolio" && <><h3>A little inspiration</h3>{profile?.portfolio.length ? <div className="professional-portfolio">{profile.portfolio.map((item, i) => <article key={i}><PortfolioImage url={item.imageUrl} title={item.title} /><h4>{item.title}</h4>{item.caption && <p>{item.caption}</p>}</article>)}</div> : <p className="muted">Portfolio photos haven’t been added yet.</p>}</>}
        {tab === "Reviews" && <><h3>Kind words</h3>{profile?.reviews.length ? <><p className="muted">Client testimonials shared by the salon.</p>{profile.reviews.map((review, i) => <div className="professional-review" key={i}><span aria-label={`${review.rating} out of 5 stars`}>{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</span><blockquote>“{review.text}”</blockquote><p>{review.author}</p></div>)}</> : <p className="muted">No client testimonials have been published yet.</p>}</>}

      </div>

      <button type="button" className="profile-select" onClick={onSelect}>Choose {person.firstName} <span aria-hidden="true">→</span></button>
    </div>
  </dialog>;
}

export function ProfessionalPicker({ selections, staff, services, onSelect }: { selections: Selection[]; staff: BookingStaff[]; services: CatalogService[]; onSelect: (key: number, staffId: string) => void }) {
  const [profile, setProfile] = useState<{ person: BookingStaff; rowKey: number } | null>(null);
  return <div className="professional-picker"><p className="professional-guidance">Choose a professional for each service, or keep your options open with any available professional.</p>
    {selections.map((row, i) => {
      const people = staff.filter(person => person.serviceIds.includes(row.serviceId));
      const service = services.find(service => service.id === row.serviceId);
      return <section className="professional-service-group" aria-label={`Professional for service ${i + 1}: ${service?.name}`} key={row.key}>
        <div className="professional-service-title"><h2>{selections.length > 1 ? `${i + 1}. ` : ""}{service?.name}</h2><span>{people.length} {people.length === 1 ? "professional" : "professionals"}</span></div>
        <div className={`professional-card professional-any${row.staffId === "" ? " is-selected" : ""}`}><span className="professional-any-icon" aria-hidden="true">⇄</span><div className="professional-card-copy"><h3>Any professional</h3><p>More flexibility for your visit</p></div><button type="button" className="professional-select" aria-label={`Any available professional for service ${i + 1}`} aria-pressed={!row.staffId} onClick={() => onSelect(row.key, "")}>{!row.staffId ? "Selected" : "Select"}</button></div>
        {people.map(person => <article className={`professional-card${row.staffId === person.id ? " is-selected" : ""}`} key={person.id}><Portrait person={person}/><div className="professional-card-copy"><h3>{person.firstName} {person.lastName}</h3><p>{person.publicProfile?.title || "Salon professional"}</p><button type="button" className="professional-view-profile" aria-label={`View profile of ${person.firstName} ${person.lastName} for service ${i + 1}`} onClick={() => setProfile({person, rowKey: row.key})}>View profile ↗</button></div><button type="button" className="professional-select" aria-label={`Select ${person.firstName} ${person.lastName} for service ${i + 1}`} aria-pressed={row.staffId === person.id} onClick={() => onSelect(row.key, person.id)}>{row.staffId === person.id ? "Selected" : "Select"}</button></article>)}
        {!people.length && <p className="professional-empty">No specific professionals are listed for this service. We’ll check staff availability when you choose your time.</p>}
      </section>;
    })}
    {profile && <Profile key={`${profile.person.id}-${profile.rowKey}`} person={profile.person} services={services} onClose={() => setProfile(null)} onSelect={() => { onSelect(profile.rowKey, profile.person.id); setProfile(null); }}/>} 
  </div>;
}
