import { useEffect, useState, type FormEvent } from "react";
import { api } from "./api";
type Collections = { timeZone: string; basis: string; totals: { currency: string; captured: string; refunded: string; netCashMovement: string; successfulApplied: string; successfulUnapplied: string; reconciliationRequired: string }[]; methodTotals: Record<string, unknown>[]; typeTotals: Record<string, unknown>[]; breakdown: Record<string, unknown>[] };
type Report = { rows: Record<string, unknown>[]; total: number; page: number; pageSize: number; dateBasis: string; timeZone: string };
type Dashboard = { appointments: { status: string; count: number }[]; finalizedCommissions: string; commissionCount: number };
const label = (key: string) => key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, s => s.toUpperCase());
function Value({ value }: { value: unknown }) {
  if (value == null) return <>—</>;
  if (Array.isArray(value)) return <ul>{value.map((item, i) => <li key={i}><Value value={item} /></li>)}</ul>;
  if (typeof value === "object") return <dl className="report-details">{Object.entries(value).map(([key, item]) => <div key={key}><dt>{label(key)}</dt><dd><Value value={item} /></dd></div>)}</dl>;
  if (typeof value === "boolean") return <>{value ? "Yes" : "No"}</>;
  return <>{String(value)}</>;
}
function DataTable({ rows }: { rows: Record<string, unknown>[] }) {
  if (!rows.length) return <p>No records in this period.</p>;
  const columns = Object.keys(rows[0]).filter(k => k !== "id");
  return <div className="table-wrap"><table><thead><tr>{columns.map(c => <th key={c}>{label(c)}</th>)}</tr></thead><tbody>{rows.map((row, i) => <tr key={String(row.id ?? i)}>{columns.map(c => <td key={c}>{typeof row[c] === "object" && row[c] !== null ? <details><summary>View details</summary><Value value={row[c]} /></details> : <Value value={row[c]} />}</td>)}</tr>)}</tbody></table></div>;
}
export function Reports({ admin, initialKind = "appointments" }: { admin: boolean; initialKind?: string }) {
  const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  const [kind, setKind] = useState(initialKind); const [collections, setCollections] = useState<Collections | null>(null);
  const [report, setReport] = useState<Report | null>(null); const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  // Initialize using the configured salon timezone, rather than the browser's date.
  useEffect(() => { let active = true; void api<{ timeZone: string }>("/salon").then(salon => {
    if (!active) return; const today = new Intl.DateTimeFormat("en-CA", { timeZone: salon.timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    setFrom(today); setTo(today);
  }).catch(err => { if (active) setError(err instanceof Error ? err.message : "Unable to load salon date."); }); return () => { active = false; }; }, []);
  async function load(page = 1) {
    setBusy(true); setError(""); setReport(null); setCollections(null); setDashboard(null);
    const query = new URLSearchParams({ from, to, page: String(page), pageSize: "25" });
    try {
      const [c, r, d] = await Promise.all([api<Collections>(`/reports/collections?${query}`), admin ? api<Report>(`/reports/${kind}?${query}`) : null, admin ? api<Dashboard>(`/reports/dashboard?${query}`) : null]);
      setCollections(c); setReport(r); setDashboard(d);
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to load reports."); }
    finally { setBusy(false); }
  }
  function submit(e: FormEvent) { e.preventDefault(); void load(); }
  function clear() { setCollections(null); setReport(null); setDashboard(null); }
  return <section><h2>{admin ? "Reports & dashboard" : "Collection summary"}</h2><p>Choose up to 366 days in salon time. Reports use historical transactions and stored service values.</p>
    <form className="account-form" onSubmit={submit}><div className="form-grid"><label>From<input type="date" required value={from} disabled={busy} onChange={e => { setFrom(e.target.value); clear(); }} /></label><label>Through<input type="date" required value={to} min={from} disabled={busy} onChange={e => { setTo(e.target.value); clear(); }} /></label>
    {admin && <label>Report<select value={kind} disabled={busy} onChange={e => { setKind(e.target.value); clear(); }}>{["appointments", "payments", "receipts", "commissions", "audit"].map(k => <option key={k} value={k}>{label(k)}</option>)}</select></label>}</div><button className="primary" disabled={busy}>{busy ? "Loading…" : "Run report"}</button></form>
    {error && <p role="alert" className="error">{error}</p>}
    {collections && <><h3>Collections</h3><p>{collections.basis} Timezone: {collections.timeZone}.</p><DataTable rows={collections.totals} /><p>Successful applied and unapplied amounts describe current payment status. Reconciliation required is a subset, not an additional collection.</p><h3>Cash, GCash & other collections</h3><DataTable rows={collections.methodTotals} /><h3>Appointment fees & service payment captures</h3><DataTable rows={collections.typeTotals} /><details><summary>Collection breakdown by payment type and method</summary><DataTable rows={collections.breakdown} /></details></>}
    {dashboard && <><h3>Appointment activity</h3><p>Counts use scheduled start dates and current status. Finalized commissions in period: PHP {dashboard.finalizedCommissions} ({dashboard.commissionCount} records).</p><DataTable rows={dashboard.appointments} /></>}
    {report && <><h3>{label(kind)}</h3><p>{report.total} records · Date basis: {report.dateBasis}. Timestamps in details use ISO format with UTC offsets.</p><DataTable rows={report.rows} /><div className="actions"><button disabled={busy || report.page <= 1} onClick={() => void load(report.page - 1)}>Previous</button><span>Page {report.page} of {Math.max(1, Math.ceil(report.total / report.pageSize))}</span><button disabled={busy || report.page * report.pageSize >= report.total} onClick={() => void load(report.page + 1)}>Next</button></div></>}
  </section>;
}
