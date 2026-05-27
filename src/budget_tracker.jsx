import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";

// ─────────────────────────────────────────────────────────────────────────────
// Data constants
// ─────────────────────────────────────────────────────────────────────────────
const FIXED_CATEGORIES = [
  { key: "rent",       label: "Rent / Housing", icon: "🏠", color: "#4f46e5", fill: "#6366f1" },
  { key: "family",     label: "Family",          icon: "👨‍👩‍👧", color: "#be185d", fill: "#ec4899" },
  { key: "loanEmi",   label: "Loan EMI",         icon: "🏦", color: "#b45309", fill: "#f59e0b" },
  { key: "creditCard", label: "Credit Card",     icon: "💳", color: "#b91c1c", fill: "#ef4444" },
  { key: "sip",        label: "Savings / SIP",   icon: "📈", color: "#047857", fill: "#10b981" },
];
const VARIABLE_CATEGORIES = [
  { key: "food",      label: "Food & Dining", icon: "🍽️", color: "#065f46", fill: "#10b981" },
  { key: "groceries", label: "Groceries",     icon: "🛒", color: "#0f766e", fill: "#14b8a6" },
  { key: "transport", label: "Transport",     icon: "🚗", color: "#1d4ed8", fill: "#3b82f6" },
];
const WELLBEING_CATEGORIES = [
  { key: "savings",       label: "Savings / Investment", icon: "💰", color: "#0369a1", fill: "#0ea5e9" },
  { key: "insurance",     label: "Insurance",            icon: "🛡️", color: "#0e7490", fill: "#0891b2" },
  { key: "medical",       label: "Medical / Health",     icon: "🏥", color: "#c2410c", fill: "#f97316" },
  { key: "education",     label: "Education",            icon: "📚", color: "#7e22ce", fill: "#a855f7" },
  { key: "entertainment", label: "Entertainment",        icon: "🎬", color: "#9f1239", fill: "#fb7185" },
  { key: "utilities",     label: "Utilities",            icon: "⚡", color: "#92400e", fill: "#fbbf24" },
];
const ALL_SCALAR = [...FIXED_CATEGORIES, ...VARIABLE_CATEGORIES, ...WELLBEING_CATEGORIES];
const CHART_CATS = [
  ...ALL_SCALAR,
  { key: "subscriptions", label: "Subscriptions", icon: "📱", color: "#6d28d9", fill: "#8b5cf6" },
  { key: "other",         label: "Other",          icon: "📦", color: "#475569", fill: "#94a3b8" },
];
const INCOME_TYPES = ["Salary", "Freelance", "Business", "Rental", "Other"];
const STORAGE_KEY = "budget_tracker_v2";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const fmt     = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
const today   = () => new Date().toISOString().split("T")[0];
const getWeek = (d) => { const dt = new Date(d); const day = dt.getDay(); const diff = dt.getDate() - day + (day === 0 ? -6 : 1); return new Date(dt.setDate(diff)).toISOString().split("T")[0]; };
const getMon  = (d) => d.slice(0, 7);
const uid     = () => `${Date.now()}-${Math.random()}`;
const mkSub   = () => ({ id: uid(), name: "", amount: "" });
const mkInc   = () => ({ id: uid(), type: "Salary", amount: "", date: today(), auto: true });

const initScalar = {};
ALL_SCALAR.forEach((c) => { initScalar[c.key] = ""; });

const TABS = ["Dashboard", "Add Entry", "History", "Analytics"];

// ─────────────────────────────────────────────────────────────────────────────
// localStorage helpers
// ─────────────────────────────────────────────────────────────────────────────
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

function saveState(state) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
}

// ─────────────────────────────────────────────────────────────────────────────
// Custom Pie Tooltip
// ─────────────────────────────────────────────────────────────────────────────
function PieTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div role="tooltip" style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 14px", fontSize: 13, boxShadow: "0 4px 20px rgba(0,0,0,0.15)", minWidth: 170, zIndex: 9999 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <span aria-hidden="true" style={{ width: 12, height: 12, borderRadius: "50%", background: d.payload?.fill, flexShrink: 0, display: "inline-block" }} />
        <span style={{ fontWeight: 700, color: "var(--text)" }}>{d.payload?.icon} {d.name}</span>
      </div>
      <div style={{ color: "var(--text)", fontWeight: 700, fontFamily: "monospace", fontSize: 16 }}>{fmt(d.value)}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────
export default function BudgetTracker() {
  const saved = loadState();

  const [activeTab, setActiveTab]           = useState("Dashboard");
  const [bankBalance, setBankBalance]       = useState(saved?.bankBalance ?? "");
  const [carryForward, setCarryForward]     = useState(saved?.carryForward ?? "");
  const [editingBalance, setEditingBalance] = useState(false);
  const [tempBalance, setTempBalance]       = useState("");
  const [editingCarry, setEditingCarry]     = useState(false);
  const [tempCarry, setTempCarry]           = useState("");
  const [incomes, setIncomes]               = useState(saved?.incomes ?? [mkInc()]);
  const [editingIncId, setEditingIncId]     = useState(null);
  const [entries, setEntries]               = useState(saved?.entries ?? []);
  const [expForm, setExpForm]               = useState({ ...initScalar, date: today(), note: "" });
  const [formSubs, setFormSubs]             = useState([mkSub()]);
  const [formOthers, setFormOthers]         = useState([mkSub()]);
  const [chartView, setChartView]           = useState("monthly");
  const [notif, setNotif]                   = useState(null);
  const [darkMode, setDarkMode]             = useState(saved?.darkMode ?? false);
  const [histSearch, setHistSearch]         = useState("");
  const [histMonth, setHistMonth]           = useState("");
  const notifTimer = useRef(null);
  const mainRef    = useRef(null);
  const importRef  = useRef(null);

  // ── Persist to localStorage ────────────────────────────────────────────────
  useEffect(() => {
    saveState({ bankBalance, carryForward, incomes, entries, darkMode });
  }, [bankBalance, carryForward, incomes, entries, darkMode]);

  // ── Dark mode on <html> ────────────────────────────────────────────────────
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  // ── Auto-income notification ───────────────────────────────────────────────
  useEffect(() => {
    const check = () => {
      const td = today();
      incomes.forEach((inc) => {
        if (!inc.auto || !inc.amount || !inc.date) return;
        if (inc.date.slice(8, 10) === td.slice(8, 10)) {
          const k = `auto_${inc.id}_${td}`;
          if (!sessionStorage.getItem(k)) { sessionStorage.setItem(k, "1"); toast(`Auto-added ${inc.type}: ${fmt(inc.amount)}`); }
        }
      });
    };
    check();
    const id = setInterval(check, 60_000);
    return () => clearInterval(id);
  }, [incomes]);

  const toast = (msg, type = "success") => {
    clearTimeout(notifTimer.current);
    setNotif({ msg, type });
    notifTimer.current = setTimeout(() => setNotif(null), 3500);
  };

  // ── Derived ──────────────────────────────────────────────────────────────
  const totalIncome   = useMemo(() => incomes.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0), [incomes]);
  const totalExpenses = useMemo(() => entries.reduce((s, e) => s + (e.total || 0), 0), [entries]);
  const netBalance    = useMemo(() => (parseFloat(bankBalance) || 0) + (parseFloat(carryForward) || 0) - totalExpenses, [bankBalance, carryForward, totalExpenses]);

  const monthEntries  = useMemo(() => { const m = getMon(today()); return entries.filter(e => getMon(e.date) === m); }, [entries]);
  const monthTotal    = useMemo(() => monthEntries.reduce((s, e) => s + e.total, 0), [monthEntries]);
  const weekEntries   = useMemo(() => { const w = getWeek(today()); return entries.filter(e => getWeek(e.date) >= w); }, [entries]);
  const weekTotal     = useMemo(() => weekEntries.reduce((s, e) => s + e.total, 0), [weekEntries]);

  const catTotals = useMemo(() => {
    const t = {};
    CHART_CATS.forEach(c => { t[c.key] = 0; });
    entries.forEach(e => {
      ALL_SCALAR.forEach(c => { t[c.key] += parseFloat(e[c.key] || 0); });
      (e.subscriptions || []).forEach(s => { t.subscriptions += parseFloat(s.amount || 0); });
      (e.others        || []).forEach(o => { t.other         += parseFloat(o.amount || 0); });
    });
    return t;
  }, [entries]);

  const pieData = useMemo(() =>
    CHART_CATS.map(c => ({ ...c, value: catTotals[c.key] })).filter(d => d.value > 0).sort((a, b) => b.value - a.value),
    [catTotals]);

  const eTotal = (e) => {
    let t = ALL_SCALAR.reduce((s, c) => s + parseFloat(e[c.key] || 0), 0);
    (e.subscriptions || []).forEach(s => { t += parseFloat(s.amount || 0); });
    (e.others        || []).forEach(o => { t += parseFloat(o.amount || 0); });
    return t;
  };

  const chartData = useMemo(() => {
    if (chartView === "monthly") {
      const m = {}; entries.forEach(e => { const k = getMon(e.date); m[k] = (m[k] || 0) + eTotal(e); });
      return Object.entries(m).sort().map(([k, v]) => ({ label: new Date(k + "-01").toLocaleDateString("en-IN", { month: "short", year: "2-digit" }), amount: Math.round(v) }));
    }
    if (chartView === "weekly") {
      const w = {}; entries.forEach(e => { const k = getWeek(e.date); w[k] = (w[k] || 0) + eTotal(e); });
      return Object.entries(w).sort().map(([k, v]) => ({ label: "W " + new Date(k).toLocaleDateString("en-IN", { day: "numeric", month: "short" }), amount: Math.round(v) }));
    }
    const d = {}; entries.forEach(e => { d[e.date] = (d[e.date] || 0) + eTotal(e); });
    return Object.entries(d).sort().slice(-30).map(([k, v]) => ({ label: new Date(k).toLocaleDateString("en-IN", { day: "numeric", month: "short" }), amount: Math.round(v) }));
  }, [entries, chartView]);

  const savingsRate = useMemo(() => !totalIncome ? 0 : Math.max(0, Math.round(((totalIncome - monthTotal) / totalIncome) * 100)), [totalIncome, monthTotal]);
  const budgetUsed  = totalIncome > 0 ? Math.min((monthTotal / totalIncome) * 100, 100) : 0;
  const balColor    = netBalance >= 0 ? "var(--green)" : "var(--red)";

  const formTotal = useMemo(() => {
    let t = ALL_SCALAR.reduce((s, c) => s + parseFloat(expForm[c.key] || 0), 0);
    formSubs.forEach(s   => { t += parseFloat(s.amount || 0); });
    formOthers.forEach(o => { t += parseFloat(o.amount || 0); });
    return t;
  }, [expForm, formSubs, formOthers]);

  // ── Filtered history ────────────────────────────────────────────────────────
  const filteredEntries = useMemo(() => {
    let list = [...entries].sort((a, b) => b.date.localeCompare(a.date));
    if (histMonth) list = list.filter(e => getMon(e.date) === histMonth);
    if (histSearch.trim()) {
      const q = histSearch.trim().toLowerCase();
      list = list.filter(e =>
        e.note?.toLowerCase().includes(q) ||
        e.date.includes(q) ||
        ALL_SCALAR.some(c => parseFloat(e[c.key] || 0) > 0 && c.label.toLowerCase().includes(q))
      );
    }
    return list;
  }, [entries, histSearch, histMonth]);

  const availableMonths = useMemo(() => {
    const s = new Set(entries.map(e => getMon(e.date)));
    return [...s].sort().reverse();
  }, [entries]);

  // ── Actions ─────────────────────────────────────────────────────────────────
  const addEntry = useCallback(() => {
    if (formTotal === 0) { toast("Enter at least one expense amount", "error"); return; }
    setEntries(prev => [{ ...expForm, subscriptions: formSubs.filter(s => parseFloat(s.amount) > 0), others: formOthers.filter(o => parseFloat(o.amount) > 0), total: formTotal, id: uid() }, ...prev]);
    setExpForm({ ...initScalar, date: today(), note: "" });
    setFormSubs([mkSub()]); setFormOthers([mkSub()]);
    toast(`Entry of ${fmt(formTotal)} added`);
    setActiveTab("Dashboard");
  }, [expForm, formSubs, formOthers, formTotal]);

  const delEntry  = (id) => { if (!confirm("Delete this entry?")) return; setEntries(p => p.filter(e => e.id !== id)); toast("Entry deleted"); };
  const addInc    = () => setIncomes(p => [...p, mkInc()]);
  const updInc    = (id, f, v) => setIncomes(p => p.map(i => i.id === id ? { ...i, [f]: v } : i));
  const remInc    = (id) => setIncomes(p => p.filter(i => i.id !== id));

  // ── Export / Import ────────────────────────────────────────────────────────
  const exportJSON = () => {
    const data = { bankBalance, carryForward, incomes, entries, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement("a"), { href: url, download: "budget-backup.json" });
    a.click(); URL.revokeObjectURL(url);
    toast("JSON exported");
  };

  const exportCSV = () => {
    const rows = [["Date","Note","Total",...ALL_SCALAR.map(c=>c.label),"Subscriptions","Other"]];
    entries.forEach(e => {
      const subs  = (e.subscriptions||[]).reduce((s,x)=>s+(parseFloat(x.amount)||0),0);
      const other = (e.others||[]).reduce((s,x)=>s+(parseFloat(x.amount)||0),0);
      rows.push([e.date, e.note||"", e.total, ...ALL_SCALAR.map(c=>parseFloat(e[c.key]||0)), subs, other]);
    });
    const csv  = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement("a"), { href: url, download: "expenses.csv" });
    a.click(); URL.revokeObjectURL(url);
    toast("CSV exported");
  };

  const importJSON = (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!Array.isArray(data.entries)) throw new Error("Invalid format");
        if (!confirm(`Import ${data.entries.length} entries? This will replace current data.`)) return;
        setBankBalance(data.bankBalance ?? "");
        setCarryForward(data.carryForward ?? "");
        setIncomes(data.incomes ?? [mkInc()]);
        setEntries(data.entries);
        toast("Data imported successfully");
      } catch { toast("Invalid backup file", "error"); }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: "'DM Sans','Segoe UI',sans-serif", background: "var(--bg)", minHeight: "100vh", paddingBottom: 60, color: "var(--text)" }}>
      <style>{CSS}</style>

      {/* Skip link */}
      <a href="#main-content" className="skip-link">Skip to main content</a>

      {/* SR-only live region */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">{notif?.msg ?? ""}</div>

      {/* Toast */}
      {notif && <div className={`notif ${notif.type}`} aria-hidden="true">{notif.msg}</div>}

      {/* ── Header ── */}
      <header style={S.header}>
        <div style={S.hInner}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div>
                <h1 style={S.title}>💼 Budget Tracker</h1>
                <p style={S.subtitle}>{new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
              </div>
            </div>
            <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
              {totalIncome > 0 && (
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, marginBottom: 1 }}>Monthly Income</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "var(--green)", fontFamily: "monospace" }}>{fmt(totalIncome)}</div>
                </div>
              )}
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, marginBottom: 1 }}>Net Balance</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: balColor, fontFamily: "monospace" }} aria-label={`Net balance: ${fmt(netBalance)}`}>{fmt(netBalance)}</div>
              </div>
              <button
                onClick={() => setDarkMode(d => !d)}
                className="btn-sm"
                style={{ fontSize: 18, padding: "6px 12px", minHeight: 40, border: "1px solid var(--border)" }}
                aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
              >
                {darkMode ? "☀️" : "🌙"}
              </button>
            </div>
          </div>
          <nav aria-label="Main navigation">
            <div role="tablist" style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 0 }}>
              {TABS.map(t => (
                <button key={t} role="tab" aria-selected={activeTab === t} aria-controls={`panel-${t}`} id={`tab-${t}`}
                  className={`tab-btn ${activeTab === t ? "active" : ""}`}
                  onClick={() => { setActiveTab(t); mainRef.current?.focus(); }}>
                  {t}
                </button>
              ))}
            </div>
          </nav>
        </div>
      </header>

      {/* ── Main ── */}
      <main id="main-content" ref={mainRef} tabIndex={-1} style={S.body}>

        {/* ══════════ DASHBOARD ══════════ */}
        {activeTab === "Dashboard" && (
          <div role="tabpanel" id="panel-Dashboard" aria-labelledby="tab-Dashboard">
            <div className="dash-layout">

              {/* ── LEFT SIDEBAR ── */}
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

                {/* Account Setup */}
                <section aria-labelledby="setup-h" className="card">
                  <h2 id="setup-h" className="section-title">Account Setup</h2>

                  {/* Bank Balance */}
                  <div style={{ marginBottom: 14 }}>
                    <label htmlFor="bank-bal" style={S.label}>Bank Balance (₹)</label>
                    {editingBalance ? (
                      <div style={{ display: "flex", gap: 8 }}>
                        <input id="bank-bal" className="inp" type="number" min="0" value={tempBalance}
                          onChange={e => setTempBalance(e.target.value)} placeholder="0" autoFocus />
                        <button className="btn-primary" style={{ whiteSpace: "nowrap", padding: "9px 16px" }}
                          onClick={() => { setBankBalance(tempBalance); setEditingBalance(false); toast("Balance updated"); }}>Save</button>
                      </div>
                    ) : (
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <div style={S.displayBox}>{bankBalance ? fmt(bankBalance) : <span style={{ color: "var(--text-muted)", fontStyle: "italic", fontWeight: 500 }}>Not set</span>}</div>
                        <button className="btn-sm" onClick={() => { setTempBalance(bankBalance); setEditingBalance(true); }} aria-label="Edit bank balance">Edit</button>
                      </div>
                    )}
                  </div>

                  {/* Carry-forward */}
                  <div style={{ marginBottom: 16 }}>
                    <label htmlFor="carry-fwd" style={S.label}>Carry-forward Balance (₹)</label>
                    {editingCarry ? (
                      <div style={{ display: "flex", gap: 8 }}>
                        <input id="carry-fwd" className="inp" type="number" min="0" value={tempCarry}
                          onChange={e => setTempCarry(e.target.value)} placeholder="0" autoFocus />
                        <button className="btn-primary" style={{ whiteSpace: "nowrap", padding: "9px 16px" }}
                          onClick={() => { setCarryForward(tempCarry); setEditingCarry(false); toast("Carry-forward updated"); }}>Save</button>
                      </div>
                    ) : (
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <div style={S.displayBox}>{carryForward ? fmt(carryForward) : <span style={{ color: "var(--text-muted)", fontStyle: "italic", fontWeight: 500 }}>Not set</span>}</div>
                        <button className="btn-sm" onClick={() => { setTempCarry(carryForward); setEditingCarry(true); }} aria-label="Edit carry-forward balance">Edit</button>
                      </div>
                    )}
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <h3 style={{ ...S.label, margin: 0 }}>Income Sources</h3>
                    <button className="btn-sm" onClick={addInc} aria-label="Add income source" style={{ minHeight: 34 }}>+ Add</button>
                  </div>
                  {incomes.map((inc, i) => (
                    <IncomeRow key={inc.id} inc={inc} index={i + 1}
                      editing={editingIncId === inc.id}
                      onEdit={() => setEditingIncId(inc.id)}
                      onSave={() => { setEditingIncId(null); toast("Income updated"); }}
                      onChange={(f, v) => updInc(inc.id, f, v)}
                      onRemove={() => remInc(inc.id)}
                      showRemove={incomes.length > 1} />
                  ))}
                  {incomes.length > 1 && (
                    <div style={S.incTotal}>
                      <span style={{ color: "var(--text-muted)", fontWeight: 600, fontSize: 13 }}>Total Monthly Income</span>
                      <span style={{ color: "#4f46e5", fontWeight: 700, fontFamily: "monospace", fontSize: 15 }}>{fmt(totalIncome)}</span>
                    </div>
                  )}
                </section>

                {/* Metrics */}
                <section aria-labelledby="metrics-h">
                  <h2 id="metrics-h" className="sr-only">Key Metrics</h2>
                  <div className="metrics-grid">
                    {[
                      { label: "Bank Balance",    val: fmt(parseFloat(bankBalance) || 0),                       sub: "Current balance",          color: "#4f46e5" },
                      { label: "This Month",       val: fmt(monthTotal),                                         sub: `${monthEntries.length} entries`, color: "var(--red)" },
                      { label: "This Week",        val: fmt(weekTotal),                                          sub: `${weekEntries.length} entries`,  color: "#b45309" },
                      { label: "Money Left",       val: fmt(netBalance),                                         sub: "After all expenses",       color: balColor   },
                    ].map(m => (
                      <div key={m.label} className="metric-card" role="figure" aria-label={`${m.label}: ${m.val}`}>
                        <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600, marginBottom: 6 }}>{m.label}</div>
                        <div style={{ fontSize: 20, fontWeight: 700, color: m.color, fontFamily: "monospace", letterSpacing: "-0.5px" }}>{m.val}</div>
                        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{m.sub}</div>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Budget progress */}
                {totalIncome > 0 && (
                  <section aria-labelledby="budget-h" className="card">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <h2 id="budget-h" className="section-title" style={{ margin: 0 }}>Monthly Budget</h2>
                      <span style={{ fontSize: 15, fontWeight: 700, color: budgetUsed > 80 ? "var(--red)" : budgetUsed > 60 ? "#b45309" : "var(--green)" }}>{Math.round(budgetUsed)}%</span>
                    </div>
                    <div className="progress-bar" role="progressbar" aria-valuenow={Math.round(budgetUsed)} aria-valuemin={0} aria-valuemax={100}>
                      <div className="progress-fill" style={{ width: `${budgetUsed}%`, background: budgetUsed > 80 ? "var(--red)" : budgetUsed > 60 ? "#b45309" : "var(--green)" }} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, fontSize: 12, color: "var(--text-muted)", fontWeight: 600, flexWrap: "wrap", gap: 4 }}>
                      <span>Spent: {fmt(monthTotal)}</span>
                      <span>Left: {fmt(Math.max(0, totalIncome - monthTotal))}</span>
                      <span>Income: {fmt(totalIncome)}</span>
                    </div>
                    {savingsRate > 0 && (
                      <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 8, background: "rgba(4,120,87,0.1)", display: "flex", gap: 8, alignItems: "center" }}>
                        <span aria-hidden="true" style={{ fontSize: 18 }}>💰</span>
                        <span style={{ fontSize: 13, color: "var(--green)", fontWeight: 700 }}>Savings Rate: {savingsRate}% — {savingsRate >= 20 ? "Great job!" : "Aim for 20%+"}</span>
                      </div>
                    )}
                  </section>
                )}

                {/* Top categories (sidebar on desktop) */}
                {pieData.length > 0 && (
                  <section aria-labelledby="top-h" className="card">
                    <h2 id="top-h" className="section-title">Top Spending</h2>
                    <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                      {pieData.slice(0, 8).map(d => (
                        <li key={d.key} className="insight-row">
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: "50%", background: d.fill, flexShrink: 0, display: "inline-block" }} />
                            <span style={{ fontSize: 13, color: "var(--text)", fontWeight: 600 }}>{d.label}</span>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "monospace", color: "var(--text)" }}>{fmt(d.value)}</div>
                            {totalIncome > 0 && <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>{Math.round((d.value / totalIncome) * 100)}%</div>}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {/* CTA */}
                <button className="btn-primary" onClick={() => setActiveTab("Add Entry")}
                  style={{ width: "100%", padding: 14, fontSize: 15, borderRadius: 12, minHeight: 52 }}>
                  + Add Expense Entry
                </button>
              </div>

              {/* ── RIGHT CHARTS AREA ── */}
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

                {/* Bar chart */}
                <section aria-labelledby="trend-h" className="card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
                    <h2 id="trend-h" className="section-title" style={{ margin: 0 }}>Spending Trend</h2>
                    <ChartToggle value={chartView} onChange={setChartView} />
                  </div>
                  {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -8 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 12, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 12, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                        <Tooltip formatter={v => [fmt(v), "Spent"]} contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13, color: "var(--text)" }} wrapperStyle={{ zIndex: 9999 }} cursor={{ fill: "rgba(99,102,241,0.06)" }} />
                        <Bar dataKey="amount" fill="#6366f1" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div style={S.empty}>No spending data yet. Add some expenses!</div>
                  )}
                </section>

                {/* Pie chart */}
                {pieData.length > 0 && (
                  <section aria-labelledby="dist-h" className="card">
                    <h2 id="dist-h" className="section-title">Spending Distribution</h2>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                        <Pie data={pieData} cx="50%" cy="45%" innerRadius={65} outerRadius={105} paddingAngle={2} dataKey="value">
                          {pieData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                        </Pie>
                        <Tooltip content={<PieTooltip />} wrapperStyle={{ zIndex: 9999 }} />
                        <Legend formatter={val => <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>{val}</span>} wrapperStyle={{ paddingTop: 8 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </section>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ══════════ ADD ENTRY ══════════ */}
        {activeTab === "Add Entry" && (
          <div role="tabpanel" id="panel-Add Entry" aria-labelledby="tab-Add Entry">
            <div className="entry-layout">

              {/* Form */}
              <div className="card" style={{ flex: 1, minWidth: 0 }}>
                <h2 className="section-title" style={{ fontSize: 14, marginBottom: 18 }}>New Expense Entry</h2>

                <div style={{ marginBottom: 20 }}>
                  <label htmlFor="entry-date" style={S.label}>Entry Date</label>
                  <input id="entry-date" className="inp" type="date" value={expForm.date}
                    onChange={e => setExpForm(p => ({ ...p, date: e.target.value }))} style={{ maxWidth: 220 }} />
                </div>

                <EntrySection title="Fixed Expenses" color="#4f46e5">
                  <div className="field-grid">{FIXED_CATEGORIES.map(c => <ScalarField key={c.key} cat={c} value={expForm[c.key]} onChange={e => setExpForm(p => ({ ...p, [c.key]: e.target.value }))} />)}</div>
                </EntrySection>

                <EntrySection title="Variable Expenses" color="#047857">
                  <div className="field-grid">{VARIABLE_CATEGORIES.map(c => <ScalarField key={c.key} cat={c} value={expForm[c.key]} onChange={e => setExpForm(p => ({ ...p, [c.key]: e.target.value }))} />)}</div>
                </EntrySection>

                <EntrySection title="Subscriptions" color="#6d28d9">
                  <MultiRows rows={formSubs} setRows={setFormSubs} label="Subscription" />
                </EntrySection>

                <EntrySection title="Savings & Wellbeing" color="#0369a1">
                  <div className="field-grid">{WELLBEING_CATEGORIES.map(c => <ScalarField key={c.key} cat={c} value={expForm[c.key]} onChange={e => setExpForm(p => ({ ...p, [c.key]: e.target.value }))} />)}</div>
                </EntrySection>

                <EntrySection title="Other Expenses" color="#475569">
                  <MultiRows rows={formOthers} setRows={setFormOthers} label="Expense" />
                </EntrySection>

                <div style={{ marginBottom: 20 }}>
                  <label htmlFor="entry-note" style={S.label}>Note (optional)</label>
                  <input id="entry-note" className="inp" type="text" placeholder="Any notes for this entry…"
                    value={expForm.note} onChange={e => setExpForm(p => ({ ...p, note: e.target.value }))} />
                </div>
              </div>

              {/* Sticky sidebar: total + save */}
              <div className="entry-sidebar">
                <div className="card entry-summary-card">
                  <h3 style={{ margin: "0 0 16px", fontSize: 13, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em" }}>Entry Summary</h3>

                  {ALL_SCALAR.map(c => {
                    const v = parseFloat(expForm[c.key] || 0);
                    if (!v) return null;
                    return (
                      <div key={c.key} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 13 }}>
                        <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>{c.icon} {c.label}</span>
                        <span style={{ fontWeight: 700, fontFamily: "monospace", color: "var(--text)" }}>{fmt(v)}</span>
                      </div>
                    );
                  })}
                  {formSubs.filter(s => parseFloat(s.amount) > 0).map((s, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 13 }}>
                      <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>📱 {s.name || `Sub ${i + 1}`}</span>
                      <span style={{ fontWeight: 700, fontFamily: "monospace", color: "var(--text)" }}>{fmt(s.amount)}</span>
                    </div>
                  ))}
                  {formOthers.filter(o => parseFloat(o.amount) > 0).map((o, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 13 }}>
                      <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>📦 {o.name || `Other ${i + 1}`}</span>
                      <span style={{ fontWeight: 700, fontFamily: "monospace", color: "var(--text)" }}>{fmt(o.amount)}</span>
                    </div>
                  ))}

                  <div style={{ borderTop: "2px solid var(--border)", marginTop: 12, paddingTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-muted)" }}>Total</span>
                    <span style={{ fontSize: 24, fontWeight: 700, color: "#4f46e5", fontFamily: "monospace" }}>{fmt(formTotal)}</span>
                  </div>

                  <button className="btn-primary" onClick={addEntry}
                    style={{ width: "100%", padding: 14, fontSize: 15, borderRadius: 12, minHeight: 52, marginTop: 16 }}>
                    Save Entry
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══════════ HISTORY ══════════ */}
        {activeTab === "History" && (
          <div role="tabpanel" id="panel-History" aria-labelledby="tab-History">
            {/* Toolbar */}
            <div className="card" style={{ marginBottom: 12, padding: "14px 18px" }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                <input
                  className="inp"
                  type="search"
                  placeholder="🔍 Search entries…"
                  value={histSearch}
                  onChange={e => setHistSearch(e.target.value)}
                  style={{ flex: "1 1 200px", maxWidth: 320 }}
                  aria-label="Search history"
                />
                <select
                  className="inp"
                  value={histMonth}
                  onChange={e => setHistMonth(e.target.value)}
                  style={{ flex: "0 0 auto", width: 160 }}
                  aria-label="Filter by month"
                >
                  <option value="">All months</option>
                  {availableMonths.map(m => (
                    <option key={m} value={m}>{new Date(m + "-01").toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</option>
                  ))}
                </select>
                <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                  <button className="btn-sm" onClick={exportCSV} title="Export as CSV" style={{ minHeight: 36 }}>📥 CSV</button>
                  <button className="btn-sm" onClick={exportJSON} title="Export as JSON" style={{ minHeight: 36 }}>📦 JSON</button>
                  <button className="btn-sm" onClick={() => importRef.current?.click()} title="Import JSON" style={{ minHeight: 36 }}>📤 Import</button>
                  <input ref={importRef} type="file" accept=".json" onChange={importJSON} style={{ display: "none" }} />
                </div>
              </div>
            </div>

            {filteredEntries.length === 0 ? (
              <div className="card" style={{ textAlign: "center", padding: 64 }}>
                <div aria-hidden="true" style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
                <p style={{ color: "var(--text-muted)", margin: 0, fontWeight: 600, fontSize: 16 }}>
                  {entries.length === 0 ? "No entries yet. Add your first expense!" : "No entries match your search."}
                </p>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <span style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 700 }}>{filteredEntries.length} {filteredEntries.length === 1 ? "entry" : "entries"}</span>
                  <span style={{ fontSize: 14, color: "var(--text-muted)", fontWeight: 700 }}>Total: {fmt(filteredEntries.reduce((s,e)=>s+e.total,0))}</span>
                </div>
                <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                  {filteredEntries.map(e => {
                    const scCats = ALL_SCALAR.filter(c => parseFloat(e[c.key] || 0) > 0);
                    const subs   = (e.subscriptions || []).filter(s => parseFloat(s.amount) > 0);
                    const others = (e.others || []).filter(o => parseFloat(o.amount) > 0);
                    const pills  = [
                      ...scCats.map(c  => ({ label: c.label,                    icon: c.icon,  fill: c.fill,      val: e[c.key] })),
                      ...subs.map(s    => ({ label: s.name || "Subscription",   icon: "📱",    fill: "#8b5cf6",   val: s.amount })),
                      ...others.map(o  => ({ label: o.name || "Other",          icon: "📦",    fill: "#94a3b8",   val: o.amount })),
                    ];
                    const ds = new Date(e.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
                    return (
                      <li key={e.id} className="history-item" aria-label={`Entry ${ds}, ${fmt(e.total)}`}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
                            <time dateTime={e.date} style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 700 }}>{ds}</time>
                            {e.note && <span style={{ fontSize: 13, color: "var(--text-muted)", fontStyle: "italic" }}>— {e.note}</span>}
                          </div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
                            {pills.slice(0, 6).map((p, i) => (
                              <span key={i} className="cat-pill" style={{ background: "var(--pill-bg)", color: "var(--text)", borderLeft: `3px solid ${p.fill}` }}>
                                {p.icon} {p.label}: {fmt(p.val)}
                              </span>
                            ))}
                            {pills.length > 6 && <span className="cat-pill" style={{ background: "var(--border)", color: "var(--text-muted)" }}>+{pills.length - 6} more</span>}
                          </div>
                        </div>
                        <div style={{ textAlign: "right", marginLeft: 16, flexShrink: 0 }}>
                          <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "monospace", color: "var(--text)" }}>{fmt(e.total)}</div>
                          <button className="btn-sm" style={{ marginTop: 8, color: "var(--red)", borderColor: "rgba(185,28,28,0.25)", minHeight: 36 }}
                            onClick={() => delEntry(e.id)} aria-label={`Delete entry from ${ds}`}>Delete</button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </div>
        )}

        {/* ══════════ ANALYTICS ══════════ */}
        {activeTab === "Analytics" && (
          <div role="tabpanel" id="panel-Analytics" aria-labelledby="tab-Analytics" style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Top stats row */}
            <section aria-labelledby="stats-h">
              <h2 id="stats-h" className="sr-only">Summary Statistics</h2>
              <div className="analytics-stats">
                {[
                  { label: "Avg Monthly Spend", val: entries.length > 0 ? fmt(totalExpenses / Math.max(1, new Set(entries.map(e => getMon(e.date))).size)) : "—", color: "#4f46e5" },
                  { label: "Savings Rate",       val: `${savingsRate}%`,    color: savingsRate >= 20 ? "var(--green)" : "#b45309" },
                  { label: "Peak Day Spend",     val: chartView === "daily" && chartData.length > 0 ? fmt(Math.max(...chartData.map(d => d.amount))) : chartData.length > 0 ? fmt(Math.max(...chartData.map(d => d.amount))) : "—", color: "var(--red)" },
                  { label: "Total Entries",      val: String(entries.length), color: "var(--text)" },
                ].map(m => (
                  <div key={m.label} className="metric-card">
                    <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600, marginBottom: 8 }}>{m.label}</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: m.color, fontFamily: "monospace" }}>{m.val}</div>
                  </div>
                ))}
              </div>
            </section>

            {/* Two-column layout on desktop */}
            <div className="analytics-layout">
              {/* Left: category totals */}
              <section aria-labelledby="cat-h" className="card">
                <h2 id="cat-h" className="section-title">Category Totals</h2>
                {CHART_CATS.map(c => {
                  const val = catTotals[c.key];
                  if (!val) return null;
                  const pct = totalExpenses > 0 ? (val / totalExpenses) * 100 : 0;
                  return (
                    <div key={c.key} style={{ marginBottom: 14 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                        <span style={{ fontSize: 13, color: "var(--text)", fontWeight: 600 }}>{c.icon} {c.label}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "monospace", color: c.color }}>
                          {fmt(val)} <span style={{ fontWeight: 600, color: "var(--text-muted)", fontSize: 12 }}>({Math.round(pct)}%)</span>
                        </span>
                      </div>
                      <div className="progress-bar" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={`${c.label}: ${Math.round(pct)}%`}>
                        <div className="progress-fill" style={{ width: `${pct}%`, background: c.fill }} />
                      </div>
                    </div>
                  );
                })}
                {totalExpenses === 0 && <p style={{ color: "var(--text-muted)", fontSize: 14, textAlign: "center", padding: 20, fontWeight: 600 }}>No spending data yet.</p>}
              </section>

              {/* Right: charts + health */}
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <section aria-labelledby="trend-a-h" className="card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
                    <h2 id="trend-a-h" className="section-title" style={{ margin: 0 }}>Spending Trend</h2>
                    <ChartToggle value={chartView} onChange={setChartView} />
                  </div>
                  {chartData.length > 1 ? (
                    <ResponsiveContainer width="100%" height={240}>
                      <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -8 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 12, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 12, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                        <Tooltip formatter={v => [fmt(v), "Spent"]} contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13, color: "var(--text)" }} wrapperStyle={{ zIndex: 9999 }} />
                        <Line type="monotone" dataKey="amount" stroke="#6366f1" strokeWidth={2.5} dot={{ fill: "#6366f1", r: 4 }} activeDot={{ r: 6 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div style={S.empty}>Add more entries to see trends</div>
                  )}
                </section>

                {pieData.length > 0 && (
                  <section aria-labelledby="dist-a-h" className="card">
                    <h2 id="dist-a-h" className="section-title">Distribution</h2>
                    <ResponsiveContainer width="100%" height={280}>
                      <PieChart>
                        <Pie data={pieData} cx="50%" cy="45%" innerRadius={60} outerRadius={95} paddingAngle={2} dataKey="value">
                          {pieData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                        </Pie>
                        <Tooltip content={<PieTooltip />} wrapperStyle={{ zIndex: 9999 }} />
                        <Legend formatter={val => <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>{val}</span>} wrapperStyle={{ paddingTop: 8 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </section>
                )}

                {totalIncome > 0 && (
                  <section aria-labelledby="health-h" className="card">
                    <h2 id="health-h" className="section-title">Financial Health</h2>
                    <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                      {[
                        { label: "Savings Rate",             val: savingsRate, t: 20, unit: "%", tip: "Target ≥ 20%" },
                        { label: "Housing % of income",      val: Math.round((catTotals.rent / totalIncome) * 100), t: 30, unit: "%", tip: "Target ≤ 30%", inv: true },
                        { label: "Debt (EMI + Credit Card)", val: Math.round(((catTotals.loanEmi + catTotals.creditCard) / totalIncome) * 100), t: 20, unit: "%", tip: "Target ≤ 20%", inv: true },
                      ].map(item => {
                        const pass = item.inv ? item.val <= item.t : item.val >= item.t;
                        return (
                          <li key={item.label} className="insight-row">
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{item.label}</div>
                              <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>{item.tip}</div>
                            </div>
                            <span style={{ fontSize: 18, fontWeight: 700, color: pass ? "var(--green)" : item.inv ? "var(--red)" : "#b45309" }}>
                              {item.val}{item.unit}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components  (all defined OUTSIDE main component — never recreate on render)
// ─────────────────────────────────────────────────────────────────────────────

function ScalarField({ cat, value, onChange }) {
  return (
    <div style={S.fieldWrap}>
      <label htmlFor={`f-${cat.key}`} style={S.label}>{cat.icon} {cat.label}</label>
      <div style={S.amtRow}>
        <span aria-hidden="true" style={S.rupee}>₹</span>
        <input
          id={`f-${cat.key}`}
          className="inp"
          type="number"
          min="0"
          placeholder="0"
          value={value}
          onChange={onChange}
          style={S.amtInp}
          aria-label={`${cat.label} in rupees`}
        />
      </div>
    </div>
  );
}

function MultiRows({ rows, setRows, label }) {
  return (
    <div>
      {rows.map((row, i) => (
        <div key={row.id} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
          <input
            className="inp"
            type="text"
            placeholder={`${label} name`}
            value={row.name}
            onChange={e => setRows(p => p.map(r => r.id === row.id ? { ...r, name: e.target.value } : r))}
            style={{ flex: "2 1 140px" }}
            aria-label={`${label} ${i + 1} name`}
          />
          <div style={{ ...S.amtRow, flex: "1 1 110px" }}>
            <span aria-hidden="true" style={S.rupee}>₹</span>
            <input
              className="inp"
              type="number"
              min="0"
              placeholder="0"
              value={row.amount}
              onChange={e => setRows(p => p.map(r => r.id === row.id ? { ...r, amount: e.target.value } : r))}
              style={S.amtInp}
              aria-label={`${label} ${i + 1} amount`}
            />
          </div>
          {rows.length > 1 && (
            <button
              onClick={() => setRows(p => p.filter(r => r.id !== row.id))}
              style={S.rmBtn}
              aria-label={`Remove ${label} ${i + 1}`}
            >✕</button>
          )}
        </div>
      ))}
      <button onClick={() => setRows(p => [...p, mkSub()])} style={S.addMoreBtn} aria-label={`Add another ${label}`}>
        + Add {label}
      </button>
    </div>
  );
}

function ChartToggle({ value, onChange }) {
  return (
    <div className="chart-toggle" role="group" aria-label="Chart time range">
      {["daily", "weekly", "monthly"].map(v => (
        <button key={v} className={value === v ? "active" : ""} onClick={() => onChange(v)} aria-pressed={value === v}>
          {v.charAt(0).toUpperCase() + v.slice(1)}
        </button>
      ))}
    </div>
  );
}

function EntrySection({ title, color, children }) {
  return (
    <fieldset style={{ marginBottom: 20, borderRadius: 10, border: `2px solid ${color}28`, padding: 0, overflow: "hidden" }}>
      <legend style={{ background: color + "12", padding: "8px 14px", margin: 0, width: "100%", display: "block", borderBottom: `1px solid ${color}22`, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text)", boxSizing: "border-box" }}>
        <span aria-hidden="true" style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: color, marginRight: 7, verticalAlign: "middle" }} />
        {title}
      </legend>
      <div style={{ padding: "14px 14px 8px" }}>{children}</div>
    </fieldset>
  );
}

function IncomeRow({ inc, index, editing, onEdit, onSave, onChange, onRemove, showRemove }) {
  const ac  = inc.auto ? "var(--green)" : "#b45309";
  const tid = `tog-${inc.id}`;
  return (
    <div style={{ background: "var(--input-bg)", borderRadius: 10, padding: "12px 14px", marginBottom: 8, border: "1px solid var(--border)" }}>
      {editing ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <select className="inp" style={{ flex: "1 1 110px" }} value={inc.type} onChange={e => onChange("type", e.target.value)} aria-label={`Income ${index} type`}>
              {INCOME_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
            <input className="inp" type="number" min="0" placeholder="Amount (₹)" value={inc.amount} onChange={e => onChange("amount", e.target.value)} style={{ flex: "1 1 130px" }} aria-label={`Income ${index} amount`} />
            <input className="inp" type="date" value={inc.date} onChange={e => onChange("date", e.target.value)} style={{ flex: "1 1 140px" }} aria-label={`Income ${index} recurring date`} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <button id={tid} role="switch" aria-checked={inc.auto} onClick={() => onChange("auto", !inc.auto)} aria-label={`Auto-add income ${index}`}
              style={{ width: 44, height: 26, borderRadius: 13, background: inc.auto ? "var(--green)" : "var(--border)", border: "none", cursor: "pointer", position: "relative", transition: "background .2s", padding: 0, flexShrink: 0 }}>
              <span style={{ position: "absolute", top: 4, left: inc.auto ? 21 : 3, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left .2s", boxShadow: "0 1px 3px rgba(0,0,0,.25)" }} />
            </button>
            <label htmlFor={tid} style={{ fontSize: 13, color: ac, fontWeight: 700, cursor: "pointer" }}>
              {inc.auto ? "🔄 Auto-add on date" : "✋ Manual only"}
            </label>
            <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              <button className="btn-primary" style={{ padding: "8px 18px", fontSize: 13, minHeight: 36 }} onClick={onSave}>Save</button>
              {showRemove && <button className="btn-sm" style={{ color: "var(--red)", borderColor: "rgba(185,28,28,0.25)", minHeight: 36 }} onClick={onRemove} aria-label={`Remove income ${index}`}>Remove</button>}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{inc.type}</span>
            <span style={{ fontSize: 16, fontWeight: 700, color: "#4f46e5", fontFamily: "monospace" }}>{inc.amount ? fmt(inc.amount) : <span style={{ color: "var(--text-muted)", fontStyle: "italic", fontWeight: 500, fontSize: 13 }}>not set</span>}</span>
            {inc.date && <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>every {new Date(inc.date).getDate()}{ordinal(new Date(inc.date).getDate())}</span>}
            <span style={{ fontSize: 12, fontWeight: 700, color: ac }}>{inc.auto ? "🔄 Auto" : "✋ Manual"}</span>
          </div>
          <button className="btn-sm" onClick={onEdit} style={{ minHeight: 36 }} aria-label={`Edit income ${index}`}>Edit</button>
        </div>
      )}
    </div>
  );
}

function ordinal(n) {
  if (n > 3 && n < 21) return "th";
  switch (n % 10) { case 1: return "st"; case 2: return "nd"; case 3: return "rd"; default: return "th"; }
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const S = {
  header:     { background: "var(--header-bg)", borderBottom: "1px solid var(--border)", padding: "18px 24px 0", position: "sticky", top: 0, zIndex: 200 },
  hInner:     { maxWidth: 1400, margin: "0 auto" },
  body:       { maxWidth: 1400, margin: "24px auto", padding: "0 24px", outline: "none" },
  title:      { margin: 0, fontSize: 22, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.5px" },
  subtitle:   { margin: "2px 0 0", fontSize: 13, color: "var(--text-muted)", fontWeight: 600 },
  label:      { fontSize: 13, color: "var(--text-muted)", fontWeight: 700, display: "block", marginBottom: 6 },
  displayBox: { flex: 1, padding: "10px 14px", borderRadius: 8, background: "var(--input-bg)", fontSize: 15, fontWeight: 700, color: "var(--text)", fontFamily: "monospace", border: "1px solid var(--border)" },
  fieldWrap:  { display: "flex", flexDirection: "column" },
  amtRow:     { display: "flex", alignItems: "center", border: "1px solid var(--border)", borderRadius: 8, background: "var(--input-bg)", overflow: "hidden" },
  rupee:      { padding: "0 8px", fontSize: 15, color: "#4f46e5", fontWeight: 700, userSelect: "none" },
  amtInp:     { flex: 1, border: "none", background: "transparent", padding: "10px 8px 10px 0", fontSize: 14, outline: "none", color: "var(--text)", minWidth: 0 },
  addMoreBtn: { fontSize: 13, color: "#4f46e5", background: "none", border: "1.5px dashed #4f46e5", borderRadius: 6, padding: "6px 14px", cursor: "pointer", marginTop: 4, fontWeight: 700, minHeight: 36 },
  rmBtn:      { background: "none", border: "1px solid var(--border)", borderRadius: 6, cursor: "pointer", fontSize: 13, padding: "6px 10px", color: "var(--red)", minHeight: 36, fontWeight: 700 },
  incTotal:   { marginTop: 10, padding: "10px 14px", borderRadius: 8, background: "rgba(79,70,229,0.06)", border: "1px solid rgba(79,70,229,0.15)", display: "flex", justifyContent: "space-between", alignItems: "center" },
  empty:      { height: 200, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 14, fontWeight: 600, textAlign: "center" },
};

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
  *, *::before, *::after { box-sizing: border-box; }
  body { margin: 0; }

  /* ── Theme tokens ── */
  :root, [data-theme="light"] {
    --bg:         #f0f2f5;
    --card:       #ffffff;
    --header-bg:  #ffffff;
    --border:     #e2e8f0;
    --text:       #1a202c;
    --text-muted: #4a5568;
    --input-bg:   #f8f9fa;
    --pill-bg:    #f0f2f5;
    --green:      #047857;
    --red:        #b91c1c;
  }
  [data-theme="dark"] {
    --bg:         #0f1117;
    --card:       #1a1d27;
    --header-bg:  #13151f;
    --border:     #2d3148;
    --text:       #e2e8f0;
    --text-muted: #8896b3;
    --input-bg:   #1e2133;
    --pill-bg:    #1e2133;
    --green:      #10b981;
    --red:        #f87171;
  }

  .skip-link { position: absolute; top: -100%; left: 8px; padding: 10px 18px; background: #4f46e5; color: #fff; font-weight: 700; font-size: 14px; border-radius: 0 0 8px 8px; text-decoration: none; z-index: 9999; transition: top .15s; }
  .skip-link:focus { top: 0; }
  .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }

  /* ── Tabs ── */
  .tab-btn { padding: 10px 22px; border-radius: 20px; border: none; cursor: pointer; font-size: 14px; font-weight: 700; transition: all .2s; background: transparent; color: var(--text-muted); min-height: 42px; font-family: inherit; }
  .tab-btn.active { background: #4f46e5; color: #fff; }
  .tab-btn:hover:not(.active) { background: rgba(99,102,241,0.1); color: var(--text); }
  .tab-btn:focus-visible { outline: 3px solid #4f46e5; outline-offset: 2px; }

  /* ── Cards ── */
  .card { background: var(--card); border-radius: 16px; border: 1px solid var(--border); padding: 22px; }
  .metric-card { background: var(--card); border-radius: 12px; padding: 20px; border: 1px solid var(--border); }

  /* ── Inputs ── */
  .inp { width: 100%; padding: 10px 13px; border-radius: 8px; border: 1px solid var(--border); font-size: 14px; background: var(--input-bg); color: var(--text); box-sizing: border-box; font-family: inherit; transition: border-color .15s, box-shadow .15s; }
  .inp:focus { outline: none; border-color: #4f46e5; box-shadow: 0 0 0 3px rgba(79,70,229,.15); }
  .inp option { background: var(--card); color: var(--text); }

  /* ── Buttons ── */
  .btn-primary { background: #4f46e5; color: #fff; border: none; border-radius: 10px; padding: 11px 24px; font-size: 14px; font-weight: 700; cursor: pointer; transition: background .2s; font-family: inherit; }
  .btn-primary:hover { background: #3730a3; }
  .btn-primary:focus-visible { outline: 3px solid #4f46e5; outline-offset: 3px; }
  .btn-sm { padding: 7px 15px; border-radius: 6px; border: 1px solid var(--border); background: transparent; color: var(--text-muted); font-size: 13px; cursor: pointer; font-family: inherit; font-weight: 700; transition: background .15s; }
  .btn-sm:hover { background: rgba(99,102,241,0.08); }
  .btn-sm:focus-visible { outline: 3px solid #4f46e5; outline-offset: 2px; }

  /* ── Chart toggle ── */
  .chart-toggle button { padding: 7px 16px; font-size: 12px; border: 1px solid var(--border); background: transparent; cursor: pointer; color: var(--text-muted); font-family: inherit; transition: all .15s; font-weight: 700; min-height: 36px; }
  .chart-toggle button:first-child { border-radius: 8px 0 0 8px; }
  .chart-toggle button:last-child  { border-radius: 0 8px 8px 0; }
  .chart-toggle button.active { background: #4f46e5; color: #fff; border-color: #4f46e5; }
  .chart-toggle button:focus-visible { outline: 3px solid #4f46e5; outline-offset: 2px; z-index: 1; position: relative; }

  /* ── Toast ── */
  .notif { position: fixed; top: 20px; right: 20px; padding: 13px 22px; border-radius: 10px; font-size: 14px; font-weight: 700; z-index: 9999; animation: slideIn .3s ease; max-width: calc(100vw - 40px); }
  .notif.success { background: #047857; color: #fff; }
  .notif.error   { background: #b91c1c; color: #fff; }
  @keyframes slideIn { from { transform: translateX(40px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }

  /* ── Progress ── */
  .progress-bar  { height: 8px; border-radius: 4px; background: var(--border); overflow: hidden; }
  .progress-fill { height: 100%; border-radius: 4px; transition: width .6s ease; }

  /* ── Section titles ── */
  .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: var(--text-muted); margin: 0 0 14px; }

  /* ── History ── */
  .history-item { display: flex; justify-content: space-between; align-items: flex-start; padding: 16px 18px; border-radius: 12px; border: 1px solid var(--border); margin-bottom: 10px; background: var(--card); transition: box-shadow .15s; }
  .history-item:hover { box-shadow: 0 2px 12px rgba(0,0,0,.1); }
  .cat-pill { display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 700; margin: 2px; }

  /* ── Insight rows ── */
  .insight-row { display: flex; align-items: center; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid var(--border); }
  .insight-row:last-child { border-bottom: none; }

  /* ── Field grid ── */
  .field-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 16px; }

  /* ── Metrics grid ── */
  .metrics-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }

  /* ── Analytics stats ── */
  .analytics-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 0; }

  /* ── DASHBOARD DESKTOP LAYOUT ── */
  .dash-layout {
    display: grid;
    grid-template-columns: 360px 1fr;
    gap: 20px;
    align-items: start;
  }

  /* ── ANALYTICS DESKTOP LAYOUT ── */
  .analytics-layout {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
    align-items: start;
  }

  /* ── ADD ENTRY DESKTOP LAYOUT ── */
  .entry-layout {
    display: grid;
    grid-template-columns: 1fr 320px;
    gap: 20px;
    align-items: start;
  }
  .entry-sidebar { position: sticky; top: 90px; }
  .entry-summary-card { padding: 22px; }

  /* ── MOBILE ── */
  @media (max-width: 900px) {
    .dash-layout     { grid-template-columns: 1fr; }
    .entry-layout    { grid-template-columns: 1fr; }
    .entry-sidebar   { position: static; }
    .analytics-layout { grid-template-columns: 1fr; }
    .analytics-stats { grid-template-columns: 1fr 1fr; }
  }
  @media (max-width: 600px) {
    .tab-btn { padding: 8px 12px; font-size: 12px; }
    .card { padding: 16px; }
    .metrics-grid { grid-template-columns: 1fr 1fr; }
    .analytics-stats { grid-template-columns: 1fr 1fr; }
    .history-item { flex-direction: column; gap: 12px; }
    .history-item > div:last-child { display: flex; align-items: center; gap: 12px; }
  }
  @media (max-width: 480px) {
    .field-grid { grid-template-columns: 1fr; }
    .analytics-stats { grid-template-columns: 1fr 1fr; }
  }

  @supports not selector(:focus-visible) {
    .tab-btn:focus, .btn-primary:focus, .btn-sm:focus { outline: 3px solid #4f46e5; outline-offset: 2px; }
  }
`;
