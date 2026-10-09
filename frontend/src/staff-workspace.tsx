import { useEffect, useRef, useState, type ReactNode } from "react";
import { useAuth } from "./auth";
import { Configuration } from "./configuration";
import { AdminAppointments } from "./appointment-management";
import { SettlementWorkspace } from "./settlement";
import { Reports } from "./reports";
import { PaymentsWorkspace } from "./payments";

type Page = "dashboard" | "configuration" | "accounts" | "appointments" | "payments" | "settlement" | "reports";
const paths = {
  dashboard: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  configuration: "M4 5h16v5H4z M4 14h16v5H4z M7 7.5h.01 M7 16.5h.01",
  accounts: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M22 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75",
  appointments: "M5 5h14a2 2 0 0 1 2 2v13H3V7a2 2 0 0 1 2-2 M7 3v4 M17 3v4 M3 11h18 M7 15h3 M14 15h3",
  payments: "M3 5h18v14H3z M3 10h18 M7 15h4",
  settlement: "M6 3h12v18l-3-2-3 2-3-2-3 2z M9 7h6 M9 11h6 M9 15h3",
  reports: "M3 3v18h18 M7 16v-5 M12 16V7 M17 16V4",
};
function Icon({ name }: { name: Page }) {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}
type Item = { id: Page; label: string; description: string };
const adminItems: Item[] = [
  { id: "configuration", label: "Manage Master Data", description: "Services, stylists, schedules and booking policies." },
  { id: "accounts", label: "Accounts & Permissions", description: "Manage Admin and Cashier access." },
  { id: "reports", label: "Reports & Analytics", description: "Collections, appointments, commissions and audit history." },
  { id: "appointments", label: "Appointment Overview", description: "Review bookings, manage changes and record no-shows." },
  { id: "payments", label: "Appointment Fees", description: "Review payments, issue receipts and reconcile collections." },
  { id: "settlement", label: "Outcomes & Commissions", description: "Review service outcomes, settlement and commissions." },
];
const cashierItems: Item[] = [
  { id: "settlement", label: "Service Settlement", description: "Record service outcomes and settle completed visits." },
  { id: "payments", label: "Appointment Fees", description: "Record received payments and issue receipts." },
  { id: "reports", label: "Collections", description: "Review collection totals and payment breakdowns." },
];

export function StaffWorkspace({ accounts }: { accounts: ReactNode }) {
  const { user, logout } = useAuth();
  const admin = user?.role === "ADMIN";
  const items = admin ? adminItems : cashierItems;
  const [page, setPage] = useState<Page>("dashboard");
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const menuButton = useRef<HTMLButtonElement>(null);
  const current = items.find(item => item.id === page);
  useEffect(() => {
    if (!menuOpen) return;
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") { setMenuOpen(false); menuButton.current?.focus(); }
    }
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [menuOpen]);
  function navigate(id: Page) {
    setPage(id); setMenuOpen(false);
    if (menuOpen) menuButton.current?.focus();
    window.scrollTo(0, 0);
  }
  async function signOut() {
    setBusy(true); setError("");
    try { await logout(); } catch (err) { setError(err instanceof Error ? err.message : "Unable to sign out. Please try again."); }
    finally { setBusy(false); }
  }
  return <div className={`staff-workspace ${admin ? "admin-workspace" : "cashier-workspace"}`}>
    <a className="staff-skip" href="#staff-content">Skip to content</a>
    <button ref={menuButton} className="staff-menu-toggle" aria-label={menuOpen ? "Close navigation" : "Open navigation"} aria-expanded={menuOpen} aria-controls="staff-navigation" onClick={() => setMenuOpen(!menuOpen)}>☰ <span>Menu</span></button>
    {menuOpen && <button className="staff-menu-backdrop" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}
    <aside className={`staff-sidebar ${menuOpen ? "is-open" : ""}`}>
      <div className="staff-brand"><a href="/" className="staff-brand-mark" aria-label="Clique Salon home">CLIQUE</a><div><strong>{user?.firstName}</strong><small>{admin ? "ADMIN ACCOUNT" : "CASHIER ACCOUNT"}</small></div></div>
      <p className="staff-nav-caption">WORKSPACE</p>
      <nav id="staff-navigation" aria-label={admin ? "Admin workspace" : "Cashier workspace"}>
        {[{ id: "dashboard" as const, label: "Dashboard" }, ...items].map(item => <button key={item.id} className="staff-nav-item" aria-current={page === item.id ? "page" : undefined} onClick={() => navigate(item.id)}><Icon name={item.id} /><span>{item.label}</span></button>)}
      </nav>
      <div className="staff-sidebar-footer"><div className="staff-identity"><Icon name="accounts" /><span>{user?.firstName} {user?.lastName}<small>{admin ? "Administrator" : "Cashier"}</small></span></div><button disabled={busy} onClick={() => void signOut()}><span aria-hidden="true">↪</span>{busy ? "Signing out…" : "Log Out"}</button></div>
    </aside>
    <div className="staff-panel">
      <header className={`staff-top-header ${page === "dashboard" ? "staff-dashboard-header" : ""}`}><div><p className="staff-kicker">CLIQUE SALON AND SPA · {admin ? "ADMIN" : "CASHIER"}</p><h1>{current?.label || "Dashboard"}</h1><p>{current?.description || `Welcome back, ${user?.firstName}. Everything you need for a beautiful day.`}</p></div><span className="staff-role-badge">{admin ? "Admin workspace" : "Cashier workspace"}</span></header>
      <main id="staff-content" className="staff-content" tabIndex={-1}>
        {error && <p className="error" role="alert">{error}</p>}
        {page === "dashboard" ? <><div className="staff-section-heading"><div><p className="staff-kicker">YOUR DAILY WORKSPACE</p><h2>Let’s get started</h2></div><span className="muted">Choose a workspace to continue</span></div><div className="staff-tool-grid">{items.map(item => <button className="staff-tool-card" key={item.id} onClick={() => navigate(item.id)}><span className="staff-tool-icon"><Icon name={item.id} /></span><strong>{item.label}</strong><span>{item.description}</span><span className="staff-card-link">Open workspace <span aria-hidden="true">↗</span></span></button>)}</div><div className="staff-module"><Reports admin={admin} /></div></> : <div className="staff-module" key={page}>{page === "configuration" && admin ? <Configuration /> : page === "accounts" && admin ? accounts : page === "appointments" && admin ? <AdminAppointments /> : page === "payments" ? <PaymentsWorkspace admin={admin} /> : page === "settlement" ? <SettlementWorkspace admin={admin} /> : <Reports admin={admin} />}</div>}
      </main>
      <footer className="staff-footer">Clique Salon and Spa <span>{admin ? "Administration" : "Cashier"} workspace</span></footer>
    </div>
  </div>;
}
