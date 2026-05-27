import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import * as XLSX from "xlsx";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
  ComposedChart, Area,
} from "recharts";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
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
const STORAGE_KEY  = "budget_tracker_v2";
const DAYS         = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const fmt      = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
const fmtNum   = (n) => Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });
const today    = () => new Date().toISOString().split("T")[0];
const getWeek  = (d) => { const dt = new Date(d); const day = dt.getDay(); const diff = dt.getDate() - day + (day === 0 ? -6 : 1); return new Date(dt.setDate(diff)).toISOString().split("T")[0]; };
const getMon   = (d) => d.slice(0, 7);
const uid      = () => `${Date.now()}-${Math.random()}`;
const mkSub    = () => ({ id: uid(), name: "", amount: "" });
const mkInc    = () => ({ id: uid(), type: "Salary", amount: "", date: today(), auto: true });
const prevMon  = (ym) => { const [y, m] = ym.split("-").map(Number); return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`; };

const initScalar = {};
ALL_SCALAR.forEach((c) => { initScalar[c.key] = ""; });

const TABS = ["Dashboard", "Add Entry", "History", "Analytics"];

// ─────────────────────────────────────────────────────────────────────────────
// localStorage
// ─────────────────────────────────────────────────────────────────────────────
function loadState() {
  try { const r = localStorage.getItem(STORAGE_KEY); return r ? JSON.parse(r) : null; } catch { return null; }
}
function saveState(s) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch {}
}

// ─────────────────────────────────────────────────────────────────────────────
// Excel export
// ─────────────────────────────────────────────────────────────────────────────
function exportExcel({ entries, bankBalance, carryForward, incomes }) {
  // ── Palette ──────────────────────────────────────────────────────────────
  const P = {
    indigo:"4F46E5", indigoD:"3730A3", indigoL:"EEF2FF", indigoXL:"F5F3FF",
    violet:"6366F1", green:"047857",   greenL:"ECFDF5",
    red:"B91C1C",    redL:"FEF2F2",    amber:"B45309",   amberL:"FFFBEB",
    slate:"475569",  slateL:"F1F5F9",
    gray:"4A5568",   grayXL:"FAFAFA",  border:"E2E8F0",  borderD:"CBD5E0",
    text:"1A202C",   muted:"718096",   white:"FFFFFF",
  };

  // ── Low-level helpers ─────────────────────────────────────────────────────
  const bThin   = (c = P.border)  => ({ style:"thin",   color:{ rgb:c } });
  const bMed    = (c = P.indigoD) => ({ style:"medium", color:{ rgb:c } });
  const allBord = (c) => ({ top:bThin(c), bottom:bThin(c), left:bThin(c), right:bThin(c) });
  const allMed  = (c) => ({ top:bMed(c),  bottom:bMed(c),  left:bMed(c),  right:bMed(c)  });
  const btBord  = (c) => ({ bottom:bThin(c), right:bThin(c) });

  const mkFont = (bold, sz, rgb, italic) =>
    ({ bold:!!bold, sz:sz||10, color:{ rgb:rgb||P.text }, italic:!!italic, name:"Calibri" });
  const mkFill = (rgb) => ({ fgColor:{ rgb }, patternType:"solid" });
  const mkAlign = (h, v="center", wrap=false) => ({ horizontal:h||"left", vertical:v, wrapText:wrap });

  // Build a full cell style object
  const mk = ({ bold, sz, fg, color, h, v, wrap, border }) => {
    const s = { font: mkFont(bold, sz, color), alignment: mkAlign(h, v||"center", wrap) };
    if (fg) s.fill = mkFill(fg);
    if (border) s.border = border;
    return s;
  };

  // Pre-built common styles
  const ST = {
    bigTitle:   mk({ bold:true,  sz:16, color:P.white,  fg:P.indigo,  h:"center", border:allMed(P.indigoD) }),
    titleSub:   mk({ bold:false, sz:10, color:P.indigo,  fg:P.indigoL, h:"center" }),
    secIndigo:  mk({ bold:true,  sz:10, color:P.white,  fg:P.indigo,  h:"left",   border:{bottom:bMed(P.indigoD), top:bMed(P.indigoD)} }),
    secGreen:   mk({ bold:true,  sz:10, color:P.white,  fg:P.green,   h:"left",   border:{bottom:bMed(P.green),   top:bMed(P.green)}   }),
    secSlate:   mk({ bold:true,  sz:10, color:P.white,  fg:P.slate,   h:"left",   border:{bottom:bMed(P.slate),   top:bMed(P.slate)}   }),
    secAmber:   mk({ bold:true,  sz:10, color:P.white,  fg:P.amber,   h:"left",   border:{bottom:bMed(P.amber),   top:bMed(P.amber)}   }),
    tblHdr:     (bg=P.indigoD) => mk({ bold:true, sz:10, color:P.white, fg:bg, h:"center", wrap:true, border:{top:bMed(bg),bottom:bMed(bg),left:bThin(bg),right:bThin(bg)} }),
    rowLbl:     (alt) => mk({ bold:true,  sz:10, color:P.gray,  fg:alt?P.grayXL:P.white, h:"left",  border:btBord(P.border) }),
    rowVal:     (alt, clr) => mk({ bold:true,  sz:11, color:clr||P.text, fg:alt?P.grayXL:P.white, h:"right", border:btBord(P.border) }),
    rowTxt:     (alt) => mk({ bold:false, sz:10, color:P.text,  fg:alt?P.indigoXL:P.white, h:"left",  border:btBord(P.border) }),
    rowNum:     (alt, clr) => mk({ bold:false, sz:10, color:clr||P.text, fg:alt?P.indigoXL:P.white, h:"right", border:btBord(P.border) }),
    totalLbl:   mk({ bold:true, sz:11, color:P.white, fg:P.indigo,  h:"left",  border:allMed(P.indigoD) }),
    totalVal:   mk({ bold:true, sz:11, color:P.white, fg:P.indigo,  h:"right", border:allMed(P.indigoD) }),
    blank:      mk({ fg:P.indigoL, h:"left" }),
    blankW:     mk({ fg:P.white,   h:"left" }),
  };

  // ── Cell writer ───────────────────────────────────────────────────────────
  function sc(ws, r, c, value, style, fmt) {
    const addr = XLSX.utils.encode_cell({ r, c });
    const t = (value == null) ? "z" : typeof value === "number" ? "n" : typeof value === "boolean" ? "b" : "s";
    ws[addr] = { t, v: value ?? "" };
    if (style) ws[addr].s = style;
    if (fmt)   ws[addr].z = fmt;
  }

  // Merge helper
  function mg(ws, r1, c1, r2, c2) {
    if (!ws["!merges"]) ws["!merges"] = [];
    ws["!merges"].push({ s:{ r:r1, c:c1 }, e:{ r:r2, c:c2 } });
  }

  // Fill merged blank cells (so borders render)
  function fillMerge(ws, r, c1, c2, style) {
    for (let c = c1; c <= c2; c++) sc(ws, r, c, "", style);
  }

  // ── Domain helpers ────────────────────────────────────────────────────────
  const totalInc = incomes.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);

  const eTotal = (e) => {
    let t = ALL_SCALAR.reduce((s, c) => s + parseFloat(e[c.key] || 0), 0);
    (e.subscriptions||[]).forEach(s => { t += parseFloat(s.amount||0); });
    (e.others||[]).forEach(o => { t += parseFloat(o.amount||0); });
    return t;
  };
  const catVal = (e, key) => {
    if (key === "subscriptions") return (e.subscriptions||[]).reduce((s,x)=>s+(parseFloat(x.amount)||0),0);
    if (key === "other")         return (e.others||[]).reduce((s,x)=>s+(parseFloat(x.amount)||0),0);
    return parseFloat(e[key]||0);
  };

  const totalExpenses = entries.reduce((s, e) => s + (e.total || eTotal(e)), 0);
  const curMon        = getMon(today());
  const curMonEntries = entries.filter(e => getMon(e.date) === curMon);
  const curMonTotal   = curMonEntries.reduce((s, e) => s + (e.total || eTotal(e)), 0);
  const netBalance    = (parseFloat(bankBalance)||0) + (parseFloat(carryForward)||0) - totalExpenses;
  const savingsThisM  = Math.max(0, totalInc - curMonTotal);
  const savingsRate   = totalInc > 0 ? savingsThisM / totalInc : 0;
  const numMonths     = Math.max(1, new Set(entries.map(e => getMon(e.date))).size);
  const avgMonthly    = totalExpenses / numMonths;

  const RUPE = "[₹]#,##0";
  const RUPEF = "[₹]#,##0.00";

  // ═══════════════════════════════════════════════════════════════════════════
  // SHEET 1 — SUMMARY
  // ═══════════════════════════════════════════════════════════════════════════
  function buildSummary() {
    const ws = {};
    ws["!cols"] = [{ wch:36 }, { wch:6 }, { wch:20 }, { wch:14 }];
    let r = 0;

    // Title banner
    fillMerge(ws, r, 0, 3, ST.bigTitle);
    sc(ws, r, 0, "💼  BUDGET TRACKER — FINANCIAL REPORT", ST.bigTitle);
    mg(ws, r, 0, r, 3); r++;

    // Subtitle
    fillMerge(ws, r, 0, 3, ST.titleSub);
    sc(ws, r, 0, `Report generated: ${new Date().toLocaleDateString("en-IN", { dateStyle:"full" })}`, ST.titleSub);
    mg(ws, r, 0, r, 3); r++;

    // Spacer
    fillMerge(ws, r, 0, 3, ST.blank); mg(ws, r, 0, r, 3); r++;

    // ── SECTION: ACCOUNT OVERVIEW ──
    const secRow = (label, val, color, alt, fmt, label2="", val2="", fmt2="") => {
      const a = !!alt;
      sc(ws, r, 0, `  ${label}`, ST.rowLbl(a));
      sc(ws, r, 1, "", ST.rowLbl(a));
      sc(ws, r, 2, val, ST.rowVal(a, color), fmt);
      sc(ws, r, 3, typeof val2 === "number" ? val2 : "", ST.rowVal(a, color), fmt2 || undefined);
      if (typeof val2 === "string" && val2) sc(ws, r, 3, val2, ST.rowVal(a, color));
      mg(ws, r, 0, r, 1); r++;
    };

    fillMerge(ws, r, 0, 3, ST.secIndigo);
    sc(ws, r, 0, "  ACCOUNT OVERVIEW", ST.secIndigo);
    sc(ws, r, 2, "BALANCE", { ...ST.secIndigo, alignment:mkAlign("center") });
    sc(ws, r, 3, "", ST.secIndigo);
    mg(ws, r, 0, r, 1); mg(ws, r, 2, r, 3); r++;

    secRow("Bank Balance",         parseFloat(bankBalance)||0,  P.indigo, false, RUPE);
    secRow("Carry-Forward Balance", parseFloat(carryForward)||0, P.violet, true,  RUPE);
    secRow("Monthly Income",       totalInc,                    P.green,  false, RUPE);

    fillMerge(ws, r, 0, 3, ST.blankW); mg(ws, r, 0, r, 3); r++;

    // ── SECTION: THIS MONTH ──
    fillMerge(ws, r, 0, 3, ST.secGreen);
    sc(ws, r, 0, "  THIS MONTH", ST.secGreen);
    sc(ws, r, 2, "AMOUNT", { ...ST.secGreen, alignment:mkAlign("center") });
    sc(ws, r, 3, "% OF INCOME", { ...ST.secGreen, alignment:mkAlign("center") });
    mg(ws, r, 0, r, 1); r++;

    const monthDataRows = [
      ["Total Spent This Month",  curMonTotal,  curMonTotal > totalInc*0.8 ? P.red : P.text, RUPE, totalInc ? curMonTotal/totalInc : 0, "0%"],
      ["Remaining Budget",        Math.max(0, totalInc - curMonTotal), P.green, RUPE, null, ""],
      ["Savings This Month",      savingsThisM, P.green, RUPE, totalInc ? savingsThisM/totalInc : 0, "0%"],
      ["Entries This Month",      curMonEntries.length, P.text, null, null, ""],
    ];
    monthDataRows.forEach(([lbl, val, clr, fmt, pctVal, pctFmt], i) => {
      const alt = i % 2 === 1;
      sc(ws, r, 0, `  ${lbl}`, ST.rowLbl(alt));
      sc(ws, r, 1, "", ST.rowLbl(alt));
      sc(ws, r, 2, val, ST.rowVal(alt, clr), fmt || undefined);
      sc(ws, r, 3, pctVal != null ? pctVal : "", ST.rowVal(alt, clr), pctFmt || undefined);
      mg(ws, r, 0, r, 1); r++;
    });

    // Savings rate highlight bar
    const srBg = savingsRate >= 0.2 ? P.green : savingsRate >= 0.1 ? P.amber : P.red;
    const srSt = mk({ bold:true, sz:12, color:P.white, fg:srBg, h:"left",  border:allMed(srBg) });
    const srVSt= mk({ bold:true, sz:14, color:P.white, fg:srBg, h:"center",border:allMed(srBg) });
    sc(ws, r, 0, "  Savings Rate", srSt);
    sc(ws, r, 1, "", srSt);
    sc(ws, r, 2, "", srSt);
    sc(ws, r, 3, savingsRate, srVSt, "0.0%");
    mg(ws, r, 0, r, 2); r++;

    fillMerge(ws, r, 0, 3, ST.blankW); mg(ws, r, 0, r, 3); r++;

    // ── SECTION: OVERALL SUMMARY ──
    fillMerge(ws, r, 0, 3, ST.secSlate);
    sc(ws, r, 0, "  OVERALL SUMMARY", ST.secSlate);
    sc(ws, r, 2, "AMOUNT", { ...ST.secSlate, alignment:mkAlign("center") });
    sc(ws, r, 3, "", ST.secSlate);
    mg(ws, r, 0, r, 1); mg(ws, r, 2, r, 3); r++;

    const overallRows = [
      ["Total Expenses (All Time)",        totalExpenses,  P.red,   RUPE],
      ["Net Balance (Bank + Carry − Exp)", netBalance,     netBalance >= 0 ? P.green : P.red, RUPE],
      ["Average Monthly Spend",            avgMonthly,     P.amber, RUPE],
      ["Total Months Tracked",             numMonths,      P.text,  null],
      ["Total Entries",                    entries.length, P.text,  null],
    ];
    overallRows.forEach(([lbl, val, clr, fmt], i) => {
      const alt = i % 2 === 1;
      sc(ws, r, 0, `  ${lbl}`, ST.rowLbl(alt));
      sc(ws, r, 1, "", ST.rowLbl(alt));
      sc(ws, r, 2, val, ST.rowVal(alt, clr), fmt || undefined);
      sc(ws, r, 3, "", ST.rowVal(alt));
      mg(ws, r, 0, r, 1); mg(ws, r, 2, r, 3); r++;
    });

    ws["!ref"] = XLSX.utils.encode_range({ s:{r:0,c:0}, e:{r:r-1,c:3} });
    ws["!rows"] = [
      { hpt:38 }, { hpt:20 }, { hpt:10 },        // title, sub, spacer
      { hpt:26 }, { hpt:22 }, { hpt:22 }, { hpt:22 },  // account section
      { hpt:10 },
      { hpt:26 }, { hpt:22 }, { hpt:22 }, { hpt:22 }, { hpt:22 }, { hpt:28 }, // month section
      { hpt:10 },
      { hpt:26 }, { hpt:22 }, { hpt:22 }, { hpt:22 }, { hpt:22 }, { hpt:22 }, // overall
    ];
    return ws;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SHEET 2 — ALL ENTRIES
  // ═══════════════════════════════════════════════════════════════════════════
  function buildEntries() {
    const ws = {};
    const hdrCols = ["Date","Day","Note","Total",...ALL_SCALAR.map(c=>c.label),"Subscriptions","Other"];
    ws["!cols"] = [{ wch:12 },{ wch:8 },{ wch:28 },{ wch:14 },...ALL_SCALAR.map(()=>({ wch:13 })),{ wch:13 },{ wch:11 }];

    // Title
    fillMerge(ws, 0, 0, hdrCols.length-1, ST.bigTitle);
    sc(ws, 0, 0, "📋  ALL EXPENSE ENTRIES", ST.bigTitle);
    mg(ws, 0, 0, 0, hdrCols.length-1);

    // Header row
    const catColors = [P.indigo, P.indigo, P.indigo, P.indigo,
      ...FIXED_CATEGORIES.map(()=>P.indigoD),
      ...VARIABLE_CATEGORIES.map(()=>P.green),
      ...WELLBEING_CATEGORIES.map(()=>P.slate),
      P.violet, P.gray];
    hdrCols.forEach((h, ci) => sc(ws, 1, ci, h, ST.tblHdr(catColors[ci] || P.indigoD)));

    const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date));
    sorted.forEach((e, ri) => {
      const alt = ri % 2 === 0;
      const row = ri + 2;
      const total = e.total || eTotal(e);
      const subs  = (e.subscriptions||[]).reduce((s,x)=>s+(parseFloat(x.amount)||0),0);
      const other = (e.others||[]).reduce((s,x)=>s+(parseFloat(x.amount)||0),0);
      const isLarge = total > avgMonthly * 0.5;

      const txtSt = ST.rowTxt(alt);
      const numSt = ST.rowNum(alt);
      const totalSt = ST.rowNum(alt, isLarge ? P.red : P.text);

      sc(ws, row, 0, e.date, txtSt);
      sc(ws, row, 1, DAYS[new Date(e.date).getDay()], { ...txtSt, alignment:mkAlign("center") });
      sc(ws, row, 2, e.note || "—", txtSt);
      sc(ws, row, 3, total, { ...totalSt, font:mkFont(true, 10, isLarge ? P.red : P.text) }, RUPE);

      let ci = 4;
      ALL_SCALAR.forEach(c => {
        const v = parseFloat(e[c.key]||0);
        sc(ws, row, ci++, v||0, v > 0 ? numSt : { ...numSt, font:mkFont(false,10,P.border) }, RUPE);
      });
      sc(ws, row, ci++, subs,  subs  > 0 ? numSt : { ...numSt, font:mkFont(false,10,P.border) }, RUPE);
      sc(ws, row, ci,   other, other > 0 ? numSt : { ...numSt, font:mkFont(false,10,P.border) }, RUPE);
    });

    // Total row
    const tRow = sorted.length + 2;
    sc(ws, tRow, 0, "TOTAL", ST.totalLbl);
    sc(ws, tRow, 1, "", ST.totalLbl);
    sc(ws, tRow, 2, "", ST.totalLbl);
    sc(ws, tRow, 3, totalExpenses, ST.totalVal, RUPE);
    let ci = 4;
    CHART_CATS.forEach(c => {
      const catTot = entries.reduce((s,e)=>s+catVal(e,c.key),0);
      sc(ws, tRow, ci++, catTot, ST.totalVal, RUPE);
    });

    ws["!views"] = [{ state:"frozen", xSplit:0, ySplit:2 }];
    ws["!autofilter"] = { ref:`A2:${XLSX.utils.encode_col(hdrCols.length-1)}2` };
    ws["!rows"] = [{ hpt:32 }, { hpt:26 }, ...sorted.map(()=>({ hpt:18 })), { hpt:24 }];
    ws["!ref"] = XLSX.utils.encode_range({ s:{r:0,c:0}, e:{r:tRow,c:hdrCols.length-1} });
    return ws;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SHEET 3 — MONTHLY BREAKDOWN
  // ═══════════════════════════════════════════════════════════════════════════
  function buildMonthly() {
    const ws = {};
    const hdrCols = ["Month","Total Spent","vs Prev Month","% of Income",...CHART_CATS.map(c=>c.label)];
    ws["!cols"] = [{ wch:20 },{ wch:14 },{ wch:16 },{ wch:13 },...CHART_CATS.map(()=>({ wch:13 }))];

    // Build month map
    const monMap = {};
    entries.forEach(e => {
      const m = getMon(e.date);
      if (!monMap[m]) { monMap[m] = { total:0 }; CHART_CATS.forEach(c=>{ monMap[m][c.key]=0; }); }
      CHART_CATS.forEach(c=>{ monMap[m][c.key] += catVal(e,c.key); });
      monMap[m].total += e.total || eTotal(e);
    });
    const monKeys = Object.keys(monMap).sort();

    // Title
    fillMerge(ws, 0, 0, hdrCols.length-1, ST.bigTitle);
    sc(ws, 0, 0, "📅  MONTHLY BREAKDOWN", ST.bigTitle);
    mg(ws, 0, 0, 0, hdrCols.length-1);

    // Header
    const hdrBgs = [P.indigoD, P.indigoD, P.indigoD, P.green,
      ...FIXED_CATEGORIES.map(()=>P.indigoD),
      ...VARIABLE_CATEGORIES.map(()=>P.green),
      ...WELLBEING_CATEGORIES.map(()=>P.slate),
      P.violet, P.gray];
    hdrCols.forEach((h, ci) => sc(ws, 1, ci, h, ST.tblHdr(hdrBgs[ci]||P.indigoD)));

    monKeys.forEach((m, idx) => {
      const alt   = idx % 2 === 0;
      const row   = idx + 2;
      const total = monMap[m].total;
      const prev  = idx > 0 ? monMap[monKeys[idx-1]].total : null;
      const delta = prev !== null ? total - prev : null;
      const pct   = totalInc > 0 ? total / totalInc : 0;
      const isCur = m === curMon;
      const rowBg = isCur ? P.indigoXL : alt ? P.grayXL : P.white;
      const mFont = isCur ? mkFont(true, 11, P.indigo) : mkFont(false, 10, P.text);
      const border = btBord(P.border);

      sc(ws, row, 0, new Date(m+"-01").toLocaleDateString("en-IN",{month:"long",year:"numeric"}),
         { font:mFont, fill:mkFill(rowBg), alignment:mkAlign("left"), border });
      sc(ws, row, 1, total,
         { font:mkFont(true,10,P.text), fill:mkFill(rowBg), alignment:mkAlign("right"), border }, RUPE);

      // Delta cell — red/green background
      if (delta !== null) {
        const dBg  = delta > 0 ? "FEF2F2" : "ECFDF5";
        const dClr = delta > 0 ? P.red : P.green;
        const pfx  = delta > 0 ? "▲ " : "▼ ";
        sc(ws, row, 2, delta,
           { font:mkFont(true,10,dClr), fill:mkFill(dBg), alignment:mkAlign("right"), border }, RUPE);
      } else {
        sc(ws, row, 2, "First month",
           { font:mkFont(false,10,P.muted), fill:mkFill(rowBg), alignment:mkAlign("center"), border });
      }

      sc(ws, row, 3, pct,
         { font:mkFont(false,10, pct>0.9?P.red:pct>0.7?P.amber:P.green), fill:mkFill(rowBg), alignment:mkAlign("right"), border }, "0%");

      let ci = 4;
      CHART_CATS.forEach(c => {
        const val = monMap[m][c.key] || 0;
        const bg  = val > 0 ? (alt ? P.indigoXL : "F0F1FF") : rowBg;
        sc(ws, row, ci++, val,
           { font:mkFont(false,10, val>0?P.text:P.border), fill:mkFill(bg), alignment:mkAlign("right"), border },
           RUPE);
      });
    });

    // Total row
    const tRow = monKeys.length + 2;
    sc(ws, tRow, 0, "TOTAL", ST.totalLbl);
    sc(ws, tRow, 1, totalExpenses, ST.totalVal, RUPE);
    sc(ws, tRow, 2, "", ST.totalVal);
    sc(ws, tRow, 3, totalInc>0 ? totalExpenses/totalInc : 0, ST.totalVal, "0%");
    let ci = 4;
    CHART_CATS.forEach(c => {
      sc(ws, tRow, ci++, entries.reduce((s,e)=>s+catVal(e,c.key),0), ST.totalVal, RUPE);
    });

    ws["!views"] = [{ state:"frozen", xSplit:0, ySplit:2 }];
    ws["!rows"] = [{ hpt:32 },{ hpt:26 },...monKeys.map(()=>({ hpt:20 })),{ hpt:24 }];
    ws["!ref"] = XLSX.utils.encode_range({ s:{r:0,c:0}, e:{r:tRow,c:hdrCols.length-1} });
    return ws;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SHEET 4 — CATEGORY ANALYSIS
  // ═══════════════════════════════════════════════════════════════════════════
  function buildCategory() {
    const ws = {};
    ws["!cols"] = [{ wch:28 },{ wch:16 },{ wch:16 },{ wch:14 },{ wch:10 }];
    ws["!rows"] = [{ hpt:32 },{ hpt:26 }];

    const ranked = CHART_CATS.map(c => {
      const val = entries.reduce((s,e)=>s+catVal(e,c.key),0);
      return { ...c, val, pExp: totalExpenses?val/totalExpenses:0, pInc: totalInc?val/totalInc:0 };
    }).filter(c=>c.val>0).sort((a,b)=>b.val-a.val);

    // Title
    fillMerge(ws, 0, 0, 4, ST.bigTitle);
    sc(ws, 0, 0, "📊  CATEGORY ANALYSIS", ST.bigTitle);
    mg(ws, 0, 0, 0, 4);

    // Header
    ["Category","Total Spent","% of Expenses","% of Income","Rank"].forEach((h,ci)=>
      sc(ws, 1, ci, h, ST.tblHdr()));

    // Rows
    ranked.forEach((c, idx) => {
      const row   = idx + 2;
      const alt   = idx % 2 === 0;
      const isTop = idx < 3;
      // Top-3 get warm highlight backgrounds
      const podiumBg = ["FEF2F2","FFF7ED","FFFBEB"][idx] || (alt ? P.grayXL : P.white);
      const podiumClr= ["B91C1C","B45309","92400E"][idx]  || P.text;
      const bg = isTop ? podiumBg : (alt ? P.grayXL : P.white);
      const clr= isTop ? podiumClr : P.text;
      const border = btBord(P.border);
      const baseStyle = { fill:mkFill(bg), alignment:mkAlign("left"), border };

      sc(ws, row, 0, `${c.icon}  ${c.label}`, { ...baseStyle, font:mkFont(isTop,10,clr) });
      sc(ws, row, 1, c.val,  { ...baseStyle, font:mkFont(isTop,11,clr), alignment:mkAlign("right") }, RUPE);
      sc(ws, row, 2, c.pExp, { ...baseStyle, font:mkFont(false,10,P.muted), alignment:mkAlign("right") }, "0.0%");
      sc(ws, row, 3, c.pInc, { ...baseStyle, font:mkFont(false,10,P.muted), alignment:mkAlign("right") }, "0.0%");
      sc(ws, row, 4, ["🥇 #1","🥈 #2","🥉 #3"][idx]||`#${idx+1}`,
         { ...baseStyle, font:mkFont(isTop,10,clr), alignment:mkAlign("center") });
      ws["!rows"].push({ hpt:20 });
    });

    // Total
    const tRow = ranked.length + 2;
    sc(ws, tRow, 0, "TOTAL", ST.totalLbl);
    sc(ws, tRow, 1, totalExpenses, ST.totalVal, RUPE);
    sc(ws, tRow, 2, 1, ST.totalVal, "0.0%");
    sc(ws, tRow, 3, totalInc>0?totalExpenses/totalInc:0, ST.totalVal, "0.0%");
    sc(ws, tRow, 4, "", ST.totalVal);
    ws["!rows"].push({ hpt:24 });

    ws["!ref"] = XLSX.utils.encode_range({ s:{r:0,c:0}, e:{r:tRow,c:4} });
    return ws;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SHEET 5 — DAY-OF-WEEK ANALYSIS
  // ═══════════════════════════════════════════════════════════════════════════
  function buildDayAnalysis() {
    const ws = {};
    ws["!cols"] = [{ wch:14 },{ wch:16 },{ wch:16 },{ wch:14 },{ wch:18 }];

    const dowMap = {};
    ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"].forEach((d,i)=>{
      dowMap[i] = { day:d, total:0, count:0 };
    });
    entries.forEach(e => {
      const d = new Date(e.date).getDay();
      dowMap[d].total += e.total || eTotal(e);
      dowMap[d].count += 1;
    });

    const sorted = Object.values(dowMap).sort((a,b)=>b.total-a.total);
    const maxTot = Math.max(...sorted.map(d=>d.total), 1);

    // Title
    fillMerge(ws, 0, 0, 4, ST.bigTitle);
    sc(ws, 0, 0, "📆  DAY OF WEEK ANALYSIS", ST.bigTitle);
    mg(ws, 0, 0, 0, 4);

    // Headers
    ["Day","Total Spent","Avg per Entry","No. of Entries","Spend Bar"].forEach((h,ci)=>
      sc(ws, 1, ci, h, ST.tblHdr()));

    sorted.forEach(({ day, total, count }, idx) => {
      const row   = idx + 2;
      const alt   = idx % 2 === 0;
      const isTop = idx === 0 && total > 0;
      const bg    = isTop ? "FEF2F2" : alt ? P.grayXL : P.white;
      const clr   = isTop ? P.red : P.text;
      const avg   = count > 0 ? total / count : 0;
      const bars  = Math.round((total / maxTot) * 20);
      const bar   = "█".repeat(bars) + "░".repeat(20 - bars);
      const border = btBord(P.border);

      sc(ws, row, 0, day,   { font:mkFont(isTop,10,clr), fill:mkFill(bg), alignment:mkAlign("left"),   border });
      sc(ws, row, 1, total, { font:mkFont(isTop,11,clr), fill:mkFill(bg), alignment:mkAlign("right"),  border }, RUPE);
      sc(ws, row, 2, avg,   { font:mkFont(false,10,P.muted),fill:mkFill(bg),alignment:mkAlign("right"),border }, RUPE);
      sc(ws, row, 3, count, { font:mkFont(false,10,P.text), fill:mkFill(bg),alignment:mkAlign("center"),border });
      sc(ws, row, 4, bar,   { font:{ ...mkFont(false,8,isTop?P.red:P.indigo), name:"Courier New" },
                               fill:mkFill(bg), alignment:mkAlign("left"), border });
    });

    ws["!rows"] = [{ hpt:32 },{ hpt:26 },...sorted.map(()=>({ hpt:22 }))];
    ws["!ref"] = XLSX.utils.encode_range({ s:{r:0,c:0}, e:{r:sorted.length+1,c:4} });
    return ws;
  }

  // ── Build & write ──────────────────────────────────────────────────────────
  const wb = XLSX.utils.book_new();
  wb.Props = { Title:"Budget Tracker Report", Subject:"Personal Finance", Author:"Budget Tracker", CreatedDate:new Date() };

  XLSX.utils.book_append_sheet(wb, buildSummary(),     "Summary");
  XLSX.utils.book_append_sheet(wb, buildEntries(),     "All Entries");
  XLSX.utils.book_append_sheet(wb, buildMonthly(),     "Monthly Breakdown");
  XLSX.utils.book_append_sheet(wb, buildCategory(),    "Category Analysis");
  XLSX.utils.book_append_sheet(wb, buildDayAnalysis(), "Day of Week");

  XLSX.writeFile(wb, `budget-report-${today()}.xlsx`, { cellStyles:true, bookSST:false });
}

// ─────────────────────────────────────────────────────────────────────────────
// Custom tooltips
// ─────────────────────────────────────────────────────────────────────────────
function PieTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 14px", fontSize: 13, boxShadow: "0 4px 20px rgba(0,0,0,0.15)", minWidth: 170, zIndex: 9999 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <span style={{ width: 12, height: 12, borderRadius: "50%", background: d.payload?.fill, display: "inline-block" }} />
        <span style={{ fontWeight: 700, color: "var(--text)" }}>{d.payload?.icon} {d.name}</span>
      </div>
      <div style={{ color: "var(--text)", fontWeight: 700, fontFamily: "monospace", fontSize: 16 }}>{fmt(d.value)}</div>
    </div>
  );
}

function BarTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 14px", fontSize: 13, zIndex: 9999 }}>
      <div style={{ fontWeight: 700, color: "var(--text-muted)", marginBottom: 6 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: p.fill || p.color, display: "inline-block" }} />
          <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>{p.name}:</span>
          <span style={{ fontWeight: 700, fontFamily: "monospace", color: "var(--text)" }}>{fmt(p.value)}</span>
        </div>
      ))}
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

  // ── Persist ────────────────────────────────────────────────────────────────
  useEffect(() => {
    saveState({ bankBalance, carryForward, incomes, entries, darkMode });
  }, [bankBalance, carryForward, incomes, entries, darkMode]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  // ── Auto-income ────────────────────────────────────────────────────────────
  useEffect(() => {
    const check = () => {
      const td = today();
      incomes.forEach(inc => {
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

  // ── eTotal helper ──────────────────────────────────────────────────────────
  const eTotal = (e) => {
    let t = ALL_SCALAR.reduce((s, c) => s + parseFloat(e[c.key] || 0), 0);
    (e.subscriptions || []).forEach(s => { t += parseFloat(s.amount || 0); });
    (e.others        || []).forEach(o => { t += parseFloat(o.amount || 0); });
    return t;
  };

  // ── Core derived ───────────────────────────────────────────────────────────
  const totalIncome   = useMemo(() => incomes.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0), [incomes]);
  const totalExpenses = useMemo(() => entries.reduce((s, e) => s + (e.total || 0), 0), [entries]);
  const netBalance    = useMemo(() => (parseFloat(bankBalance) || 0) + (parseFloat(carryForward) || 0) - totalExpenses, [bankBalance, carryForward, totalExpenses]);

  const curMon      = getMon(today());
  const monthEntries = useMemo(() => entries.filter(e => getMon(e.date) === curMon), [entries]);
  const monthTotal   = useMemo(() => monthEntries.reduce((s, e) => s + e.total, 0), [monthEntries]);
  const weekEntries  = useMemo(() => { const w = getWeek(today()); return entries.filter(e => getWeek(e.date) >= w); }, [entries]);
  const weekTotal    = useMemo(() => weekEntries.reduce((s, e) => s + e.total, 0), [weekEntries]);

  // ── Category totals ────────────────────────────────────────────────────────
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

  // ── Chart data ─────────────────────────────────────────────────────────────
  const chartData = useMemo(() => {
    if (chartView === "monthly") {
      const m = {}; entries.forEach(e => { const k = getMon(e.date); m[k] = (m[k] || 0) + eTotal(e); });
      return Object.entries(m).sort().map(([k, v]) => ({ label: new Date(k + "-01").toLocaleDateString("en-IN", { month: "short", year: "2-digit" }), amount: Math.round(v), income: totalIncome }));
    }
    if (chartView === "weekly") {
      const w = {}; entries.forEach(e => { const k = getWeek(e.date); w[k] = (w[k] || 0) + eTotal(e); });
      return Object.entries(w).sort().map(([k, v]) => ({ label: "W " + new Date(k).toLocaleDateString("en-IN", { day: "numeric", month: "short" }), amount: Math.round(v) }));
    }
    const d = {}; entries.forEach(e => { d[e.date] = (d[e.date] || 0) + eTotal(e); });
    return Object.entries(d).sort().slice(-30).map(([k, v]) => ({ label: new Date(k).toLocaleDateString("en-IN", { day: "numeric", month: "short" }), amount: Math.round(v) }));
  }, [entries, chartView, totalIncome]);

  // ── Analytics-specific derived ─────────────────────────────────────────────
  const analyticsData = useMemo(() => {
    // Month-over-month comparison
    const prevM     = prevMon(curMon);
    const prevMon_entries = entries.filter(e => getMon(e.date) === prevM);
    const prevMonTotal    = prevMon_entries.reduce((s, e) => s + e.total, 0);
    const momDelta        = prevMonTotal > 0 ? ((monthTotal - prevMonTotal) / prevMonTotal) * 100 : null;

    // Monthly trend with cumulative
    const monMap = {};
    entries.forEach(e => {
      const m = getMon(e.date);
      monMap[m] = (monMap[m] || 0) + eTotal(e);
    });
    const monKeys    = Object.keys(monMap).sort();
    const monthTrend = monKeys.map((m, idx) => ({
      label:  new Date(m + "-01").toLocaleDateString("en-IN", { month: "short", year: "2-digit" }),
      amount: Math.round(monMap[m]),
      income: totalIncome,
      prev:   idx > 0 ? Math.round(monMap[monKeys[idx - 1]]) : null,
    }));

    // Day-of-week spending
    const dowTotals = Array(7).fill(0);
    const dowCounts = Array(7).fill(0);
    entries.forEach(e => {
      const d = new Date(e.date).getDay();
      dowTotals[d] += eTotal(e);
      dowCounts[d] += 1;
    });
    const dowData = DAYS.map((d, i) => ({
      day: d,
      total: Math.round(dowTotals[i]),
      avg:   dowCounts[i] ? Math.round(dowTotals[i] / dowCounts[i]) : 0,
      count: dowCounts[i],
    }));

    // Daily average this month
    const daysElapsed   = new Date().getDate();
    const avgDailyMonth = daysElapsed > 0 ? monthTotal / daysElapsed : 0;
    const daysInMonth   = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
    const projectedEnd  = avgDailyMonth * daysInMonth;

    // Top 3 categories this month
    const monCatTotals = {};
    CHART_CATS.forEach(c => { monCatTotals[c.key] = 0; });
    monthEntries.forEach(e => {
      ALL_SCALAR.forEach(c => { monCatTotals[c.key] += parseFloat(e[c.key] || 0); });
      (e.subscriptions||[]).forEach(s => { monCatTotals.subscriptions += parseFloat(s.amount||0); });
      (e.others||[]).forEach(o => { monCatTotals.other += parseFloat(o.amount||0); });
    });

    // Category trend (last 6 months per category)
    const last6 = monKeys.slice(-6);
    const catTrendData = last6.map(m => {
      const mEntries = entries.filter(e => getMon(e.date) === m);
      const row = { label: new Date(m + "-01").toLocaleDateString("en-IN", { month: "short", year: "2-digit" }) };
      CHART_CATS.slice(0, 8).forEach(c => {
        let v = 0;
        mEntries.forEach(e => {
          if (c.key === "subscriptions") v += (e.subscriptions||[]).reduce((s,x)=>s+(parseFloat(x.amount)||0),0);
          else if (c.key === "other")    v += (e.others||[]).reduce((s,x)=>s+(parseFloat(x.amount)||0),0);
          else v += parseFloat(e[c.key]||0);
        });
        row[c.label] = Math.round(v);
      });
      return row;
    });

    // Savings rate by month
    const savingsRateTrend = monKeys.map(m => {
      const spent = monMap[m];
      const rate  = totalIncome > 0 ? Math.max(0, Math.round(((totalIncome - spent) / totalIncome) * 100)) : 0;
      return { label: new Date(m + "-01").toLocaleDateString("en-IN", { month: "short", year: "2-digit" }), rate };
    });

    // Unique months
    const numMonths   = monKeys.length;
    const avgMonthly  = numMonths > 0 ? totalExpenses / numMonths : 0;
    const savingsRate = totalIncome > 0 ? Math.max(0, Math.round(((totalIncome - monthTotal) / totalIncome) * 100)) : 0;
    const peakDay     = chartData.length > 0 ? Math.max(...chartData.map(d => d.amount)) : 0;

    return { momDelta, prevMonTotal, monthTrend, dowData, avgDailyMonth, projectedEnd, daysElapsed, daysInMonth, monCatTotals, catTrendData, savingsRateTrend, numMonths, avgMonthly, savingsRate, peakDay };
  }, [entries, curMon, monthTotal, monthEntries, totalIncome, chartData]);

  const { momDelta, prevMonTotal, monthTrend, dowData, avgDailyMonth, projectedEnd, daysElapsed, daysInMonth, monCatTotals, catTrendData, savingsRateTrend, numMonths, avgMonthly, savingsRate, peakDay } = analyticsData;

  const budgetUsed = totalIncome > 0 ? Math.min((monthTotal / totalIncome) * 100, 100) : 0;
  const balColor   = netBalance >= 0 ? "var(--green)" : "var(--red)";

  // ── Form total ─────────────────────────────────────────────────────────────
  const formTotal = useMemo(() => {
    let t = ALL_SCALAR.reduce((s, c) => s + parseFloat(expForm[c.key] || 0), 0);
    formSubs.forEach(s   => { t += parseFloat(s.amount || 0); });
    formOthers.forEach(o => { t += parseFloat(o.amount || 0); });
    return t;
  }, [expForm, formSubs, formOthers]);

  // ── Filtered history ───────────────────────────────────────────────────────
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

  // ── Actions ────────────────────────────────────────────────────────────────
  const addEntry = useCallback(() => {
    if (formTotal === 0) { toast("Enter at least one expense amount", "error"); return; }
    setEntries(prev => [{ ...expForm, subscriptions: formSubs.filter(s => parseFloat(s.amount) > 0), others: formOthers.filter(o => parseFloat(o.amount) > 0), total: formTotal, id: uid() }, ...prev]);
    setExpForm({ ...initScalar, date: today(), note: "" });
    setFormSubs([mkSub()]); setFormOthers([mkSub()]);
    toast(`Entry of ${fmt(formTotal)} added`);
    setActiveTab("Dashboard");
  }, [expForm, formSubs, formOthers, formTotal]);

  const delEntry = (id) => { if (!confirm("Delete this entry?")) return; setEntries(p => p.filter(e => e.id !== id)); toast("Entry deleted"); };
  const addInc   = () => setIncomes(p => [...p, mkInc()]);
  const updInc   = (id, f, v) => setIncomes(p => p.map(i => i.id === id ? { ...i, [f]: v } : i));
  const remInc   = (id) => setIncomes(p => p.filter(i => i.id !== id));

  // ── Export / Import ────────────────────────────────────────────────────────
  const doExportExcel = () => {
    exportExcel({ entries, bankBalance, carryForward, incomes });
    toast("Excel report downloaded");
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
    Object.assign(document.createElement("a"), { href: url, download: "expenses.csv" }).click();
    URL.revokeObjectURL(url);
    toast("CSV exported");
  };

  const exportJSON = () => {
    const data = { bankBalance, carryForward, incomes, entries, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    Object.assign(document.createElement("a"), { href: url, download: "budget-backup.json" }).click();
    URL.revokeObjectURL(url);
    toast("JSON exported");
  };

  const importJSON = (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!Array.isArray(data.entries)) throw new Error();
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
    <div style={{ fontFamily: "'Inter',system-ui,sans-serif", background: "var(--bg)", minHeight: "100vh", paddingBottom: 60, color: "var(--text)" }}>
      <style>{CSS}</style>
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">{notif?.msg ?? ""}</div>
      {notif && <div className={`notif ${notif.type}`}>{notif.msg}</div>}

      {/* ── Header ── */}
      <header style={S.header}>
        <div style={S.hInner}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 12 }}>
            <div>
              <h1 style={S.title}>💼 Budget Tracker</h1>
              <p style={S.subtitle}>{new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
            </div>
            <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
              {totalIncome > 0 && (
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>Monthly Income</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "var(--green)", fontFamily: "monospace" }}>{fmt(totalIncome)}</div>
                </div>
              )}
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>Net Balance</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: balColor, fontFamily: "monospace" }}>{fmt(netBalance)}</div>
              </div>
              <button onClick={() => setDarkMode(d => !d)} className="btn-sm"
                style={{ fontSize: 18, padding: "6px 12px", minHeight: 40 }}
                aria-label={darkMode ? "Light mode" : "Dark mode"}>
                {darkMode ? "☀️" : "🌙"}
              </button>
            </div>
          </div>
          <nav aria-label="Main navigation">
            <div role="tablist" style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 0 }}>
              {TABS.map(t => (
                <button key={t} role="tab" aria-selected={activeTab === t} id={`tab-${t}`}
                  className={`tab-btn ${activeTab === t ? "active" : ""}`}
                  onClick={() => { setActiveTab(t); mainRef.current?.focus(); }}>
                  {t}
                </button>
              ))}
            </div>
          </nav>
        </div>
      </header>

      <main id="main-content" ref={mainRef} tabIndex={-1} style={S.body}>

        {/* ══════════ DASHBOARD ══════════ */}
        {activeTab === "Dashboard" && (
          <div>
            <div className="dash-layout">
              {/* LEFT */}
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Account Setup */}
                <section className="card">
                  <h2 className="section-title">Account Setup</h2>
                  <BalanceField label="Bank Balance (₹)" value={bankBalance} editing={editingBalance}
                    temp={tempBalance} onEdit={() => { setTempBalance(bankBalance); setEditingBalance(true); }}
                    onSave={() => { setBankBalance(tempBalance); setEditingBalance(false); toast("Balance updated"); }}
                    onChange={setTempBalance} id="bank-bal" />
                  <div style={{ marginBottom: 16 }} />
                  <BalanceField label="Carry-Forward Balance (₹)" value={carryForward} editing={editingCarry}
                    temp={tempCarry} onEdit={() => { setTempCarry(carryForward); setEditingCarry(true); }}
                    onSave={() => { setCarryForward(tempCarry); setEditingCarry(false); toast("Carry-forward updated"); }}
                    onChange={setTempCarry} id="carry-fwd" />
                  <div style={{ height: 16 }} />
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <h3 style={{ ...S.label, margin: 0 }}>Income Sources</h3>
                    <button className="btn-sm" onClick={addInc} style={{ minHeight: 34 }}>+ Add</button>
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
                      <span style={{ color: "#4f46e5", fontWeight: 700, fontFamily: "monospace" }}>{fmt(totalIncome)}</span>
                    </div>
                  )}
                </section>

                {/* Metrics */}
                <div className="metrics-grid">
                  {[
                    { label: "Bank Balance",  val: fmt(parseFloat(bankBalance) || 0), sub: "Current balance",     color: "#4f46e5" },
                    { label: "This Month",    val: fmt(monthTotal),                   sub: `${monthEntries.length} entries`, color: "var(--red)" },
                    { label: "This Week",     val: fmt(weekTotal),                    sub: `${weekEntries.length} entries`,  color: "#b45309" },
                    { label: "Money Left",    val: fmt(netBalance),                   sub: "After all expenses",   color: balColor },
                  ].map(m => (
                    <div key={m.label} className="metric-card">
                      <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600, marginBottom: 6 }}>{m.label}</div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: m.color, fontFamily: "monospace" }}>{m.val}</div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{m.sub}</div>
                    </div>
                  ))}
                </div>

                {/* Budget progress */}
                {totalIncome > 0 && (
                  <section className="card">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <h2 className="section-title" style={{ margin: 0 }}>Monthly Budget</h2>
                      <span style={{ fontSize: 15, fontWeight: 700, color: budgetUsed > 80 ? "var(--red)" : budgetUsed > 60 ? "#b45309" : "var(--green)" }}>{Math.round(budgetUsed)}%</span>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${budgetUsed}%`, background: budgetUsed > 80 ? "var(--red)" : budgetUsed > 60 ? "#b45309" : "var(--green)" }} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, fontSize: 12, color: "var(--text-muted)", fontWeight: 600, flexWrap: "wrap", gap: 4 }}>
                      <span>Spent: {fmt(monthTotal)}</span>
                      <span>Left: {fmt(Math.max(0, totalIncome - monthTotal))}</span>
                      <span>Income: {fmt(totalIncome)}</span>
                    </div>
                    {savingsRate > 0 && (
                      <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 8, background: "rgba(4,120,87,0.1)", display: "flex", gap: 8, alignItems: "center" }}>
                        <span style={{ fontSize: 18 }}>💰</span>
                        <span style={{ fontSize: 13, color: "var(--green)", fontWeight: 700 }}>Savings Rate: {savingsRate}% — {savingsRate >= 20 ? "Great job!" : "Aim for 20%+"}</span>
                      </div>
                    )}
                  </section>
                )}

                {/* Top categories */}
                {pieData.length > 0 && (
                  <section className="card">
                    <h2 className="section-title">Top Spending</h2>
                    <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                      {pieData.slice(0, 8).map(d => (
                        <li key={d.key} className="insight-row">
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ width: 10, height: 10, borderRadius: "50%", background: d.fill, flexShrink: 0, display: "inline-block" }} />
                            <span style={{ fontSize: 13, fontWeight: 600 }}>{d.label}</span>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "monospace" }}>{fmt(d.value)}</div>
                            {totalIncome > 0 && <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>{Math.round((d.value / totalIncome) * 100)}%</div>}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                <button className="btn-primary" onClick={() => setActiveTab("Add Entry")}
                  style={{ width: "100%", padding: 14, fontSize: 15, borderRadius: 12, minHeight: 52 }}>
                  + Add Expense Entry
                </button>
              </div>

              {/* RIGHT */}
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <section className="card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
                    <h2 className="section-title" style={{ margin: 0 }}>Spending Trend</h2>
                    <ChartToggle value={chartView} onChange={setChartView} />
                  </div>
                  {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={240}>
                      <ComposedChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -8 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 12, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 12, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                        <Tooltip content={<BarTooltip />} wrapperStyle={{ zIndex: 9999 }} />
                        <Bar dataKey="amount" name="Spent" fill="#6366f1" radius={[4,4,0,0]} />
                        {chartView === "monthly" && totalIncome > 0 && <Line dataKey="income" name="Income" stroke="#10b981" strokeWidth={2} strokeDasharray="5 4" dot={false} />}
                      </ComposedChart>
                    </ResponsiveContainer>
                  ) : (
                    <div style={S.empty}>No spending data yet. Add some expenses!</div>
                  )}
                </section>

                {pieData.length > 0 && (
                  <section className="card">
                    <h2 className="section-title">Spending Distribution</h2>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
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
          <div>
            <div className="entry-layout">
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

              <div className="entry-sidebar">
                <div className="card entry-summary-card">
                  <h3 style={{ margin: "0 0 16px", fontSize: 13, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em" }}>Entry Summary</h3>
                  {ALL_SCALAR.map(c => {
                    const v = parseFloat(expForm[c.key] || 0);
                    if (!v) return null;
                    return (
                      <div key={c.key} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 13 }}>
                        <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>{c.icon} {c.label}</span>
                        <span style={{ fontWeight: 700, fontFamily: "monospace" }}>{fmt(v)}</span>
                      </div>
                    );
                  })}
                  {formSubs.filter(s => parseFloat(s.amount) > 0).map((s, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 13 }}>
                      <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>📱 {s.name || `Sub ${i+1}`}</span>
                      <span style={{ fontWeight: 700, fontFamily: "monospace" }}>{fmt(s.amount)}</span>
                    </div>
                  ))}
                  {formOthers.filter(o => parseFloat(o.amount) > 0).map((o, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 13 }}>
                      <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>📦 {o.name || `Other ${i+1}`}</span>
                      <span style={{ fontWeight: 700, fontFamily: "monospace" }}>{fmt(o.amount)}</span>
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
          <div>
            <div className="card" style={{ marginBottom: 12, padding: "14px 18px" }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                <input className="inp" type="search" placeholder="🔍 Search entries…"
                  value={histSearch} onChange={e => setHistSearch(e.target.value)}
                  style={{ flex: "1 1 200px", maxWidth: 320 }} aria-label="Search history" />
                <select className="inp" value={histMonth} onChange={e => setHistMonth(e.target.value)}
                  style={{ flex: "0 0 auto", width: 160 }}>
                  <option value="">All months</option>
                  {availableMonths.map(m => (
                    <option key={m} value={m}>{new Date(m+"-01").toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</option>
                  ))}
                </select>
                <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button className="btn-sm btn-excel" onClick={doExportExcel} style={{ minHeight: 36 }}>📊 Excel</button>
                  <button className="btn-sm" onClick={exportCSV} style={{ minHeight: 36 }}>📥 CSV</button>
                  <button className="btn-sm" onClick={exportJSON} style={{ minHeight: 36 }}>📦 JSON</button>
                  <button className="btn-sm" onClick={() => importRef.current?.click()} style={{ minHeight: 36 }}>📤 Import</button>
                  <input ref={importRef} type="file" accept=".json" onChange={importJSON} style={{ display: "none" }} />
                </div>
              </div>
            </div>

            {filteredEntries.length === 0 ? (
              <div className="card" style={{ textAlign: "center", padding: 64 }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
                <p style={{ color: "var(--text-muted)", margin: 0, fontWeight: 600, fontSize: 16 }}>
                  {entries.length === 0 ? "No entries yet. Add your first expense!" : "No entries match your search."}
                </p>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <span style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 700 }}>{filteredEntries.length} entries</span>
                  <span style={{ fontSize: 14, color: "var(--text-muted)", fontWeight: 700 }}>Total: {fmt(filteredEntries.reduce((s,e)=>s+e.total,0))}</span>
                </div>
                <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                  {filteredEntries.map(e => {
                    const scCats = ALL_SCALAR.filter(c => parseFloat(e[c.key] || 0) > 0);
                    const subs   = (e.subscriptions || []).filter(s => parseFloat(s.amount) > 0);
                    const others = (e.others || []).filter(o => parseFloat(o.amount) > 0);
                    const pills  = [
                      ...scCats.map(c  => ({ label: c.label, icon: c.icon,  fill: c.fill, val: e[c.key] })),
                      ...subs.map(s    => ({ label: s.name || "Subscription", icon: "📱", fill: "#8b5cf6", val: s.amount })),
                      ...others.map(o  => ({ label: o.name || "Other",        icon: "📦", fill: "#94a3b8", val: o.amount })),
                    ];
                    const ds = new Date(e.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
                    return (
                      <li key={e.id} className="history-item">
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
                            <time dateTime={e.date} style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 700 }}>{ds}</time>
                            {e.note && <span style={{ fontSize: 13, color: "var(--text-muted)", fontStyle: "italic" }}>— {e.note}</span>}
                          </div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
                            {pills.slice(0, 6).map((p, i) => (
                              <span key={i} className="cat-pill" style={{ background: "var(--pill-bg)", borderLeft: `3px solid ${p.fill}` }}>
                                {p.icon} {p.label}: {fmt(p.val)}
                              </span>
                            ))}
                            {pills.length > 6 && <span className="cat-pill" style={{ background: "var(--border)", color: "var(--text-muted)" }}>+{pills.length - 6} more</span>}
                          </div>
                        </div>
                        <div style={{ textAlign: "right", marginLeft: 16, flexShrink: 0 }}>
                          <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "monospace" }}>{fmt(e.total)}</div>
                          <button className="btn-sm" style={{ marginTop: 8, color: "var(--red)", borderColor: "rgba(185,28,28,0.25)", minHeight: 36 }}
                            onClick={() => delEntry(e.id)}>Delete</button>
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
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {/* Export bar */}
            <div className="card" style={{ padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)" }}>📊 Export Report</span>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button className="btn-sm btn-excel" onClick={doExportExcel} style={{ minHeight: 36 }}>📊 Excel (5 sheets)</button>
                <button className="btn-sm" onClick={exportCSV} style={{ minHeight: 36 }}>📥 CSV</button>
                <button className="btn-sm" onClick={exportJSON} style={{ minHeight: 36 }}>📦 JSON Backup</button>
              </div>
            </div>

            {/* KPI Row */}
            <div className="analytics-stats">
              {[
                { label: "Avg Monthly Spend", val: numMonths > 0 ? fmt(avgMonthly) : "—", color: "#4f46e5", sub: `over ${numMonths} month${numMonths !== 1 ? "s" : ""}` },
                { label: "This Month",        val: fmt(monthTotal), color: momDelta !== null && momDelta > 0 ? "var(--red)" : "var(--green)",
                  sub: momDelta !== null ? `${momDelta >= 0 ? "▲" : "▼"} ${Math.abs(momDelta).toFixed(1)}% vs last month` : "first month" },
                { label: "Avg Daily Spend",   val: fmt(avgDailyMonth), color: "#b45309", sub: `${daysElapsed} days elapsed` },
                { label: "Projected Month-End", val: fmt(projectedEnd), color: projectedEnd > totalIncome && totalIncome > 0 ? "var(--red)" : "var(--green)",
                  sub: totalIncome > 0 ? (projectedEnd > totalIncome ? "⚠️ over income" : "✅ within income") : "" },
                { label: "Savings Rate",      val: `${savingsRate}%`, color: savingsRate >= 20 ? "var(--green)" : "#b45309", sub: "this month" },
                { label: "Peak Day Spend",    val: fmt(peakDay), color: "var(--red)", sub: "single day high" },
                { label: "Total Expenses",    val: fmt(totalExpenses), color: "var(--text)", sub: `${entries.length} entries` },
                { label: "Months Tracked",    val: String(numMonths), color: "#4f46e5", sub: "calendar months" },
              ].map(m => (
                <div key={m.label} className="metric-card">
                  <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 700, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>{m.label}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: m.color, fontFamily: "monospace", letterSpacing: "-0.5px" }}>{m.val}</div>
                  {m.sub && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4, fontWeight: 600 }}>{m.sub}</div>}
                </div>
              ))}
            </div>

            {/* Month-over-month trend */}
            {monthTrend.length > 0 && (
              <section className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
                  <h2 className="section-title" style={{ margin: 0 }}>Monthly Spending vs Income</h2>
                  {momDelta !== null && (
                    <span style={{ fontSize: 13, fontWeight: 700, padding: "4px 12px", borderRadius: 20,
                      background: momDelta > 0 ? "rgba(185,28,28,0.1)" : "rgba(4,120,87,0.1)",
                      color: momDelta > 0 ? "var(--red)" : "var(--green)" }}>
                      {momDelta >= 0 ? "▲" : "▼"} {Math.abs(momDelta).toFixed(1)}% vs last month
                    </span>
                  )}
                </div>
                <ResponsiveContainer width="100%" height={260}>
                  <ComposedChart data={monthTrend} margin={{ top: 4, right: 8, bottom: 0, left: -8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 12, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 12, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                    <Tooltip content={<BarTooltip />} wrapperStyle={{ zIndex: 9999 }} />
                    <Bar dataKey="amount" name="Spent" fill="#6366f1" radius={[4,4,0,0]} />
                    {totalIncome > 0 && <Line dataKey="income" name="Income" stroke="#10b981" strokeWidth={2.5} strokeDasharray="6 4" dot={false} />}
                  </ComposedChart>
                </ResponsiveContainer>
              </section>
            )}

            {/* Two-column: Category breakdown + Savings rate trend */}
            <div className="analytics-layout">
              {/* Category totals */}
              <section className="card">
                <h2 className="section-title">Category Totals (All Time)</h2>
                {CHART_CATS.map(c => {
                  const val = catTotals[c.key];
                  if (!val) return null;
                  const pct = totalExpenses > 0 ? (val / totalExpenses) * 100 : 0;
                  return (
                    <div key={c.key} style={{ marginBottom: 14 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{c.icon} {c.label}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "monospace", color: c.color }}>
                          {fmt(val)} <span style={{ fontWeight: 600, color: "var(--text-muted)", fontSize: 12 }}>({Math.round(pct)}%)</span>
                        </span>
                      </div>
                      <div className="progress-bar">
                        <div className="progress-fill" style={{ width: `${pct}%`, background: c.fill }} />
                      </div>
                    </div>
                  );
                })}
                {totalExpenses === 0 && <p style={{ color: "var(--text-muted)", textAlign: "center", padding: 20 }}>No spending data yet.</p>}
              </section>

              {/* Savings rate trend */}
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {savingsRateTrend.length > 1 && (
                  <section className="card">
                    <h2 className="section-title">Savings Rate Trend</h2>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={savingsRateTrend} margin={{ top: 4, right: 8, bottom: 0, left: -8 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 12, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 12, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
                        <Tooltip formatter={v => [`${v}%`, "Savings Rate"]} contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13 }} />
                        <Line type="monotone" dataKey="rate" stroke="#10b981" strokeWidth={2.5} dot={{ fill: "#10b981", r: 4 }} activeDot={{ r: 6 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </section>
                )}

                {/* Financial Health */}
                {totalIncome > 0 && (
                  <section className="card">
                    <h2 className="section-title">Financial Health</h2>
                    <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                      {[
                        { label: "Savings Rate",             val: savingsRate, t: 20, unit: "%", tip: "Target ≥ 20%", inv: false },
                        { label: "Housing % of income",      val: Math.round((catTotals.rent / totalIncome) * 100), t: 30, unit: "%", tip: "Target ≤ 30%", inv: true },
                        { label: "Debt (EMI + Credit Card)", val: Math.round(((catTotals.loanEmi + catTotals.creditCard) / totalIncome) * 100), t: 20, unit: "%", tip: "Target ≤ 20%", inv: true },
                        { label: "Food % of income",         val: Math.round((catTotals.food / totalIncome) * 100), t: 15, unit: "%", tip: "Target ≤ 15%", inv: true },
                      ].map(item => {
                        const pass = item.inv ? item.val <= item.t : item.val >= item.t;
                        return (
                          <li key={item.label} className="insight-row">
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 700 }}>{item.label}</div>
                              <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>{item.tip}</div>
                            </div>
                            <span style={{ fontSize: 18, fontWeight: 700, color: pass ? "var(--green)" : "var(--red)" }}>
                              {item.val}{item.unit}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                )}

                {/* Spending pace */}
                {totalIncome > 0 && (
                  <section className="card">
                    <h2 className="section-title">Spending Pace — {new Date().toLocaleDateString("en-IN", { month: "long" })}</h2>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, fontSize: 13, color: "var(--text-muted)", fontWeight: 600 }}>
                      <span>Day {daysElapsed} of {daysInMonth}</span>
                      <span>{Math.round((daysElapsed / daysInMonth) * 100)}% of month elapsed</span>
                    </div>
                    <div className="progress-bar" style={{ marginBottom: 12 }}>
                      <div className="progress-fill" style={{ width: `${(daysElapsed / daysInMonth) * 100}%`, background: "#94a3b8" }} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, fontSize: 13, color: "var(--text-muted)", fontWeight: 600 }}>
                      <span>Spent so far</span>
                      <span>Projected month-end</span>
                    </div>
                    <div className="progress-bar" style={{ marginBottom: 8 }}>
                      <div className="progress-fill" style={{
                        width: `${Math.min(100, (projectedEnd / totalIncome) * 100)}%`,
                        background: projectedEnd > totalIncome ? "var(--red)" : "var(--green)"
                      }} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700 }}>
                      <span style={{ color: "#4f46e5", fontFamily: "monospace" }}>{fmt(monthTotal)}</span>
                      <span style={{ color: projectedEnd > totalIncome ? "var(--red)" : "var(--green)", fontFamily: "monospace" }}>{fmt(projectedEnd)}</span>
                    </div>
                    <div style={{ marginTop: 10, fontSize: 12, color: "var(--text-muted)", fontWeight: 600, textAlign: "center" }}>
                      Income: {fmt(totalIncome)} · Avg/day: {fmt(avgDailyMonth)}
                    </div>
                  </section>
                )}
              </div>
            </div>

            {/* Category trend (last 6 months stacked bar) */}
            {catTrendData.length > 1 && (
              <section className="card">
                <h2 className="section-title">Category Trend — Last {catTrendData.length} Months</h2>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={catTrendData} margin={{ top: 4, right: 8, bottom: 0, left: -8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 12, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 12, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                    <Tooltip content={<BarTooltip />} wrapperStyle={{ zIndex: 9999 }} />
                    <Legend formatter={val => <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>{val}</span>} />
                    {CHART_CATS.slice(0, 8).map(c => (
                      <Bar key={c.key} dataKey={c.label} stackId="a" fill={c.fill} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </section>
            )}

            {/* Day-of-week analysis */}
            {entries.length > 0 && (
              <section className="card">
                <h2 className="section-title">Spending by Day of Week</h2>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 8 }}>
                  {dowData.map(d => {
                    const maxTotal = Math.max(...dowData.map(x => x.total), 1);
                    const pct = (d.total / maxTotal) * 100;
                    return (
                      <div key={d.day} style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 6 }}>{d.day}</div>
                        <div style={{ height: 80, display: "flex", alignItems: "flex-end", justifyContent: "center", marginBottom: 6 }}>
                          <div style={{ width: "60%", background: pct > 0 ? "#6366f1" : "var(--border)", borderRadius: "4px 4px 0 0", height: `${Math.max(pct, 2)}%`, transition: "height .3s" }} />
                        </div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text)", fontFamily: "monospace" }}>{d.total > 0 ? fmt(d.total) : "—"}</div>
                        <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600 }}>{d.count} {d.count === 1 ? "entry" : "entries"}</div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Distribution pie (analytics) */}
            {pieData.length > 0 && (
              <section className="card">
                <h2 className="section-title">Overall Spending Distribution</h2>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="45%" innerRadius={70} outerRadius={110} paddingAngle={2} dataKey="value">
                      {pieData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                    </Pie>
                    <Tooltip content={<PieTooltip />} wrapperStyle={{ zIndex: 9999 }} />
                    <Legend formatter={val => <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>{val}</span>} wrapperStyle={{ paddingTop: 8 }} />
                  </PieChart>
                </ResponsiveContainer>
              </section>
            )}

            {entries.length === 0 && (
              <div className="card" style={{ textAlign: "center", padding: 64 }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
                <p style={{ color: "var(--text-muted)", fontWeight: 600, fontSize: 16 }}>Add some expenses to see your analytics!</p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────
function BalanceField({ label, value, editing, temp, onEdit, onSave, onChange, id }) {
  return (
    <div>
      <label htmlFor={id} style={S.label}>{label}</label>
      {editing ? (
        <div style={{ display: "flex", gap: 8 }}>
          <input id={id} className="inp" type="number" min="0" value={temp} onChange={e => onChange(e.target.value)} placeholder="0" autoFocus />
          <button className="btn-primary" style={{ whiteSpace: "nowrap", padding: "9px 16px" }} onClick={onSave}>Save</button>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={S.displayBox}>{value ? `₹${Number(value).toLocaleString("en-IN")}` : <span style={{ color: "var(--text-muted)", fontStyle: "italic", fontWeight: 500 }}>Not set</span>}</div>
          <button className="btn-sm" onClick={onEdit}>Edit</button>
        </div>
      )}
    </div>
  );
}

function ScalarField({ cat, value, onChange }) {
  return (
    <div style={S.fieldWrap}>
      <label htmlFor={`f-${cat.key}`} style={S.label}>{cat.icon} {cat.label}</label>
      <div style={S.amtRow}>
        <span style={S.rupee}>₹</span>
        <input id={`f-${cat.key}`} className="inp" type="number" min="0" placeholder="0" value={value} onChange={onChange} style={S.amtInp} aria-label={`${cat.label} in rupees`} />
      </div>
    </div>
  );
}

function MultiRows({ rows, setRows, label }) {
  return (
    <div>
      {rows.map((row, i) => (
        <div key={row.id} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
          <input className="inp" type="text" placeholder={`${label} name`} value={row.name}
            onChange={e => setRows(p => p.map(r => r.id === row.id ? { ...r, name: e.target.value } : r))}
            style={{ flex: "2 1 140px" }} aria-label={`${label} ${i+1} name`} />
          <div style={{ ...S.amtRow, flex: "1 1 110px" }}>
            <span style={S.rupee}>₹</span>
            <input className="inp" type="number" min="0" placeholder="0" value={row.amount}
              onChange={e => setRows(p => p.map(r => r.id === row.id ? { ...r, amount: e.target.value } : r))}
              style={S.amtInp} aria-label={`${label} ${i+1} amount`} />
          </div>
          {rows.length > 1 && <button onClick={() => setRows(p => p.filter(r => r.id !== row.id))} style={S.rmBtn}>✕</button>}
        </div>
      ))}
      <button onClick={() => setRows(p => [...p, mkSub()])} style={S.addMoreBtn}>+ Add {label}</button>
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
        <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: color, marginRight: 7, verticalAlign: "middle" }} />
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
            <select className="inp" style={{ flex: "1 1 110px" }} value={inc.type} onChange={e => onChange("type", e.target.value)}>
              {INCOME_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
            <input className="inp" type="number" min="0" placeholder="Amount (₹)" value={inc.amount} onChange={e => onChange("amount", e.target.value)} style={{ flex: "1 1 130px" }} />
            <input className="inp" type="date" value={inc.date} onChange={e => onChange("date", e.target.value)} style={{ flex: "1 1 140px" }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <button id={tid} role="switch" aria-checked={inc.auto} onClick={() => onChange("auto", !inc.auto)}
              style={{ width: 44, height: 26, borderRadius: 13, background: inc.auto ? "var(--green)" : "var(--border)", border: "none", cursor: "pointer", position: "relative", padding: 0, flexShrink: 0 }}>
              <span style={{ position: "absolute", top: 4, left: inc.auto ? 21 : 3, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left .2s", boxShadow: "0 1px 3px rgba(0,0,0,.25)" }} />
            </button>
            <label htmlFor={tid} style={{ fontSize: 13, color: ac, fontWeight: 700, cursor: "pointer" }}>
              {inc.auto ? "🔄 Auto-add on date" : "✋ Manual only"}
            </label>
            <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              <button className="btn-primary" style={{ padding: "8px 18px", fontSize: 13, minHeight: 36 }} onClick={onSave}>Save</button>
              {showRemove && <button className="btn-sm" style={{ color: "var(--red)", minHeight: 36 }} onClick={onRemove}>Remove</button>}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>{inc.type}</span>
            <span style={{ fontSize: 16, fontWeight: 700, color: "#4f46e5", fontFamily: "monospace" }}>
              {inc.amount ? `₹${Number(inc.amount).toLocaleString("en-IN")}` : <span style={{ color: "var(--text-muted)", fontStyle: "italic", fontWeight: 500, fontSize: 13 }}>not set</span>}
            </span>
            {inc.date && <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>every {new Date(inc.date).getDate()}{ordinal(new Date(inc.date).getDate())}</span>}
            <span style={{ fontSize: 12, fontWeight: 700, color: ac }}>{inc.auto ? "🔄 Auto" : "✋ Manual"}</span>
          </div>
          <button className="btn-sm" onClick={onEdit} style={{ minHeight: 36 }}>Edit</button>
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
  title:      { margin: 0, fontSize: 22, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.3px", fontFamily: "'Playfair Display', Georgia, serif" },
  subtitle:   { margin: "2px 0 0", fontSize: 13, color: "var(--text-muted)", fontWeight: 500, fontFamily: "'Inter', system-ui, sans-serif" },
  label:      { fontSize: 13, color: "var(--text-muted)", fontWeight: 600, display: "block", marginBottom: 6, fontFamily: "'Inter', system-ui, sans-serif" },
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
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@600;700&display=swap');
  *, *::before, *::after { box-sizing: border-box; }
  body { margin: 0; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; font-family: 'Inter', system-ui, sans-serif; }

  :root, [data-theme="light"] {
    --bg: #f0f2f5; --card: #ffffff; --header-bg: #ffffff;
    --border: #e2e8f0; --text: #1a202c; --text-muted: #4a5568;
    --input-bg: #f8f9fa; --pill-bg: #f0f2f5;
    --green: #047857; --red: #b91c1c;
  }
  [data-theme="dark"] {
    --bg: #0f1117; --card: #1a1d27; --header-bg: #13151f;
    --border: #2d3148; --text: #e2e8f0; --text-muted: #8896b3;
    --input-bg: #1e2133; --pill-bg: #1e2133;
    --green: #10b981; --red: #f87171;
  }

  .skip-link { position: absolute; top: -100%; left: 8px; padding: 10px 18px; background: #4f46e5; color: #fff; font-weight: 700; font-size: 14px; border-radius: 0 0 8px 8px; text-decoration: none; z-index: 9999; transition: top .15s; }
  .skip-link:focus { top: 0; }
  .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }

  .tab-btn { padding: 10px 22px; border-radius: 20px; border: none; cursor: pointer; font-size: 14px; font-weight: 600; transition: all .2s; background: transparent; color: var(--text-muted); min-height: 42px; font-family: 'Inter', system-ui, sans-serif; letter-spacing: 0.01em; }
  .tab-btn.active { background: #4f46e5; color: #fff; }
  .tab-btn:hover:not(.active) { background: rgba(99,102,241,0.1); color: var(--text); }
  .tab-btn:focus-visible { outline: 3px solid #4f46e5; outline-offset: 2px; }

  .card { background: var(--card); border-radius: 16px; border: 1px solid var(--border); padding: 22px; }
  .metric-card { background: var(--card); border-radius: 12px; padding: 18px; border: 1px solid var(--border); }

  .inp { width: 100%; padding: 10px 13px; border-radius: 8px; border: 1px solid var(--border); font-size: 14px; background: var(--input-bg); color: var(--text); box-sizing: border-box; font-family: 'Inter', system-ui, sans-serif; font-weight: 500; transition: border-color .15s, box-shadow .15s; }
  .inp:focus { outline: none; border-color: #4f46e5; box-shadow: 0 0 0 3px rgba(79,70,229,.15); }
  .inp option { background: var(--card); color: var(--text); }

  .btn-primary { background: #4f46e5; color: #fff; border: none; border-radius: 10px; padding: 11px 24px; font-size: 14px; font-weight: 600; cursor: pointer; transition: background .2s; font-family: 'Inter', system-ui, sans-serif; letter-spacing: 0.01em; }
  .btn-primary:hover { background: #3730a3; }
  .btn-primary:focus-visible { outline: 3px solid #4f46e5; outline-offset: 3px; }
  .btn-sm { padding: 7px 15px; border-radius: 6px; border: 1px solid var(--border); background: transparent; color: var(--text-muted); font-size: 13px; cursor: pointer; font-family: 'Inter', system-ui, sans-serif; font-weight: 600; transition: background .15s; }
  .btn-sm:hover { background: rgba(99,102,241,0.08); }
  .btn-excel { border-color: #15803d40; color: #15803d; background: rgba(21,128,61,0.05); }
  .btn-excel:hover { background: rgba(21,128,61,0.12); }
  [data-theme="dark"] .btn-excel { color: #34d399; border-color: #34d39940; background: rgba(52,211,153,0.07); }
  [data-theme="dark"] .btn-excel:hover { background: rgba(52,211,153,0.14); }

  .chart-toggle button { padding: 7px 16px; font-size: 12px; border: 1px solid var(--border); background: transparent; cursor: pointer; color: var(--text-muted); font-family: inherit; transition: all .15s; font-weight: 700; min-height: 36px; }
  .chart-toggle button:first-child { border-radius: 8px 0 0 8px; }
  .chart-toggle button:last-child  { border-radius: 0 8px 8px 0; }
  .chart-toggle button.active { background: #4f46e5; color: #fff; border-color: #4f46e5; }

  .notif { position: fixed; top: 20px; right: 20px; padding: 13px 22px; border-radius: 10px; font-size: 14px; font-weight: 700; z-index: 9999; animation: slideIn .3s ease; max-width: calc(100vw - 40px); }
  .notif.success { background: #047857; color: #fff; }
  .notif.error   { background: #b91c1c; color: #fff; }
  @keyframes slideIn { from { transform: translateX(40px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }

  .progress-bar  { height: 8px; border-radius: 4px; background: var(--border); overflow: hidden; }
  .progress-fill { height: 100%; border-radius: 4px; transition: width .6s ease; }

  .section-title { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .1em; color: var(--text-muted); margin: 0 0 14px; font-family: 'Inter', system-ui, sans-serif; }

  .history-item { display: flex; justify-content: space-between; align-items: flex-start; padding: 16px 18px; border-radius: 12px; border: 1px solid var(--border); margin-bottom: 10px; background: var(--card); transition: box-shadow .15s; }
  .history-item:hover { box-shadow: 0 2px 12px rgba(0,0,0,.1); }
  .cat-pill { display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 700; margin: 2px; color: var(--text); }

  .insight-row { display: flex; align-items: center; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid var(--border); }
  .insight-row:last-child { border-bottom: none; }

  .field-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 16px; }
  .metrics-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .analytics-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }

  .dash-layout    { display: grid; grid-template-columns: 360px 1fr; gap: 20px; align-items: start; }
  .analytics-layout { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; align-items: start; }
  .entry-layout   { display: grid; grid-template-columns: 1fr 320px; gap: 20px; align-items: start; }
  .entry-sidebar  { position: sticky; top: 90px; }
  .entry-summary-card { padding: 22px; }

  @media (max-width: 1100px) {
    .analytics-stats { grid-template-columns: repeat(4, 1fr); }
  }
  @media (max-width: 900px) {
    .dash-layout { grid-template-columns: 1fr; }
    .entry-layout { grid-template-columns: 1fr; }
    .entry-sidebar { position: static; }
    .analytics-layout { grid-template-columns: 1fr; }
    .analytics-stats { grid-template-columns: 1fr 1fr; }
  }
  @media (max-width: 600px) {
    .tab-btn { padding: 8px 12px; font-size: 12px; }
    .card { padding: 16px; }
    .metrics-grid { grid-template-columns: 1fr 1fr; }
    .analytics-stats { grid-template-columns: 1fr 1fr; }
    .history-item { flex-direction: column; gap: 12px; }
  }
  @media (max-width: 480px) {
    .field-grid { grid-template-columns: 1fr; }
  }
`;
