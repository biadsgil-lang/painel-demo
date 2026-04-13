import { useState, useEffect, useCallback, useRef, Fragment } from "react";

// ═══════════════════════════════════════════════════════════════════════════════
// PALETTE & THEME
// ═══════════════════════════════════════════════════════════════════════════════
const C = {
  blue: "#ddf0fb", pink: "#fce4ec", rose: "#f8bbd0", deep: "#e991aa",
  lavender: "#e8d5f5", mint: "#d4f0e8", butter: "#fff9c4", peach: "#ffe0cc",
  gold: "#d4a853", dark: "#5a4a6a", mid: "#8a7a9a", light: "#b8a8c8",
  danger: "#f28b9e", success: "#6ec89b",
};
const font = "'DM Sans', sans-serif";
const serif = "'Playfair Display', serif";

// ═══════════════════════════════════════════════════════════════════════════════
// CROSS-DEVICE SYNC STORAGE
// ═══════════════════════════════════════════════════════════════════════════════
const SYNC_BASE = "/api/sync";
const cache = {};
const tsCache = {};

function load(key, fallback) {
  if (cache[key] !== undefined) return cache[key];
  try {
    const v = localStorage.getItem(key);
    if (v) { cache[key] = JSON.parse(v); return cache[key]; }
  } catch {}
  return fallback;
}

function save(key, val) {
  const ts = Date.now();
  cache[key] = val;
  tsCache[key] = ts;
  try {
    localStorage.setItem(key, JSON.stringify(val));
    localStorage.setItem(key + "_ts", String(ts));
  } catch {}
  // Debounced cloud sync
  if (save._timers) clearTimeout(save._timers[key]);
  save._timers = save._timers || {};
  save._timers[key] = setTimeout(() => {
    fetch(`${SYNC_BASE}?key=${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: val, ts }),
    }).catch(() => {});
  }, 500);
}

async function cloudPull(key) {
  try {
    const r = await fetch(`${SYNC_BASE}?key=${encodeURIComponent(key)}`);
    if (r.ok) {
      const d = await r.json();
      if (d && d.value !== undefined && d.ts) {
        const localTs = Number(localStorage.getItem(key + "_ts") || "0");
        if (d.ts > localTs) {
          cache[key] = d.value;
          localStorage.setItem(key, JSON.stringify(d.value));
          localStorage.setItem(key + "_ts", String(d.ts));
          return d.value;
        }
      }
    }
  } catch {}
  return null;
}

const SK = {
  tasks: "pv_tasks", estudos: "pv_estudos", semana: "pv_semana",
  artes: "pv_artes", habits: "pv_habits", notes: "pv_notes",
  pomodoro: "pv_pomo", events: "pv_events", wishlist: "pv_wishlist",
  saude: "pv_saude", midia: "pv_midia", lugares: "pv_lugares",
  transactions: "pv_tx", budgets: "pv_budgets",
};

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════
const fmt = v => `R$ ${(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
const todayStr = () => new Date().toISOString().slice(0, 10);
const nowStr = () => new Date().toISOString();

const dateLabel = d => {
  if (!d) return "";
  const dt = new Date(d + (d.length === 10 ? "T00:00:00" : ""));
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((dt.setHours(0,0,0,0) - today) / 86400000);
  if (diff === 0) return "hoje";
  if (diff === 1) return "amanhã";
  if (diff === -1) return "ontem";
  if (diff > 1 && diff <= 7) return `em ${diff} dias`;
  if (diff < -1 && diff >= -7) return `${Math.abs(diff)} dias atrás`;
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
};

const catEmoji = (d = "") => {
  const x = d.toLowerCase();
  if (x.match(/sal[aá]rio|pgto|sal/)) return "💼";
  if (x.match(/mercado|superm|hortifr/)) return "🛒";
  if (x.match(/uber|99|transp|metro|onibus/)) return "🚌";
  if (x.match(/ifood|restaur|lanch|padaria|rappi/)) return "🍜";
  if (x.match(/spotify|netflix|disney|prime|hbo/)) return "🎵";
  if (x.match(/farm[aá]cia|drog/)) return "💊";
  if (x.match(/aluguel|condom/)) return "🏠";
  if (x.match(/invest|aplica|cdb|tesouro/)) return "📈";
  if (x.match(/luz|energia|enel|light/)) return "💡";
  if (x.match(/internet|vivo|claro|tim|oi/)) return "📶";
  if (x.match(/gas/)) return "🔥";
  if (x.match(/agua|sabesp/)) return "💧";
  if (x.match(/amazon|mercado livre|shein|shop/)) return "📦";
  return "✦";
};

const catFromDesc = (d = "") => {
  const x = d.toLowerCase();
  if (x.match(/sal[aá]rio|pgto/)) return "salario";
  if (x.match(/mercado|superm|hortifr|padaria/)) return "mercado";
  if (x.match(/uber|99|transp|metro|onibus|gasol/)) return "transporte";
  if (x.match(/ifood|restaur|lanch|rappi/)) return "alimentacao";
  if (x.match(/spotify|netflix|disney|prime|hbo|cinema/)) return "lazer";
  if (x.match(/farm[aá]cia|drog|m[eé]dico|exame|consulta/)) return "saude";
  if (x.match(/aluguel|condom|luz|energia|internet|agua|gas/)) return "moradia";
  if (x.match(/invest|aplica|cdb|tesouro/)) return "investimento";
  if (x.match(/amazon|shein|shop|roupa/)) return "compras";
  return "outros";
};

// ═══════════════════════════════════════════════════════════════════════════════
// BASE COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════
function Card({ children, style = {}, onClick }) {
  return (
    <div onClick={onClick} style={{
      background: "rgba(255,255,255,0.72)", backdropFilter: "blur(12px)",
      borderRadius: 24, border: "1.5px solid rgba(255,255,255,0.9)",
      boxShadow: "0 4px 24px rgba(180,160,210,0.12)",
      padding: "20px 22px", marginBottom: 14, ...style,
    }}>{children}</div>
  );
}

function Pill({ label, active, onClick, color }) {
  return (
    <button onClick={onClick} style={{
      padding: "7px 14px", borderRadius: 20,
      border: `1.5px solid ${active ? (color || C.deep) : "rgba(180,160,210,0.3)"}`,
      background: active ? (color || C.deep) : "rgba(255,255,255,0.5)",
      color: active ? "#fff" : C.mid, fontFamily: font, fontSize: 11,
      cursor: "pointer", fontWeight: active ? 600 : 400, transition: "all 0.2s",
    }}>{label}</button>
  );
}

function ProgressBar({ value, max, color, height = 7 }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div style={{ height, background: "rgba(180,160,210,0.15)", borderRadius: 99, overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${pct}%`, background: color || `linear-gradient(90deg, ${C.rose}, ${C.lavender})`, borderRadius: 99, transition: "width 0.6s ease" }} />
    </div>
  );
}

function Spinner({ size = 26 }) {
  return <div style={{ width: size, height: size, border: "2px solid rgba(233,145,170,0.2)", borderTop: `2px solid ${C.deep}`, borderRadius: "50%", animation: "spin 0.8s linear infinite", flexShrink: 0 }} />;
}

function EmptyState({ emoji, title, desc }) {
  return (
    <div style={{ textAlign: "center", padding: "28px 16px" }}>
      <div style={{ fontSize: 38, marginBottom: 10 }}>{emoji}</div>
      <div style={{ fontFamily: serif, fontSize: 15, color: C.dark, marginBottom: 5 }}>{title}</div>
      <div style={{ fontFamily: font, fontSize: 12, color: C.mid, lineHeight: 1.6 }}>{desc}</div>
    </div>
  );
}

function Btn({ children, onClick, danger, outline, full, disabled, style: s = {} }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: "11px 18px", borderRadius: 18,
      border: outline ? `1.5px solid ${danger ? C.danger : C.deep}` : "none",
      background: outline ? "transparent" : danger ? C.danger : `linear-gradient(135deg, ${C.rose}, ${C.lavender})`,
      color: outline ? (danger ? C.danger : C.deep) : "#fff",
      fontFamily: font, fontSize: 13, fontWeight: 600,
      cursor: disabled ? "not-allowed" : "pointer", width: full ? "100%" : "auto",
      opacity: disabled ? 0.5 : 1, transition: "all 0.15s",
      display: "flex", alignItems: "center", justifyContent: "center", gap: 8, ...s,
    }}>{children}</button>
  );
}

function IconBtn({ icon, onClick, title, size = 26, danger }) {
  return (
    <button title={title} onClick={e => { e.stopPropagation(); onClick(e); }} style={{
      width: size, height: size, borderRadius: "50%", border: "none",
      background: danger ? "rgba(242,139,158,0.15)" : "rgba(180,160,210,0.12)",
      color: danger ? C.danger : C.mid, fontSize: size * 0.46,
      cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
      transition: "all 0.15s", flexShrink: 0,
    }}>{icon}</button>
  );
}

function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(90,74,106,0.35)", backdropFilter: "blur(6px)",
      zIndex: 999, display: "flex", alignItems: "flex-end", justifyContent: "center",
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "#fff", borderRadius: "26px 26px 0 0",
        boxShadow: "0 -8px 48px rgba(180,160,210,0.22)",
        padding: "22px 24px 32px", width: "100%", maxWidth: 440,
        maxHeight: "85vh", overflowY: "auto", animation: "slideUp 0.3s ease",
      }}>
        <div style={{ width: 36, height: 4, borderRadius: 99, background: "rgba(180,160,210,0.3)", margin: "0 auto 14px" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <span style={{ fontFamily: serif, fontSize: 16, fontWeight: 700, color: C.dark }}>{title}</span>
          <IconBtn icon="✕" onClick={onClose} size={26} />
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ fontSize: 11, color: C.mid, fontFamily: font, marginBottom: 5, display: "block" }}>{label}</label>
      {children}
    </div>
  );
}
const iStyle = {
  width: "100%", padding: "11px 14px", borderRadius: 14,
  border: "1.5px solid rgba(248,187,208,0.35)", background: "rgba(255,255,255,0.9)",
  fontFamily: font, fontSize: 13, color: C.dark, outline: "none", boxSizing: "border-box",
};

function StatCard({ label, val, sub, bg, emoji }) {
  return (
    <div style={{ flex: 1, background: bg, borderRadius: 18, padding: "12px 13px", border: "1px solid rgba(255,255,255,0.8)", minWidth: 0 }}>
      <div style={{ fontSize: 16, marginBottom: 2 }}>{emoji}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: C.dark, fontFamily: serif, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{val}</div>
      <div style={{ fontSize: 9, color: C.mid, fontFamily: font }}>{label}</div>
      {sub && <div style={{ fontSize: 8, color: C.light, fontFamily: font, marginTop: 1 }}>{sub}</div>}
    </div>
  );
}

// Emoji picker grid helper
function EmojiPick({ value, onChange, options }) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {options.map(e => (
        <button key={e} onClick={() => onChange(e)} style={{
          fontSize: 20, padding: 4, borderRadius: 8, cursor: "pointer",
          border: value === e ? `2px solid ${C.deep}` : "2px solid transparent",
          background: value === e ? C.pink : "transparent",
        }}>{e}</button>
      ))}
    </div>
  );
}

function ColorPick({ value, onChange, options }) {
  return (
    <div style={{ display: "flex", gap: 8 }}>
      {options.map(c => (
        <button key={c} onClick={() => onChange(c)} style={{
          width: 26, height: 26, borderRadius: "50%", background: c,
          border: value === c ? `3px solid ${C.deep}` : "3px solid transparent",
          cursor: "pointer",
        }} />
      ))}
    </div>
  );
}

const colorPick = [C.blue, C.mint, C.lavender, C.butter, C.pink, C.rose, C.peach];

// Convert file to base64 (for photo uploads)
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Resize image before storing to keep localStorage small
async function resizeImage(file, maxSize = 600) {
  const base64 = await fileToBase64(file);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > height) {
        if (width > maxSize) { height = (height * maxSize) / width; width = maxSize; }
      } else {
        if (height > maxSize) { width = (width * maxSize) / height; height = maxSize; }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", 0.75));
    };
    img.src = base64;
  });
}

// OFX/CSV parser for bank statements
function parseOFX(text) {
  const txs = [];
  // Match STMTTRN blocks
  const blocks = text.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi) || [];
  for (const block of blocks) {
    const get = (tag) => {
      const m = block.match(new RegExp(`<${tag}>([^<\\r\\n]+)`, "i"));
      return m ? m[1].trim() : "";
    };
    const dt = get("DTPOSTED").slice(0, 8); // YYYYMMDD
    const date = dt.length === 8 ? `${dt.slice(0,4)}-${dt.slice(4,6)}-${dt.slice(6,8)}` : "";
    const amount = parseFloat(get("TRNAMT")) || 0;
    const memo = get("MEMO") || get("NAME") || "Transação";
    if (date && amount) {
      txs.push({
        id: `${date}-${amount}-${memo.slice(0,20)}-${Math.random().toString(36).slice(2,7)}`,
        date, amount, description: memo, category: catFromDesc(memo),
      });
    }
  }
  return txs;
}

function parseCSV(text) {
  const txs = [];
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return txs;
  // Try to detect header
  const header = lines[0].toLowerCase();
  const sep = header.includes(";") ? ";" : ",";
  const cols = header.split(sep).map(c => c.trim().replace(/"/g, ""));
  const dateIdx = cols.findIndex(c => c.match(/data|date/));
  const descIdx = cols.findIndex(c => c.match(/descri|histor|memo|titulo/));
  const valIdx = cols.findIndex(c => c.match(/valor|amount|quantia|preço/));
  if (dateIdx < 0 || valIdx < 0) return txs;
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(sep).map(p => p.trim().replace(/"/g, ""));
    if (parts.length < 2) continue;
    let dateStr = parts[dateIdx];
    // Handle DD/MM/YYYY
    if (dateStr.includes("/")) {
      const [d, m, y] = dateStr.split("/");
      dateStr = `${y.length === 2 ? "20" + y : y}-${m.padStart(2,"0")}-${d.padStart(2,"0")}`;
    }
    const desc = descIdx >= 0 ? parts[descIdx] : "Transação";
    let val = parts[valIdx].replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "");
    const amount = parseFloat(val) || 0;
    if (dateStr && amount) {
      txs.push({
        id: `${dateStr}-${amount}-${desc.slice(0,20)}-${Math.random().toString(36).slice(2,7)}`,
        date: dateStr, amount, description: desc, category: catFromDesc(desc),
      });
    }
  }
  return txs;
}

// ═══════════════════════════════════════════════════════════════════════════════
// FINANÇAS (CSV/OFX upload + manual entry + budgets)
// ═══════════════════════════════════════════════════════════════════════════════
const catLabels = {
  salario: "Salário 💼", mercado: "Mercado 🛒", transporte: "Transporte 🚌",
  alimentacao: "Alimentação 🍜", lazer: "Lazer 🎵", saude: "Saúde 💊",
  moradia: "Moradia 🏠", investimento: "Investimentos 📈", compras: "Compras 📦",
  outros: "Outros ✦",
};
const catColors = {
  salario: C.mint, mercado: C.butter, transporte: C.blue, alimentacao: C.peach,
  lazer: C.lavender, saude: C.pink, moradia: C.rose, investimento: C.mint,
  compras: C.butter, outros: C.lavender,
};

const defaultBudgets = {
  mercado: 800, alimentacao: 400, transporte: 300, lazer: 200,
  saude: 150, moradia: 1500, compras: 300, outros: 200,
};

const DEMO_TXS = [
  { id:"d1", date:"2026-04-01", description:"PAGTO SALARIO", amount:3200, category:"salario", bank:"Itaú" },
  { id:"d2", date:"2026-04-01", description:"FATURA PAGA NUBANK", amount:-1850, category:"outros", bank:"Itaú" },
  { id:"d3", date:"2026-04-03", description:"Supermercado Extra", amount:-312.50, category:"mercado", bank:"Nubank" },
  { id:"d4", date:"2026-04-05", description:"iFood - Jantar", amount:-68.90, category:"alimentacao", bank:"Nubank" },
  { id:"d5", date:"2026-04-06", description:"Uber", amount:-22.40, category:"transporte", bank:"Nubank" },
  { id:"d6", date:"2026-04-08", description:"Netflix", amount:-55.90, category:"lazer", bank:"Nubank" },
  { id:"d7", date:"2026-04-08", description:"Spotify", amount:-21.90, category:"lazer", bank:"Nubank" },
  { id:"d8", date:"2026-04-10", description:"Farmácia Drogasil", amount:-87.30, category:"saude", bank:"Nubank" },
  { id:"d9", date:"2026-04-10", description:"Aluguel abril", amount:-1200, category:"moradia", bank:"Itaú" },
  { id:"d10", date:"2026-04-11", description:"Amazon - livros", amount:-134.70, category:"compras", bank:"Nubank" },
  { id:"d11", date:"2026-04-12", description:"PIX amiga Mari", amount:-50, category:"outros", bank:"Itaú" },
  { id:"d12", date:"2026-04-13", description:"Café Bloom", amount:-28.50, category:"alimentacao", bank:"Nubank" },
  { id:"d13", date:"2026-03-01", description:"PAGTO SALARIO", amount:3200, category:"salario", bank:"Itaú" },
  { id:"d14", date:"2026-03-03", description:"Supermercado Pão de Açúcar", amount:-289.40, category:"mercado", bank:"Nubank" },
  { id:"d15", date:"2026-03-07", description:"Restaurante Sushi", amount:-98.00, category:"alimentacao", bank:"Nubank" },
  { id:"d16", date:"2026-03-10", description:"Aluguel março", amount:-1200, category:"moradia", bank:"Itaú" },
  { id:"d17", date:"2026-03-15", description:"Shein - roupas", amount:-210.00, category:"compras", bank:"Nubank" },
  { id:"d18", date:"2026-03-20", description:"Academia", amount:-99.90, category:"saude", bank:"Nubank" },
];

function FinancasSection() {
  const [tab, setTab] = useState("resumo");
  const [txs, setTxs] = useState(DEMO_TXS);
  const [budgets, setBudgets] = useState(defaultBudgets);
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showBudget, setShowBudget] = useState(false);
  const [editTx, setEditTx] = useState(null);
  const [form, setForm] = useState({ date: todayStr(), description: "", amount: "", category: "outros", bank: "Manual" });
  const [monthFilter, setMonthFilter] = useState(todayStr().slice(0, 7));
  const fileRef = useRef(null);
  const [importStatus, setImportStatus] = useState("");

  useEffect(() => { save(SK.transactions, txs); }, [txs]);
  useEffect(() => { save(SK.budgets, budgets); }, [budgets]);

  const addTx = () => {
    if (!form.description.trim() || !form.amount) return;
    const tx = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
      date: form.date, description: form.description,
      amount: parseFloat(form.amount), category: form.category, bank: form.bank,
    };
    setTxs(p => [tx, ...p]);
    setForm({ date: todayStr(), description: "", amount: "", category: "outros", bank: form.bank });
    setShowAdd(false);
  };

  const saveEdit = () => {
    setTxs(p => p.map(t => t.id === editTx.id ? { ...t, ...form, amount: parseFloat(form.amount) } : t));
    setEditTx(null);
  };

  const removeTx = id => setTxs(p => p.filter(t => t.id !== id));

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImportStatus("Processando...");
    try {
      const text = await file.text();
      let parsed = [];
      if (file.name.toLowerCase().endsWith(".ofx") || text.includes("<OFX>") || text.includes("<STMTTRN>")) {
        parsed = parseOFX(text);
      } else {
        parsed = parseCSV(text);
      }
      if (parsed.length === 0) {
        setImportStatus("Nenhuma transação encontrada. Verifique o formato do arquivo.");
        return;
      }
      // Dedupe against existing
      const existing = new Set(txs.map(t => `${t.date}-${t.amount}-${t.description.slice(0,20)}`));
      const fresh = parsed.filter(t => !existing.has(`${t.date}-${t.amount}-${t.description.slice(0,20)}`));
      const bank = form.bank || "Importado";
      const withBank = fresh.map(t => ({ ...t, bank }));
      setTxs(p => [...withBank, ...p].sort((a, b) => b.date.localeCompare(a.date)));
      setImportStatus(`✓ ${fresh.length} novas transações importadas (${parsed.length - fresh.length} duplicadas ignoradas)`);
      setTimeout(() => { setShowImport(false); setImportStatus(""); }, 2500);
    } catch (err) {
      setImportStatus("Erro: " + err.message);
    }
    e.target.value = "";
  };

  // Filter by month
  const monthTxs = txs.filter(t => t.date.startsWith(monthFilter));
  const entradas = monthTxs.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const saidas = Math.abs(monthTxs.filter(t => t.amount < 0).reduce((s, t) => s + t.amount, 0));
  const saldo = entradas - saidas;

  // Spending by category
  const byCat = {};
  monthTxs.filter(t => t.amount < 0).forEach(t => {
    byCat[t.category] = (byCat[t.category] || 0) + Math.abs(t.amount);
  });
  const byCatArr = Object.entries(byCat).sort((a, b) => b[1] - a[1]);

  // Month options (last 12 months with data + current)
  const months = new Set([todayStr().slice(0, 7)]);
  txs.forEach(t => months.add(t.date.slice(0, 7)));
  const monthList = [...months].sort().reverse().slice(0, 12);

  const txForm = (
    <>
      <Field label="Data"><input type="date" value={form.date} onChange={e => setForm(f => ({...f, date: e.target.value}))} style={iStyle} /></Field>
      <Field label="Descrição"><input value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value, category: catFromDesc(e.target.value)}))} style={iStyle} placeholder="Ex: Supermercado Extra" /></Field>
      <Field label="Valor (+ entrada / - saída)"><input type="number" step="0.01" value={form.amount} onChange={e => setForm(f => ({...f, amount: e.target.value}))} style={iStyle} placeholder="-150.00" /></Field>
      <Field label="Categoria">
        <select value={form.category} onChange={e => setForm(f => ({...f, category: e.target.value}))} style={iStyle}>
          {Object.entries(catLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </Field>
      <Field label="Banco/Origem">
        <select value={form.bank} onChange={e => setForm(f => ({...f, bank: e.target.value}))} style={iStyle}>
          <option>Manual</option><option>Nubank</option><option>Itaú</option><option>XP</option><option>Outro</option>
        </select>
      </Field>
    </>
  );

  return (
    <div>
      {/* Month selector */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14, overflowX: "auto", paddingBottom: 4 }}>
        {monthList.map(m => {
          const [y, mo] = m.split("-");
          const label = new Date(+y, +mo - 1).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
          return <Pill key={m} label={label} active={monthFilter === m} onClick={() => setMonthFilter(m)} />;
        })}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        {[["resumo","Resumo"],["transacoes","Transações"],["orcamento","Orçamento"]].map(([k,l]) => (
          <Pill key={k} label={l} active={tab===k} onClick={() => setTab(k)} />
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <Btn onClick={() => { setForm({ date: todayStr(), description: "", amount: "", category: "outros", bank: "Manual" }); setShowAdd(true); }} style={{ flex: 1, fontSize: 12, padding: "9px 12px" }}>＋ Transação</Btn>
        <Btn onClick={() => setShowImport(true)} outline style={{ flex: 1, fontSize: 12, padding: "9px 12px" }}>📁 Importar</Btn>
      </div>

      {tab === "resumo" && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
            <StatCard label="Entradas" val={fmt(entradas)} bg={C.mint} emoji="✨" />
            <StatCard label="Saídas" val={fmt(saidas)} bg={C.pink} emoji="🌷" />
            <StatCard label="Saldo do mês" val={fmt(saldo)} bg={saldo >= 0 ? C.blue : C.peach} emoji={saldo >= 0 ? "🌸" : "⚠️"} />
            <StatCard label="Transações" val={monthTxs.length} bg={C.lavender} emoji="📊" />
          </div>

          {byCatArr.length > 0 && (
            <div style={{ background: "rgba(180,160,210,0.06)", borderRadius: 18, padding: 14, marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: C.mid, fontFamily: font, marginBottom: 10 }}>Gastos por categoria ✦</div>
              {byCatArr.map(([cat, val]) => {
                const budget = budgets[cat] || 0;
                const over = budget > 0 && val > budget;
                return (
                  <div key={cat} style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 11, color: C.dark, fontFamily: font, fontWeight: 600 }}>{catLabels[cat]}</span>
                      <span style={{ fontSize: 10, color: over ? C.danger : C.mid, fontFamily: font, fontWeight: over ? 700 : 500 }}>
                        {fmt(val)}{budget > 0 && ` / ${fmt(budget)}`}
                      </span>
                    </div>
                    <ProgressBar value={val} max={budget || byCatArr[0][1]} color={over ? `linear-gradient(90deg, ${C.danger}, ${C.rose})` : `linear-gradient(90deg, ${catColors[cat]}, ${C.rose})`} height={5} />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === "transacoes" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {monthTxs.length === 0 && <EmptyState emoji="🌸" title="Nenhuma transação" desc="Adicione manualmente ou importe um extrato" />}
          {monthTxs.map(t => (
            <div key={t.id} onClick={() => { setEditTx(t); setForm({ ...t, amount: String(t.amount) }); }} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "11px 14px", borderRadius: 14, cursor: "pointer",
              background: t.amount > 0 ? "rgba(212,240,232,0.55)" : "rgba(252,228,236,0.55)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
                <span style={{ fontSize: 18 }}>{catEmoji(t.description)}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: C.dark, fontFamily: font, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.description}</div>
                  <div style={{ fontSize: 10, color: C.light, fontFamily: font }}>{t.bank} · {new Date(t.date + "T00:00:00").toLocaleDateString("pt-BR")}</div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontWeight: 700, fontSize: 13, color: t.amount > 0 ? C.success : "#e17b8a", fontFamily: font }}>
                  {t.amount > 0 ? "+" : ""}R$ {Math.abs(t.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </span>
                <IconBtn icon="✕" onClick={(e) => { e.stopPropagation(); removeTx(t.id); }} size={22} danger />
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "orcamento" && (
        <div>
          <div style={{ fontSize: 11, color: C.mid, fontFamily: font, marginBottom: 12 }}>Defina limites mensais por categoria ✦</div>
          {Object.entries(catLabels).filter(([k]) => k !== "salario" && k !== "investimento").map(([k, label]) => (
            <div key={k} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <span style={{ fontSize: 11, color: C.dark, fontFamily: font, flex: 1 }}>{label}</span>
              <input type="number" value={budgets[k] || 0} onChange={e => setBudgets(b => ({...b, [k]: parseFloat(e.target.value) || 0}))} style={{...iStyle, width: 110, textAlign: "right", padding: "8px 10px"}} />
            </div>
          ))}
        </div>
      )}

      {/* Add/edit transaction modal */}
      <Modal open={showAdd || !!editTx} onClose={() => { setShowAdd(false); setEditTx(null); }} title={editTx ? "Editar transação" : "Nova transação"}>
        {txForm}
        <Btn full onClick={editTx ? saveEdit : addTx}>{editTx ? "Salvar" : "Adicionar"} ✦</Btn>
      </Modal>

      {/* Import modal */}
      <Modal open={showImport} onClose={() => { setShowImport(false); setImportStatus(""); }} title="Importar extrato">
        <div style={{ fontSize: 12, color: C.mid, fontFamily: font, lineHeight: 1.6, marginBottom: 14 }}>
          Aceita arquivos <b>OFX</b> (Itaú, XP) e <b>CSV</b> (Nubank). As transações duplicadas são ignoradas automaticamente ✦
        </div>
        <Field label="Banco de origem">
          <select value={form.bank} onChange={e => setForm(f => ({...f, bank: e.target.value}))} style={iStyle}>
            <option>Nubank</option><option>Itaú</option><option>XP</option><option>Outro</option>
          </select>
        </Field>
        <input ref={fileRef} type="file" accept=".ofx,.csv,.txt" onChange={handleFile} style={{ display: "none" }} />
        <Btn full onClick={() => fileRef.current?.click()}>📁 Escolher arquivo</Btn>
        {importStatus && (
          <div style={{ marginTop: 14, padding: 12, background: importStatus.startsWith("✓") ? "rgba(212,240,232,0.5)" : "rgba(242,139,158,0.1)", borderRadius: 12, fontSize: 11, color: C.dark, fontFamily: font, textAlign: "center" }}>
            {importStatus}
          </div>
        )}
        <div style={{ marginTop: 16, fontSize: 10, color: C.light, fontFamily: font, lineHeight: 1.5 }}>
          <b>Como exportar:</b><br/>
          <b>Nubank:</b> app → Conta → ⚙️ → Exportar extrato → CSV<br/>
          <b>Itaú:</b> Internet Banking → Extrato → Exportar OFX<br/>
          <b>XP:</b> Portal → Extrato → Exportar CSV
        </div>
      </Modal>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CALENDÁRIO
// ═══════════════════════════════════════════════════════════════════════════════
const eventTypes = {
  prova: { label: "Prova", emoji: "📝", color: C.pink },
  medico: { label: "Médico", emoji: "🏥", color: C.mint },
  trabalho: { label: "Trabalho", emoji: "💼", color: C.blue },
  pessoal: { label: "Pessoal", emoji: "🌸", color: C.lavender },
  evento: { label: "Evento", emoji: "🎉", color: C.butter },
  aniversario: { label: "Aniversário", emoji: "🎂", color: C.peach },
};

function CalendarioSection() {
  const [events, setEvents] = useState([{id:1,title:"Prova Cálculo Atuarial",date:"2026-04-18",time:"14:00",type:"prova",location:"FFLCH",notes:""},{id:2,title:"Consulta dermatologista",date:"2026-04-22",time:"10:30",type:"medico",location:"Clínica Bem Estar",notes:""},{id:3,title:"Aniversário da Lari",date:"2026-04-25",time:"19:00",type:"aniversario",location:"",notes:"Levar presente"},{id:4,title:"Entrega relatório pricing",date:"2026-04-30",time:"18:00",type:"trabalho",location:"",notes:""},{id:5,title:"Show Pitty",date:"2026-05-03",time:"21:00",type:"evento",location:"Vibra SP",notes:""}]);
  const [curMonth, setCurMonth] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [showAdd, setShowAdd] = useState(false);
  const [editEv, setEditEv] = useState(null);
  const [form, setForm] = useState({ title: "", date: todayStr(), time: "", type: "pessoal", notes: "", location: "" });

  useEffect(() => { save(SK.events, events); }, [events]);

  const addEvent = () => {
    if (!form.title.trim()) return;
    setEvents(p => [...p, { ...form, id: Date.now() }]);
    setShowAdd(false);
  };
  const saveEdit = () => {
    setEvents(p => p.map(e => e.id === editEv.id ? { ...form, id: editEv.id } : e));
    setEditEv(null);
  };
  const removeEv = id => setEvents(p => p.filter(e => e.id !== id));

  // Build month grid
  const firstDay = new Date(curMonth.y, curMonth.m, 1);
  const lastDay = new Date(curMonth.y, curMonth.m + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startDow = firstDay.getDay();
  const cells = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${curMonth.y}-${String(curMonth.m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({ day: d, date: dateStr });
  }

  const eventsByDate = {};
  events.forEach(e => { if (!eventsByDate[e.date]) eventsByDate[e.date] = []; eventsByDate[e.date].push(e); });

  const monthName = firstDay.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const selectedEvents = (eventsByDate[selectedDate] || []).sort((a, b) => (a.time || "").localeCompare(b.time || ""));

  // Upcoming events
  const upcoming = events.filter(e => e.date >= todayStr()).sort((a, b) => a.date.localeCompare(b.date) || (a.time || "").localeCompare(b.time || "")).slice(0, 5);

  const evForm = (
    <>
      <Field label="Título"><input value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))} style={iStyle} placeholder="Ex: Prova de Estatística" autoFocus /></Field>
      <Field label="Tipo">
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {Object.entries(eventTypes).map(([k, v]) => (
            <Pill key={k} label={`${v.emoji} ${v.label}`} active={form.type === k} onClick={() => setForm(f => ({...f, type: k}))} color={v.color} />
          ))}
        </div>
      </Field>
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}><Field label="Data"><input type="date" value={form.date} onChange={e => setForm(f => ({...f, date: e.target.value}))} style={iStyle} /></Field></div>
        <div style={{ flex: 1 }}><Field label="Hora"><input type="time" value={form.time} onChange={e => setForm(f => ({...f, time: e.target.value}))} style={iStyle} /></Field></div>
      </div>
      <Field label="Local"><input value={form.location} onChange={e => setForm(f => ({...f, location: e.target.value}))} style={iStyle} placeholder="Opcional" /></Field>
      <Field label="Notas"><textarea value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} rows={3} style={{...iStyle, resize: "vertical"}} placeholder="Detalhes, lembretes..." /></Field>
    </>
  );

  return (
    <div>
      {/* Upcoming */}
      {upcoming.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: C.mid, fontFamily: font, marginBottom: 8 }}>Próximos ✦</div>
          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
            {upcoming.map(e => {
              const t = eventTypes[e.type];
              return (
                <div key={e.id} onClick={() => { setSelectedDate(e.date); const d = new Date(e.date + "T00:00:00"); setCurMonth({ y: d.getFullYear(), m: d.getMonth() }); }}
                  style={{ background: t.color, borderRadius: 14, padding: "10px 12px", minWidth: 130, flexShrink: 0, cursor: "pointer", border: "1px solid rgba(255,255,255,0.8)" }}>
                  <div style={{ fontSize: 14, marginBottom: 2 }}>{t.emoji}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.dark, fontFamily: font, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.title}</div>
                  <div style={{ fontSize: 9, color: C.mid, fontFamily: font }}>{dateLabel(e.date)}{e.time && ` · ${e.time}`}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Month nav */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <IconBtn icon="‹" onClick={() => setCurMonth(m => m.m === 0 ? { y: m.y - 1, m: 11 } : { y: m.y, m: m.m - 1 })} size={30} />
        <span style={{ fontFamily: serif, fontSize: 15, fontWeight: 700, color: C.dark, textTransform: "capitalize" }}>{monthName}</span>
        <IconBtn icon="›" onClick={() => setCurMonth(m => m.m === 11 ? { y: m.y + 1, m: 0 } : { y: m.y, m: m.m + 1 })} size={30} />
      </div>

      {/* Day headers */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 6 }}>
        {["D","S","T","Q","Q","S","S"].map((d, i) => (
          <div key={i} style={{ textAlign: "center", fontSize: 10, color: C.light, fontFamily: font, fontWeight: 600 }}>{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 18 }}>
        {cells.map((c, i) => {
          if (!c) return <div key={i} />;
          const dayEvents = eventsByDate[c.date] || [];
          const isToday = c.date === todayStr();
          const isSelected = c.date === selectedDate;
          return (
            <div key={i} onClick={() => setSelectedDate(c.date)} style={{
              aspectRatio: "1", borderRadius: 10, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", cursor: "pointer", position: "relative",
              background: isSelected ? C.deep : isToday ? C.pink : "rgba(255,255,255,0.5)",
              border: isToday && !isSelected ? `1.5px solid ${C.deep}` : "1px solid rgba(255,255,255,0.8)",
              transition: "all 0.15s",
            }}>
              <span style={{ fontSize: 12, fontWeight: isToday || isSelected ? 700 : 500, color: isSelected ? "#fff" : C.dark, fontFamily: font }}>{c.day}</span>
              {dayEvents.length > 0 && (
                <div style={{ display: "flex", gap: 2, marginTop: 2, position: "absolute", bottom: 4 }}>
                  {dayEvents.slice(0, 3).map((e, j) => (
                    <div key={j} style={{ width: 4, height: 4, borderRadius: "50%", background: isSelected ? "#fff" : eventTypes[e.type].color, border: isSelected ? "none" : "1px solid rgba(0,0,0,0.1)" }} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Selected day events */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: C.dark, fontFamily: font }}>
            {new Date(selectedDate + "T00:00:00").toLocaleDateString("pt-BR", { day: "numeric", month: "long" })}
          </span>
          <Btn onClick={() => { setForm({ title: "", date: selectedDate, time: "", type: "pessoal", notes: "", location: "" }); setShowAdd(true); }} style={{ padding: "7px 12px", fontSize: 11 }}>＋</Btn>
        </div>
        {selectedEvents.length === 0 && <EmptyState emoji="🌤️" title="Dia livre" desc="Nenhum evento nesse dia" />}
        {selectedEvents.map(e => {
          const t = eventTypes[e.type];
          return (
            <div key={e.id} onClick={() => { setForm({ ...e }); setEditEv(e); }} style={{
              display: "flex", alignItems: "flex-start", gap: 10, padding: "11px 13px",
              background: t.color, borderRadius: 14, marginBottom: 8, cursor: "pointer",
              border: "1px solid rgba(255,255,255,0.8)",
            }}>
              <span style={{ fontSize: 20 }}>{t.emoji}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.dark, fontFamily: font }}>{e.title}</div>
                {(e.time || e.location) && <div style={{ fontSize: 10, color: C.mid, fontFamily: font, marginTop: 2 }}>{e.time}{e.time && e.location && " · "}{e.location}</div>}
                {e.notes && <div style={{ fontSize: 10, color: C.mid, fontFamily: font, marginTop: 3, lineHeight: 1.5 }}>{e.notes}</div>}
              </div>
              <IconBtn icon="✕" onClick={(ev) => { ev.stopPropagation(); removeEv(e.id); }} size={22} danger />
            </div>
          );
        })}
      </div>

      <Modal open={showAdd || !!editEv} onClose={() => { setShowAdd(false); setEditEv(null); }} title={editEv ? "Editar evento" : "Novo evento"}>
        {evForm}
        <Btn full onClick={editEv ? saveEdit : addEvent}>{editEv ? "Salvar" : "Adicionar"} ✦</Btn>
      </Modal>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// WISHLIST (com fotos)
// ═══════════════════════════════════════════════════════════════════════════════
const wishPriorities = { alta: "Muito quero!", media: "Quero", baixa: "Um dia..." };
const wishStatus = { quero: "Quero", comprei: "Comprei", desisti: "Desisti" };

function WishlistSection() {
  const [items, setItems] = useState([{id:1,name:"Tinta óleo Winsor Newton",price:"289",url:"https://amazon.com.br",photo:"",priority:"alta",status:"quero",notes:"Kit 12 cores",category:"Arte",ts:1712000000},{id:2,name:"Livro The Artist Way",price:"79",url:"",photo:"",priority:"media",status:"quero",notes:"",category:"Livros",ts:1711900000},{id:3,name:"Tablet Wacom Intuos",price:"850",url:"https://wacom.com",photo:"",priority:"alta",status:"quero",notes:"Tamanho M",category:"Arte",ts:1711800000},{id:4,name:"Blusa Sanrio collab",price:"149",url:"",photo:"",priority:"baixa",status:"comprei",notes:"",category:"Roupa",ts:1711700000}]);
  const [showAdd, setShowAdd] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ name: "", price: "", url: "", photo: "", priority: "media", status: "quero", notes: "", category: "" });
  const [filter, setFilter] = useState("quero");
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => { save(SK.wishlist, items); }, [items]);

  const handlePhoto = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const resized = await resizeImage(file, 500);
      setForm(f => ({ ...f, photo: resized }));
    } catch (err) {
      alert("Erro ao processar imagem");
    }
    setUploading(false);
    e.target.value = "";
  };

  const addItem = () => {
    if (!form.name.trim()) return;
    setItems(p => [{ ...form, id: Date.now(), ts: Date.now() }, ...p]);
    setShowAdd(false);
  };
  const saveEdit = () => {
    setItems(p => p.map(i => i.id === editItem.id ? { ...form, id: editItem.id, ts: editItem.ts } : i));
    setEditItem(null);
  };
  const remove = id => setItems(p => p.filter(i => i.id !== id));
  const markBought = id => setItems(p => p.map(i => i.id === id ? { ...i, status: "comprei" } : i));

  const filtered = items.filter(i => filter === "todos" ? true : i.status === filter);
  const totalWish = items.filter(i => i.status === "quero").reduce((s, i) => s + (parseFloat(i.price) || 0), 0);

  const wForm = (
    <>
      {/* Photo */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
        <div onClick={() => fileRef.current?.click()} style={{
          width: 140, height: 140, borderRadius: 18, cursor: "pointer",
          background: form.photo ? `url(${form.photo}) center/cover` : `linear-gradient(135deg, ${C.pink}, ${C.lavender})`,
          border: "1.5px dashed rgba(248,187,208,0.5)",
          display: "flex", alignItems: "center", justifyContent: "center",
          position: "relative", overflow: "hidden",
        }}>
          {!form.photo && (
            <div style={{ textAlign: "center", color: "#fff" }}>
              <div style={{ fontSize: 30 }}>📷</div>
              <div style={{ fontSize: 10, fontFamily: font, marginTop: 4 }}>{uploading ? "Carregando..." : "Adicionar foto"}</div>
            </div>
          )}
          {form.photo && (
            <button onClick={(e) => { e.stopPropagation(); setForm(f => ({...f, photo: ""})); }} style={{
              position: "absolute", top: 6, right: 6, width: 26, height: 26, borderRadius: "50%",
              border: "none", background: "rgba(0,0,0,0.5)", color: "#fff", fontSize: 12, cursor: "pointer",
            }}>✕</button>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" onChange={handlePhoto} style={{ display: "none" }} />
      </div>
      <Field label="Nome"><input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} style={iStyle} placeholder="Ex: Tinta a óleo Winsor & Newton" autoFocus /></Field>
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}><Field label="Preço (R$)"><input type="number" step="0.01" value={form.price} onChange={e => setForm(f => ({...f, price: e.target.value}))} style={iStyle} /></Field></div>
        <div style={{ flex: 1 }}><Field label="Categoria"><input value={form.category} onChange={e => setForm(f => ({...f, category: e.target.value}))} style={iStyle} placeholder="Arte, roupa..." /></Field></div>
      </div>
      <Field label="Link"><input value={form.url} onChange={e => setForm(f => ({...f, url: e.target.value}))} style={iStyle} placeholder="https://..." /></Field>
      <Field label="Prioridade">
        <div style={{ display: "flex", gap: 6 }}>
          {Object.entries(wishPriorities).map(([k, v]) => <Pill key={k} label={v} active={form.priority === k} onClick={() => setForm(f => ({...f, priority: k}))} />)}
        </div>
      </Field>
      <Field label="Notas"><textarea value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} rows={2} style={{...iStyle, resize: "vertical"}} placeholder="Tamanho, cor, especificações..." /></Field>
    </>
  );

  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
        <StatCard label="Querendo" val={items.filter(i => i.status === "quero").length} bg={C.pink} emoji="💝" />
        <StatCard label="Total $" val={fmt(totalWish)} bg={C.butter} emoji="💰" />
        <StatCard label="Comprados" val={items.filter(i => i.status === "comprei").length} bg={C.mint} emoji="✓" />
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        {Object.entries({ quero: "Quero", comprei: "Comprei", desisti: "Desisti", todos: "Todos" }).map(([k, v]) => (
          <Pill key={k} label={v} active={filter === k} onClick={() => setFilter(k)} />
        ))}
      </div>

      <Btn onClick={() => { setForm({ name: "", price: "", url: "", photo: "", priority: "media", status: "quero", notes: "", category: "" }); setShowAdd(true); }} full style={{ marginBottom: 14 }}>＋ Novo desejo ✦</Btn>

      {filtered.length === 0 && <EmptyState emoji="💝" title="Lista vazia" desc="Adicione seus desejos com foto, preço e link" />}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {filtered.sort((a, b) => b.ts - a.ts).map(item => (
          <div key={item.id} onClick={() => { setForm({ ...item }); setEditItem(item); }} style={{
            background: "#fff", borderRadius: 18, overflow: "hidden", cursor: "pointer",
            border: "1.5px solid rgba(255,255,255,0.9)", boxShadow: "0 2px 12px rgba(180,160,210,0.08)",
          }}>
            <div style={{
              width: "100%", aspectRatio: "1",
              background: item.photo ? `url(${item.photo}) center/cover` : `linear-gradient(135deg, ${C.pink}, ${C.lavender})`,
              position: "relative",
              opacity: item.status === "desisti" ? 0.4 : 1,
            }}>
              {!item.photo && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40, color: "#fff" }}>💝</div>}
              {item.status === "comprei" && <div style={{ position: "absolute", top: 6, right: 6, background: C.success, color: "#fff", padding: "3px 8px", borderRadius: 99, fontSize: 9, fontFamily: font, fontWeight: 700 }}>✓ Comprei</div>}
              {item.priority === "alta" && item.status === "quero" && <div style={{ position: "absolute", top: 6, left: 6, fontSize: 16 }}>⭐</div>}
            </div>
            <div style={{ padding: "10px 12px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.dark, fontFamily: font, marginBottom: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</div>
              {item.price && <div style={{ fontSize: 11, color: C.deep, fontFamily: serif, fontWeight: 700 }}>R$ {parseFloat(item.price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>}
              <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
                {item.status === "quero" && (
                  <button onClick={(e) => { e.stopPropagation(); markBought(item.id); }} style={{ flex: 1, padding: "5px", borderRadius: 8, border: "none", background: C.mint, color: C.dark, fontSize: 9, fontFamily: font, fontWeight: 600, cursor: "pointer" }}>✓ Comprei</button>
                )}
                {item.url && (
                  <a href={item.url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ flex: 1, padding: "5px", borderRadius: 8, background: C.lavender, color: C.dark, fontSize: 9, fontFamily: font, fontWeight: 600, textAlign: "center", textDecoration: "none" }}>🔗 Link</a>
                )}
                <IconBtn icon="✕" onClick={(e) => { e.stopPropagation(); remove(item.id); }} size={22} danger />
              </div>
            </div>
          </div>
        ))}
      </div>

      <Modal open={showAdd || !!editItem} onClose={() => { setShowAdd(false); setEditItem(null); }} title={editItem ? "Editar desejo" : "Novo desejo"}>
        {wForm}
        <Btn full onClick={editItem ? saveEdit : addItem}>{editItem ? "Salvar" : "Adicionar"} ✦</Btn>
      </Modal>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SAÚDE
// ═══════════════════════════════════════════════════════════════════════════════
function SaudeSection() {
  const [data, setData] = useState({consultas:[{id:1,doctor:"Dra. Ana Lima",specialty:"Dermatologia",date:"2026-04-22",time:"10:30",location:"Clínica Bem Estar",notes:"Rotina"},{id:2,doctor:"Dr. Carlos Mendes",specialty:"Clínico Geral",date:"2026-05-10",time:"09:00",location:"UBS Centro",notes:""}],medicacoes:[{id:1,name:"Roacutan",dose:"20mg",freq:"1x ao dia",time:"20:00",notes:"Com comida"},{id:2,name:"Vitamina D",dose:"2000UI",freq:"1x ao dia",time:"08:00",notes:""}],exames:[{id:1,name:"Hemograma completo",date:"2026-03-15",lab:"Fleury",result:"Tudo normal",notes:""}]});
  const [tab, setTab] = useState("consultas");
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});

  useEffect(() => { save(SK.saude, data); }, [data]);

  const openAdd = () => {
    const defaults = {
      consultas: { title: "", date: todayStr(), time: "", doctor: "", specialty: "", location: "", notes: "" },
      medicacoes: { name: "", dose: "", frequency: "diária", time: "", startDate: todayStr(), notes: "" },
      exames: { name: "", date: todayStr(), result: "", lab: "", notes: "" },
    };
    setForm(defaults[tab]);
    setEditing(null);
    setShowAdd(true);
  };

  const openEdit = (item) => { setForm({ ...item }); setEditing(item); setShowAdd(true); };

  const save_ = () => {
    if (tab === "consultas" && !form.title) return;
    if (tab === "medicacoes" && !form.name) return;
    if (tab === "exames" && !form.name) return;
    if (editing) {
      setData(d => ({ ...d, [tab]: d[tab].map(x => x.id === editing.id ? { ...form, id: editing.id } : x) }));
    } else {
      setData(d => ({ ...d, [tab]: [...d[tab], { ...form, id: Date.now() }] }));
    }
    setShowAdd(false);
  };

  const remove = (id) => setData(d => ({ ...d, [tab]: d[tab].filter(x => x.id !== id) }));

  const list = data[tab] || [];

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {[["consultas","🏥 Consultas"],["medicacoes","💊 Medicações"],["exames","🔬 Exames"]].map(([k, l]) => (
          <Pill key={k} label={l} active={tab === k} onClick={() => setTab(k)} />
        ))}
      </div>

      <Btn onClick={openAdd} full style={{ marginBottom: 14 }}>＋ Adicionar</Btn>

      {list.length === 0 && <EmptyState emoji="🌿" title="Nada registrado" desc="Adicione consultas, medicações e exames" />}

      {tab === "consultas" && list.sort((a, b) => (b.date || "").localeCompare(a.date || "")).map(c => (
        <div key={c.id} onClick={() => openEdit(c)} style={{ padding: "13px 15px", background: C.mint, borderRadius: 16, marginBottom: 8, cursor: "pointer", border: "1px solid rgba(255,255,255,0.8)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.dark, fontFamily: font }}>{c.title}</div>
              {c.doctor && <div style={{ fontSize: 11, color: C.mid, fontFamily: font, marginTop: 2 }}>{c.doctor}{c.specialty && ` · ${c.specialty}`}</div>}
              <div style={{ fontSize: 10, color: C.mid, fontFamily: font, marginTop: 3 }}>
                {c.date && dateLabel(c.date)}{c.time && ` · ${c.time}`}{c.location && ` · ${c.location}`}
              </div>
              {c.notes && <div style={{ fontSize: 10, color: C.mid, fontFamily: font, marginTop: 5, lineHeight: 1.5 }}>{c.notes}</div>}
            </div>
            <IconBtn icon="✕" onClick={(e) => { e.stopPropagation(); remove(c.id); }} size={22} danger />
          </div>
        </div>
      ))}

      {tab === "medicacoes" && list.map(m => (
        <div key={m.id} onClick={() => openEdit(m)} style={{ padding: "13px 15px", background: C.pink, borderRadius: 16, marginBottom: 8, cursor: "pointer", border: "1px solid rgba(255,255,255,0.8)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 16 }}>💊</span>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.dark, fontFamily: font }}>{m.name}</div>
              </div>
              {m.dose && <div style={{ fontSize: 11, color: C.mid, fontFamily: font, marginTop: 3 }}>{m.dose} · {m.frequency}{m.time && ` às ${m.time}`}</div>}
              {m.notes && <div style={{ fontSize: 10, color: C.mid, fontFamily: font, marginTop: 5, lineHeight: 1.5 }}>{m.notes}</div>}
            </div>
            <IconBtn icon="✕" onClick={(e) => { e.stopPropagation(); remove(m.id); }} size={22} danger />
          </div>
        </div>
      ))}

      {tab === "exames" && list.sort((a, b) => (b.date || "").localeCompare(a.date || "")).map(ex => (
        <div key={ex.id} onClick={() => openEdit(ex)} style={{ padding: "13px 15px", background: C.lavender, borderRadius: 16, marginBottom: 8, cursor: "pointer", border: "1px solid rgba(255,255,255,0.8)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 16 }}>🔬</span>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.dark, fontFamily: font }}>{ex.name}</div>
              </div>
              {ex.date && <div style={{ fontSize: 10, color: C.mid, fontFamily: font, marginTop: 3 }}>{dateLabel(ex.date)}{ex.lab && ` · ${ex.lab}`}</div>}
              {ex.result && <div style={{ fontSize: 11, color: C.dark, fontFamily: font, marginTop: 5, lineHeight: 1.5, fontWeight: 500 }}>{ex.result}</div>}
              {ex.notes && <div style={{ fontSize: 10, color: C.mid, fontFamily: font, marginTop: 3, lineHeight: 1.5 }}>{ex.notes}</div>}
            </div>
            <IconBtn icon="✕" onClick={(e) => { e.stopPropagation(); remove(ex.id); }} size={22} danger />
          </div>
        </div>
      ))}

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title={editing ? "Editar" : "Adicionar"}>
        {tab === "consultas" && (
          <>
            <Field label="Motivo / Título"><input value={form.title || ""} onChange={e => setForm(f => ({...f, title: e.target.value}))} style={iStyle} placeholder="Ex: Check-up anual" autoFocus /></Field>
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1 }}><Field label="Data"><input type="date" value={form.date || ""} onChange={e => setForm(f => ({...f, date: e.target.value}))} style={iStyle} /></Field></div>
              <div style={{ flex: 1 }}><Field label="Hora"><input type="time" value={form.time || ""} onChange={e => setForm(f => ({...f, time: e.target.value}))} style={iStyle} /></Field></div>
            </div>
            <Field label="Médico(a)"><input value={form.doctor || ""} onChange={e => setForm(f => ({...f, doctor: e.target.value}))} style={iStyle} /></Field>
            <Field label="Especialidade"><input value={form.specialty || ""} onChange={e => setForm(f => ({...f, specialty: e.target.value}))} style={iStyle} /></Field>
            <Field label="Local"><input value={form.location || ""} onChange={e => setForm(f => ({...f, location: e.target.value}))} style={iStyle} /></Field>
            <Field label="Notas"><textarea value={form.notes || ""} onChange={e => setForm(f => ({...f, notes: e.target.value}))} rows={3} style={{...iStyle, resize: "vertical"}} /></Field>
          </>
        )}
        {tab === "medicacoes" && (
          <>
            <Field label="Nome"><input value={form.name || ""} onChange={e => setForm(f => ({...f, name: e.target.value}))} style={iStyle} autoFocus /></Field>
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1 }}><Field label="Dose"><input value={form.dose || ""} onChange={e => setForm(f => ({...f, dose: e.target.value}))} style={iStyle} placeholder="10mg" /></Field></div>
              <div style={{ flex: 1 }}><Field label="Hora"><input type="time" value={form.time || ""} onChange={e => setForm(f => ({...f, time: e.target.value}))} style={iStyle} /></Field></div>
            </div>
            <Field label="Frequência">
              <select value={form.frequency || "diária"} onChange={e => setForm(f => ({...f, frequency: e.target.value}))} style={iStyle}>
                <option>diária</option><option>2x ao dia</option><option>3x ao dia</option><option>semanal</option><option>conforme necessidade</option>
              </select>
            </Field>
            <Field label="Notas"><textarea value={form.notes || ""} onChange={e => setForm(f => ({...f, notes: e.target.value}))} rows={2} style={{...iStyle, resize: "vertical"}} /></Field>
          </>
        )}
        {tab === "exames" && (
          <>
            <Field label="Nome do exame"><input value={form.name || ""} onChange={e => setForm(f => ({...f, name: e.target.value}))} style={iStyle} autoFocus /></Field>
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1 }}><Field label="Data"><input type="date" value={form.date || ""} onChange={e => setForm(f => ({...f, date: e.target.value}))} style={iStyle} /></Field></div>
              <div style={{ flex: 1 }}><Field label="Laboratório"><input value={form.lab || ""} onChange={e => setForm(f => ({...f, lab: e.target.value}))} style={iStyle} /></Field></div>
            </div>
            <Field label="Resultado"><textarea value={form.result || ""} onChange={e => setForm(f => ({...f, result: e.target.value}))} rows={3} style={{...iStyle, resize: "vertical"}} placeholder="Resumo dos valores..." /></Field>
            <Field label="Notas"><textarea value={form.notes || ""} onChange={e => setForm(f => ({...f, notes: e.target.value}))} rows={2} style={{...iStyle, resize: "vertical"}} /></Field>
          </>
        )}
        <Btn full onClick={save_}>{editing ? "Salvar" : "Adicionar"} ✦</Btn>
      </Modal>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MÍDIA (livros, filmes, séries)
// ═══════════════════════════════════════════════════════════════════════════════
const mediaTypes = {
  livro: { label: "Livros", emoji: "📚" },
  filme: { label: "Filmes", emoji: "🎬" },
  serie: { label: "Séries", emoji: "📺" },
};
const mediaStatuses = {
  quero: "Quero ver",
  assistindo: "Vendo",
  concluido: "Concluído",
};

function MidiaSection() {
  const [items, setItems] = useState([{id:1,title:"A Hora da Estrela",type:"livro",status:"concluido",rating:5,photo:"",author:"Clarice Lispector",notes:"Lindo demais",ts:1712000000},{id:2,title:"Fleabag",type:"serie",status:"concluido",rating:5,photo:"",author:"Phoebe Waller-Bridge",notes:"Perfeita",ts:1711900000},{id:3,title:"Saltburn",type:"filme",status:"concluido",rating:4,photo:"",author:"Emerald Fennell",notes:"Intrigante",ts:1711800000},{id:4,title:"Normal People",type:"serie",status:"assistindo",rating:0,photo:"",author:"Sally Rooney",notes:"",ts:1711700000},{id:5,title:"Lolita",type:"livro",status:"quero",rating:0,photo:"",author:"Vladimir Nabokov",notes:"",ts:1711600000}]);
  const [tab, setTab] = useState("livro");
  const [filter, setFilter] = useState("todos");
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ title: "", type: "livro", status: "quero", rating: 0, photo: "", author: "", notes: "" });
  const fileRef = useRef(null);

  useEffect(() => { save(SK.midia, items); }, [items]);

  const handlePhoto = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const resized = await resizeImage(file, 400);
    setForm(f => ({ ...f, photo: resized }));
    e.target.value = "";
  };

  const openAdd = () => { setForm({ title: "", type: tab, status: "quero", rating: 0, photo: "", author: "", notes: "" }); setEditing(null); setShowAdd(true); };
  const openEdit = (it) => { setForm({ ...it }); setEditing(it); setShowAdd(true); };

  const save_ = () => {
    if (!form.title.trim()) return;
    if (editing) setItems(p => p.map(i => i.id === editing.id ? { ...form, id: editing.id } : i));
    else setItems(p => [{ ...form, id: Date.now(), ts: Date.now() }, ...p]);
    setShowAdd(false);
  };
  const remove = id => setItems(p => p.filter(i => i.id !== id));

  const filtered = items.filter(i => i.type === tab && (filter === "todos" || i.status === filter));

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {Object.entries(mediaTypes).map(([k, v]) => (
          <Pill key={k} label={`${v.emoji} ${v.label}`} active={tab === k} onClick={() => setTab(k)} />
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        {Object.entries({ todos: "Todos", ...mediaStatuses }).map(([k, v]) => (
          <Pill key={k} label={v} active={filter === k} onClick={() => setFilter(k)} />
        ))}
      </div>

      <Btn onClick={openAdd} full style={{ marginBottom: 14 }}>＋ Adicionar {mediaTypes[tab].label.toLowerCase()}</Btn>

      {filtered.length === 0 && <EmptyState emoji={mediaTypes[tab].emoji} title="Vazio" desc={`Adicione ${mediaTypes[tab].label.toLowerCase()} que você quer ler/ver ou já viu`} />}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {filtered.map(it => (
          <div key={it.id} onClick={() => openEdit(it)} style={{
            background: "#fff", borderRadius: 16, overflow: "hidden", cursor: "pointer",
            border: "1.5px solid rgba(255,255,255,0.9)", boxShadow: "0 2px 12px rgba(180,160,210,0.08)",
          }}>
            <div style={{
              width: "100%", aspectRatio: "3/4",
              background: it.photo ? `url(${it.photo}) center/cover` : `linear-gradient(135deg, ${C.lavender}, ${C.pink})`,
              position: "relative",
            }}>
              {!it.photo && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, color: "#fff" }}>{mediaTypes[it.type].emoji}</div>}
              <div style={{ position: "absolute", top: 6, right: 6, background: "rgba(255,255,255,0.9)", padding: "3px 8px", borderRadius: 99, fontSize: 9, fontFamily: font, fontWeight: 600, color: C.dark }}>
                {mediaStatuses[it.status]}
              </div>
            </div>
            <div style={{ padding: "10px 12px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.dark, fontFamily: font, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.title}</div>
              {it.author && <div style={{ fontSize: 9, color: C.mid, fontFamily: font, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.author}</div>}
              {it.status === "concluido" && it.rating > 0 && (
                <div style={{ fontSize: 10, marginTop: 3 }}>{"⭐".repeat(it.rating)}</div>
              )}
            </div>
          </div>
        ))}
      </div>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title={editing ? "Editar" : `Novo ${mediaTypes[tab].label.slice(0, -1).toLowerCase()}`}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
          <div onClick={() => fileRef.current?.click()} style={{
            width: 100, height: 140, borderRadius: 12, cursor: "pointer",
            background: form.photo ? `url(${form.photo}) center/cover` : `linear-gradient(135deg, ${C.lavender}, ${C.pink})`,
            border: "1.5px dashed rgba(248,187,208,0.5)", display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {!form.photo && <div style={{ color: "#fff", fontSize: 24 }}>📷</div>}
          </div>
          <input ref={fileRef} type="file" accept="image/*" onChange={handlePhoto} style={{ display: "none" }} />
        </div>
        <Field label="Título"><input value={form.title || ""} onChange={e => setForm(f => ({...f, title: e.target.value}))} style={iStyle} autoFocus /></Field>
        <Field label={form.type === "livro" ? "Autor" : "Diretor / Criador"}><input value={form.author || ""} onChange={e => setForm(f => ({...f, author: e.target.value}))} style={iStyle} /></Field>
        <Field label="Status">
          <div style={{ display: "flex", gap: 6 }}>
            {Object.entries(mediaStatuses).map(([k, v]) => <Pill key={k} label={v} active={form.status === k} onClick={() => setForm(f => ({...f, status: k}))} />)}
          </div>
        </Field>
        {form.status === "concluido" && (
          <Field label="Avaliação">
            <div style={{ display: "flex", gap: 4 }}>
              {[1,2,3,4,5].map(n => (
                <button key={n} onClick={() => setForm(f => ({...f, rating: n === f.rating ? 0 : n}))} style={{ background: "none", border: "none", fontSize: 26, cursor: "pointer", padding: 0 }}>
                  {n <= (form.rating || 0) ? "⭐" : "☆"}
                </button>
              ))}
            </div>
          </Field>
        )}
        <Field label="Notas / Resenha"><textarea value={form.notes || ""} onChange={e => setForm(f => ({...f, notes: e.target.value}))} rows={3} style={{...iStyle, resize: "vertical"}} /></Field>
        <div style={{ display: "flex", gap: 8 }}>
          {editing && <Btn onClick={() => { remove(editing.id); setShowAdd(false); }} outline danger>Remover</Btn>}
          <Btn full onClick={save_}>{editing ? "Salvar" : "Adicionar"} ✦</Btn>
        </div>
      </Modal>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LUGARES (viagens e restaurantes pra visitar)
// ═══════════════════════════════════════════════════════════════════════════════
const placeTypes = {
  viagem: { label: "Viagem", emoji: "✈️", color: C.blue },
  restaurante: { label: "Restaurante", emoji: "🍽️", color: C.peach },
  cafe: { label: "Café", emoji: "☕", color: C.butter },
  cultural: { label: "Cultural", emoji: "🎭", color: C.lavender },
  natureza: { label: "Natureza", emoji: "🌿", color: C.mint },
  outro: { label: "Outro", emoji: "📍", color: C.pink },
};

function LugaresSection() {
  const [items, setItems] = useState([{id:1,name:"Tóquio",type:"viagem",city:"Japão",status:"quero",photo:"",notes:"Sanrio Puroland, Harajuku!"},{id:2,name:"Café Leiteria",type:"cafe",city:"São Paulo",status:"quero",photo:"",notes:"Viu no instagram"},{id:3,name:"Lisboa",type:"viagem",city:"Portugal",status:"visitei",photo:"",notes:"Incrível, quero voltar"},{id:4,name:"Museu de Arte Moderna",type:"cultural",city:"São Paulo",status:"quero",photo:"",notes:"Exposição nova em maio"}]);
  const [filter, setFilter] = useState("todos");
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", type: "viagem", city: "", status: "quero", photo: "", notes: "", url: "" });
  const fileRef = useRef(null);

  useEffect(() => { save(SK.lugares, items); }, [items]);

  const handlePhoto = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const resized = await resizeImage(file, 500);
    setForm(f => ({ ...f, photo: resized }));
    e.target.value = "";
  };

  const openAdd = () => { setForm({ name: "", type: "viagem", city: "", status: "quero", photo: "", notes: "", url: "" }); setEditing(null); setShowAdd(true); };
  const openEdit = (it) => { setForm({ ...it }); setEditing(it); setShowAdd(true); };

  const save_ = () => {
    if (!form.name.trim()) return;
    if (editing) setItems(p => p.map(i => i.id === editing.id ? { ...form, id: editing.id } : i));
    else setItems(p => [{ ...form, id: Date.now() }, ...p]);
    setShowAdd(false);
  };
  const remove = id => setItems(p => p.filter(i => i.id !== id));

  const filtered = items.filter(i => filter === "todos" || i.type === filter);

  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
        <StatCard label="Pra visitar" val={items.filter(i => i.status === "quero").length} bg={C.blue} emoji="✨" />
        <StatCard label="Visitei" val={items.filter(i => i.status === "visitei").length} bg={C.mint} emoji="✓" />
        <StatCard label="Total" val={items.length} bg={C.lavender} emoji="📍" />
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        <Pill label="Todos" active={filter === "todos"} onClick={() => setFilter("todos")} />
        {Object.entries(placeTypes).map(([k, v]) => (
          <Pill key={k} label={`${v.emoji} ${v.label}`} active={filter === k} onClick={() => setFilter(k)} />
        ))}
      </div>

      <Btn onClick={openAdd} full style={{ marginBottom: 14 }}>＋ Novo lugar</Btn>

      {filtered.length === 0 && <EmptyState emoji="📍" title="Nenhum lugar ainda" desc="Adicione lugares que você quer visitar ou já visitou" />}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.map(it => {
          const t = placeTypes[it.type];
          return (
            <div key={it.id} onClick={() => openEdit(it)} style={{
              background: "#fff", borderRadius: 16, overflow: "hidden", cursor: "pointer",
              border: "1.5px solid rgba(255,255,255,0.9)", boxShadow: "0 2px 12px rgba(180,160,210,0.08)",
              display: "flex",
            }}>
              <div style={{
                width: 90, flexShrink: 0,
                background: it.photo ? `url(${it.photo}) center/cover` : `linear-gradient(135deg, ${t.color}, ${C.lavender})`,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {!it.photo && <span style={{ fontSize: 28 }}>{t.emoji}</span>}
              </div>
              <div style={{ flex: 1, padding: "12px 14px", minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 6 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.dark, fontFamily: serif, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.name}</div>
                    <div style={{ fontSize: 10, color: C.mid, fontFamily: font, marginTop: 2 }}>{t.emoji} {t.label}{it.city && ` · ${it.city}`}</div>
                    {it.notes && <div style={{ fontSize: 10, color: C.mid, fontFamily: font, marginTop: 5, lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{it.notes}</div>}
                    <div style={{ marginTop: 6, display: "inline-block", padding: "2px 8px", borderRadius: 99, background: it.status === "visitei" ? C.mint : C.butter, fontSize: 9, color: C.dark, fontFamily: font, fontWeight: 600 }}>
                      {it.status === "visitei" ? "✓ Visitei" : "Quero visitar"}
                    </div>
                  </div>
                  <IconBtn icon="✕" onClick={(e) => { e.stopPropagation(); remove(it.id); }} size={22} danger />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title={editing ? "Editar lugar" : "Novo lugar"}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
          <div onClick={() => fileRef.current?.click()} style={{
            width: 140, height: 100, borderRadius: 14, cursor: "pointer",
            background: form.photo ? `url(${form.photo}) center/cover` : `linear-gradient(135deg, ${C.blue}, ${C.lavender})`,
            border: "1.5px dashed rgba(248,187,208,0.5)", display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {!form.photo && <div style={{ color: "#fff", fontSize: 24 }}>📷</div>}
          </div>
          <input ref={fileRef} type="file" accept="image/*" onChange={handlePhoto} style={{ display: "none" }} />
        </div>
        <Field label="Nome"><input value={form.name || ""} onChange={e => setForm(f => ({...f, name: e.target.value}))} style={iStyle} autoFocus /></Field>
        <Field label="Cidade / Local"><input value={form.city || ""} onChange={e => setForm(f => ({...f, city: e.target.value}))} style={iStyle} placeholder="Ex: Paris, França" /></Field>
        <Field label="Tipo">
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {Object.entries(placeTypes).map(([k, v]) => <Pill key={k} label={`${v.emoji} ${v.label}`} active={form.type === k} onClick={() => setForm(f => ({...f, type: k}))} />)}
          </div>
        </Field>
        <Field label="Status">
          <div style={{ display: "flex", gap: 6 }}>
            <Pill label="Quero visitar" active={form.status === "quero"} onClick={() => setForm(f => ({...f, status: "quero"}))} />
            <Pill label="Já visitei" active={form.status === "visitei"} onClick={() => setForm(f => ({...f, status: "visitei"}))} />
          </div>
        </Field>
        <Field label="Link"><input value={form.url || ""} onChange={e => setForm(f => ({...f, url: e.target.value}))} style={iStyle} placeholder="https://..." /></Field>
        <Field label="Notas"><textarea value={form.notes || ""} onChange={e => setForm(f => ({...f, notes: e.target.value}))} rows={3} style={{...iStyle, resize: "vertical"}} placeholder="Dicas, pratos pedidos, recomendações..." /></Field>
        <Btn full onClick={save_}>{editing ? "Salvar" : "Adicionar"} ✦</Btn>
      </Modal>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ESTUDOS
// ═══════════════════════════════════════════════════════════════════════════════
const defaultDisc = [
  { id:1, nome:"Cálculo Atuarial", p:72, cor:C.blue, e:"📐" },
  { id:2, nome:"Matemática Financeira", p:85, cor:C.mint, e:"💹" },
  { id:3, nome:"Teoria do Risco", p:45, cor:C.lavender, e:"🎲" },
  { id:4, nome:"Estatística", p:90, cor:C.butter, e:"📊" },
  { id:5, nome:"Modelos Lineares", p:30, cor:C.pink, e:"📈" },
];
const defaultSem = [{d:"Seg",h:0},{d:"Ter",h:0},{d:"Qua",h:0},{d:"Qui",h:0},{d:"Sex",h:0},{d:"Sáb",h:0},{d:"Dom",h:0}];
const emojiPick = ["📐","💹","🎲","📊","📈","🧮","📖","🧠","🔬","💻","🎓","✏️","📝","🗂️","🌐"];

function EstudosSection() {
  const [disc, setDisc] = useState(() => load(SK.estudos, defaultDisc));
  const [sem, setSem] = useState(() => load(SK.semana, [{d:"Seg",h:3},{d:"Ter",h:4.5},{d:"Qua",h:2},{d:"Qui",h:5},{d:"Sex",h:3.5},{d:"Sáb",h:1.5},{d:"Dom",h:0}]));
  const [showAdd, setShowAdd] = useState(false);
  const [editDay, setEditDay] = useState(null);
  const [editDisc, setEditDisc] = useState(null);
  const [form, setForm] = useState({ nome: "", e: "📖", cor: C.blue });
  const [dayH, setDayH] = useState("");

  useEffect(() => { save(SK.estudos, disc); }, [disc]);
  useEffect(() => { save(SK.semana, sem); }, [sem]);

  const total = sem.reduce((a, d) => a + d.h, 0);
  const maxH = Math.max(...sem.map(d => d.h), 1);
  const avg = disc.length > 0 ? Math.round(disc.reduce((a, d) => a + d.p, 0) / disc.length) : 0;

  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
        <StatCard label="Esta semana" val={`${total}h`} sub="meta: 12h" bg={C.butter} emoji="⏱️" />
        <StatCard label="Streak" val={`${sem.filter(d=>d.h>0).length}d`} bg={C.mint} emoji="🔥" />
        <StatCard label="Média" val={`${avg}%`} bg={C.lavender} emoji="📊" />
      </div>

      <div style={{ background: "rgba(180,160,210,0.08)", borderRadius: 18, padding: 15, marginBottom: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
          <span style={{ fontSize: 11, color: C.mid, fontFamily: font }}>Horas — semana</span>
          <span style={{ fontSize: 9, color: C.light, fontFamily: font }}>toque p/ editar</span>
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 76 }}>
          {sem.map((d, i) => (
            <div key={i} onClick={() => { setEditDay(i); setDayH(String(d.h)); }} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, cursor: "pointer" }}>
              <span style={{ fontSize: 9, color: C.dark, fontFamily: font, fontWeight: 600 }}>{d.h > 0 ? `${d.h}h` : ""}</span>
              <div style={{ width: "100%", height: `${(d.h / maxH) * 56}px`, background: d.h > 0 ? `linear-gradient(180deg,${C.lavender},${C.rose})` : "rgba(180,160,210,0.12)", borderRadius: "5px 5px 0 0", minHeight: 4, transition: "height 0.3s" }} />
              <span style={{ fontSize: 9, color: C.light, fontFamily: font }}>{d.d}</span>
            </div>
          ))}
        </div>
      </div>

      <Modal open={editDay !== null} onClose={() => setEditDay(null)} title={`✦ ${editDay !== null ? sem[editDay].d : ""}`}>
        <Field label="Horas de estudo"><input type="number" step="0.5" min="0" max="24" value={dayH} onChange={e => setDayH(e.target.value)} style={iStyle} autoFocus /></Field>
        <Btn full onClick={() => { setSem(p => p.map((d,i) => i === editDay ? { ...d, h: parseFloat(dayH) || 0 } : d)); setEditDay(null); }}>Salvar</Btn>
      </Modal>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: C.dark, fontFamily: font }}>Disciplinas</span>
        <IconBtn icon="＋" onClick={() => { setForm({ nome: "", e: "📖", cor: C.blue }); setShowAdd(true); }} />
      </div>
      {disc.map(d => (
        <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <span style={{ fontSize: 17, width: 24 }}>{d.e}</span>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: C.dark, fontFamily: font }}>{d.nome}</span>
              <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                <span style={{ fontSize: 11, color: C.mid, fontFamily: font }}>{d.p}%</span>
                <IconBtn icon="✎" onClick={() => setEditDisc({ ...d })} size={22} />
                <IconBtn icon="✕" onClick={() => setDisc(p => p.filter(x => x.id !== d.id))} size={22} danger />
              </div>
            </div>
            <ProgressBar value={d.p} max={100} color={`linear-gradient(90deg,${d.cor},${C.rose})`} />
          </div>
        </div>
      ))}

      <Modal open={!!editDisc} onClose={() => setEditDisc(null)} title="Editar progresso">
        {editDisc && (
          <>
            <div style={{ textAlign: "center", marginBottom: 14 }}>
              <span style={{ fontSize: 36 }}>{editDisc.e}</span>
              <div style={{ fontFamily: serif, fontSize: 14, color: C.dark, marginTop: 4 }}>{editDisc.nome}</div>
            </div>
            <Field label={`Progresso: ${editDisc.p}%`}>
              <input type="range" min="0" max="100" step="5" value={editDisc.p} onChange={e => setEditDisc(p => ({ ...p, p: Number(e.target.value) }))} style={{ width: "100%", accentColor: C.deep }} />
            </Field>
            <Btn full onClick={() => { setDisc(p => p.map(x => x.id === editDisc.id ? editDisc : x)); setEditDisc(null); }}>Salvar ✦</Btn>
          </>
        )}
      </Modal>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Nova disciplina">
        <Field label="Nome"><input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} style={iStyle} autoFocus /></Field>
        <Field label="Emoji"><EmojiPick value={form.e} onChange={e => setForm(f => ({...f, e}))} options={emojiPick} /></Field>
        <Field label="Cor"><ColorPick value={form.cor} onChange={c => setForm(f => ({...f, cor: c}))} options={colorPick} /></Field>
        <Btn full onClick={() => { if (!form.nome.trim()) return; setDisc(p => [...p, { id: Date.now(), ...form, p: 0 }]); setShowAdd(false); }}>Adicionar ✦</Btn>
      </Modal>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ARTES
// ═══════════════════════════════════════════════════════════════════════════════
const defaultArtes = [
  { id:1, titulo:"Série Bunny Cupid", status:"em andamento", p:60, e:"🐰", bg:C.pink, desc:"Pintura a óleo · 5 peças" },
  { id:2, titulo:"Zine Kewpie", status:"planejando", p:15, e:"⭑", bg:C.butter, desc:"Ilustração + risografia" },
  { id:3, titulo:"Coleção de stickers", status:"em andamento", p:40, e:"🎀", bg:C.lavender, desc:"Sanrio-inspired · 12 designs" },
];
const artEmojis = ["🐰","⭑","🌸","🎀","🎨","✦","🖼️","🖌️","🌈","💎","🦋","🧸","🌷","🍰","💫"];
const statusList = ["planejando", "em andamento", "concluído"];

function ArtesSection() {
  const [proj, setProj] = useState(() => load(SK.artes, defaultArtes));
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [f, setF] = useState({ titulo: "", desc: "", e: "🎨", bg: C.pink, status: "planejando", p: 0 });

  useEffect(() => { save(SK.artes, proj); }, [proj]);

  const openNew = () => { setF({ titulo: "", desc: "", e: "🎨", bg: C.pink, status: "planejando", p: 0 }); setEditing(null); setShowModal(true); };
  const openEdit = p => { setF({ ...p }); setEditing(p); setShowModal(true); };
  const doSave = () => {
    if (!f.titulo.trim()) return;
    if (editing) setProj(p => p.map(x => x.id === editing.id ? { ...f, id: editing.id } : x));
    else setProj(p => [...p, { ...f, id: Date.now() }]);
    setShowModal(false);
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
        <StatCard label="Ativos" val={proj.filter(p => p.status !== "concluído").length} bg={C.pink} emoji="🎨" />
        <StatCard label="Concluídos" val={proj.filter(p => p.status === "concluído").length} bg={C.mint} emoji="✓" />
        <StatCard label="Total" val={proj.length} bg={C.lavender} emoji="🖼️" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
        {proj.map(p => (
          <div key={p.id} onClick={() => openEdit(p)} style={{ background: p.bg, borderRadius: 20, padding: "14px 15px", border: "1.5px solid rgba(255,255,255,0.8)", position: "relative", overflow: "hidden", cursor: "pointer" }}>
            <div style={{ position: "absolute", top: 8, right: 8, zIndex: 2 }}>
              <IconBtn icon="✕" onClick={(e) => { e.stopPropagation(); setProj(pr => pr.filter(x => x.id !== p.id)); }} size={22} danger />
            </div>
            <div style={{ position: "absolute", top: 8, right: 12, fontSize: 26, opacity: 0.12 }}>{p.e}</div>
            <div style={{ display: "inline-block", padding: "2px 9px", borderRadius: 99, background: "rgba(255,255,255,0.5)", fontSize: 9, color: C.mid, fontFamily: font, marginBottom: 6 }}>{p.status}</div>
            <div style={{ fontSize: 17, marginBottom: 3 }}>{p.e}</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.dark, fontFamily: serif, marginBottom: 2 }}>{p.titulo}</div>
            <div style={{ fontSize: 9, color: C.mid, fontFamily: font, marginBottom: 10 }}>{p.desc}</div>
            <ProgressBar value={p.p} max={100} color="rgba(180,120,160,0.4)" height={5} />
            <div style={{ fontSize: 9, color: C.mid, fontFamily: font, marginTop: 3, textAlign: "right" }}>{p.p}%</div>
          </div>
        ))}
      </div>

      <Btn onClick={openNew} outline full>＋ Novo projeto ✦</Btn>

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? "Editar projeto" : "Novo projeto"}>
        <Field label="Título"><input value={f.titulo} onChange={e => setF(x => ({...x, titulo: e.target.value}))} style={iStyle} /></Field>
        <Field label="Descrição"><input value={f.desc} onChange={e => setF(x => ({...x, desc: e.target.value}))} style={iStyle} /></Field>
        <Field label="Emoji"><EmojiPick value={f.e} onChange={e => setF(x => ({...x, e}))} options={artEmojis} /></Field>
        <Field label="Status"><div style={{ display: "flex", gap: 6 }}>{statusList.map(s => <Pill key={s} label={s} active={f.status === s} onClick={() => setF(x => ({...x, status: s, p: s === "concluído" ? 100 : x.p}))} />)}</div></Field>
        <Field label={`Progresso: ${f.p}%`}><input type="range" min="0" max="100" step="5" value={f.p} onChange={e => setF(x => ({...x, p: Number(e.target.value)}))} style={{ width: "100%", accentColor: C.deep }} /></Field>
        <Field label="Cor"><ColorPick value={f.bg} onChange={c => setF(x => ({...x, bg: c}))} options={colorPick} /></Field>
        <Btn full onClick={doSave}>{editing ? "Salvar ✦" : "Criar projeto"}</Btn>
      </Modal>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// AGENDA (tasks)
// ═══════════════════════════════════════════════════════════════════════════════
const defaultTasks = [
  { id:1, text:"Entregar relatório de pricing", done:false, cat:"💼", pri:"alta", date:"2026-04-14", notes:"Enviar para o supervisor" },
  { id:2, text:"Estudar Teoria do Risco — cap. 4", done:false, cat:"📚", pri:"alta", date:"2026-04-17", notes:"Prova dia 18" },
  { id:3, text:"Finalizar 3 stickers da coleção", done:false, cat:"🎨", pri:"media", date:"2026-04-20", notes:"" },
  { id:4, text:"Comprar presente aniversário Lari", done:false, cat:"🌸", pri:"media", date:"2026-04-24", notes:"Ela adora Sanrio" },
  { id:5, text:"Pagar conta de luz", done:true, cat:"🏠", pri:"alta", date:"2026-04-10", notes:"" },
  { id:6, text:"Agendar retorno dermatologista", done:true, cat:"💊", pri:"baixa", date:"2026-04-12", notes:"" },
];
const priCor = { alta: C.rose, media: C.butter, baixa: C.mint };
const priLabel = { alta: "Alta", media: "Média", baixa: "Baixa" };
const catOpts = ["💼","📚","🎨","💰","💳","🏠","🍜","🎵","⭑","🌸","🐾","✦","🏃","💊","🎮"];

function AgendaSection() {
  const [tasks, setTasks] = useState(() => load(SK.tasks, defaultTasks));
  const [nova, setNova] = useState("");
  const [filtro, setFiltro] = useState("todas");
  const [editTask, setEditTask] = useState(null);
  const [ef, setEf] = useState({});

  useEffect(() => { save(SK.tasks, tasks); }, [tasks]);

  const toggle = id => setTasks(p => p.map(t => t.id === id ? { ...t, done: !t.done } : t));
  const remove = id => setTasks(p => p.filter(t => t.id !== id));
  const add = () => { if (!nova.trim()) return; setTasks(p => [...p, { id: Date.now(), text: nova, done: false, cat: "⭑", pri: "media", date: todayStr(), notes: "" }]); setNova(""); };
  const move = (id, dir) => setTasks(p => { const i = p.findIndex(t => t.id === id); if (i < 0) return p; const j = i + dir; if (j < 0 || j >= p.length) return p; const a = [...p]; [a[i], a[j]] = [a[j], a[i]]; return a; });
  const openEdit = t => { setEf({ ...t }); setEditTask(t); };
  const saveEdit = () => { setTasks(p => p.map(t => t.id === editTask.id ? { ...ef } : t)); setEditTask(null); };

  const lista = filtro === "todas" ? tasks : filtro === "pendentes" ? tasks.filter(t => !t.done) : tasks.filter(t => t.done);
  const done = tasks.filter(t => t.done).length;
  const hoje = tasks.filter(t => !t.done && t.date === todayStr()).length;

  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
        <StatCard label="Pendentes" val={tasks.filter(t => !t.done).length} bg={C.pink} emoji="📋" />
        <StatCard label="Hoje" val={hoje} bg={C.butter} emoji="☀️" />
        <StatCard label="Feitas" val={done} bg={C.mint} emoji="✓" />
      </div>

      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 11, color: C.mid, fontFamily: font }}>
          <span>Progresso</span><span style={{ color: C.deep, fontWeight: 600 }}>{done}/{tasks.length}</span>
        </div>
        <ProgressBar value={done} max={tasks.length} />
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        {["todas","pendentes","concluídas"].map(f => <Pill key={f} label={f} active={filtro===f} onClick={() => setFiltro(f)} />)}
        {done > 0 && <button onClick={() => setTasks(p => p.filter(t => !t.done))} style={{ marginLeft: "auto", padding: "5px 10px", borderRadius: 12, border: `1px solid ${C.danger}`, background: "transparent", color: C.danger, fontSize: 10, fontFamily: font, cursor: "pointer" }}>Limpar ✓</button>}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 14 }}>
        {lista.length === 0 && <EmptyState emoji="🌟" title="Tudo limpo!" desc="Nada aqui, hora de relaxar ✦" />}
        {lista.map(t => (
          <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 11px", background: t.done ? "rgba(180,160,210,0.06)" : "rgba(255,255,255,0.7)", borderRadius: 14, border: `1.5px solid ${t.done ? "rgba(180,160,210,0.15)" : "rgba(255,255,255,0.9)"}` }}>
            <div onClick={() => toggle(t.id)} style={{ width: 20, height: 20, borderRadius: "50%", border: `2px solid ${t.done ? C.deep : "rgba(180,160,210,0.35)"}`, background: t.done ? C.deep : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, cursor: "pointer" }}>
              {t.done && <span style={{ color: "#fff", fontSize: 10 }}>✓</span>}
            </div>
            <span style={{ fontSize: 14 }}>{t.cat}</span>
            <div style={{ flex: 1, minWidth: 0 }} onClick={() => openEdit(t)}>
              <div style={{ fontSize: 12, color: t.done ? C.light : C.dark, textDecoration: t.done ? "line-through" : "none", fontFamily: font, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.text}</div>
              <div style={{ display: "flex", gap: 5, alignItems: "center", marginTop: 2 }}>
                {t.date && <span style={{ fontSize: 9, color: t.date === todayStr() ? C.deep : C.light, fontFamily: font, fontWeight: t.date === todayStr() ? 600 : 400 }}>{dateLabel(t.date)}</span>}
                <span style={{ fontSize: 8, color: priCor[t.pri], fontFamily: font, background: `${priCor[t.pri]}22`, padding: "1px 6px", borderRadius: 6 }}>{priLabel[t.pri]}</span>
              </div>
            </div>
            <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
              <IconBtn icon="↑" onClick={() => move(t.id, -1)} size={20} />
              <IconBtn icon="↓" onClick={() => move(t.id, 1)} size={20} />
              <IconBtn icon="✕" onClick={() => remove(t.id)} size={20} danger />
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <input value={nova} onChange={e => setNova(e.target.value)} onKeyDown={e => e.key === "Enter" && add()} placeholder="✦ Nova tarefa..." style={{ flex: 1, ...iStyle, borderRadius: 18 }} />
        <Btn onClick={add} style={{ padding: "11px 17px", fontSize: 16 }}>+</Btn>
      </div>

      <Modal open={!!editTask} onClose={() => setEditTask(null)} title="Editar tarefa">
        <Field label="Tarefa"><input value={ef.text || ""} onChange={e => setEf(f => ({...f, text: e.target.value}))} style={iStyle} /></Field>
        <Field label="Notas"><textarea value={ef.notes || ""} onChange={e => setEf(f => ({...f, notes: e.target.value}))} rows={3} style={{...iStyle, resize: "vertical"}} /></Field>
        <Field label="Data"><input type="date" value={ef.date || ""} onChange={e => setEf(f => ({...f, date: e.target.value}))} style={iStyle} /></Field>
        <Field label="Prioridade"><div style={{ display: "flex", gap: 6 }}>{Object.entries(priLabel).map(([k,v]) => <Pill key={k} label={v} active={ef.pri === k} onClick={() => setEf(f => ({...f, pri: k}))} />)}</div></Field>
        <Field label="Categoria"><EmojiPick value={ef.cat} onChange={e => setEf(f => ({...f, cat: e}))} options={catOpts} /></Field>
        <Btn full onClick={saveEdit}>Salvar ✦</Btn>
      </Modal>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// HÁBITOS
// ═══════════════════════════════════════════════════════════════════════════════
const defaultHabits = [
  { id: 1, nome: "Meditar", e: "🧘", days: {}, cor: C.lavender },
  { id: 2, nome: "Exercício", e: "🏃", days: {}, cor: C.mint },
  { id: 3, nome: "Água (2L)", e: "💧", days: {}, cor: C.blue },
];
const habitEmojis = ["🧘","🏃","📖","💧","✨","🎨","🎵","💊","🌿","😴","📝","🧹","🍎","💪","🙏"];

function HabitosSection() {
  const [habits, setHabits] = useState(() => load(SK.habits, [{id:1,nome:'Meditar',e:'🧘',cor:'#e8d5f5',days:{'2026-04-13':true,'2026-04-12':true,'2026-04-11':true,'2026-04-10':true,'2026-04-08':true}},{id:2,nome:'Exercício',e:'🏃',cor:'#d4f0e8',days:{'2026-04-13':true,'2026-04-11':true,'2026-04-09':true}},{id:3,nome:'Água (2L)',e:'💧',cor:'#ddf0fb',days:{'2026-04-13':true,'2026-04-12':true,'2026-04-11':true,'2026-04-10':true,'2026-04-09':true,'2026-04-08':true,'2026-04-07':true}},{id:4,nome:'Desenhar',e:'🎨',cor:'#fce4ec',days:{'2026-04-13':true,'2026-04-12':true,'2026-04-10':true,'2026-04-08':true}}]));
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ nome: "", e: "🌿", cor: C.mint });

  useEffect(() => { save(SK.habits, habits); }, [habits]);

  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  const dayLabels = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];

  const toggleDay = (hid, day) => {
    setHabits(p => p.map(h => h.id !== hid ? h : { ...h, days: { ...h.days, [day]: !h.days[day] } }));
  };

  const todayDone = habits.filter(h => h.days[todayStr()]).length;
  const bestStreak = habits.reduce((best, h) => {
    let s = 0;
    for (let i = 0; i < 30; i++) {
      const d = new Date(); d.setDate(d.getDate() - i);
      if (h.days[d.toISOString().slice(0,10)]) s++; else break;
    }
    return Math.max(best, s);
  }, 0);

  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
        <StatCard label="Hoje" val={`${todayDone}/${habits.length}`} bg={C.mint} emoji="✓" />
        <StatCard label="Streak" val={`${bestStreak}d`} bg={C.butter} emoji="🔥" />
        <StatCard label="Total" val={habits.length} bg={C.lavender} emoji="🌱" />
      </div>

      <div style={{ overflowX: "auto", marginBottom: 14, paddingBottom: 4 }}>
        <div style={{ display: "grid", gridTemplateColumns: "130px repeat(7, 1fr)", gap: 0, minWidth: 360 }}>
          <div />
          {days.map((d) => {
            const dt = new Date(d + "T00:00:00");
            const isToday = d === todayStr();
            return (
              <div key={d} style={{ textAlign: "center", padding: "4px 0" }}>
                <div style={{ fontSize: 9, color: isToday ? C.deep : C.light, fontFamily: font, fontWeight: isToday ? 700 : 400 }}>{dayLabels[dt.getDay()]}</div>
                <div style={{ fontSize: 10, color: isToday ? C.deep : C.mid, fontFamily: font, fontWeight: isToday ? 700 : 400 }}>{dt.getDate()}</div>
              </div>
            );
          })}
          {habits.map(h => (
            <Fragment key={h.id}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 0", minWidth: 0 }}>
                <span style={{ fontSize: 15 }}>{h.e}</span>
                <span style={{ fontSize: 10, color: C.dark, fontFamily: font, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{h.nome}</span>
                <IconBtn icon="✕" onClick={() => setHabits(p => p.filter(x => x.id !== h.id))} size={18} danger />
              </div>
              {days.map(d => {
                const checked = !!h.days[d];
                return (
                  <div key={d} style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "4px 0" }}>
                    <button onClick={() => toggleDay(h.id, d)} style={{
                      width: 26, height: 26, borderRadius: 8,
                      border: `1.5px solid ${checked ? h.cor : "rgba(180,160,210,0.25)"}`,
                      background: checked ? h.cor : "transparent", cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      transition: "all 0.15s",
                    }}>
                      {checked && <span style={{ color: C.dark, fontSize: 11, fontWeight: 700 }}>✓</span>}
                    </button>
                  </div>
                );
              })}
            </Fragment>
          ))}
        </div>
      </div>

      <Btn onClick={() => { setForm({ nome: "", e: "🌿", cor: C.mint }); setShowAdd(true); }} outline full>＋ Novo hábito</Btn>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Novo hábito">
        <Field label="Nome"><input value={form.nome} onChange={e => setForm(f => ({...f, nome: e.target.value}))} style={iStyle} autoFocus /></Field>
        <Field label="Emoji"><EmojiPick value={form.e} onChange={e => setForm(f => ({...f, e}))} options={habitEmojis} /></Field>
        <Field label="Cor"><ColorPick value={form.cor} onChange={c => setForm(f => ({...f, cor: c}))} options={colorPick} /></Field>
        <Btn full onClick={() => { if (!form.nome.trim()) return; setHabits(p => [...p, { ...form, id: Date.now(), days: {} }]); setShowAdd(false); }}>Adicionar</Btn>
      </Modal>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// NOTAS RÁPIDAS
// ═══════════════════════════════════════════════════════════════════════════════
const noteColors = [C.butter, C.lavender, C.pink, C.mint, C.blue, C.peach];

function NotasSection() {
  const [notes, setNotes] = useState([
  {id:1, text:'Estudar cap 4 e 5 antes da prova ✦
Fazer exercícios do livro', color:'#fff9c4', ts:1712500000000},
  {id:2, text:'Ideias pro zine Kewpie:
- capa risografica
- paleta pastel
- 12 páginas', color:'#e8d5f5', ts:1712400000000},
  {id:3, text:'Lista mercado
- leite de aveia
- morango
- granola
- azeite', color:'#d4f0e8', ts:1712300000000},
  {id:4, text:'Recomendar pra Ju: Normal People na Netflix 🌸', color:'#fce4ec', ts:1712200000000},
]);
  const [showAdd, setShowAdd] = useState(false);
  const [editNote, setEditNote] = useState(null);
  const [text, setText] = useState("");
  const [color, setColor] = useState(C.butter);

  useEffect(() => { save(SK.notes, notes); }, [notes]);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: C.dark, fontFamily: font }}>{notes.length} nota{notes.length !== 1 ? "s" : ""}</span>
        <Btn onClick={() => { setText(""); setColor(C.butter); setEditNote(null); setShowAdd(true); }} style={{ padding: "8px 14px", fontSize: 12 }}>＋ Nova</Btn>
      </div>

      <div style={{ columns: 2, columnGap: 10 }}>
        {notes.map(n => (
          <div key={n.id} onClick={() => { setEditNote(n); setText(n.text); setColor(n.color); setShowAdd(true); }}
            style={{ background: n.color, borderRadius: 16, padding: "14px 15px", marginBottom: 10, breakInside: "avoid", border: "1.5px solid rgba(255,255,255,0.7)", cursor: "pointer", position: "relative" }}>
            <div style={{ position: "absolute", top: 6, right: 6 }}>
              <IconBtn icon="✕" onClick={(e) => { e.stopPropagation(); setNotes(p => p.filter(x => x.id !== n.id)); }} size={22} danger />
            </div>
            <div style={{ fontSize: 12, color: C.dark, fontFamily: font, lineHeight: 1.6, whiteSpace: "pre-wrap", paddingRight: 22 }}>{n.text}</div>
            <div style={{ fontSize: 9, color: C.mid, fontFamily: font, marginTop: 8 }}>{new Date(n.ts).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</div>
          </div>
        ))}
      </div>

      {notes.length === 0 && <EmptyState emoji="📝" title="Nenhuma nota" desc="Anote ideias, inspirações, lembretes rápidos ✦" />}

      <Modal open={showAdd} onClose={() => { setShowAdd(false); setEditNote(null); }} title={editNote ? "Editar nota" : "Nova nota"}>
        <Field label="Texto"><textarea value={text} onChange={e => setText(e.target.value)} rows={5} style={{...iStyle, resize: "vertical"}} placeholder="Anote qualquer coisa... ✦" autoFocus /></Field>
        <Field label="Cor"><div style={{ display: "flex", gap: 8 }}>{noteColors.map(c => <button key={c} onClick={() => setColor(c)} style={{ width: 30, height: 30, borderRadius: "50%", background: c, border: color === c ? `3px solid ${C.deep}` : "3px solid transparent", cursor: "pointer" }} />)}</div></Field>
        <Btn full onClick={() => {
          if (!text.trim()) return;
          if (editNote) setNotes(p => p.map(n => n.id === editNote.id ? { ...n, text, color } : n));
          else setNotes(p => [{ id: Date.now(), text, color, ts: Date.now() }, ...p]);
          setShowAdd(false); setEditNote(null);
        }}>{editNote ? "Salvar" : "Adicionar"} ✦</Btn>
      </Modal>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// POMODORO
// ═══════════════════════════════════════════════════════════════════════════════
function PomodoroSection() {
  const [mode, setMode] = useState("foco");
  const [time, setTime] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [sessions, setSessions] = useState({ today: "2026-04-13", count: 4 });
  const intervalRef = useRef(null);

  const durations = { foco: 25 * 60, pausa: 5 * 60, longa: 15 * 60 };
  const labels = { foco: "Foco", pausa: "Pausa", longa: "Pausa longa" };
  const colors = { foco: C.rose, pausa: C.mint, longa: C.lavender };

  useEffect(() => {
    if (running && time > 0) {
      intervalRef.current = setInterval(() => setTime(t => t - 1), 1000);
      return () => clearInterval(intervalRef.current);
    }
    if (time === 0 && running) {
      setRunning(false);
      if (mode === "foco") {
        const s = sessions.today === todayStr() ? { today: todayStr(), count: sessions.count + 1 } : { today: todayStr(), count: 1 };
        setSessions(s); save(SK.pomodoro, s);
      }
    }
  }, [running, time, mode, sessions]);

  const switchMode = m => { setMode(m); setTime(durations[m]); setRunning(false); };
  const mins = Math.floor(time / 60);
  const secs = time % 60;
  const pct = ((durations[mode] - time) / durations[mode]) * 100;
  const todayCount = sessions.today === todayStr() ? sessions.count : 0;

  return (
    <div>
      <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 20 }}>
        {Object.entries(labels).map(([k, v]) => <Pill key={k} label={v} active={mode === k} onClick={() => switchMode(k)} color={colors[k]} />)}
      </div>

      <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
        <div style={{ position: "relative", width: 200, height: 200 }}>
          <svg width="200" height="200" style={{ transform: "rotate(-90deg)" }}>
            <circle cx="100" cy="100" r="90" fill="none" stroke="rgba(180,160,210,0.12)" strokeWidth="8" />
            <circle cx="100" cy="100" r="90" fill="none" stroke={colors[mode]} strokeWidth="8"
              strokeDasharray={`${2 * Math.PI * 90}`} strokeDashoffset={`${2 * Math.PI * 90 * (1 - pct / 100)}`}
              strokeLinecap="round" style={{ transition: "stroke-dashoffset 0.5s" }} />
          </svg>
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <div style={{ fontFamily: serif, fontSize: 42, fontWeight: 700, color: C.dark, letterSpacing: 2 }}>
              {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
            </div>
            <div style={{ fontSize: 11, color: C.mid, fontFamily: font, marginTop: 4 }}>{labels[mode]}</div>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, justifyContent: "center", marginBottom: 24 }}>
        <Btn onClick={() => setRunning(!running)} style={{ padding: "14px 32px", fontSize: 15 }}>
          {running ? "⏸ Pausar" : time === durations[mode] ? "▶ Iniciar" : "▶ Continuar"}
        </Btn>
        <Btn onClick={() => { setRunning(false); setTime(durations[mode]); }} outline style={{ padding: "14px 20px" }}>↺</Btn>
      </div>

      <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
        <StatCard label="Sessões hoje" val={todayCount} bg={C.butter} emoji="🍅" />
        <StatCard label="Tempo focado" val={`${todayCount * 25}min`} bg={C.mint} emoji="⏱️" />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// APP PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════
const sections = [
  { key: "agenda",    label: "Agenda",    emoji: "🌸", title: "Agenda & Tarefas", group: "rotina" },
  { key: "calendario",label: "Calendário",emoji: "📅", title: "Calendário", group: "rotina" },
  { key: "habitos",   label: "Hábitos",   emoji: "🌱", title: "Tracker de Hábitos", group: "rotina" },
  { key: "pomodoro",  label: "Foco",      emoji: "🍅", title: "Pomodoro Timer", group: "rotina" },
  { key: "financas",  label: "Finanças",  emoji: "💰", title: "Finanças", group: "vida" },
  { key: "estudos",   label: "Estudos",   emoji: "📚", title: "Tracker de Estudos", group: "vida" },
  { key: "saude",     label: "Saúde",     emoji: "🏥", title: "Saúde", group: "vida" },
  { key: "artes",     label: "Projetos",  emoji: "🎨", title: "Projetos Artísticos", group: "criativo" },
  { key: "wishlist",  label: "Wishlist",  emoji: "💝", title: "Lista de Desejos", group: "criativo" },
  { key: "midia",     label: "Mídia",     emoji: "📚", title: "Livros, Filmes & Séries", group: "criativo" },
  { key: "lugares",   label: "Lugares",   emoji: "📍", title: "Lugares & Viagens", group: "criativo" },
  { key: "notas",     label: "Notas",     emoji: "📝", title: "Notas Rápidas", group: "criativo" },
];

const groupLabels = { rotina: "Rotina ✦", vida: "Vida ✦", criativo: "Criativo ✦" };

export default function App() {
  const [active, setActive] = useState(() => localStorage.getItem("pv_active") || "agenda");
  const [hora, setHora] = useState("");
  const [saudacao, setSaudacao] = useState("boa tarde");
  const [showMenu, setShowMenu] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");

  // Persist active tab
  useEffect(() => { localStorage.setItem("pv_active", active); }, [active]);

  // DEMO MODE - sem sync

  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=DM+Sans:wght@300;400;500;600&display=swap');
      *{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}
      body{background:linear-gradient(135deg,#ddf0fb 0%,#e8d5f5 40%,#fce4ec 70%,#fff9c4 100%);min-height:100vh;background-attachment:fixed}
      @keyframes spin{to{transform:rotate(360deg)}}
      @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
      @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
      @keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
      .fade{animation:fadeUp 0.3s ease}
      ::-webkit-scrollbar{width:4px;height:4px}
      ::-webkit-scrollbar-thumb{background:rgba(180,160,210,0.3);border-radius:99px}
      input::placeholder,textarea::placeholder{color:#c8b8d8}
      input:focus,textarea:focus,select:focus{outline:none;border-color:rgba(248,187,208,0.8)!important}
      select{appearance:none;-webkit-appearance:none;background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'><path d='M3 4.5l3 3 3-3' stroke='%238a7a9a' stroke-width='1.5' fill='none' stroke-linecap='round'/></svg>");background-repeat:no-repeat;background-position:right 12px center;padding-right:34px!important}
      input[type="range"]{-webkit-appearance:none;height:6px;border-radius:99px;background:rgba(180,160,210,0.2);outline:none}
      input[type="range"]::-webkit-slider-thumb{-webkit-appearance:none;width:18px;height:18px;border-radius:50%;background:linear-gradient(135deg,#f8bbd0,#e8d5f5);border:2px solid white;box-shadow:0 2px 8px rgba(180,160,210,0.3);cursor:pointer}
    `;
    document.head.appendChild(style);
    const update = () => {
      const now = new Date();
      setHora(now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
      const h = now.getHours();
      setSaudacao(h < 12 ? "bom dia" : h < 18 ? "boa tarde" : "boa noite");
    };
    update();
    const iv = setInterval(update, 60000);
    return () => clearInterval(iv);
  }, []);

  const dias = ["domingo","segunda-feira","terça-feira","quarta-feira","quinta-feira","sexta-feira","sábado"];
  const diaSemana = dias[new Date().getDay()];
  const cur = sections.find(s => s.key === active) || sections[0];

  const components = {
    financas: <FinancasSection />, estudos: <EstudosSection />, artes: <ArtesSection />,
    agenda: <AgendaSection />, habitos: <HabitosSection />, notas: <NotasSection />,
    pomodoro: <PomodoroSection />, calendario: <CalendarioSection />,
    wishlist: <WishlistSection />, saude: <SaudeSection />, midia: <MidiaSection />,
    lugares: <LugaresSection />,
  };

  // Group sections for menu
  const grouped = {};
  sections.forEach(s => { if (!grouped[s.group]) grouped[s.group] = []; grouped[s.group].push(s); });

  return (
    <div style={{ minHeight: "100vh", paddingBottom: 20 }}>
      {/* Floating stars */}
      {[{top:"5%",left:"3%",fs:14,dur:3.5},{top:"18%",right:"5%",fs:10,dur:4.2},{top:"48%",left:"2%",fs:12,dur:5},{top:"72%",right:"3%",fs:16,dur:3.8}].map((s,i)=>(
        <span key={i} style={{ position:"fixed", color:C.gold, opacity:0.3, fontSize:s.fs, animation:`float ${s.dur}s ease-in-out infinite`, animationDelay:`${i*0.6}s`, pointerEvents:"none", zIndex:0, top:s.top, left:s.left, right:s.right }}>{["✦","✧","⋆","˚"][i]}</span>
      ))}

      {/* Header */}
      <div style={{ background:"rgba(255,255,255,0.58)", backdropFilter:"blur(18px)", borderBottom:"1px solid rgba(255,255,255,0.8)", padding:"14px 20px", display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:50 }}>
        <button onClick={() => setShowMenu(true)} style={{ background: "rgba(180,160,210,0.12)", border: "none", borderRadius: 12, padding: "8px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 16 }}>☰</span>
          <span style={{ fontSize: 10, fontFamily: font, color: C.mid, fontWeight: 600 }}>Menu</span>
        </button>
        <div style={{ textAlign: "center" }}>
          <div style={{ background: "linear-gradient(90deg,#f8bbd0,#e8d5f5)", color: "#5a4a6a", fontSize: 9, fontFamily: "'DM Sans', sans-serif", fontWeight: 700, padding: "3px 12px", borderRadius: 99, marginBottom: 4, letterSpacing: 0.5 }}>✦ MODO DEMO ✦</div>
          <div style={{ display:"flex", alignItems:"center", gap:6, justifyContent: "center" }}>
            <span style={{ fontSize:15 }}>🌙</span>
            <span style={{ fontFamily:serif, fontSize:16, fontWeight:700, color:C.dark }}>meu painel</span>
            <span style={{ color:C.gold, fontSize:11 }}>✦</span>
          </div>
          <div style={{ fontFamily:font, fontSize:9, color:C.light, marginTop:1 }}>{diaSemana} · {hora}</div>
        </div>
        <div style={{ background:`linear-gradient(135deg,${C.blue},${C.lavender})`, borderRadius:"50%", width:34, height:34, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, border:"2px solid rgba(255,255,255,0.9)" }}>🐾</div>
      </div>

      {/* Sync indicator */}
      {(syncing || syncMsg) && (
        <div style={{ position: "fixed", top: 68, left: "50%", transform: "translateX(-50%)", background: "rgba(255,255,255,0.95)", backdropFilter: "blur(12px)", padding: "7px 14px", borderRadius: 99, boxShadow: "0 4px 16px rgba(180,160,210,0.2)", fontSize: 10, color: C.mid, fontFamily: font, zIndex: 40, display: "flex", alignItems: "center", gap: 6 }}>
          {syncing && <Spinner size={12} />}
          {syncing ? "Sincronizando..." : syncMsg}
        </div>
      )}

      {/* Content */}
      <div style={{ padding:"18px 16px 0" }}>
        <Card style={{ background:"linear-gradient(135deg,rgba(200,230,245,0.75),rgba(232,213,245,0.75))" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize:11, color:C.mid, fontFamily:font, marginBottom:5 }}>✦ {saudacao}, artista & atuária</div>
              <div style={{ fontFamily:serif, fontSize:20, fontWeight:700, color:C.dark, lineHeight:1.25 }}>Seu universo,<br/><em style={{ fontWeight:400, color:C.mid }}>organizado com carinho</em></div>
            </div>
            <span style={{ fontSize:40, opacity:0.85, animation:"float 4s ease-in-out infinite", flexShrink:0 }}>☁️</span>
          </div>
        </Card>

        <Card>
          <div style={{ display:"flex", alignItems:"center", gap:9, marginBottom:18 }}>
            <span style={{ fontSize:20 }}>{cur.emoji}</span>
            <span style={{ fontFamily:serif, fontSize:17, fontWeight:700, color:C.dark }}>{cur.title}</span>
            <span style={{ color:C.gold, fontSize:12 }}>✦</span>
          </div>
          <div className="fade" key={active}>{components[active]}</div>
        </Card>
      </div>

      {/* Menu drawer */}
      {showMenu && (
        <div onClick={() => setShowMenu(false)} style={{ position: "fixed", inset: 0, background: "rgba(90,74,106,0.4)", backdropFilter: "blur(6px)", zIndex: 200 }}>
          <div onClick={e => e.stopPropagation()} style={{
            position: "absolute", top: 0, left: 0, bottom: 0, width: "82%", maxWidth: 320,
            background: "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(252,228,236,0.92))",
            backdropFilter: "blur(20px)", padding: "28px 20px 24px",
            boxShadow: "4px 0 32px rgba(180,160,210,0.2)", overflowY: "auto",
            animation: "slideLeft 0.3s ease",
          }}>
            <style>{`@keyframes slideLeft{from{transform:translateX(-100%)}to{transform:translateX(0)}}`}</style>
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <span style={{ fontSize: 26 }}>🌙</span>
                <div>
                  <div style={{ fontFamily: serif, fontSize: 20, fontWeight: 700, color: C.dark }}>meu painel</div>
                  <div style={{ fontFamily: font, fontSize: 10, color: C.mid }}>{sections.length} seções</div>
                </div>
              </div>
            </div>

            {Object.entries(grouped).map(([group, secs]) => (
              <div key={group} style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 10, fontFamily: font, color: C.light, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, paddingLeft: 8 }}>{groupLabels[group]}</div>
                {secs.map(s => (
                  <button key={s.key} onClick={() => { setActive(s.key); setShowMenu(false); }} style={{
                    display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "11px 12px",
                    background: active === s.key ? `linear-gradient(135deg, ${C.rose}, ${C.lavender})` : "transparent",
                    border: "none", borderRadius: 14, cursor: "pointer", textAlign: "left", marginBottom: 4,
                    transition: "all 0.15s",
                  }}>
                    <span style={{ fontSize: 20 }}>{s.emoji}</span>
                    <span style={{ fontSize: 13, fontWeight: active === s.key ? 700 : 500, color: active === s.key ? "#fff" : C.dark, fontFamily: font }}>{s.title}</span>
                    {active === s.key && <span style={{ marginLeft: "auto", color: "#fff", fontSize: 11 }}>✦</span>}
                  </button>
                ))}
              </div>
            ))}

            <div style={{ marginTop: 20, padding: "14px", background: "rgba(180,160,210,0.08)", borderRadius: 14, fontSize: 10, color: C.mid, fontFamily: font, lineHeight: 1.6, textAlign: "center" }}>
              ✦ Seus dados sincronizam automaticamente entre dispositivos ✦
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
