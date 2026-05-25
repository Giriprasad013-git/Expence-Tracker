import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const FIXED_CATEGORIES = [
  { key: "rent",       label: "Rent / Housing",     icon: "🏠", color: "#6366f1" },
  { key: "family",     label: "Family",              icon: "👨‍👩‍👧", color: "#ec4899" },
  { key: "loanEmi",   label: "Loan EMI",             icon: "🏦", color: "#f59e0b" },
  { key: "creditCard", label: "Credit Card",         icon: "💳", color: "#ef4444" },
  { key: "sip",        label: "Savings / SIP",       icon: "📈", color: "#059669" },
];

const VARIABLE_CATEGORIES = [
  { key: "food",        label: "Food & Dining",   icon: "🍽️", color: "#10b981" },
  { key: "groceries",   label: "Groceries",       icon: "🛒", color: "#14b8a6" },
  { key: "transport",   label: "Transport",       icon: "🚗", color: "#3b82f6" },
];

const WELLBEING_CATEGORIES = [
  { key: "savings",      label: "Savings / Investment", icon: "💰", color: "#0ea5e9" },
  { key: "insurance",    label: "Insurance",            icon: "🛡️", color: "#0891b2" },
  { key: "medical",      label: "Medical / Health",     icon: "🏥", color: "#f97316" },
  { key: "education",    label: "Education",            icon: "📚", color: "#a855f7" },
  { key: "entertainment",label: "Entertainment",        icon: "🎬", color: "#fb7185" },
  { key: "utilities",    label: "Utilities",            icon: "⚡", color: "#fbbf24" },
];

// All scalar categories (subscriptions/others are multi-line, handled separately)
const ALL_SCALAR_CATEGORIES = [...FIXED_CATEGORIES, ...VARIABLE_CATEGORIES, ...WELLBEING_CATEGORIES];

// For charts/analytics – subscriptions and others are grouped
const CHART_CATEGORIES = [
  ...ALL_SCALAR_CATEGORIES,
  { key: "subscriptions", label: "Subscriptions", icon: "📱", color: "#8b5cf6" },
  { key: "other",         label: "Other",          icon: "📦", color: "#94a3b8" },
];

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
const newId = () => Date.now() + Math.random();

const makeSub = () => ({ id: newId(), name: "", amount: "" });
const makeIncome = () => ({ id: newId(), type: "Salary", amount: "", date: today(), auto: true });

const initialScalar = {};
ALL_SCALAR_CATEGORIES.forEach((c) => { initialScalar[c.key] = ""; });

const TABS = ["Dashboard", "Add Entry", "History", "Analytics"];

// ---------------------------------------------------------------------------
// Custom Pie Tooltip
// ---------------------------------------------------------------------------
function PieTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div style={{
      background: "var(--color-background-primary, #fff)",
      border: "0.5px solid #e2e8f0",
      borderRadius: 10,
      padding: "10px 14px",
      fontSize: 13,
      boxShadow: "0 4px 16px rgba(0,0,0,0.10)",
      minWidth: 160,
      zIndex: 999,
    }}>
      <div style={{ fontWeight: 700, color: d.payload?.color || "#6366f1", marginBottom: 3 }}>
        {d.payload?.icon} {d.name}
      </div>
      <div style={{ color: "#1a202c", fontWeight: 600 }}>{fmt(d.value)}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
export default function BudgetTracker() {
  const [activeTab, setActiveTab] = useState("Dashboard");
  const [bankBalance, setBankBalance] = useState("");
  const [editingBalance, setEditingBalance] = useState(false);
  const [tempBalance, setTempBalance] = useState("");

  // Multiple incomes
  const [incomes, setIncomes] = useState([makeIncome()]);
  const [editingIncomeId, setEditingIncomeId] = useState(null);

  // Entries
  const [entries, setEntries] = useState([]);

  // Expense form
  const [expenseForm, setExpenseForm] = useState({
    ...initialScalar,
    date: today(),
    note: "",
  });
  // Multi-line subscriptions and others in the form
  const [formSubs, setFormSubs] = useState([makeSub()]);
  const [formOthers, setFormOthers] = useState([makeSub()]);

  const [chartView, setChartView] = useState("monthly");
  const [notification, setNotification] = useState(null);
  const notifTimer = useRef(null);

  // Auto-income injection
  useEffect(() => {
    const interval = setInterval(() => {
      const todayStr = today();
      incomes.forEach((inc) => {
        if (!inc.auto || !inc.amount || !inc.date) return;
        const incDay = inc.date.slice(8, 10); // DD
        const todayDay = todayStr.slice(8, 10);
        if (incDay === todayDay) {
          // mark as auto-added today – use sessionStorage so we don't double-add per session
          const key = `auto_income_${inc.id}_${todayStr}`;
          if (!sessionStorage.getItem(key)) {
            sessionStorage.setItem(key, "1");
            showNotif(`Auto-added ${inc.type} income: ${fmt(inc.amount)}`);
          }
        }
      });
    }, 60_000);
    return () => clearInterval(interval);
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
    [incomes]
  );

  const totalExpenses = useMemo(
    () => entries.reduce((sum, e) => sum + (e.total || 0), 0),
    [entries]
  );

  const balance = useMemo(() => {
    const bank = parseFloat(bankBalance) || 0;
    return bank - totalExpenses;
  }, [bankBalance, totalExpenses]);

  const thisMonthEntries = useMemo(() => {
    const m = getMonth(today());
    return entries.filter((e) => getMonth(e.date) === m);
  }, [entries]);

  const thisMonthTotal = useMemo(
    () => thisMonthEntries.reduce((s, e) => s + e.total, 0),
    [thisMonthEntries]
  );

  const thisWeekEntries = useMemo(() => {
    const w = getWeek(today());
    return entries.filter((e) => getWeek(e.date) >= w);
  }, [entries]);

  const thisWeekTotal = useMemo(
    () => thisWeekEntries.reduce((s, e) => s + e.total, 0),
    [thisWeekEntries]
  );

  // Category totals across all entries
  const categoryTotals = useMemo(() => {
    const totals = {};
    CHART_CATEGORIES.forEach((c) => { totals[c.key] = 0; });
    entries.forEach((e) => {
      ALL_SCALAR_CATEGORIES.forEach((c) => {
        totals[c.key] += parseFloat(e[c.key] || 0);
      });
      (e.subscriptions || []).forEach((s) => {
        totals.subscriptions += parseFloat(s.amount || 0);
      });
      (e.others || []).forEach((o) => {
        totals.other += parseFloat(o.amount || 0);
      });
    });
    return totals;
  }, [entries]);

  const pieData = useMemo(() => {
    return CHART_CATEGORIES
      .map((c) => ({ name: c.label, value: categoryTotals[c.key], color: c.color, icon: c.icon }))
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [categoryTotals]);

  const chartData = useMemo(() => {
    const entryTotal = (e) => {
      let t = ALL_SCALAR_CATEGORIES.reduce((s, c) => s + (parseFloat(e[c.key] || 0)), 0);
      (e.subscriptions || []).forEach((s) => { t += parseFloat(s.amount || 0); });
      (e.others || []).forEach((o) => { t += parseFloat(o.amount || 0); });
      return t;
    };
    if (chartView === "monthly") {
      const byMonth = {};
      entries.forEach((e) => {
        const m = getMonth(e.date);
        byMonth[m] = (byMonth[m] || 0) + entryTotal(e);
      });
      return Object.entries(byMonth).sort().map(([k, v]) => ({
        label: new Date(k + "-01").toLocaleDateString("en-IN", { month: "short", year: "2-digit" }),
        amount: Math.round(v),
      }));
    } else if (chartView === "weekly") {
      const byWeek = {};
      entries.forEach((e) => {
        const w = getWeek(e.date);
        byWeek[w] = (byWeek[w] || 0) + entryTotal(e);
      });
      return Object.entries(byWeek).sort().map(([k, v]) => ({
        label: "W " + new Date(k).toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
        amount: Math.round(v),
      }));
    } else {
      const byDay = {};
      entries.forEach((e) => { byDay[e.date] = (byDay[e.date] || 0) + entryTotal(e); });
      return Object.entries(byDay).sort().slice(-30).map(([k, v]) => ({
        label: new Date(k).toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
        amount: Math.round(v),
      }));
    }
  }, [entries, chartView]);

  const savingsRate = useMemo(() => {
    if (!totalMonthlyIncome) return 0;
    return Math.max(0, Math.round(((totalMonthlyIncome - thisMonthTotal) / totalMonthlyIncome) * 100));
  }, [totalMonthlyIncome, thisMonthTotal]);

  const budgetUsed = totalMonthlyIncome > 0
    ? Math.min((thisMonthTotal / totalMonthlyIncome) * 100, 100)
    : 0;

  const balanceColor = balance >= 0 ? "#10b981" : "#ef4444";

  // ---------------------------------------------------------------------------
  // Form entry total preview
  // ---------------------------------------------------------------------------
  const formTotal = useMemo(() => {
    let t = ALL_SCALAR_CATEGORIES.reduce((s, c) => s + (parseFloat(expenseForm[c.key] || 0)), 0);
    formSubs.forEach((s) => { t += parseFloat(s.amount || 0); });
    formOthers.forEach((o) => { t += parseFloat(o.amount || 0); });
    return t;
  }, [expenseForm, formSubs, formOthers]);

  // ---------------------------------------------------------------------------
  // Add entry
  // ---------------------------------------------------------------------------
  const handleAddEntry = useCallback(() => {
    if (formTotal === 0) { showNotif("Enter at least one expense amount", "error"); return; }
    const entry = {
      ...expenseForm,
      subscriptions: formSubs.filter((s) => parseFloat(s.amount) > 0),
      others: formOthers.filter((o) => parseFloat(o.amount) > 0),
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

  // ---------------------------------------------------------------------------
  // Income helpers
  // ---------------------------------------------------------------------------
  const addIncome = () => setIncomes((prev) => [...prev, makeIncome()]);
  const updateIncome = (id, field, val) =>
    setIncomes((prev) => prev.map((i) => (i.id === id ? { ...i, [field]: val } : i)));
  const removeIncome = (id) => setIncomes((prev) => prev.filter((i) => i.id !== id));

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------
  const ScalarField = ({ cat }) => (
    <div style={styles.fieldWrap}>
      <label style={styles.label}>{cat.icon} {cat.label}</label>
      <div style={styles.amountRow}>
        <span style={styles.rupee}>₹</span>
        <input
          className="inp"
          type="number"
          placeholder="0"
          value={expenseForm[cat.key]}
          onChange={(e) => setExpenseForm((p) => ({ ...p, [cat.key]: e.target.value }))}
          style={styles.amountInp}
        />
      </div>
    </div>
  );

  const MultiLineFields = ({ rows, setRows, label, icon, color }) => (
    <div style={{ marginBottom: 8 }}>
      {rows.map((row, idx) => (
        <div key={row.id} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
          <input
            className="inp"
            type="text"
            placeholder={`${label} name`}
            value={row.name}
            onChange={(e) => setRows((prev) => prev.map((r) => r.id === row.id ? { ...r, name: e.target.value } : r))}
            style={{ flex: 2 }}
          />
          <div style={{ ...styles.amountRow, flex: 1 }}>
            <span style={styles.rupee}>₹</span>
            <input
              className="inp"
              type="number"
              placeholder="0"
              value={row.amount}
              onChange={(e) => setRows((prev) => prev.map((r) => r.id === row.id ? { ...r, amount: e.target.value } : r))}
              style={styles.amountInp}
            />
          </div>
          {rows.length > 1 && (
            <button
              onClick={() => setRows((prev) => prev.filter((r) => r.id !== row.id))}
              style={{ ...styles.iconBtn, color: "#ef4444" }}
              title="Remove"
            >✕</button>
          )}
        </div>
      ))}
      <button
        onClick={() => setRows((prev) => [...prev, makeSub()])}
        style={styles.addMoreBtn}
      >+ Add {label}</button>
    </div>
  );

  // ---------------------------------------------------------------------------
  // JSX
  // ---------------------------------------------------------------------------
  return (
    <div style={{ fontFamily: "'DM Sans','Segoe UI',sans-serif", background: "#f0f2f5", minHeight: "100vh", paddingBottom: 48 }}>
      <style>{CSS}</style>

      {notification && (
        <div className={`notif ${notification.type}`}>{notification.msg}</div>
      )}

      {/* ── Header ── */}
      <div style={styles.header}>
        <div style={styles.headerInner}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div>
              <h1 style={styles.title}>💼 Budget Tracker</h1>
              <p style={styles.subtitle}>
                {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              </p>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 11, color: "#718096", marginBottom: 2 }}>Balance</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: balanceColor, fontFamily: "monospace" }}>{fmt(balance)}</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 4, overflowX: "auto", paddingBottom: 2 }}>
            {TABS.map((t) => (
              <button key={t} className={`tab-btn ${activeTab === t ? "active" : ""}`} onClick={() => setActiveTab(t)}>{t}</button>
            ))}
          </div>
        </div>
      </div>

      <div style={styles.body}>

        {/* ════════════════════════ DASHBOARD ════════════════════════ */}
        {activeTab === "Dashboard" && (
          <div style={styles.col}>

            {/* Account Setup */}
            <div className="card">
              <p className="section-title">Account Setup</p>

              {/* Bank Balance */}
              <div style={{ marginBottom: 16 }}>
                <label style={styles.label}>Bank Balance (₹)</label>
                {editingBalance ? (
                  <div style={{ display: "flex", gap: 8 }}>
                    <input className="inp" type="number" value={tempBalance} onChange={(e) => setTempBalance(e.target.value)} placeholder="0" autoFocus />
                    <button className="btn-primary" style={{ whiteSpace: "nowrap", padding: "9px 14px" }}
                      onClick={() => { setBankBalance(tempBalance); setEditingBalance(false); showNotif("Balance updated"); }}>Save</button>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <div style={styles.displayBox}>{bankBalance ? fmt(bankBalance) : "Not set"}</div>
                    <button className="btn-sm" onClick={() => { setTempBalance(bankBalance); setEditingBalance(true); }}>Edit</button>
                  </div>
                )}
              </div>

              {/* Income rows */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <label style={styles.label}>Monthly Income</label>
                <button className="btn-sm" onClick={addIncome} style={{ fontSize: 13, padding: "4px 12px" }}>+ Add</button>
              </div>
              {incomes.map((inc) => (
                <IncomeRow
                  key={inc.id}
                  inc={inc}
                  editing={editingIncomeId === inc.id}
                  onEdit={() => setEditingIncomeId(inc.id)}
                  onSave={() => { setEditingIncomeId(null); showNotif("Income updated"); }}
                  onChange={(f, v) => updateIncome(inc.id, f, v)}
                  onRemove={() => removeIncome(inc.id)}
                  showRemove={incomes.length > 1}
                />
              ))}
              {incomes.length > 1 && (
                <div style={{ marginTop: 6, padding: "8px 12px", borderRadius: 8, background: "rgba(99,102,241,0.07)", fontSize: 13, color: "#6366f1", fontWeight: 600 }}>
                  Total Income: {fmt(totalMonthlyIncome)}
                </div>
              )}
            </div>

            {/* Key Metrics */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10 }}>
              {[
                { label: "Bank Balance", val: fmt(parseFloat(bankBalance) || 0), sub: "Current", color: "#6366f1" },
                { label: "This Month", val: fmt(thisMonthTotal), sub: `${thisMonthEntries.length} entries`, color: "#ef4444" },
                { label: "This Week", val: fmt(thisWeekTotal), sub: `${thisWeekEntries.length} entries`, color: "#f59e0b" },
                { label: "Money Left", val: fmt(balance), sub: "After expenses", color: balanceColor },
              ].map((m) => (
                <div className="metric-card" key={m.label}>
                  <div style={{ fontSize: 11, color: "#718096", fontWeight: 500, marginBottom: 6 }}>{m.label}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: m.color, fontFamily: "monospace" }}>{m.val}</div>
                  <div style={{ fontSize: 11, color: "#718096", marginTop: 3 }}>{m.sub}</div>
                </div>
              ))}
            </div>

            {/* Budget Progress */}
            {totalMonthlyIncome > 0 && (
              <div className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <p className="section-title" style={{ margin: 0 }}>Monthly Budget Used</p>
                  <span style={{ fontSize: 13, fontWeight: 700, color: budgetUsed > 80 ? "#ef4444" : budgetUsed > 60 ? "#f59e0b" : "#10b981" }}>{Math.round(budgetUsed)}%</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${budgetUsed}%`, background: budgetUsed > 80 ? "#ef4444" : budgetUsed > 60 ? "#f59e0b" : "#10b981" }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 12, color: "#718096" }}>
                  <span>Spent: {fmt(thisMonthTotal)}</span>
                  <span>Left: {fmt(Math.max(0, totalMonthlyIncome - thisMonthTotal))}</span>
                  <span>Income: {fmt(totalMonthlyIncome)}</span>
                </div>
                {savingsRate > 0 && (
                  <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: 8, background: "rgba(16,185,129,0.08)", display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ fontSize: 16 }}>💰</span>
                    <span style={{ fontSize: 13, color: "#059669", fontWeight: 600 }}>Savings Rate: {savingsRate}% — {savingsRate >= 20 ? "Great job!" : "Aim for 20%+"}</span>
                  </div>
                )}
              </div>
            )}

            {/* Top Categories */}
            {pieData.length > 0 && (
              <div className="card">
                <p className="section-title">Top Spending Categories</p>
                {pieData.slice(0, 6).map((d) => (
                  <div key={d.name} className="insight-row">
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 18 }}>{d.icon}</span>
                      <span style={{ fontSize: 14, color: "#1a202c", fontWeight: 500 }}>{d.name}</span>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 14, fontWeight: 700, fontFamily: "monospace" }}>{fmt(d.value)}</div>
                      <div style={{ fontSize: 11, color: "#718096" }}>{totalMonthlyIncome > 0 ? Math.round((d.value / totalMonthlyIncome) * 100) + "% of income" : ""}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Spending Trend Bar Chart */}
            <div className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <p className="section-title" style={{ margin: 0 }}>Spending Trend</p>
                <div className="chart-toggle">
                  {["daily", "weekly", "monthly"].map((v) => (
                    <button key={v} className={chartView === v ? "active" : ""} onClick={() => setChartView(v)}>
                      {v.charAt(0).toUpperCase() + v.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={chartData} margin={{ top: 0, right: 4, bottom: 0, left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#edf2f7" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#718096" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#718096" }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                    <Tooltip
                      formatter={(v) => [fmt(v), "Spent"]}
                      contentStyle={{ background: "#fff", border: "0.5px solid #e2e8f0", borderRadius: 8, fontSize: 13, zIndex: 999 }}
                      wrapperStyle={{ zIndex: 999 }}
                      cursor={{ fill: "rgba(99,102,241,0.08)" }}
                    />
                    <Bar dataKey="amount" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div style={styles.emptyChart}>No spending data yet. Add some expenses!</div>
              )}
            </div>

            {/* Pie Chart – Spending Distribution */}
            {pieData.length > 0 && (
              <div className="card">
                <p className="section-title">Spending Distribution</p>
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={58} outerRadius={90} paddingAngle={2} dataKey="value">
                      {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                    <Tooltip content={<PieTooltip />} />
                    <Legend
                      formatter={(val) => <span style={{ fontSize: 12, color: "#718096" }}>{val}</span>}
                      wrapperStyle={{ paddingTop: 8 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}

            <button className="btn-primary" onClick={() => setActiveTab("Add Entry")} style={{ width: "100%", padding: 14, fontSize: 15, borderRadius: 12 }}>
              + Add Expense Entry
            </button>
          </div>
        )}

        {/* ════════════════════════ ADD ENTRY ════════════════════════ */}
        {activeTab === "Add Entry" && (
          <div style={styles.col}>
            <div className="card">
              <p className="section-title" style={{ fontSize: 14, marginBottom: 16 }}>New Expense Entry</p>

              <div style={{ marginBottom: 18 }}>
                <label style={styles.label}>Entry Date</label>
                <input className="inp" type="date" value={expenseForm.date} onChange={(e) => setExpenseForm((p) => ({ ...p, date: e.target.value }))} style={{ maxWidth: 200 }} />
              </div>

              {/* Fixed Expenses */}
              <Section title="Fixed Expenses" color="#6366f1">
                <div style={styles.fieldGrid}>
                  {FIXED_CATEGORIES.map((c) => <ScalarField key={c.key} cat={c} />)}
                </div>
              </Section>

              {/* Variable Expenses */}
              <Section title="Variable Expenses" color="#10b981">
                <div style={styles.fieldGrid}>
                  {VARIABLE_CATEGORIES.map((c) => <ScalarField key={c.key} cat={c} />)}
                </div>
              </Section>

              {/* Subscriptions – multi */}
              <Section title="Subscriptions" color="#8b5cf6">
                <MultiLineFields rows={formSubs} setRows={setFormSubs} label="Subscription" icon="📱" color="#8b5cf6" />
              </Section>

              {/* Savings & Wellbeing */}
              <Section title="Savings & Wellbeing" color="#0ea5e9">
                <div style={styles.fieldGrid}>
                  {WELLBEING_CATEGORIES.map((c) => <ScalarField key={c.key} cat={c} />)}
                </div>
              </Section>

              {/* Other – multi */}
              <Section title="Other Expenses" color="#94a3b8">
                <MultiLineFields rows={formOthers} setRows={setFormOthers} label="Expense" icon="📦" color="#94a3b8" />
              </Section>

              {/* Note */}
              <div style={{ marginBottom: 18 }}>
                <label style={styles.label}>Note (optional)</label>
                <input className="inp" type="text" placeholder="Any notes for this entry…" value={expenseForm.note} onChange={(e) => setExpenseForm((p) => ({ ...p, note: e.target.value }))} />
              </div>

              {/* Total preview */}
              <div style={styles.totalPreview}>
                <span style={{ fontSize: 14, color: "#718096", fontWeight: 600 }}>Entry Total</span>
                <span style={{ fontSize: 22, fontWeight: 700, color: "#6366f1", fontFamily: "monospace" }}>{fmt(formTotal)}</span>
              </div>

              <button className="btn-primary" onClick={handleAddEntry} style={{ width: "100%", padding: 13, fontSize: 15, borderRadius: 12 }}>
                Save Entry
              </button>
            </div>
          </div>
        )}

        {/* ════════════════════════ HISTORY ════════════════════════ */}
        {activeTab === "History" && (
          <div>
            {entries.length === 0 ? (
              <div className="card" style={{ textAlign: "center", padding: 40 }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
                <p style={{ color: "#718096", margin: 0 }}>No entries yet. Add your first expense!</p>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <p className="section-title" style={{ margin: 0 }}>{entries.length} total entries</p>
                  <span style={{ fontSize: 13, color: "#718096" }}>Total: {fmt(totalExpenses)}</span>
                </div>
                {entries.map((e) => {
                  const scalarCats = ALL_SCALAR_CATEGORIES.filter((c) => parseFloat(e[c.key] || 0) > 0);
                  const subs = (e.subscriptions || []).filter((s) => parseFloat(s.amount) > 0);
                  const others = (e.others || []).filter((o) => parseFloat(o.amount) > 0);
                  const allPills = [
                    ...scalarCats.map((c) => ({ label: c.label, icon: c.icon, color: c.color, val: e[c.key] })),
                    ...subs.map((s) => ({ label: s.name || "Subscription", icon: "📱", color: "#8b5cf6", val: s.amount })),
                    ...others.map((o) => ({ label: o.name || "Other", icon: "📦", color: "#94a3b8", val: o.amount })),
                  ];
                  return (
                    <div key={e.id} className="history-item">
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                          <span style={{ fontSize: 12, color: "#718096" }}>
                            {new Date(e.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                          </span>
                          {e.note && <span style={{ fontSize: 12, color: "#718096", fontStyle: "italic" }}>— {e.note}</span>}
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap" }}>
                          {allPills.slice(0, 5).map((p, i) => (
                            <span key={i} className="cat-pill" style={{ background: p.color + "18", color: p.color }}>
                              {p.icon} {p.label}: {fmt(p.val)}
                            </span>
                          ))}
                          {allPills.length > 5 && (
                            <span className="cat-pill" style={{ background: "#f0f2f5", color: "#718096" }}>+{allPills.length - 5} more</span>
                          )}
                        </div>
                      </div>
                      <div style={{ textAlign: "right", marginLeft: 12 }}>
                        <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "monospace" }}>{fmt(e.total)}</div>
                        <button className="btn-sm" style={{ marginTop: 6, color: "#ef4444", borderColor: "#ef444440" }} onClick={() => deleteEntry(e.id)}>Delete</button>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}

        {/* ════════════════════════ ANALYTICS ════════════════════════ */}
        {activeTab === "Analytics" && (
          <div style={styles.col}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[
                { label: "Avg Monthly", val: entries.length > 0 ? fmt(totalExpenses / Math.max(1, new Set(entries.map((e) => getMonth(e.date))).size)) : "—", color: "#6366f1" },
                { label: "Savings Rate", val: `${savingsRate}%`, color: savingsRate >= 20 ? "#10b981" : "#f59e0b" },
                { label: "Highest Day", val: chartData.length > 0 ? fmt(Math.max(...chartData.map((d) => d.amount))) : "—", color: "#ef4444" },
                { label: "Total Entries", val: String(entries.length), color: "#1a202c" },
              ].map((m) => (
                <div className="metric-card" key={m.label}>
                  <div style={{ fontSize: 11, color: "#718096", marginBottom: 6 }}>{m.label}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: m.color, fontFamily: "monospace" }}>{m.val}</div>
                </div>
              ))}
            </div>

            {/* Category totals */}
            <div className="card">
              <p className="section-title">All Category Totals</p>
              {CHART_CATEGORIES.map((c) => {
                const val = categoryTotals[c.key];
                if (!val) return null;
                const pct = totalExpenses > 0 ? (val / totalExpenses) * 100 : 0;
                return (
                  <div key={c.key} style={{ marginBottom: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 13 }}>{c.icon} {c.label}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: c.color, fontFamily: "monospace" }}>
                        {fmt(val)} <span style={{ fontWeight: 400, color: "#718096", fontSize: 11 }}>({Math.round(pct)}%)</span>
                      </span>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${pct}%`, background: c.color }} />
                    </div>
                  </div>
                );
              })}
              {totalExpenses === 0 && <p style={{ color: "#718096", fontSize: 14, textAlign: "center", padding: 20 }}>No spending data yet.</p>}
            </div>

            {/* Trend line chart */}
            <div className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <p className="section-title" style={{ margin: 0 }}>Spending Trend</p>
                <div className="chart-toggle">
                  {["daily", "weekly", "monthly"].map((v) => (
                    <button key={v} className={chartView === v ? "active" : ""} onClick={() => setChartView(v)}>
                      {v.charAt(0).toUpperCase() + v.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              {chartData.length > 1 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#edf2f7" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#718096" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#718096" }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                    <Tooltip
                      formatter={(v) => [fmt(v), "Spent"]}
                      contentStyle={{ background: "#fff", border: "0.5px solid #e2e8f0", borderRadius: 8, fontSize: 13, zIndex: 999 }}
                      wrapperStyle={{ zIndex: 999 }}
                    />
                    <Line type="monotone" dataKey="amount" stroke="#6366f1" strokeWidth={2} dot={{ fill: "#6366f1", r: 3 }} activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div style={styles.emptyChart}>Add more entries to see trends</div>
              )}
            </div>

            {/* Pie */}
            {pieData.length > 0 && (
              <div className="card">
                <p className="section-title">Spending Distribution</p>
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                    <Pie data={pieData} cx="50%" cy="46%" innerRadius={58} outerRadius={90} paddingAngle={2} dataKey="value">
                      {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                    <Tooltip content={<PieTooltip />} />
                    <Legend formatter={(val) => <span style={{ fontSize: 12, color: "#718096" }}>{val}</span>} wrapperStyle={{ paddingTop: 8 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Financial Health */}
            {totalMonthlyIncome > 0 && (
              <div className="card">
                <p className="section-title">Financial Health</p>
                {[
                  { label: "Savings Rate", val: savingsRate, target: 20, unit: "%", tip: "Target ≥ 20%" },
                  { label: "Housing (% of income)", val: Math.round((categoryTotals.rent / totalMonthlyIncome) * 100), target: 30, unit: "%", tip: "Target ≤ 30%", invert: true },
                  { label: "Debt (EMI + Credit Card)", val: Math.round(((categoryTotals.loanEmi + categoryTotals.creditCard) / totalMonthlyIncome) * 100), target: 20, unit: "%", tip: "Target ≤ 20%", invert: true },
                ].map((item) => (
                  <div key={item.label} className="insight-row">
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{item.label}</div>
                      <div style={{ fontSize: 11, color: "#718096" }}>{item.tip}</div>
                    </div>
                    <span style={{ fontSize: 15, fontWeight: 700, color: item.invert ? (item.val <= item.target ? "#10b981" : "#ef4444") : (item.val >= item.target ? "#10b981" : "#f59e0b") }}>
                      {item.val}{item.unit}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Section({ title, color, children }) {
  return (
    <div style={{
      marginBottom: 20,
      borderRadius: 10,
      border: `1.5px solid ${color}28`,
      overflow: "hidden",
    }}>
      <div style={{
        background: color + "12",
        padding: "8px 14px",
        borderBottom: `1px solid ${color}20`,
      }}>
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color }}>{title}</span>
      </div>
      <div style={{ padding: "14px 14px 6px" }}>{children}</div>
    </div>
  );
}

function IncomeRow({ inc, editing, onEdit, onSave, onChange, onRemove, showRemove }) {
  const autoColor = inc.auto ? "#10b981" : "#f59e0b";
  return (
    <div style={{
      background: "#f8f9fa",
      borderRadius: 10,
      padding: "10px 12px",
      marginBottom: 8,
      border: "0.5px solid #e2e8f0",
    }}>
      {editing ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <select
              className="inp"
              style={{ flex: "1 1 100px", minWidth: 100 }}
              value={inc.type}
              onChange={(e) => onChange("type", e.target.value)}
            >
              {INCOME_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
            <input className="inp" type="number" placeholder="Amount" value={inc.amount} onChange={(e) => onChange("amount", e.target.value)} style={{ flex: "1 1 120px" }} />
            <input className="inp" type="date" value={inc.date} onChange={(e) => onChange("date", e.target.value)} style={{ flex: "1 1 130px" }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer", userSelect: "none" }}>
              <div
                onClick={() => onChange("auto", !inc.auto)}
                style={{
                  width: 38, height: 22, borderRadius: 11,
                  background: inc.auto ? "#10b981" : "#cbd5e0",
                  position: "relative", cursor: "pointer", transition: "background 0.2s",
                }}
              >
                <div style={{
                  position: "absolute", top: 3, left: inc.auto ? 18 : 3,
                  width: 16, height: 16, borderRadius: "50%",
                  background: "#fff", transition: "left 0.2s",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                }} />
              </div>
              <span style={{ color: autoColor, fontWeight: 600 }}>
                {inc.auto ? "Auto-add on date" : "Manual only"}
              </span>
            </label>
            <button className="btn-primary" style={{ padding: "5px 14px", fontSize: 13 }} onClick={onSave}>Save</button>
            {showRemove && <button className="btn-sm" style={{ color: "#ef4444" }} onClick={onRemove}>Remove</button>}
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{inc.type}</span>
            <span style={{ fontSize: 13, color: "#718096", margin: "0 8px" }}>·</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: "#6366f1", fontFamily: "monospace" }}>{inc.amount ? fmt(inc.amount) : "—"}</span>
            {inc.date && (
              <span style={{ fontSize: 11, color: "#718096", marginLeft: 8 }}>
                every {new Date(inc.date).getDate()}{ordinal(new Date(inc.date).getDate())}
              </span>
            )}
            <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 600, color: autoColor }}>
              {inc.auto ? "🔄 Auto" : "✋ Manual"}
            </span>
          </div>
          <button className="btn-sm" onClick={onEdit}>Edit</button>
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
const styles = {
  header: { background: "#fff", borderBottom: "0.5px solid #edf2f7", padding: "16px 20px 0", position: "sticky", top: 0, zIndex: 100 },
  headerInner: { maxWidth: 740, margin: "0 auto" },
  body: { maxWidth: 740, margin: "20px auto", padding: "0 16px" },
  col: { display: "flex", flexDirection: "column", gap: 16 },
  title: { margin: 0, fontSize: 20, fontWeight: 700, color: "#1a202c", letterSpacing: "-0.3px" },
  subtitle: { margin: "2px 0 0", fontSize: 12, color: "#718096" },
  label: { fontSize: 12, color: "#718096", fontWeight: 600, display: "block", marginBottom: 5 },
  displayBox: { flex: 1, padding: "9px 12px", borderRadius: 8, background: "#f8f9fa", fontSize: 14, fontWeight: 700, color: "#1a202c", fontFamily: "monospace" },
  fieldWrap: { display: "flex", flexDirection: "column" },
  fieldGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 14px" },
  amountRow: { display: "flex", alignItems: "center", border: "0.5px solid #e2e8f0", borderRadius: 8, background: "#f8f9fa", overflow: "hidden" },
  rupee: { padding: "0 8px", fontSize: 14, color: "#6366f1", fontWeight: 700, userSelect: "none" },
  amountInp: { flex: 1, border: "none", background: "transparent", padding: "9px 8px 9px 0", fontSize: 14, outline: "none", color: "#1a202c" },
  addMoreBtn: { fontSize: 12, color: "#6366f1", background: "none", border: "1px dashed #6366f1", borderRadius: 6, padding: "4px 12px", cursor: "pointer", marginTop: 4 },
  iconBtn: { background: "none", border: "none", cursor: "pointer", fontSize: 14, padding: "4px 6px" },
  totalPreview: { background: "rgba(99,102,241,0.08)", borderRadius: 10, padding: "12px 16px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" },
  emptyChart: { height: 200, display: "flex", alignItems: "center", justifyContent: "center", color: "#718096", fontSize: 14 },
};

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono&display=swap');
  * { box-sizing: border-box; }
  body { margin: 0; }
  .tab-btn { padding: 8px 18px; border-radius: 20px; border: none; cursor: pointer; font-size: 13px; font-weight: 700; transition: all 0.2s; background: transparent; color: #718096; }
  .tab-btn.active { background: #6366f1; color: #fff; }
  .tab-btn:hover:not(.active) { background: #f0f2f5; }
  .card { background: #fff; border-radius: 16px; border: 0.5px solid #edf2f7; padding: 20px; margin-bottom: 0; }
  .metric-card { background: #f8f9fa; border-radius: 12px; padding: 16px; }
  .inp { width: 100%; padding: 9px 12px; border-radius: 8px; border: 0.5px solid #e2e8f0; font-size: 14px; background: #f8f9fa; color: #1a202c; box-sizing: border-box; font-family: inherit; }
  .inp:focus { outline: none; border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,0.12); }
  .btn-primary { background: #6366f1; color: white; border: none; border-radius: 10px; padding: 11px 24px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.2s; font-family: inherit; }
  .btn-primary:hover { background: #4f46e5; }
  .btn-sm { padding: 5px 12px; border-radius: 6px; border: 0.5px solid #e2e8f0; background: transparent; color: #718096; font-size: 12px; cursor: pointer; font-family: inherit; }
  .btn-sm:hover { background: #f8f9fa; }
  .chart-toggle button { padding: 6px 14px; font-size: 12px; border: 0.5px solid #e2e8f0; background: transparent; cursor: pointer; color: #718096; font-family: inherit; transition: all 0.15s; font-weight: 600; }
  .chart-toggle button:first-child { border-radius: 8px 0 0 8px; }
  .chart-toggle button:last-child { border-radius: 0 8px 8px 0; }
  .chart-toggle button.active { background: #6366f1; color: white; border-color: #6366f1; }
  .notif { position: fixed; top: 20px; right: 20px; padding: 12px 20px; border-radius: 10px; font-size: 13px; font-weight: 600; z-index: 9999; animation: slideIn 0.3s ease; }
  .notif.success { background: #10b981; color: white; }
  .notif.error { background: #ef4444; color: white; }
  @keyframes slideIn { from { transform: translateX(40px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
  .progress-bar { height: 6px; border-radius: 3px; background: #f0f2f5; overflow: hidden; }
  .progress-fill { height: 100%; border-radius: 3px; transition: width 0.6s ease; }
  .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #718096; margin: 0 0 12px; }
  .history-item { display: flex; justify-content: space-between; align-items: flex-start; padding: 14px 16px; border-radius: 10px; border: 0.5px solid #edf2f7; margin-bottom: 8px; background: #fff; }
  .cat-pill { display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px; border-radius: 20px; font-size: 11px; font-weight: 600; margin: 2px; }
  .insight-row { display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 0.5px solid #edf2f7; }
  .insight-row:last-child { border-bottom: none; }
  @media (max-width: 600px) {
    .tab-btn { padding: 7px 12px; font-size: 12px; }
  }
`;
