import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const FIXED_CATEGORIES = [
  { key: "rent",       label: "Rent / Housing",  icon: "🏠", color: "#4f46e5" },
  { key: "family",     label: "Family",           icon: "👨‍👩‍👧", color: "#be185d" },
  { key: "loanEmi",   label: "Loan EMI",          icon: "🏦", color: "#b45309" },
  { key: "creditCard", label: "Credit Card",      icon: "💳", color: "#b91c1c" },
  { key: "sip",        label: "Savings / SIP",    icon: "📈", color: "#047857" },
];

const VARIABLE_CATEGORIES = [
  { key: "food",      label: "Food & Dining", icon: "🍽️", color: "#065f46" },
  { key: "groceries", label: "Groceries",     icon: "🛒", color: "#0f766e" },
  { key: "transport", label: "Transport",     icon: "🚗", color: "#1d4ed8" },
];

const WELLBEING_CATEGORIES = [
  { key: "savings",       label: "Savings / Investment", icon: "💰", color: "#0369a1" },
  { key: "insurance",     label: "Insurance",            icon: "🛡️", color: "#0e7490" },
  { key: "medical",       label: "Medical / Health",     icon: "🏥", color: "#c2410c" },
  { key: "education",     label: "Education",            icon: "📚", color: "#7e22ce" },
  { key: "entertainment", label: "Entertainment",        icon: "🎬", color: "#9f1239" },
  { key: "utilities",     label: "Utilities",            icon: "⚡", color: "#92400e" },
];

// Scalar categories (subscriptions / others handled as multi-line)
const ALL_SCALAR_CATEGORIES = [...FIXED_CATEGORIES, ...VARIABLE_CATEGORIES, ...WELLBEING_CATEGORIES];

// For charts – subscriptions and others are each a single aggregated slice
const CHART_CATEGORIES = [
  ...ALL_SCALAR_CATEGORIES,
  { key: "subscriptions", label: "Subscriptions", icon: "📱", color: "#6d28d9" },
  { key: "other",         label: "Other",          icon: "📦", color: "#475569" },
];

// Chart-safe colors (used for fills only – can be brighter)
const CHART_FILL_COLORS = {
  rent: "#6366f1", family: "#ec4899", loanEmi: "#f59e0b", creditCard: "#ef4444",
  sip: "#059669", food: "#10b981", groceries: "#14b8a6", transport: "#3b82f6",
  savings: "#0ea5e9", insurance: "#0891b2", medical: "#f97316", education: "#a855f7",
  entertainment: "#fb7185", utilities: "#fbbf24", subscriptions: "#8b5cf6", other: "#94a3b8",
};

const INCOME_TYPES = ["Salary", "Freelance", "Business", "Rental", "Other"];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const fmt = (n) =>
  `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
const today = () => new Date().toISOString().split("T")[0];
const getWeek = (d) => {
  const dt = new Date(d);
  const day = dt.getDay();
  const diff = dt.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(dt.setDate(diff)).toISOString().split("T")[0];
};
const getMonth = (d) => d.slice(0, 7);
const newId = () => `${Date.now()}-${Math.random()}`;

const makeSub    = () => ({ id: newId(), name: "", amount: "" });
const makeIncome = () => ({ id: newId(), type: "Salary", amount: "", date: today(), auto: true });

const initialScalar = {};
ALL_SCALAR_CATEGORIES.forEach((c) => { initialScalar[c.key] = ""; });

const TABS = ["Dashboard", "Add Entry", "History", "Analytics"];

// ---------------------------------------------------------------------------
// Accessible Pie Tooltip
// ---------------------------------------------------------------------------
function PieTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  const fillColor = CHART_FILL_COLORS[d.payload?.key] || "#6366f1";
  return (
    <div role="tooltip" style={{
      background: "#fff",
      border: "1px solid #e2e8f0",
      borderRadius: 10,
      padding: "10px 14px",
      fontSize: 13,
      boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
      minWidth: 170,
      zIndex: 9999,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
        <span
          aria-hidden="true"
          style={{ width: 10, height: 10, borderRadius: "50%", background: fillColor, flexShrink: 0 }}
        />
        <span style={{ fontWeight: 700, color: "#1a202c" }}>{d.payload?.icon} {d.name}</span>
      </div>
      <div style={{ color: "#1a202c", fontWeight: 700, fontFamily: "monospace", fontSize: 15 }}>{fmt(d.value)}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
export default function BudgetTracker() {
  const [activeTab, setActiveTab]         = useState("Dashboard");
  const [bankBalance, setBankBalance]     = useState("");
  const [editingBalance, setEditingBalance] = useState(false);
  const [tempBalance, setTempBalance]     = useState("");
  const [incomes, setIncomes]             = useState([makeIncome()]);
  const [editingIncomeId, setEditingIncomeId] = useState(null);
  const [entries, setEntries]             = useState([]);
  const [expenseForm, setExpenseForm]     = useState({ ...initialScalar, date: today(), note: "" });
  const [formSubs, setFormSubs]           = useState([makeSub()]);
  const [formOthers, setFormOthers]       = useState([makeSub()]);
  const [chartView, setChartView]         = useState("monthly");
  const [notification, setNotification]   = useState(null);
  const notifTimer = useRef(null);
  const mainRef    = useRef(null);

  // Auto-income injection
  useEffect(() => {
    const check = () => {
      const todayStr = today();
      incomes.forEach((inc) => {
        if (!inc.auto || !inc.amount || !inc.date) return;
        if (inc.date.slice(8, 10) === todayStr.slice(8, 10)) {
          const key = `auto_income_${inc.id}_${todayStr}`;
          if (!sessionStorage.getItem(key)) {
            sessionStorage.setItem(key, "1");
            showNotif(`Auto-added ${inc.type} income: ${fmt(inc.amount)}`);
          }
        }
      });
    };
    check();
    const id = setInterval(check, 60_000);
    return () => clearInterval(id);
  }, [incomes]);

  const showNotif = (msg, type = "success") => {
    clearTimeout(notifTimer.current);
    setNotification({ msg, type });
    notifTimer.current = setTimeout(() => setNotification(null), 3500);
  };

  // ---------------------------------------------------------------------------
  // Derived totals
  // ---------------------------------------------------------------------------
  const totalMonthlyIncome = useMemo(
    () => incomes.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0),
    [incomes],
  );

  const totalExpenses = useMemo(
    () => entries.reduce((sum, e) => sum + (e.total || 0), 0),
    [entries],
  );

  const balance = useMemo(
    () => (parseFloat(bankBalance) || 0) - totalExpenses,
    [bankBalance, totalExpenses],
  );

  const thisMonthEntries = useMemo(() => {
    const m = getMonth(today());
    return entries.filter((e) => getMonth(e.date) === m);
  }, [entries]);

  const thisMonthTotal = useMemo(
    () => thisMonthEntries.reduce((s, e) => s + e.total, 0),
    [thisMonthEntries],
  );

  const thisWeekEntries = useMemo(() => {
    const w = getWeek(today());
    return entries.filter((e) => getWeek(e.date) >= w);
  }, [entries]);

  const thisWeekTotal = useMemo(
    () => thisWeekEntries.reduce((s, e) => s + e.total, 0),
    [thisWeekEntries],
  );

  const categoryTotals = useMemo(() => {
    const totals = {};
    CHART_CATEGORIES.forEach((c) => { totals[c.key] = 0; });
    entries.forEach((e) => {
      ALL_SCALAR_CATEGORIES.forEach((c) => { totals[c.key] += parseFloat(e[c.key] || 0); });
      (e.subscriptions || []).forEach((s) => { totals.subscriptions += parseFloat(s.amount || 0); });
      (e.others         || []).forEach((o) => { totals.other         += parseFloat(o.amount || 0); });
    });
    return totals;
  }, [entries]);

  const pieData = useMemo(() =>
    CHART_CATEGORIES
      .map((c) => ({ ...c, value: categoryTotals[c.key], fillColor: CHART_FILL_COLORS[c.key] }))
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value),
    [categoryTotals],
  );

  const entryTotal = (e) => {
    let t = ALL_SCALAR_CATEGORIES.reduce((s, c) => s + parseFloat(e[c.key] || 0), 0);
    (e.subscriptions || []).forEach((s) => { t += parseFloat(s.amount || 0); });
    (e.others         || []).forEach((o) => { t += parseFloat(o.amount || 0); });
    return t;
  };

  const chartData = useMemo(() => {
    if (chartView === "monthly") {
      const byMonth = {};
      entries.forEach((e) => { const m = getMonth(e.date); byMonth[m] = (byMonth[m] || 0) + entryTotal(e); });
      return Object.entries(byMonth).sort().map(([k, v]) => ({
        label: new Date(k + "-01").toLocaleDateString("en-IN", { month: "short", year: "2-digit" }),
        amount: Math.round(v),
      }));
    }
    if (chartView === "weekly") {
      const byWeek = {};
      entries.forEach((e) => { const w = getWeek(e.date); byWeek[w] = (byWeek[w] || 0) + entryTotal(e); });
      return Object.entries(byWeek).sort().map(([k, v]) => ({
        label: "W " + new Date(k).toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
        amount: Math.round(v),
      }));
    }
    // daily
    const byDay = {};
    entries.forEach((e) => { byDay[e.date] = (byDay[e.date] || 0) + entryTotal(e); });
    return Object.entries(byDay).sort().slice(-30).map(([k, v]) => ({
      label: new Date(k).toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
      amount: Math.round(v),
    }));
  }, [entries, chartView]);

  const savingsRate = useMemo(() => {
    if (!totalMonthlyIncome) return 0;
    return Math.max(0, Math.round(((totalMonthlyIncome - thisMonthTotal) / totalMonthlyIncome) * 100));
  }, [totalMonthlyIncome, thisMonthTotal]);

  const budgetUsed = totalMonthlyIncome > 0
    ? Math.min((thisMonthTotal / totalMonthlyIncome) * 100, 100) : 0;

  const balanceColor = balance >= 0 ? "#047857" : "#b91c1c";

  // ---------------------------------------------------------------------------
  // Form total preview
  // ---------------------------------------------------------------------------
  const formTotal = useMemo(() => {
    let t = ALL_SCALAR_CATEGORIES.reduce((s, c) => s + parseFloat(expenseForm[c.key] || 0), 0);
    formSubs.forEach((s)   => { t += parseFloat(s.amount || 0); });
    formOthers.forEach((o) => { t += parseFloat(o.amount || 0); });
    return t;
  }, [expenseForm, formSubs, formOthers]);

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------
  const handleAddEntry = useCallback(() => {
    if (formTotal === 0) { showNotif("Enter at least one expense amount", "error"); return; }
    const entry = {
      ...expenseForm,
      subscriptions: formSubs.filter((s) => parseFloat(s.amount) > 0),
      others:        formOthers.filter((o) => parseFloat(o.amount) > 0),
      total: formTotal,
      id: newId(),
    };
    setEntries((prev) => [entry, ...prev]);
    setExpenseForm({ ...initialScalar, date: today(), note: "" });
    setFormSubs([makeSub()]);
    setFormOthers([makeSub()]);
    showNotif(`Entry of ${fmt(formTotal)} added`);
    setActiveTab("Dashboard");
  }, [expenseForm, formSubs, formOthers, formTotal]);

  const deleteEntry = (id) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
    showNotif("Entry deleted");
  };

  const addIncome    = () => setIncomes((p) => [...p, makeIncome()]);
  const updateIncome = (id, f, v) => setIncomes((p) => p.map((i) => i.id === id ? { ...i, [f]: v } : i));
  const removeIncome = (id) => setIncomes((p) => p.filter((i) => i.id !== id));

  // ---------------------------------------------------------------------------
  // Render helpers (defined inside so they close over expenseForm state)
  // ---------------------------------------------------------------------------
  const ScalarField = ({ cat }) => (
    <div style={S.fieldWrap}>
      <label htmlFor={`field-${cat.key}`} style={S.label}>{cat.icon} {cat.label}</label>
      <div style={S.amountRow}>
        <span aria-hidden="true" style={S.rupee}>₹</span>
        <input
          id={`field-${cat.key}`}
          className="inp"
          type="number"
          min="0"
          placeholder="0"
          value={expenseForm[cat.key]}
          onChange={(e) => setExpenseForm((p) => ({ ...p, [cat.key]: e.target.value }))}
          style={S.amountInp}
          aria-label={`${cat.label} amount in rupees`}
        />
      </div>
    </div>
  );

  const MultiLineFields = ({ rows, setRows, label }) => (
    <div>
      {rows.map((row, idx) => (
        <div key={row.id} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
          <input
            className="inp"
            type="text"
            placeholder={`${label} name`}
            value={row.name}
            onChange={(e) => setRows((p) => p.map((r) => r.id === row.id ? { ...r, name: e.target.value } : r))}
            style={{ flex: "2 1 120px" }}
            aria-label={`${label} ${idx + 1} name`}
          />
          <div style={{ ...S.amountRow, flex: "1 1 100px" }}>
            <span aria-hidden="true" style={S.rupee}>₹</span>
            <input
              className="inp"
              type="number"
              min="0"
              placeholder="0"
              value={row.amount}
              onChange={(e) => setRows((p) => p.map((r) => r.id === row.id ? { ...r, amount: e.target.value } : r))}
              style={S.amountInp}
              aria-label={`${label} ${idx + 1} amount in rupees`}
            />
          </div>
          {rows.length > 1 && (
            <button
              onClick={() => setRows((p) => p.filter((r) => r.id !== row.id))}
              style={S.removeBtn}
              aria-label={`Remove ${label} ${idx + 1}`}
            >✕</button>
          )}
        </div>
      ))}
      <button
        onClick={() => setRows((p) => [...p, makeSub()])}
        style={S.addMoreBtn}
        aria-label={`Add another ${label}`}
      >+ Add {label}</button>
    </div>
  );

  // ---------------------------------------------------------------------------
  // JSX
  // ---------------------------------------------------------------------------
  return (
    <div style={{ fontFamily: "'DM Sans','Segoe UI',sans-serif", background: "#f0f2f5", minHeight: "100vh", paddingBottom: 56 }}>
      <style>{CSS}</style>

      {/* Skip navigation – always the first focusable element */}
      <a href="#main-content" className="skip-link">Skip to main content</a>

      {/* Live region for notifications (always in DOM so screen readers catch updates) */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0,0,0,0)", whiteSpace: "nowrap" }}
      >
        {notification?.msg ?? ""}
      </div>

      {/* Visual notification toast */}
      {notification && (
        <div className={`notif ${notification.type}`} aria-hidden="true">
          {notification.msg}
        </div>
      )}

      {/* ── Sticky header / nav ── */}
      <header style={S.header}>
        <div style={S.headerInner}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div>
              <h1 style={S.title}>💼 Budget Tracker</h1>
              <p style={S.subtitle}>
                {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              </p>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 12, color: "#4a5568", marginBottom: 2, fontWeight: 600 }}>Balance</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: balanceColor, fontFamily: "monospace" }} aria-label={`Balance: ${fmt(balance)}`}>
                {fmt(balance)}
              </div>
            </div>
          </div>

          <nav aria-label="Main navigation">
            <div role="tablist" aria-label="Budget Tracker sections" style={{ display: "flex", gap: 4, overflowX: "auto", paddingBottom: 4 }}>
              {TABS.map((t) => (
                <button
                  key={t}
                  role="tab"
                  aria-selected={activeTab === t}
                  aria-controls={`panel-${t}`}
                  id={`tab-${t}`}
                  className={`tab-btn ${activeTab === t ? "active" : ""}`}
                  onClick={() => { setActiveTab(t); mainRef.current?.focus(); }}
                >
                  {t}
                </button>
              ))}
            </div>
          </nav>
        </div>
      </header>

      {/* ── Main content ── */}
      <main id="main-content" ref={mainRef} tabIndex={-1} style={S.body} aria-label={`${activeTab} section`}>

        {/* ════════════════════════ DASHBOARD ════════════════════════ */}
        {activeTab === "Dashboard" && (
          <div style={S.col} role="tabpanel" id="panel-Dashboard" aria-labelledby="tab-Dashboard">

            {/* Account Setup */}
            <section aria-labelledby="setup-heading" className="card">
              <h2 id="setup-heading" className="section-title">Account Setup</h2>

              <div style={{ marginBottom: 16 }}>
                <label htmlFor="bank-balance" style={S.label}>Bank Balance (₹)</label>
                {editingBalance ? (
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      id="bank-balance"
                      className="inp"
                      type="number"
                      min="0"
                      value={tempBalance}
                      onChange={(e) => setTempBalance(e.target.value)}
                      placeholder="0"
                      autoFocus
                      aria-label="Enter bank balance amount"
                    />
                    <button
                      className="btn-primary"
                      style={{ whiteSpace: "nowrap", padding: "9px 16px" }}
                      onClick={() => { setBankBalance(tempBalance); setEditingBalance(false); showNotif("Balance updated"); }}
                    >Save</button>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <div style={S.displayBox} aria-label={`Bank balance: ${bankBalance ? fmt(bankBalance) : "Not set"}`}>
                      {bankBalance ? fmt(bankBalance) : "Not set"}
                    </div>
                    <button
                      className="btn-sm"
                      onClick={() => { setTempBalance(bankBalance); setEditingBalance(true); }}
                      aria-label="Edit bank balance"
                    >Edit</button>
                  </div>
                )}
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <h3 style={{ ...S.label, margin: 0 }}>Monthly Income Sources</h3>
                <button className="btn-sm" onClick={addIncome} aria-label="Add another income source" style={{ minHeight: 36 }}>
                  + Add Income
                </button>
              </div>

              {incomes.map((inc, idx) => (
                <IncomeRow
                  key={inc.id}
                  inc={inc}
                  index={idx + 1}
                  editing={editingIncomeId === inc.id}
                  onEdit={() => setEditingIncomeId(inc.id)}
                  onSave={() => { setEditingIncomeId(null); showNotif("Income updated"); }}
                  onChange={(f, v) => updateIncome(inc.id, f, v)}
                  onRemove={() => removeIncome(inc.id)}
                  showRemove={incomes.length > 1}
                />
              ))}

              {incomes.length > 1 && (
                <div style={S.totalIncomeChip} aria-label={`Total monthly income: ${fmt(totalMonthlyIncome)}`}>
                  <span style={{ fontWeight: 600, color: "#4a5568" }}>Total Income</span>
                  <span style={{ fontWeight: 700, color: "#4f46e5", fontFamily: "monospace" }}>{fmt(totalMonthlyIncome)}</span>
                </div>
              )}
            </section>

            {/* Key Metrics */}
            <section aria-labelledby="metrics-heading">
              <h2 id="metrics-heading" className="sr-only">Key Metrics</h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10 }}>
                {[
                  { label: "Bank Balance", val: fmt(parseFloat(bankBalance) || 0), sub: "Current", color: "#4f46e5" },
                  { label: "This Month",   val: fmt(thisMonthTotal), sub: `${thisMonthEntries.length} entries`, color: "#b91c1c" },
                  { label: "This Week",    val: fmt(thisWeekTotal),  sub: `${thisWeekEntries.length} entries`, color: "#b45309" },
                  { label: "Money Left",   val: fmt(balance),         sub: "After expenses", color: balanceColor },
                ].map((m) => (
                  <div className="metric-card" key={m.label} role="figure" aria-label={`${m.label}: ${m.val} — ${m.sub}`}>
                    <div style={{ fontSize: 12, color: "#4a5568", fontWeight: 600, marginBottom: 6 }}>{m.label}</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: m.color, fontFamily: "monospace" }} aria-hidden="true">{m.val}</div>
                    <div style={{ fontSize: 12, color: "#4a5568", marginTop: 3 }}>{m.sub}</div>
                  </div>
                ))}
              </div>
            </section>

            {/* Budget Progress */}
            {totalMonthlyIncome > 0 && (
              <section aria-labelledby="budget-heading" className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <h2 id="budget-heading" className="section-title" style={{ margin: 0 }}>Monthly Budget Used</h2>
                  <span
                    style={{ fontSize: 14, fontWeight: 700, color: budgetUsed > 80 ? "#b91c1c" : budgetUsed > 60 ? "#b45309" : "#047857" }}
                    aria-label={`${Math.round(budgetUsed)} percent of budget used`}
                  >{Math.round(budgetUsed)}%</span>
                </div>
                <div className="progress-bar" role="progressbar" aria-valuenow={Math.round(budgetUsed)} aria-valuemin={0} aria-valuemax={100} aria-label="Budget used">
                  <div className="progress-fill" style={{ width: `${budgetUsed}%`, background: budgetUsed > 80 ? "#b91c1c" : budgetUsed > 60 ? "#b45309" : "#047857" }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, fontSize: 12, color: "#4a5568", fontWeight: 600, flexWrap: "wrap", gap: 4 }}>
                  <span>Spent: {fmt(thisMonthTotal)}</span>
                  <span>Left: {fmt(Math.max(0, totalMonthlyIncome - thisMonthTotal))}</span>
                  <span>Income: {fmt(totalMonthlyIncome)}</span>
                </div>
                {savingsRate > 0 && (
                  <div style={{ marginTop: 10, padding: "10px 12px", borderRadius: 8, background: "rgba(4,120,87,0.08)", display: "flex", gap: 8, alignItems: "center" }}>
                    <span aria-hidden="true" style={{ fontSize: 18 }}>💰</span>
                    <span style={{ fontSize: 13, color: "#047857", fontWeight: 700 }}>
                      Savings Rate: {savingsRate}% — {savingsRate >= 20 ? "Great job!" : "Aim for 20%+"}
                    </span>
                  </div>
                )}
              </section>
            )}

            {/* Top Categories */}
            {pieData.length > 0 && (
              <section aria-labelledby="top-cats-heading" className="card">
                <h2 id="top-cats-heading" className="section-title">Top Spending Categories</h2>
                <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                  {pieData.slice(0, 6).map((d) => (
                    <li key={d.key} className="insight-row">
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span aria-hidden="true" style={{ fontSize: 20 }}>{d.icon}</span>
                        <span style={{ fontSize: 14, color: "#1a202c", fontWeight: 600 }}>{d.label}</span>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 14, fontWeight: 700, fontFamily: "monospace", color: "#1a202c" }}>{fmt(d.value)}</div>
                        {totalMonthlyIncome > 0 && (
                          <div style={{ fontSize: 12, color: "#4a5568", fontWeight: 600 }}>
                            {Math.round((d.value / totalMonthlyIncome) * 100)}% of income
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Spending Trend */}
            <section aria-labelledby="trend-heading" className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
                <h2 id="trend-heading" className="section-title" style={{ margin: 0 }}>Spending Trend</h2>
                <ChartToggle value={chartView} onChange={setChartView} />
              </div>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={chartData} margin={{ top: 0, right: 4, bottom: 0, left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#4a5568" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 12, fill: "#4a5568" }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                    <Tooltip
                      formatter={(v) => [fmt(v), "Spent"]}
                      contentStyle={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 13 }}
                      wrapperStyle={{ zIndex: 9999 }}
                      cursor={{ fill: "rgba(99,102,241,0.08)" }}
                    />
                    <Bar dataKey="amount" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p style={S.emptyState}>No spending data yet. Add some expenses!</p>
              )}
            </section>

            {/* Pie Chart */}
            {pieData.length > 0 && (
              <section aria-labelledby="dist-heading" className="card">
                <h2 id="dist-heading" className="section-title">Spending Distribution</h2>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={58} outerRadius={90} paddingAngle={2} dataKey="value">
                      {pieData.map((d, i) => <Cell key={i} fill={d.fillColor} />)}
                    </Pie>
                    <Tooltip content={<PieTooltip />} wrapperStyle={{ zIndex: 9999 }} />
                    <Legend
                      formatter={(val) => <span style={{ fontSize: 12, color: "#4a5568", fontWeight: 600 }}>{val}</span>}
                      wrapperStyle={{ paddingTop: 8 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </section>
            )}

            <button
              className="btn-primary"
              onClick={() => setActiveTab("Add Entry")}
              style={{ width: "100%", padding: 14, fontSize: 15, borderRadius: 12, minHeight: 52 }}
            >
              + Add Expense Entry
            </button>
          </div>
        )}

        {/* ════════════════════════ ADD ENTRY ════════════════════════ */}
        {activeTab === "Add Entry" && (
          <div style={S.col} role="tabpanel" id="panel-Add Entry" aria-labelledby="tab-Add Entry">
            <div className="card">
              <h2 className="section-title" style={{ fontSize: 15, marginBottom: 18 }}>New Expense Entry</h2>

              <div style={{ marginBottom: 20 }}>
                <label htmlFor="entry-date" style={S.label}>Entry Date</label>
                <input
                  id="entry-date"
                  className="inp"
                  type="date"
                  value={expenseForm.date}
                  onChange={(e) => setExpenseForm((p) => ({ ...p, date: e.target.value }))}
                  style={{ maxWidth: 220 }}
                />
              </div>

              <EntrySection title="Fixed Expenses" color="#4f46e5">
                <div className="field-grid">
                  {FIXED_CATEGORIES.map((c) => <ScalarField key={c.key} cat={c} />)}
                </div>
              </EntrySection>

              <EntrySection title="Variable Expenses" color="#047857">
                <div className="field-grid">
                  {VARIABLE_CATEGORIES.map((c) => <ScalarField key={c.key} cat={c} />)}
                </div>
              </EntrySection>

              <EntrySection title="Subscriptions" color="#6d28d9">
                <MultiLineFields rows={formSubs} setRows={setFormSubs} label="Subscription" />
              </EntrySection>

              <EntrySection title="Savings & Wellbeing" color="#0369a1">
                <div className="field-grid">
                  {WELLBEING_CATEGORIES.map((c) => <ScalarField key={c.key} cat={c} />)}
                </div>
              </EntrySection>

              <EntrySection title="Other Expenses" color="#475569">
                <MultiLineFields rows={formOthers} setRows={setFormOthers} label="Expense" />
              </EntrySection>

              <div style={{ marginBottom: 20 }}>
                <label htmlFor="entry-note" style={S.label}>Note (optional)</label>
                <input
                  id="entry-note"
                  className="inp"
                  type="text"
                  placeholder="Any notes for this entry…"
                  value={expenseForm.note}
                  onChange={(e) => setExpenseForm((p) => ({ ...p, note: e.target.value }))}
                />
              </div>

              <div style={S.totalPreview} aria-label={`Entry total: ${fmt(formTotal)}`}>
                <span style={{ fontSize: 14, color: "#4a5568", fontWeight: 700 }}>Entry Total</span>
                <span style={{ fontSize: 22, fontWeight: 700, color: "#4f46e5", fontFamily: "monospace" }}>{fmt(formTotal)}</span>
              </div>

              <button
                className="btn-primary"
                onClick={handleAddEntry}
                style={{ width: "100%", padding: 14, fontSize: 15, borderRadius: 12, minHeight: 52 }}
              >
                Save Entry
              </button>
            </div>
          </div>
        )}

        {/* ════════════════════════ HISTORY ════════════════════════ */}
        {activeTab === "History" && (
          <div role="tabpanel" id="panel-History" aria-labelledby="tab-History">
            {entries.length === 0 ? (
              <div className="card" style={{ textAlign: "center", padding: 48 }}>
                <div aria-hidden="true" style={{ fontSize: 44, marginBottom: 14 }}>📋</div>
                <p style={{ color: "#4a5568", margin: 0, fontWeight: 600, fontSize: 15 }}>No entries yet. Add your first expense!</p>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <h2 className="section-title" style={{ margin: 0 }}>{entries.length} total {entries.length === 1 ? "entry" : "entries"}</h2>
                  <span style={{ fontSize: 13, color: "#4a5568", fontWeight: 700 }}>Total: {fmt(totalExpenses)}</span>
                </div>
                <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                  {entries.map((e) => {
                    const scalarCats = ALL_SCALAR_CATEGORIES.filter((c) => parseFloat(e[c.key] || 0) > 0);
                    const subs   = (e.subscriptions || []).filter((s) => parseFloat(s.amount) > 0);
                    const others = (e.others || []).filter((o) => parseFloat(o.amount) > 0);
                    const allPills = [
                      ...scalarCats.map((c) => ({ label: c.label, icon: c.icon, color: c.color, val: e[c.key] })),
                      ...subs.map((s)   => ({ label: s.name || "Subscription", icon: "📱", color: "#6d28d9", val: s.amount })),
                      ...others.map((o) => ({ label: o.name || "Other",        icon: "📦", color: "#475569", val: o.amount })),
                    ];
                    const dateStr = new Date(e.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
                    return (
                      <li key={e.id} className="history-item" aria-label={`Entry on ${dateStr}, total ${fmt(e.total)}`}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                            <time dateTime={e.date} style={{ fontSize: 13, color: "#4a5568", fontWeight: 600 }}>{dateStr}</time>
                            {e.note && <span style={{ fontSize: 13, color: "#4a5568", fontStyle: "italic" }}>— {e.note}</span>}
                          </div>
                          <div style={{ display: "flex", flexWrap: "wrap" }}>
                            {allPills.slice(0, 5).map((p, i) => (
                              <span key={i} className="cat-pill" style={{ background: "#f0f2f5", color: "#1a202c", borderLeft: `3px solid ${p.color}` }}>
                                {p.icon} {p.label}: {fmt(p.val)}
                              </span>
                            ))}
                            {allPills.length > 5 && (
                              <span className="cat-pill" style={{ background: "#f0f2f5", color: "#1a202c" }}>
                                +{allPills.length - 5} more
                              </span>
                            )}
                          </div>
                        </div>
                        <div style={{ textAlign: "right", marginLeft: 12, flexShrink: 0 }}>
                          <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "monospace", color: "#1a202c" }}>{fmt(e.total)}</div>
                          <button
                            className="btn-sm"
                            style={{ marginTop: 8, color: "#b91c1c", borderColor: "#b91c1c40", minHeight: 36 }}
                            onClick={() => deleteEntry(e.id)}
                            aria-label={`Delete entry from ${dateStr}`}
                          >Delete</button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </div>
        )}

        {/* ════════════════════════ ANALYTICS ════════════════════════ */}
        {activeTab === "Analytics" && (
          <div style={S.col} role="tabpanel" id="panel-Analytics" aria-labelledby="tab-Analytics">
            <section aria-labelledby="summary-heading">
              <h2 id="summary-heading" className="sr-only">Summary Statistics</h2>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[
                  { label: "Avg Monthly",  val: entries.length > 0 ? fmt(totalExpenses / Math.max(1, new Set(entries.map((e) => getMonth(e.date))).size)) : "—", color: "#4f46e5" },
                  { label: "Savings Rate", val: `${savingsRate}%`, color: savingsRate >= 20 ? "#047857" : "#b45309" },
                  { label: "Highest Day",  val: chartData.length > 0 ? fmt(Math.max(...chartData.map((d) => d.amount))) : "—", color: "#b91c1c" },
                  { label: "Total Entries",val: String(entries.length), color: "#1a202c" },
                ].map((m) => (
                  <div className="metric-card" key={m.label}>
                    <div style={{ fontSize: 12, color: "#4a5568", fontWeight: 600, marginBottom: 6 }}>{m.label}</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: m.color, fontFamily: "monospace" }}>{m.val}</div>
                  </div>
                ))}
              </div>
            </section>

            <section aria-labelledby="cat-totals-heading" className="card">
              <h2 id="cat-totals-heading" className="section-title">All Category Totals</h2>
              {CHART_CATEGORIES.map((c) => {
                const val = categoryTotals[c.key];
                if (!val) return null;
                const pct = totalExpenses > 0 ? (val / totalExpenses) * 100 : 0;
                return (
                  <div key={c.key} style={{ marginBottom: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                      <span style={{ fontSize: 13, color: "#1a202c", fontWeight: 600 }}>{c.icon} {c.label}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: c.color, fontFamily: "monospace" }}>
                        {fmt(val)} <span style={{ fontWeight: 600, color: "#4a5568", fontSize: 12 }}>({Math.round(pct)}%)</span>
                      </span>
                    </div>
                    <div className="progress-bar" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={`${c.label}: ${Math.round(pct)}% of total spending`}>
                      <div className="progress-fill" style={{ width: `${pct}%`, background: CHART_FILL_COLORS[c.key] || c.color }} />
                    </div>
                  </div>
                );
              })}
              {totalExpenses === 0 && <p style={{ color: "#4a5568", fontSize: 14, textAlign: "center", padding: 20, fontWeight: 600 }}>No spending data yet.</p>}
            </section>

            <section aria-labelledby="trend-a-heading" className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
                <h2 id="trend-a-heading" className="section-title" style={{ margin: 0 }}>Spending Trend</h2>
                <ChartToggle value={chartView} onChange={setChartView} />
              </div>
              {chartData.length > 1 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#4a5568" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 12, fill: "#4a5568" }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                    <Tooltip
                      formatter={(v) => [fmt(v), "Spent"]}
                      contentStyle={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 13 }}
                      wrapperStyle={{ zIndex: 9999 }}
                    />
                    <Line type="monotone" dataKey="amount" stroke="#6366f1" strokeWidth={2} dot={{ fill: "#6366f1", r: 3 }} activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p style={S.emptyState}>Add more entries to see trends</p>
              )}
            </section>

            {pieData.length > 0 && (
              <section aria-labelledby="dist-a-heading" className="card">
                <h2 id="dist-a-heading" className="section-title">Spending Distribution</h2>
                <ResponsiveContainer width="100%" height={270}>
                  <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                    <Pie data={pieData} cx="50%" cy="46%" innerRadius={58} outerRadius={90} paddingAngle={2} dataKey="value">
                      {pieData.map((d, i) => <Cell key={i} fill={d.fillColor} />)}
                    </Pie>
                    <Tooltip content={<PieTooltip />} wrapperStyle={{ zIndex: 9999 }} />
                    <Legend
                      formatter={(val) => <span style={{ fontSize: 12, color: "#4a5568", fontWeight: 600 }}>{val}</span>}
                      wrapperStyle={{ paddingTop: 8 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </section>
            )}

            {totalMonthlyIncome > 0 && (
              <section aria-labelledby="health-heading" className="card">
                <h2 id="health-heading" className="section-title">Financial Health</h2>
                <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                  {[
                    { label: "Savings Rate",          val: savingsRate, target: 20, unit: "%", tip: "Target ≥ 20%" },
                    { label: "Housing (% of income)", val: Math.round((categoryTotals.rent / totalMonthlyIncome) * 100), target: 30, unit: "%", tip: "Target ≤ 30%", invert: true },
                    { label: "Debt (EMI + Credit Card)", val: Math.round(((categoryTotals.loanEmi + categoryTotals.creditCard) / totalMonthlyIncome) * 100), target: 20, unit: "%", tip: "Target ≤ 20%", invert: true },
                  ].map((item) => {
                    const pass = item.invert ? item.val <= item.target : item.val >= item.target;
                    const valColor = pass ? "#047857" : item.invert ? "#b91c1c" : "#b45309";
                    return (
                      <li key={item.label} className="insight-row">
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "#1a202c" }}>{item.label}</div>
                          <div style={{ fontSize: 12, color: "#4a5568", fontWeight: 600 }}>{item.tip}</div>
                        </div>
                        <span style={{ fontSize: 16, fontWeight: 700, color: valColor }} aria-label={`${item.label}: ${item.val}${item.unit}`}>
                          {item.val}{item.unit}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ChartToggle({ value, onChange }) {
  return (
    <div className="chart-toggle" role="group" aria-label="Chart time range">
      {["daily", "weekly", "monthly"].map((v) => (
        <button
          key={v}
          className={value === v ? "active" : ""}
          onClick={() => onChange(v)}
          aria-pressed={value === v}
        >
          {v.charAt(0).toUpperCase() + v.slice(1)}
        </button>
      ))}
    </div>
  );
}

function EntrySection({ title, color, children }) {
  return (
    <fieldset style={{
      marginBottom: 20,
      borderRadius: 10,
      border: `2px solid ${color}30`,
      padding: 0,
      overflow: "hidden",
    }}>
      <legend style={{
        background: color + "15",
        padding: "7px 14px",
        margin: 0,
        width: "100%",
        display: "block",
        borderBottom: `1px solid ${color}25`,
        fontSize: 12,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.07em",
        color: "#1a202c",
        boxSizing: "border-box",
      }}>
        <span aria-hidden="true" style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: color, marginRight: 6, verticalAlign: "middle" }} />
        {title}
      </legend>
      <div style={{ padding: "14px 14px 8px" }}>{children}</div>
    </fieldset>
  );
}

function IncomeRow({ inc, index, editing, onEdit, onSave, onChange, onRemove, showRemove }) {
  const autoColor = inc.auto ? "#047857" : "#b45309";
  const toggleId  = `auto-toggle-${inc.id}`;
  return (
    <div style={{ background: "#f8f9fa", borderRadius: 10, padding: "12px 14px", marginBottom: 8, border: "1px solid #e2e8f0" }}>
      {editing ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <select
              className="inp"
              style={{ flex: "1 1 110px" }}
              value={inc.type}
              onChange={(e) => onChange("type", e.target.value)}
              aria-label={`Income ${index} type`}
            >
              {INCOME_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
            <input
              className="inp"
              type="number"
              min="0"
              placeholder="Amount (₹)"
              value={inc.amount}
              onChange={(e) => onChange("amount", e.target.value)}
              style={{ flex: "1 1 130px" }}
              aria-label={`Income ${index} amount in rupees`}
            />
            <input
              className="inp"
              type="date"
              value={inc.date}
              onChange={(e) => onChange("date", e.target.value)}
              style={{ flex: "1 1 140px" }}
              aria-label={`Income ${index} recurring date`}
            />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                id={toggleId}
                role="switch"
                aria-checked={inc.auto}
                onClick={() => onChange("auto", !inc.auto)}
                style={{
                  width: 42, height: 24, borderRadius: 12,
                  background: inc.auto ? "#047857" : "#cbd5e0",
                  border: "none", cursor: "pointer", position: "relative",
                  transition: "background 0.2s", flexShrink: 0, padding: 0,
                }}
                aria-label={`Auto-add income ${index} on recurring date`}
              >
                <span style={{
                  position: "absolute", top: 3, left: inc.auto ? 20 : 3,
                  width: 18, height: 18, borderRadius: "50%",
                  background: "#fff", transition: "left 0.2s",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
                }} />
              </button>
              <label htmlFor={toggleId} style={{ fontSize: 13, color: autoColor, fontWeight: 700, cursor: "pointer" }}>
                {inc.auto ? "🔄 Auto-add on date" : "✋ Manual only"}
              </label>
            </div>
            <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
              <button className="btn-primary" style={{ padding: "8px 16px", fontSize: 13, minHeight: 36 }} onClick={onSave} aria-label={`Save income ${index}`}>Save</button>
              {showRemove && (
                <button className="btn-sm" style={{ color: "#b91c1c", borderColor: "#b91c1c40", minHeight: 36 }} onClick={onRemove} aria-label={`Remove income ${index}`}>Remove</button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#1a202c" }}>{inc.type}</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: "#4f46e5", fontFamily: "monospace" }}>
              {inc.amount ? fmt(inc.amount) : <span style={{ color: "#4a5568", fontStyle: "italic" }}>—</span>}
            </span>
            {inc.date && (
              <span style={{ fontSize: 12, color: "#4a5568", fontWeight: 600 }}>
                every {new Date(inc.date).getDate()}{ordinal(new Date(inc.date).getDate())}
              </span>
            )}
            <span style={{ fontSize: 12, fontWeight: 700, color: autoColor }}>
              {inc.auto ? "🔄 Auto" : "✋ Manual"}
            </span>
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

// ---------------------------------------------------------------------------
// Styles & CSS
// ---------------------------------------------------------------------------
const S = {
  header:       { background: "#fff", borderBottom: "1px solid #e2e8f0", padding: "16px 20px 0", position: "sticky", top: 0, zIndex: 200 },
  headerInner:  { maxWidth: 760, margin: "0 auto" },
  body:         { maxWidth: 760, margin: "24px auto", padding: "0 16px", outline: "none" },
  col:          { display: "flex", flexDirection: "column", gap: 16 },
  title:        { margin: 0, fontSize: 20, fontWeight: 700, color: "#1a202c", letterSpacing: "-0.3px" },
  subtitle:     { margin: "2px 0 0", fontSize: 13, color: "#4a5568", fontWeight: 600 },
  label:        { fontSize: 13, color: "#4a5568", fontWeight: 700, display: "block", marginBottom: 6 },
  displayBox:   { flex: 1, padding: "10px 12px", borderRadius: 8, background: "#f8f9fa", fontSize: 14, fontWeight: 700, color: "#1a202c", fontFamily: "monospace", border: "1px solid #e2e8f0" },
  fieldWrap:    { display: "flex", flexDirection: "column" },
  amountRow:    { display: "flex", alignItems: "center", border: "1px solid #e2e8f0", borderRadius: 8, background: "#f8f9fa", overflow: "hidden" },
  rupee:        { padding: "0 8px", fontSize: 15, color: "#4f46e5", fontWeight: 700, userSelect: "none", lineHeight: 1 },
  amountInp:    { flex: 1, border: "none", background: "transparent", padding: "10px 8px 10px 0", fontSize: 14, outline: "none", color: "#1a202c", minWidth: 0 },
  addMoreBtn:   { fontSize: 13, color: "#4f46e5", background: "none", border: "1.5px dashed #4f46e5", borderRadius: 6, padding: "6px 14px", cursor: "pointer", marginTop: 4, fontWeight: 700, minHeight: 36 },
  removeBtn:    { background: "none", border: "1px solid #e2e8f0", borderRadius: 6, cursor: "pointer", fontSize: 13, padding: "6px 10px", color: "#b91c1c", minWidth: 36, minHeight: 36, fontWeight: 700 },
  totalPreview: { background: "rgba(79,70,229,0.07)", borderRadius: 10, padding: "14px 16px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid rgba(79,70,229,0.15)" },
  totalIncomeChip: { marginTop: 8, padding: "10px 14px", borderRadius: 8, background: "rgba(79,70,229,0.06)", border: "1px solid rgba(79,70,229,0.15)", display: "flex", justifyContent: "space-between", alignItems: "center" },
  emptyState:   { height: 180, display: "flex", alignItems: "center", justifyContent: "center", color: "#4a5568", fontSize: 14, fontWeight: 600, textAlign: "center", margin: 0 },
};

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
  *, *::before, *::after { box-sizing: border-box; }
  body { margin: 0; }

  /* Skip link */
  .skip-link {
    position: absolute;
    top: -100%;
    left: 8px;
    padding: 10px 18px;
    background: #4f46e5;
    color: #fff;
    font-weight: 700;
    font-size: 14px;
    border-radius: 0 0 8px 8px;
    text-decoration: none;
    z-index: 9999;
    transition: top 0.15s;
  }
  .skip-link:focus { top: 0; }

  /* Screen-reader only */
  .sr-only {
    position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
    overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0;
  }

  /* Tabs */
  .tab-btn {
    padding: 8px 18px; border-radius: 20px; border: none; cursor: pointer;
    font-size: 13px; font-weight: 700; transition: all 0.2s;
    background: transparent; color: #4a5568; min-height: 40px;
    font-family: inherit;
  }
  .tab-btn.active { background: #4f46e5; color: #fff; }
  .tab-btn:hover:not(.active) { background: #eef2ff; color: #1a202c; }
  .tab-btn:focus-visible { outline: 3px solid #4f46e5; outline-offset: 2px; }

  /* Cards */
  .card { background: #fff; border-radius: 16px; border: 1px solid #e2e8f0; padding: 20px; }
  .metric-card { background: #f8f9fa; border-radius: 12px; padding: 16px; border: 1px solid #e2e8f0; }

  /* Inputs */
  .inp {
    width: 100%; padding: 10px 12px; border-radius: 8px; border: 1px solid #e2e8f0;
    font-size: 14px; background: #f8f9fa; color: #1a202c; box-sizing: border-box;
    font-family: inherit; transition: border-color 0.15s, box-shadow 0.15s;
  }
  .inp:focus {
    outline: none; border-color: #4f46e5;
    box-shadow: 0 0 0 3px rgba(79,70,229,0.15);
  }

  /* Buttons */
  .btn-primary {
    background: #4f46e5; color: #fff; border: none; border-radius: 10px;
    padding: 11px 24px; font-size: 14px; font-weight: 700; cursor: pointer;
    transition: background 0.2s; font-family: inherit;
  }
  .btn-primary:hover { background: #3730a3; }
  .btn-primary:focus-visible { outline: 3px solid #4f46e5; outline-offset: 3px; }
  .btn-sm {
    padding: 6px 14px; border-radius: 6px; border: 1px solid #e2e8f0;
    background: transparent; color: #4a5568; font-size: 13px; cursor: pointer;
    font-family: inherit; font-weight: 700; transition: background 0.15s;
  }
  .btn-sm:hover { background: #f0f2f5; }
  .btn-sm:focus-visible { outline: 3px solid #4f46e5; outline-offset: 2px; }

  /* Chart toggle */
  .chart-toggle button {
    padding: 7px 14px; font-size: 12px; border: 1px solid #e2e8f0;
    background: transparent; cursor: pointer; color: #4a5568;
    font-family: inherit; transition: all 0.15s; font-weight: 700; min-height: 36px;
  }
  .chart-toggle button:first-child { border-radius: 8px 0 0 8px; }
  .chart-toggle button:last-child  { border-radius: 0 8px 8px 0; }
  .chart-toggle button.active { background: #4f46e5; color: #fff; border-color: #4f46e5; }
  .chart-toggle button:focus-visible { outline: 3px solid #4f46e5; outline-offset: 2px; z-index: 1; position: relative; }

  /* Notification */
  .notif {
    position: fixed; top: 20px; right: 20px; padding: 12px 20px;
    border-radius: 10px; font-size: 14px; font-weight: 700; z-index: 9999;
    animation: slideIn 0.3s ease; max-width: calc(100vw - 40px);
  }
  .notif.success { background: #047857; color: #fff; }
  .notif.error   { background: #b91c1c; color: #fff; }
  @keyframes slideIn { from { transform: translateX(40px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }

  /* Progress */
  .progress-bar { height: 8px; border-radius: 4px; background: #e2e8f0; overflow: hidden; }
  .progress-fill { height: 100%; border-radius: 4px; transition: width 0.6s ease; }

  /* Section headings */
  .section-title {
    font-size: 11px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.08em; color: #4a5568; margin: 0 0 14px;
  }

  /* History items */
  .history-item {
    display: flex; justify-content: space-between; align-items: flex-start;
    padding: 14px 16px; border-radius: 12px; border: 1px solid #e2e8f0;
    margin-bottom: 8px; background: #fff;
  }
  .history-item:focus-within { box-shadow: 0 0 0 2px #4f46e5; }

  /* Category pills */
  .cat-pill {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 4px 9px; border-radius: 6px; font-size: 12px;
    font-weight: 700; margin: 2px; color: #1a202c;
  }

  /* Insight rows */
  .insight-row {
    display: flex; align-items: center; justify-content: space-between;
    padding: 12px 0; border-bottom: 1px solid #e2e8f0;
  }
  .insight-row:last-child { border-bottom: none; }

  /* Mobile */
  @media (max-width: 600px) {
    .tab-btn { padding: 7px 11px; font-size: 12px; min-height: 40px; }
    .card { padding: 16px; }
    .history-item { flex-direction: column; gap: 10px; }
    .history-item > div:last-child { text-align: left; margin-left: 0; display: flex; align-items: center; gap: 12px; }
  }

  /* 2-col input grid */
  .field-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 14px; }
  @media (max-width: 480px) {
    .field-grid { grid-template-columns: 1fr; }
  }

  /* Focus visible fallback for browsers that don't support :focus-visible */
  @supports not selector(:focus-visible) {
    .tab-btn:focus, .btn-primary:focus, .btn-sm:focus { outline: 3px solid #4f46e5; outline-offset: 2px; }
  }
`;
