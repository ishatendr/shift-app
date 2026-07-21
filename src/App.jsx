import { useState, useCallback, useEffect } from "react";

// ── スタッフ定義 ────────────────────────────────────────
const INITIAL_STAFF = [
  { id: "A", name: "川",     role: "limited", fixedCount: 3 },
  { id: "B", name: "内",     role: "limited", fixedCount: 3 },
  { id: "C", name: "堀",     role: "limited", fixedCount: 3 },
  { id: "D", name: "田",     role: "regular" },
  { id: "E", name: "馬",     role: "regular" },
  { id: "F", name: "箸",     role: "regular" },
  { id: "G", name: "弘",     role: "regular" },
  { id: "H", name: "黒",     role: "regular" },
  { id: "I", name: "藤",     role: "regular" },
];

// スタッフごとの個人カラー（背景・文字）
const STAFF_COLORS = {
  A: { bg: "#DBEAFE", text: "#1D4ED8" }, // 青
  B: { bg: "#FCE7F3", text: "#9D174D" }, // ピンク
  C: { bg: "#D1FAE5", text: "#065F46" }, // 緑
  D: { bg: "#FEF3C7", text: "#92400E" }, // 黄
  E: { bg: "#EDE9FE", text: "#5B21B6" }, // 紫
  F: { bg: "#FFE4E6", text: "#9F1239" }, // 赤
  G: { bg: "#ECFDF5", text: "#064E3B" }, // エメラルド
  H: { bg: "#FFF7ED", text: "#C2410C" }, // オレンジ
  I: { bg: "#F0F9FF", text: "#0369A1" }, // 空
};

const NUM_PATTERNS = 3;
const SLOTS = ["am", "pm"];

// ── 日本の祝日 ──────────────────────────────────────────
function nthMonday(year, month, n) {
  const d = new Date(year, month - 1, 1);
  let count = 0;
  while (true) {
    if (d.getDay() === 1) { count++; if (count === n) return new Date(d); }
    d.setDate(d.getDate() + 1);
  }
}

function dateKey(date) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`; }

function getJapaneseHolidays(year) {
  const holidays = new Set();
  const add = (y, m, day) => {
    const key = `${y}-${String(m).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
    const d = new Date(y, m-1, day);
    holidays.add(key);
    // 振替休日（祝日が日曜→翌月曜）
    if (d.getDay() === 0) {
      const next = new Date(y, m-1, day+1);
      holidays.add(dateKey(next));
    }
  };

  // 固定祝日
  add(year,1,1);   // 元日
  add(year,2,11);  // 建国記念日
  add(year,2,23);  // 天皇誕生日
  add(year,4,29);  // 昭和の日
  add(year,5,3);   // 憲法記念日
  add(year,5,4);   // みどりの日
  add(year,5,5);   // こどもの日
  add(year,8,11);  // 山の日
  add(year,11,3);  // 文化の日
  add(year,11,23); // 勤労感謝の日

  // ハッピーマンデー
  const jan2 = nthMonday(year,1,2);  add(year,1,jan2.getDate());   // 成人の日
  const jul3 = nthMonday(year,7,3);  add(year,7,jul3.getDate());   // 海の日
  const sep3 = nthMonday(year,9,3);  add(year,9,sep3.getDate());   // 敬老の日
  const oct2 = nthMonday(year,10,2); add(year,10,oct2.getDate());  // スポーツの日

  // 春分の日（近似式）
  const shun = Math.floor(20.8431 + 0.242194*(year-1980) - Math.floor((year-1980)/4));
  add(year,3,shun);
  // 秋分の日（近似式）
  const shub = Math.floor(23.2488 + 0.242194*(year-1980) - Math.floor((year-1980)/4));
  add(year,9,shub);

  // 国民の休日（祝日に挟まれた平日）
  const sorted = [...holidays].sort();
  const extras = new Set();
  for (const dk of sorted) {
    const [yy,mm,dd] = dk.split("-").map(Number);
    const d = new Date(yy, mm-1, dd);
    const prev = new Date(d); prev.setDate(d.getDate()-1);
    const next = new Date(d); next.setDate(d.getDate()+1);
    if (d.getDay() !== 0 && d.getDay() !== 6 && !holidays.has(dateKey(d))) {
      if (holidays.has(dateKey(prev)) && holidays.has(dateKey(next))) extras.add(dateKey(d));
    }
  }
  extras.forEach(e => holidays.add(e));

  return holidays;
}

// ── 日付ユーティリティ ──────────────────────────────────
function isWeekend(d) { const w = d.getDay(); return w === 0 || w === 6; }

function getWorkdays(year, month, holidays) {
  const days = [];
  const d = new Date(year, month - 1, 1);
  while (d.getMonth() === month - 1) {
    if (!isWeekend(d) && !holidays.has(dateKey(d))) days.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return days;
}

// 月曜始まりの週グリッド。祝日はグレーセルで表示
function buildWeekGrid(year, month, holidays) {
  const weekdays = getWorkdays(year, month, holidays);
  const firstDay = new Date(year, month - 1, 1);
  const startOffset = (firstDay.getDay() + 6) % 7;

  const allDates = [];
  for (let i = 0; i < startOffset; i++) allDates.push(null);
  const d = new Date(year, month - 1, 1);
  while (d.getMonth() === month - 1) {
    if (d.getDay() !== 0 && d.getDay() !== 6) allDates.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  while (allDates.length % 5 !== 0) allDates.push(null);

  const weeks = [];
  for (let i = 0; i < allDates.length; i += 5) weeks.push(allDates.slice(i, i + 5));
  return { weeks, weekdays };
}

function fmtDate(date) {
  return `${date.getMonth()+1}/${date.getDate()}`;
}

// ── 均等チェック ────────────────────────────────────────
// regularスタッフが全員ちょうど targetCount 回入れるか検証
// 戻り値: { ok, reasons[] }
function checkFeasibility(weekdays, availability, staffList, regularTarget) {
  const reasons = [];
  const regulars = staffList.filter(s => s.role === "regular");
  const limited  = staffList.filter(s => s.role === "limited");
  const totalSlots = weekdays.length * 2;
  const limitedTotal = limited.reduce((a, s) => a + s.fixedCount, 0);
  const regularTotal = regulars.length * regularTarget;

  // スロット数チェック
  if (limitedTotal + regularTotal !== totalSlots) {
    const diff = totalSlots - limitedTotal - regularTotal;
    reasons.push(`総スロット数${totalSlots}コマに対し、限定(${limitedTotal})＋均等(${regularTotal})＝${limitedTotal+regularTotal}コマ（差${diff>0?"+":""}${diff}）`);
  }

  // スロット数を数えるヘルパー（{ dk: {am,pm} } 形式）
  const countSlots = (id) => {
    const avObj = availability[id] || {};
    return Object.entries(avObj).filter(([dk,]) => weekdays.some(d=>dateKey(d)===dk))
      .reduce((sum,[,v]) => sum + (v.am?1:0) + (v.pm?1:0), 0);
  };

  // limited: 可能コマ数が fixedCount 以上あるか
  limited.forEach(s => {
    const avCnt = countSlots(s.id);
    if (avCnt < s.fixedCount) {
      reasons.push(`${s.name}の可能コマ数が${avCnt}コマしかなく、固定${s.fixedCount}回に届かない`);
    }
  });

  // regular: 可能コマ数が regularTarget 以上あるか
  regulars.forEach(s => {
    const avCnt = countSlots(s.id);
    if (avCnt < regularTarget) {
      reasons.push(`${s.name}の可能コマ数が${avCnt}コマしかなく、均等${regularTarget}回に届かない`);
    }
  });

  return { ok: reasons.length === 0, reasons };
}



// ── 空きスロット検出 ────────────────────────────────────
// 戻り値: [{ dk, sl, label }] — 誰も○をつけていないスロット
function detectEmptySlots(weekdays, availability, staffList) {
  const empty = [];
  weekdays.forEach(d => {
    const dk = dateKey(d);
    SLOTS.forEach(sl => {
      const anyone = staffList.some(s => availability[s.id]?.[dk]?.[sl] === true);
      if (!anyone) empty.push({ dk, sl });
    });
  });
  return empty;
}

// ── シフト生成 ─────────────────────────────────────────
// 全コマ埋め優先 + 午前/午後バランス + 週バランス
function generateShift(weekdays, availability, staffList, regularTarget) {
  const shift = {};
  weekdays.forEach(d => { shift[dateKey(d)] = { am: null, pm: null }; });
  const counts    = {};  // 総担当回数
  const amCounts  = {};  // 午前担当回数
  const pmCounts  = {};  // 午後担当回数
  // 週番号マップ: dk → weekIndex (0,1,2,...)
  const weekIndexOf = {};
  let wi = 0, prevMon = null;
  weekdays.forEach(d => {
    const mon = new Date(d); mon.setDate(d.getDate() - ((d.getDay()+6)%7));
    const monKey = mon.toISOString().slice(0,10);
    if (monKey !== prevMon) { wi++; prevMon = monKey; }
    weekIndexOf[dateKey(d)] = wi;
  });
  const totalWeeks = wi;
  const weekCounts = {}; // staffId → { weekIndex: count }
  staffList.forEach(s => {
    counts[s.id] = 0; amCounts[s.id] = 0; pmCounts[s.id] = 0;
    weekCounts[s.id] = {};
    for (let w = 1; w <= totalWeeks; w++) weekCounts[s.id][w] = 0;
  });

  const avail = {};
  staffList.forEach(s => { avail[s.id] = availability[s.id] || {}; });

  const maxFor = (id) => {
    const s = staffList.find(x => x.id === id);
    return s.fixedCount !== undefined && s.fixedCount !== null ? s.fixedCount : regularTarget;
  };

  // 候補スコア（小さいほど優先）
  // 優先順位: ①総回数が少ない ②週の回数が少ない ③午前/午後の偏りが大きい方を解消
  const candidateScore = (s, sl, dk) => {
    const wk = weekIndexOf[dk];
    const wCount = weekCounts[s.id][wk] || 0;
    // 今slotがamなら「pmが多い人優先」（amが少ない人に入れる）
    const slotBias = sl === "am"
      ? amCounts[s.id] - pmCounts[s.id]   // 負なら午前が少ない → 優先
      : pmCounts[s.id] - amCounts[s.id];  // 負なら午後が少ない → 優先
    return counts[s.id] * 1000 + wCount * 10 + slotBias;
  };

  // スロットをランダム順で処理
  const slots = [];
  weekdays.forEach(d => SLOTS.forEach(sl => slots.push({ dk: dateKey(d), sl })));
  for (let i = slots.length-1; i>0; i--) {
    const j = Math.floor(Math.random()*(i+1));
    [slots[i],slots[j]]=[slots[j],slots[i]];
  }

  const assign = (s, dk, sl) => {
    shift[dk][sl] = s.id;
    counts[s.id]++;
    if (sl === "am") amCounts[s.id]++; else pmCounts[s.id]++;
    weekCounts[s.id][weekIndexOf[dk]]++;
  };

  // パス1: 上限内で割り当て（多段スコア順）
  for (const { dk, sl } of slots) {
    const other = sl === "am" ? "pm" : "am";
    const alreadyToday = shift[dk][other];
    const candidates = staffList
      .filter(s =>
        s.id !== alreadyToday &&
        avail[s.id][dk]?.[sl] === true &&
        counts[s.id] < maxFor(s.id)
      )
      .sort((a,b) => candidateScore(a,sl,dk) - candidateScore(b,sl,dk));
    if (candidates.length > 0) assign(candidates[0], dk, sl);
  }

  // パス2: 空きコマを上限無視で埋める
  for (const { dk, sl } of slots) {
    if (shift[dk][sl] !== null) continue;
    const other = sl === "am" ? "pm" : "am";
    const alreadyToday = shift[dk][other];
    const candidates = staffList
      .filter(s =>
        s.id !== alreadyToday &&
        avail[s.id][dk]?.[sl] === true
      )
      .sort((a,b) => candidateScore(a,sl,dk) - candidateScore(b,sl,dk));
    if (candidates.length > 0) assign(candidates[0], dk, sl);
  }

  return { shift, counts, amCounts, pmCounts, weekCounts };
}

function shiftScore(counts, staffList, regularTarget) {
  // 全員の目標回数からの乖離の二乗和（小さいほど良い）
  return staffList.reduce((sum, s) => {
    const target = s.role === "limited" ? s.fixedCount : regularTarget;
    const d = counts[s.id] - target;
    return sum + d*d;
  }, 0);
}

// ── 計算: regularの目標回数 ────────────────────────────
function calcRegularTarget(weekdays, staffList) {
  const totalSlots = weekdays.length * 2;
  const limited = staffList.filter(s => s.role === "limited");
  const regulars = staffList.filter(s => s.role === "regular");
  const limitedTotal = limited.reduce((a,s) => a + s.fixedCount, 0);
  const remaining = totalSlots - limitedTotal;
  return remaining / regulars.length; // 整数でなければ均等不可
}

// ── メインコンポーネント ────────────────────────────────
// ── localStorage保存キー ──────────────────────────────────
const LS_KEY        = "shiftApp_v1";
const LS_SUBMIT_KEY = "shiftApp_submissions_v1"; // 希望提出データ

function loadSubmissions() {
  try { return JSON.parse(localStorage.getItem(LS_SUBMIT_KEY) || "{}"); } catch { return {}; }
}
function saveSubmission(staffId, year, month, avail) {
  const all = loadSubmissions();
  const key = `${year}-${String(month).padStart(2,"0")}`;
  all[key] = { ...(all[key]||{}), [staffId]: avail };
  try { localStorage.setItem(LS_SUBMIT_KEY, JSON.stringify(all)); } catch {}
}
function clearSubmissions(year, month) {
  const all = loadSubmissions();
  const key = `${year}-${String(month).padStart(2,"0")}`;
  delete all[key];
  try { localStorage.setItem(LS_SUBMIT_KEY, JSON.stringify(all)); } catch {}
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return data;
  } catch { return null; }
}

function saveToStorage(data) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(data)); } catch {}
}

const now = new Date();

export default function ShiftApp() {
  // localStorage から復元
  const [year, setYear]   = useState(() => {
    const s = loadFromStorage();
    return s?.year ?? (now.getMonth()===11 ? now.getFullYear()+1 : now.getFullYear());
  });
  const [month, setMonth] = useState(() => {
    const s = loadFromStorage();
    return s?.month ?? (now.getMonth()===11 ? 1 : now.getMonth()+2);
  });
  const [staffList, setStaffList] = useState(() => {
    const s = loadFromStorage();
    if (!s?.staffList) return INITIAL_STAFF;
    // 保存データに name/role があれば完全復元（医者変更対応）
    if (s.staffList[0]?.name) return s.staffList;
    // 旧データ互換: fixedCountだけ復元
    return INITIAL_STAFF.map(st => {
      const saved = s.staffList.find(x=>x.id===st.id);
      return saved ? {...st, fixedCount: saved.fixedCount} : st;
    });
  });
  // availability: { staffId: { [dateKey]: { am: bool, pm: bool } } }
  const [availability, setAvailability] = useState(() => {
    const s = loadFromStorage();
    if (s?.availability) return s.availability;
    const staff = (s?.staffList?.[0]?.name ? s.staffList : null) || INITIAL_STAFF;
    const o = {}; staff.forEach(st => { o[st.id]={}; }); return o;
  });
  const [editingStaff, setEditingStaff] = useState(INITIAL_STAFF[0].id);

  // アプリモード: "manager"=管理者 / "submit"=希望提出
  const [appMode, setAppMode] = useState("manager");
  // 希望提出モードのstate
  const [submitStaffId, setSubmitStaffId] = useState(null); // 選択中のスタッフ
  const [submitAvail, setSubmitAvail] = useState({});        // { dk: {am,pm} }
  const [submitDone, setSubmitDone] = useState(false);       // 提出完了フラグ

  // view: "input" | "adjust" | "result"
  const [view, setView] = useState("input");

  // adjust state
  const [adjustErrors, setAdjustErrors] = useState([]);
  const [regularTarget, setRegularTarget] = useState(null); // base回数
  const [regularExtra, setRegularExtra] = useState(0);      // base+1になる人数
  const [regularCounts, setRegularCounts] = useState({});   // { staffId: count }
  const [limitedCounts, setLimitedCounts] = useState(() => {
    const s = loadFromStorage();
    if (s?.limitedCounts) return s.limitedCounts;
    const o = {}; INITIAL_STAFF.filter(st=>st.role==="limited").forEach(st=>{ o[st.id]=st.fixedCount; }); return o;
  }); // 2画面目で設定する limited の回数

  // result state
  const [patterns, setPatterns] = useState(() => {
    const s = loadFromStorage();
    return s?.patterns ?? null;
  });
  const [selPattern, setSelPattern] = useState(() => {
    const s = loadFromStorage();
    return s?.selPattern ?? 0;
  });

  // 手動シフト編集
  const [manualShift, setManualShift] = useState(() => {
    const s = loadFromStorage();
    return s?.manualShift ?? null;
  }); // 手動上書き: { dk: { am, pm } }
  const [editingSlot, setEditingSlot] = useState(null);   // 編集中: { dk, sl } | null

  // 祝日管理
  const [removedHolidays, setRemovedHolidays] = useState(() => {
    const s = loadFromStorage();
    return new Set(s?.removedHolidays ?? []);
  });
  const [addedHolidays, setAddedHolidays] = useState(() => {
    const s = loadFromStorage();
    return new Set(s?.addedHolidays ?? []);
  });
  const [showHolidayPanel, setShowHolidayPanel] = useState(false);
  const [showStaffPanel, setShowStaffPanel] = useState(false);

  const autoHolidays = getJapaneseHolidays(year);
  const holidays = new Set([
    ...[...autoHolidays].filter(dk => !removedHolidays.has(dk)),
    ...addedHolidays,
  ]);

  const { weeks, weekdays } = buildWeekGrid(year, month, holidays);

  // 変更のたびにlocalStorageへ自動保存
  useEffect(() => {
    saveToStorage({
      year, month,
      staffList: staffList.map(s=>({id:s.id, name:s.name, role:s.role, fixedCount:s.fixedCount})),
      availability,
      removedHolidays: [...removedHolidays],
      addedHolidays:   [...addedHolidays],
      patterns,
      selPattern,
      manualShift,
      limitedCounts,
    });
  }, [year, month, staffList, availability, removedHolidays, addedHolidays,
      patterns, selPattern, manualShift, limitedCounts]);

  const toggleSlot = useCallback((staffId, dk, slot) => {
    setAvailability(prev => {
      const staffAvail = { ...prev[staffId] };
      const cur = staffAvail[dk] || { am: false, pm: false };
      staffAvail[dk] = { ...cur, [slot]: !cur[slot] };
      // 両方falseなら削除
      if (!staffAvail[dk].am && !staffAvail[dk].pm) delete staffAvail[dk];
      return { ...prev, [staffId]: staffAvail };
    });
  }, []);

  const updateFixed = (id, val) => {
    setStaffList(prev => prev.map(s => s.id===id ? {...s, fixedCount: Math.max(0,Number(val))} : s));
  };

  // ── シフト提出 → 担当回数選択画面へ ──────────────────
  const handleSubmit = () => {
    // 空きスロット検出（誰も○をつけていないコマ）
    const emptySlots = detectEmptySlots(weekdays, availability, staffList);
    const emptyErrors = emptySlots.map(({dk, sl}) => {
      const d = weekdays.find(d=>dateKey(d)===dk);
      return `${d ? fmtDate(d) : dk} ${sl==="am"?"午前":"午後"}：誰も出勤可能にしていない`;
    });
    setAdjustErrors(emptyErrors);

    // limitedCounts の初期値をstaffListのfixedCountに揃える
    const initLimited = {};
    staffList.filter(s=>s.role==="limited").forEach(s=>{ initLimited[s.id] = s.fixedCount; });
    setLimitedCounts(initLimited);

    // regularのbase計算（limitedCountsは後で変わるので暫定: 初期固定値で計算）
    const totalSlots = weekdays.length * 2;
    const regulars = staffList.filter(s=>s.role==="regular");
    const limitedTotal = staffList.filter(s=>s.role==="limited").reduce((a,s)=>a+s.fixedCount,0);
    const remaining = totalSlots - limitedTotal;
    const base = Math.floor(remaining / regulars.length);
    const extra = remaining - base * regulars.length;
    setRegularTarget(base);
    setRegularExtra(extra);

    const sortedBySlots = [...regulars].sort((a,b)=>{
      const ca = Object.values(availability[a.id]||{}).reduce((s,v)=>s+(v.am?1:0)+(v.pm?1:0),0);
      const cb = Object.values(availability[b.id]||{}).reduce((s,v)=>s+(v.am?1:0)+(v.pm?1:0),0);
      return cb-ca;
    });
    const initCounts = {};
    sortedBySlots.forEach((s,i) => { initCounts[s.id] = i < extra ? base+1 : base; });
    setRegularCounts(initCounts);
    setView("adjust");
  };

  const doGenerate = () => {
    const resolvedStaff = staffList.map(s => {
      if (s.role === "limited" && limitedCounts[s.id] !== undefined)
        return { ...s, fixedCount: limitedCounts[s.id] };
      if (s.role === "regular" && regularCounts[s.id] !== undefined)
        return { ...s, fixedCount: regularCounts[s.id] };
      return s;
    });
    const candidates = Array.from({length: NUM_PATTERNS * 8}, () =>
      generateShift(weekdays, availability, resolvedStaff, regularTarget)
    );
    candidates.sort((a,b) => shiftScore(a.counts,resolvedStaff,regularTarget) - shiftScore(b.counts,resolvedStaff,regularTarget));
    setPatterns(candidates.slice(0, NUM_PATTERNS));
    setSelPattern(0);
    setManualShift(null);
    setEditingSlot(null);
    setView("result");
  };

  // ── スタイル ────────────────────────────────────────
  const C = {
    bg:"#F7F6F3", surface:"#FFFFFF",
    accent:"#3B6E8F", accentLight:"#EDF4F9",
    limited:"#7B5EA7", limitedLight:"#F3EEF9",
    am:"#E6F4EA", amText:"#276221",
    pm:"#FFF3E0", pmText:"#B45309",
    border:"#DDD9D3", text:"#1A1A1A", muted:"#7A7570",
    danger:"#B91C1C", dangerBg:"#FEF2F2",
    warn:"#92400E", warnBg:"#FFFBEB",
  };
  const SS = { border:`1px solid ${C.border}`, borderRadius:7, padding:"4px 8px", fontSize:13, color:C.text, background:"#fff", cursor:"pointer" };

  // ─────────────────────────────────────────────────────
  // 入力ビュー
  // ─────────────────────────────────────────────────────
  const inputView = () => {
    const DOW_LABELS = ["月","火","水","木","金"];

    return (
      <div style={{display:"flex",flexDirection:"column",gap:18}}>

        {/* 月選択 */}
        <div style={{background:C.surface,borderRadius:12,padding:"12px 16px",border:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
          <span style={{fontWeight:700,fontSize:13,color:C.text}}>対象月</span>
          <select value={year} onChange={e=>setYear(Number(e.target.value))} style={SS}>
            {Array.from({length:16},(_,i)=>2025+i).map(y=><option key={y}>{y}</option>)}
          </select>
          <span style={{color:C.muted,fontSize:13}}>年</span>
          <select value={month} onChange={e=>setMonth(Number(e.target.value))} style={SS}>
            {Array.from({length:12},(_,i)=>i+1).map(m=><option key={m} value={m}>{m}</option>)}
          </select>
          <span style={{color:C.muted,fontSize:13}}>月</span>
          <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:11,color:"#16A34A",fontWeight:600}}>💾 自動保存中</span>
            <button onClick={()=>{
              if(!window.confirm("入力した希望をすべてリセットしますか？")) return;
              const o={}; staffList.forEach(s=>{o[s.id]={};});
              setAvailability(o);
              setRemovedHolidays(new Set());
              setAddedHolidays(new Set());
            }} style={{fontSize:11,color:C.danger,background:"none",border:`1px solid ${C.danger}`,borderRadius:6,padding:"3px 8px",cursor:"pointer"}}>
              リセット
            </button>
          </div>
        </div>

        {/* スタッフ管理パネル */}
        <div style={{background:"#F8F4FF",border:`1px solid #D3C5EC`,borderRadius:12}}>
          <button onClick={()=>setShowStaffPanel(p=>!p)}
            style={{width:"100%",background:"none",border:"none",padding:"12px 16px",cursor:"pointer",display:"flex",alignItems:"center",gap:8,textAlign:"left"}}>
            <span style={{fontSize:13,fontWeight:700,color:C.limited}}>👥 スタッフ管理</span>
            <span style={{fontSize:11,color:C.muted,marginLeft:4}}>{staffList.length}人</span>
            <span style={{marginLeft:"auto",fontSize:12,color:C.muted}}>{showStaffPanel?"▲":"▼"}</span>
          </button>
          {showStaffPanel && (
            <div style={{borderTop:`1px solid #D3C5EC`,padding:"12px 16px"}}>
              <p style={{fontSize:11,color:C.muted,marginBottom:10}}>名前・役割を変更、追加・削除できます。変更は即時保存されます。</p>
              <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:12}}>
                {staffList.map((s,idx)=>(
                  <div key={s.id} style={{display:"flex",alignItems:"center",gap:6,
                    padding:"8px 10px",borderRadius:8,background:"#fff",border:`1px solid #D3C5EC`}}>
                    {/* 名前入力 */}
                    <input value={s.name} onChange={e=>{
                      const v = e.target.value;
                      setStaffList(prev=>prev.map(x=>x.id===s.id?{...x,name:v}:x));
                    }} style={{
                      width:56,border:`1px solid ${C.border}`,borderRadius:6,
                      padding:"4px 6px",fontSize:14,fontWeight:700,
                      color:s.role==="limited"?C.limited:C.accent,
                      textAlign:"center",background:"#FAFAFA",
                    }}/>
                    {/* 役割切替 */}
                    <button onClick={()=>setStaffList(prev=>prev.map(x=>
                      x.id===s.id?{...x,role:x.role==="limited"?"regular":"limited"}:x
                    ))} style={{
                      fontSize:10,fontWeight:700,padding:"3px 8px",borderRadius:20,
                      border:"none",cursor:"pointer",
                      background:s.role==="limited"?C.limitedLight:C.accentLight,
                      color:s.role==="limited"?C.limited:C.accent,
                    }}>
                      {s.role==="limited"?"固定":"均等"}
                    </button>
                    {/* 削除 */}
                    <button onClick={()=>{
                      if(!window.confirm(`${s.name}を削除しますか？`)) return;
                      setStaffList(prev=>prev.filter(x=>x.id!==s.id));
                      setAvailability(prev=>{const n={...prev};delete n[s.id];return n;});
                    }} style={{
                      marginLeft:"auto",fontSize:11,color:C.danger,background:"none",
                      border:`1px solid ${C.danger}`,borderRadius:6,padding:"3px 8px",cursor:"pointer",
                    }}>削除</button>
                  </div>
                ))}
              </div>
              {/* 新規追加 */}
              <button onClick={()=>{
                const name = window.prompt("新しいスタッフの名前を入力してください");
                if (!name || !name.trim()) return;
                const newId = "S" + Date.now();
                const newStaff = {id:newId, name:name.trim(), role:"regular", fixedCount:null};
                setStaffList(prev=>[...prev, newStaff]);
                setAvailability(prev=>({...prev,[newId]:{}}));
              }} style={{
                width:"100%",padding:"10px",borderRadius:8,cursor:"pointer",
                border:`2px dashed #D3C5EC`,background:"#fff",
                fontSize:13,fontWeight:700,color:C.limited,
              }}>＋ スタッフを追加</button>
            </div>
          )}
        </div>

        {/* 祝日設定パネル */}
        {(() => {
          // この月の平日（土日除く）を全部列挙
          const allWeekdaysInMonth = [];
          const tmp = new Date(year, month-1, 1);
          while (tmp.getMonth() === month-1) {
            if (tmp.getDay() !== 0 && tmp.getDay() !== 6) allWeekdaysInMonth.push(new Date(tmp));
            tmp.setDate(tmp.getDate()+1);
          }
          const monthHolidays = allWeekdaysInMonth.filter(d => holidays.has(dateKey(d)));
          const monthWorkdays = allWeekdaysInMonth.filter(d => !holidays.has(dateKey(d)));
          return (
            <div style={{background:"#FFF8F0",border:`1px solid #F0C98A`,borderRadius:12}}>
              <button onClick={()=>setShowHolidayPanel(p=>!p)}
                style={{width:"100%",background:"none",border:"none",padding:"12px 16px",cursor:"pointer",display:"flex",alignItems:"center",gap:8,textAlign:"left"}}>
                <span style={{fontSize:13,fontWeight:700,color:"#92400E"}}>🗓 祝日・休日設定</span>
                <span style={{fontSize:12,color:"#B45309",marginLeft:4}}>
                  {monthHolidays.length}日が休日（平日 {monthWorkdays.length}日）
                </span>
                <span style={{marginLeft:"auto",fontSize:12,color:"#B45309"}}>{showHolidayPanel?"▲":"▼"}</span>
              </button>
              {showHolidayPanel && (
                <div style={{borderTop:`1px solid #F0C98A`,padding:"12px 16px"}}>
                  <p style={{fontSize:11,color:"#92400E",marginBottom:10}}>
                    タップで休日⇔平日を切り替え。赤＝休日（シフト対象外）
                  </p>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:4,borderRadius:8,overflow:"hidden",border:`1px solid ${C.border}`}}>
                    {/* 曜日ヘッダー */}
                    {["月","火","水","木","金"].map(l=>(
                      <div key={l} style={{textAlign:"center",padding:"5px 0",fontSize:11,fontWeight:700,color:"#fff",background:C.accent}}>{l}</div>
                    ))}
                    {/* 月の頭の空白 */}
                    {(() => {
                      const cells = [];
                      const firstDay = new Date(year, month-1, 1);
                      const offset = (firstDay.getDay()+6)%7;
                      for (let i=0;i<offset;i++) cells.push(<div key={`e${i}`} style={{background:"#F0EEE8",minHeight:36}}/>);
                      // 月内の月〜金
                      const d2 = new Date(year, month-1, 1);
                      while (d2.getMonth() === month-1) {
                        if (d2.getDay()!==0 && d2.getDay()!==6) {
                          const dk = dateKey(d2);
                          const isH = holidays.has(dk);
                          const isAuto = autoHolidays.has(dk);
                          const d3 = new Date(d2);
                          cells.push(
                            <button key={dk} onClick={()=>{
                              if (isH) {
                                // 休日→平日に戻す
                                if (isAuto) setRemovedHolidays(prev=>{ const s=new Set(prev); s.add(dk); return s; });
                                else setAddedHolidays(prev=>{ const s=new Set(prev); s.delete(dk); return s; });
                              } else {
                                // 平日→休日にする
                                setAddedHolidays(prev=>{ const s=new Set(prev); s.add(dk); return s; });
                                setRemovedHolidays(prev=>{ const s=new Set(prev); s.delete(dk); return s; });
                              }
                            }} style={{
                              minHeight:36,padding:"3px 1px",cursor:"pointer",textAlign:"center",border:"none",
                              borderTop:`1px solid ${C.border}`,
                              background:isH?"#FEE2E2":C.surface,
                              color:isH?C.danger:C.text,
                              fontWeight:isH?700:400,fontSize:11,
                            }}>
                              {d3.getDate()}
                              {isAuto&&isH&&<span style={{display:"block",fontSize:8,color:C.danger}}>祝</span>}
                              {!isAuto&&isH&&<span style={{display:"block",fontSize:8,color:C.danger}}>休</span>}
                            </button>
                          );
                        }
                        d2.setDate(d2.getDate()+1);
                      }
                      return cells;
                    })()}
                  </div>
                  <button onClick={()=>{setRemovedHolidays(new Set());setAddedHolidays(new Set());}}
                    style={{marginTop:8,fontSize:11,color:C.muted,background:"none",border:`1px solid ${C.border}`,borderRadius:6,padding:"4px 10px",cursor:"pointer"}}>
                    自動祝日に戻す
                  </button>
                </div>
              )}
            </div>
          );
        })()}

        {/* コマ別希望入力カレンダー */}
        <div>
          <p style={{fontSize:12,color:C.muted,marginBottom:8}}>
            各コマをタップして出勤可能なスタッフ名を追加・削除
          </p>
          <div style={{borderRadius:10,overflow:"hidden",border:`1px solid ${C.border}`}}>
            {/* 曜日ヘッダー */}
            <div style={{display:"grid",gridTemplateColumns:"44px repeat(5,1fr)",background:C.accent}}>
              <div/>
              {DOW_LABELS.map(l=>(
                <div key={l} style={{textAlign:"center",padding:"6px 0",fontSize:12,fontWeight:700,color:"#fff"}}>{l}</div>
              ))}
            </div>
            {weeks.map((week,wi)=>(
              <div key={wi} style={{borderTop:`2px solid ${C.border}`}}>
                {/* 日付行 */}
                <div style={{display:"grid",gridTemplateColumns:"44px repeat(5,1fr)",background:"#F7F6F3"}}>
                  <div/>
                  {week.map((d,di)=>{
                    const borderL = di>0?`1px solid ${C.border}`:"none";
                    if (!d) return <div key={di} style={{background:"#EEECEA",borderLeft:borderL,minHeight:18}}/>;
                    const dk = dateKey(d);
                    const isHoliday = holidays.has(dk);
                    return (
                      <div key={dk} style={{textAlign:"center",padding:"3px 2px",borderLeft:borderL,
                        background:isHoliday?"#F0EEE8":"#F7F6F3",fontSize:11,
                        color:isHoliday?"#B0A8A0":C.muted,fontWeight:500}}>
                        {fmtDate(d)}{isHoliday&&<span style={{marginLeft:2,fontSize:9,color:C.danger}}>祝</span>}
                      </div>
                    );
                  })}
                </div>
                {/* 午前行 */}
                <div style={{display:"grid",gridTemplateColumns:"44px repeat(5,1fr)",borderTop:`1px solid ${C.border}`}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"center",background:C.am,padding:"4px 2px"}}>
                    <span style={{fontSize:10,fontWeight:700,color:C.amText}}>午前</span>
                  </div>
                  {week.map((d,di)=>{
                    const borderL = di>0?`1px solid ${C.border}`:"none";
                    if (!d) return <div key={di} style={{background:"#EEECEA",borderLeft:borderL}}/>;
                    const dk = dateKey(d);
                    if (holidays.has(dk)) return <div key={dk} style={{background:"#F0EEE8",borderLeft:borderL,minHeight:50}}/>;
                    // このコマに○をつけたスタッフ
                    const inStaff = staffList.filter(s=>availability[s.id]?.[dk]?.am===true);
                    const notInStaff = staffList.filter(s=>!inStaff.find(x=>x.id===s.id));
                    return (
                      <div key={dk+"-am"} style={{borderLeft:borderL,background:C.surface,padding:"4px 3px",minHeight:50}}>
                        {/* 入っているスタッフ（タップで削除） */}
                        <div style={{display:"flex",flexWrap:"wrap",gap:2,marginBottom:inStaff.length>0&&notInStaff.length>0?2:0}}>
                          {inStaff.map(s=>{
                            const isLim2 = s.role==="limited";
                            return (
                              <button key={s.id} onClick={()=>toggleSlot(s.id,dk,"am")} title="タップで削除" style={{
                                fontSize:10,fontWeight:700,cursor:"pointer",padding:"1px 5px",borderRadius:4,border:"none",
                                background:isLim2?"#E3D7F5":C.accentLight,
                                color:isLim2?C.limited:C.accent,
                              }}>{s.name}</button>
                            );
                          })}
                        </div>
                        {/* 未入のスタッフ（タップで追加） */}
                        <div style={{display:"flex",flexWrap:"wrap",gap:2}}>
                          {notInStaff.map(s=>(
                            <button key={s.id} onClick={()=>toggleSlot(s.id,dk,"am")} title="タップで追加" style={{
                              fontSize:10,cursor:"pointer",padding:"1px 5px",borderRadius:4,border:`1px dashed ${C.border}`,
                              background:"transparent",color:C.muted,
                            }}>{s.name}</button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {/* 午後行 */}
                <div style={{display:"grid",gridTemplateColumns:"44px repeat(5,1fr)",borderTop:`1px solid ${C.border}`}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"center",background:C.pm,padding:"4px 2px"}}>
                    <span style={{fontSize:10,fontWeight:700,color:C.pmText}}>午後</span>
                  </div>
                  {week.map((d,di)=>{
                    const borderL = di>0?`1px solid ${C.border}`:"none";
                    if (!d) return <div key={di} style={{background:"#EEECEA",borderLeft:borderL}}/>;
                    const dk = dateKey(d);
                    if (holidays.has(dk)) return <div key={dk} style={{background:"#F0EEE8",borderLeft:borderL,minHeight:50}}/>;
                    const inStaff = staffList.filter(s=>availability[s.id]?.[dk]?.pm===true);
                    const notInStaff = staffList.filter(s=>!inStaff.find(x=>x.id===s.id));
                    return (
                      <div key={dk+"-pm"} style={{borderLeft:borderL,background:wi%2===0?C.bg:C.surface,padding:"4px 3px",minHeight:50}}>
                        <div style={{display:"flex",flexWrap:"wrap",gap:2,marginBottom:inStaff.length>0&&notInStaff.length>0?2:0}}>
                          {inStaff.map(s=>{
                            const isLim2 = s.role==="limited";
                            return (
                              <button key={s.id} onClick={()=>toggleSlot(s.id,dk,"pm")} title="タップで削除" style={{
                                fontSize:10,fontWeight:700,cursor:"pointer",padding:"1px 5px",borderRadius:4,border:"none",
                                background:isLim2?"#FFE4B5":"#FFF3E0",
                                color:isLim2?"#B45309":C.pmText,
                              }}>{s.name}</button>
                            );
                          })}
                        </div>
                        <div style={{display:"flex",flexWrap:"wrap",gap:2}}>
                          {notInStaff.map(s=>(
                            <button key={s.id} onClick={()=>toggleSlot(s.id,dk,"pm")} title="タップで追加" style={{
                              fontSize:10,cursor:"pointer",padding:"1px 5px",borderRadius:4,border:`1px dashed ${C.border}`,
                              background:"transparent",color:C.muted,
                            }}>{s.name}</button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 希望収集データ読み込みボタン */}
        {(() => {
          const subs = loadSubmissions();
          const key = `${year}-${String(month).padStart(2,"0")}`;
          const monthSubs = subs[key] || {};
          const cnt = Object.keys(monthSubs).length;
          return cnt > 0 ? (
            <button onClick={loadSubmissionsToAvailability} style={{
              background:"#F0FDF4",color:"#166534",
              border:`2px solid #86EFAC`,
              borderRadius:12,padding:"12px 14px",fontSize:13,fontWeight:700,
              cursor:"pointer",display:"flex",alignItems:"center",gap:8,
            }}>
              <span style={{fontSize:16}}>📥</span>
              <span>希望提出データを読み込む（{cnt}/{staffList.length}人 提出済み）</span>
            </button>
          ) : null;
        })()}

        {/* 前回のシフト案を復元 */}
        {patterns && (
          <button onClick={()=>setView("result")} style={{
            background:"#F0F9FF",color:"#0369A1",
            border:`2px solid #BAE6FD`,
            borderRadius:12,padding:"12px 14px",fontSize:13,fontWeight:700,
            cursor:"pointer",display:"flex",alignItems:"center",gap:8,
          }}>
            <span style={{fontSize:16}}>📋</span>
            <span>前回のシフト案を表示する（保存済み）</span>
          </button>
        )}

        <button onClick={handleSubmit} style={{
          background:C.accent,color:"#fff",border:"none",
          borderRadius:12,padding:"14px",fontSize:15,fontWeight:700,
          cursor:"pointer",letterSpacing:"0.04em",
        }}>
          シフトを提出して確認 →
        </button>
      </div>
    );
  };

  // ─────────────────────────────────────────────────────
  // 調整ビュー（担当回数の確認・選択）
  // ─────────────────────────────────────────────────────
  const adjustView = () => {
    const regulars = staffList.filter(s=>s.role==="regular");
    const totalSlots = weekdays.length*2;
    const limitedTotal = staffList.filter(s=>s.role==="limited")
      .reduce((a,s)=>a+(limitedCounts[s.id]??s.fixedCount),0);
    const remaining = totalSlots - limitedTotal;
    const base = remaining > 0 ? Math.floor(remaining/regulars.length) : 0;
    const extra = remaining > 0 ? remaining - base*regulars.length : 0;

    // regularCounts の合計チェック（合計 === remaining になるべき）
    const regularTotal = regulars.reduce((a,s)=>a+(regularCounts[s.id]??base),0);
    const totalOk = regularTotal === remaining && remaining >= 0;

    // 各スタッフの可能コマ数
    const slotCount = (id) => Object.values(availability[id]||{})
      .reduce((a,v)=>a+(v.am?1:0)+(v.pm?1:0),0);

    // +1/-1 ボタン: 合計が remaining になるよう他者と連動
    const toggle = (id) => {
      setRegularCounts(prev => {
        const curBase = base; // 現在のbase（limitedCounts変更に追従）
        const cur = prev[id] ?? curBase;
        const next = { ...prev };
        if (cur === curBase) {
          const victim = regulars.find(s=>s.id!==id && (prev[s.id]??curBase)===curBase+1);
          if (!victim) return prev;
          next[id] = curBase+1;
          next[victim.id] = curBase;
        } else {
          const beneficiary = regulars.find(s=>s.id!==id && (prev[s.id]??curBase)===curBase);
          if (!beneficiary) return prev;
          next[id] = curBase;
          next[beneficiary.id] = curBase+1;
        }
        return next;
      });
    };

    return (

      <div style={{display:"flex",flexDirection:"column",gap:16}}>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <button onClick={()=>setView("input")} style={{background:"none",border:`1px solid ${C.border}`,borderRadius:8,padding:"5px 12px",cursor:"pointer",color:C.muted,fontSize:12}}>← 戻る</button>
          <span style={{fontWeight:700,fontSize:15,color:C.text}}>担当回数の確認</span>
        </div>

        {/* 空きコマ警告 */}
        {adjustErrors.length > 0 && (
          <div style={{background:C.dangerBg,border:`1px solid #FECACA`,borderRadius:12,padding:"14px 16px"}}>
            <p style={{fontSize:13,fontWeight:700,color:C.danger,marginBottom:6}}>
              ⚠ 以下のコマは誰も出勤可能にしていません（空きコマになります）
            </p>
            <p style={{fontSize:11,color:C.danger,marginBottom:8}}>
              該当スタッフの可能日を追加するか、このまま生成すると空きコマが残ります。
            </p>
            <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
              {adjustErrors.map((e,i)=>(
                <span key={i} style={{fontSize:12,color:C.danger,background:"#FEE2E2",padding:"3px 10px",borderRadius:20,fontWeight:600}}>
                  {e}
                </span>
              ))}
            </div>
            <button onClick={()=>setView("input")} style={{
              marginTop:10,fontSize:12,fontWeight:700,color:C.danger,
              background:"none",border:`1px solid ${C.danger}`,
              borderRadius:8,padding:"5px 14px",cursor:"pointer",
            }}>← 入力に戻って修正する</button>
          </div>
        )}

        {/* limited スタッフの回数設定 */}
        {(() => {
          const limited = staffList.filter(s=>s.role==="limited");
          const totalSlots = weekdays.length*2;
          const limitedTotal = limited.reduce((a,s)=>a+(limitedCounts[s.id]??s.fixedCount),0);
          const remaining2 = totalSlots - limitedTotal;
          const regulars2 = staffList.filter(s=>s.role==="regular");
          const base2 = Math.floor(remaining2/regulars2.length);
          const extra2 = remaining2 - base2*regulars2.length;
          const isValid = remaining2 >= 0;
          return (
            <div style={{background:C.limitedLight,border:`1px solid #D3C5EC`,borderRadius:12,padding:"14px 16px"}}>
              <p style={{fontSize:12,fontWeight:700,color:C.limited,marginBottom:4}}>川・内・堀の出勤回数</p>
              <p style={{fontSize:11,color:C.muted,marginBottom:10}}>± で回数を調整。均等スタッフの割り当てに自動反映されます。</p>
              <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:10}}>
                {limited.map(s=>{
                  const cur = limitedCounts[s.id]??s.fixedCount;
                  const avCnt = Object.values(availability[s.id]||{}).reduce((a,v)=>a+(v.am?1:0)+(v.pm?1:0),0);
                  const tooMany = cur > avCnt;
                  return (
                    <div key={s.id} style={{
                      display:"flex",alignItems:"center",gap:10,
                      padding:"8px 12px",borderRadius:10,
                      background:tooMany?"#FEF2F2":C.surface,
                      border:`1.5px solid ${tooMany?C.danger:"#D3C5EC"}`,
                    }}>
                      <span style={{minWidth:24,fontSize:15,fontWeight:700,color:C.limited}}>{s.name}</span>
                      <button onClick={()=>setLimitedCounts(p=>({...p,[s.id]:Math.max(0,(p[s.id]??s.fixedCount)-1)}))}
                        style={{width:28,height:28,borderRadius:6,border:`1px solid #D3C5EC`,background:"#fff",fontSize:16,cursor:"pointer",color:C.limited,fontWeight:700}}>−</button>
                      <span style={{minWidth:24,textAlign:"center",fontSize:17,fontWeight:800,color:tooMany?C.danger:C.limited}}>{cur}</span>
                      <button onClick={()=>setLimitedCounts(p=>({...p,[s.id]:(p[s.id]??s.fixedCount)+1}))}
                        style={{width:28,height:28,borderRadius:6,border:`1px solid #D3C5EC`,background:"#fff",fontSize:16,cursor:"pointer",color:C.limited,fontWeight:700}}>＋</button>
                      <span style={{fontSize:11,color:tooMany?C.danger:C.muted}}>
                        {tooMany?`⚠ 可能${avCnt}コマ`:`可能${avCnt}コマ`}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div style={{fontSize:12,borderRadius:8,padding:"6px 10px",
                background:isValid?C.accentLight:C.dangerBg,
                color:isValid?C.accent:C.danger}}>
                {isValid
                  ? `残り${remaining2}コマ ÷ ${regulars2.length}人 → ${extra2===0?`全員${base2}回`:`${base2}回×${regulars2.length-extra2}人、${base2+1}回×${extra2}人`}`
                  : `⚠ 限定スタッフ合計(${limitedTotal})が総スロット(${totalSlots})を超過`}
              </div>
            </div>
          );
        })()}

        {/* リアルタイム実現可能性チェック */}
        {(() => {
          if (!totalOk) return null;
          // 現在の設定で各スタッフの可能コマ数が足りるか確認
          const issues = [];
          staffList.filter(s=>s.role==="limited").forEach(s=>{
            const need = limitedCounts[s.id]??s.fixedCount;
            const have = slotCount(s.id);
            if (have < need) issues.push(`${s.name}：可能${have}コマ < 必要${need}コマ`);
          });
          regulars.forEach(s=>{
            const need = regularCounts[s.id]??base;
            const have = slotCount(s.id);
            if (have < need) issues.push(`${s.name}：可能${have}コマ < 必要${need}コマ`);
          });
          // 各コマに誰もいないスロット
          const emptyCount = adjustErrors.length;
          const allGood = issues.length===0 && emptyCount===0;
          return (
            <div style={{borderRadius:12,padding:"12px 14px",
              background:allGood?"#F0FAF4":issues.length>0?C.dangerBg:C.warnBg,
              border:`1px solid ${allGood?"#86EFAC":issues.length>0?"#FECACA":"#FDE68A"}`}}>
              <p style={{fontSize:12,fontWeight:700,marginBottom:issues.length>0||emptyCount>0?6:0,
                color:allGood?"#166534":issues.length>0?C.danger:C.warn}}>
                {allGood?"✓ この設定で全コマ埋まる見込みです"
                  :issues.length>0?"⚠ 可能コマ数が不足しているスタッフがいます"
                  :"△ 空きコマが出る可能性があります（可能コマ数は足りています）"}
              </p>
              {issues.map((iss,i)=>(
                <div key={i} style={{fontSize:11,color:C.danger,marginTop:2}}>· {iss}</div>
              ))}
              {emptyCount>0&&issues.length===0&&(
                <div style={{fontSize:11,color:C.warn}}>· {emptyCount}コマに誰も○をつけていません（入力に戻って追加を）</div>
              )}
            </div>
          );
        })()}

        {/* regular スタッフの回数選択 */}
        <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:"14px 16px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
            <div>
              <p style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:2}}>スタッフ担当回数</p>
              <p style={{fontSize:11,color:C.muted}}>
                残り{remaining}コマ ÷ {regulars.length}人 →
                {extra===0
                  ? ` 全員${base}回`
                  : ` ${base}回 または ${base+1}回（${base+1}回が${extra}人）`}
              </p>
            </div>
            <div style={{fontSize:11,padding:"4px 10px",borderRadius:20,fontWeight:700,
              background:totalOk?C.accentLight:C.dangerBg,
              color:totalOk?C.accent:C.danger,
              border:`1px solid ${totalOk?C.accent:C.danger}`}}>
              {totalOk ? "✓ OK" : `合計${regularTotal}/${remaining}`}
            </div>
          </div>

          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {regulars.map(s=>{
              const cur = regularCounts[s.id] ?? base;
              const avail_cnt = slotCount(s.id);
              const tooMany = cur > avail_cnt;
              const isExtra = cur === base+1;
              const canToggle = extra > 0; // base+1 が存在する場合のみ切り替え可能

              return (
                <div key={s.id} style={{
                  display:"flex",alignItems:"center",gap:10,
                  padding:"10px 12px",borderRadius:10,
                  background:isExtra?C.accentLight:C.bg,
                  border:`1.5px solid ${tooMany?C.danger:isExtra?C.accent:C.border}`,
                }}>
                  <span style={{minWidth:28,fontSize:15,fontWeight:700,color:C.text}}>{s.name}</span>
                  <span style={{fontSize:18,fontWeight:800,color:tooMany?C.danger:isExtra?C.accent:C.muted,minWidth:24,textAlign:"center"}}>
                    {cur}
                  </span>
                  <span style={{fontSize:11,color:C.muted}}>回</span>
                  {canToggle && !tooMany && (
                    <button onClick={()=>toggle(s.id)} style={{
                      marginLeft:"auto",fontSize:11,fontWeight:700,cursor:"pointer",
                      padding:"4px 12px",borderRadius:20,border:"none",
                      background:isExtra?C.border:C.accent,
                      color:isExtra?C.muted:"#fff",
                    }}>
                      {isExtra ? `${base}回に戻す` : `${base+1}回にする`}
                    </button>
                  )}
                  {tooMany && (
                    <span style={{marginLeft:"auto",fontSize:11,color:C.danger,fontWeight:700}}>
                      ⚠ 可能{avail_cnt}コマ
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <button onClick={doGenerate} disabled={!totalOk} style={{
          background:totalOk?C.accent:"#9CA3AF",
          color:"#fff",border:"none",borderRadius:12,padding:"14px",
          fontSize:15,fontWeight:700,
          cursor:totalOk?"pointer":"not-allowed",
          letterSpacing:"0.04em",
        }}>
          {adjustErrors.length>0 ? "空きコマを許容してシフト案を生成 →" : "この回数でシフト案を生成 →"}
        </button>
      </div>
    );
  };

  // ─────────────────────────────────────────────────────
  // 結果ビュー
  // ─────────────────────────────────────────────────────
  // 手動上書きを適用したシフトを返す
  const getEffectiveShift = () => {
    if (!patterns) return null;
    const base = patterns[selPattern].shift;
    if (!manualShift) return base;
    const merged = {};
    Object.keys(base).forEach(dk => {
      merged[dk] = { ...base[dk], ...(manualShift[dk]||{}) };
    });
    return merged;
  };

  const resultView = () => {
    const pat = patterns[selPattern];
    const shift = getEffectiveShift();
    const getName = id => staffList.find(s=>s.id===id)?.name;
    const resolvedStaff = staffList.map(s => {
      if (s.role==="limited"&&limitedCounts[s.id]!==undefined) return {...s,fixedCount:limitedCounts[s.id]};
      if (s.role==="regular"&&regularCounts[s.id]!==undefined) return {...s,fixedCount:regularCounts[s.id]};
      return s;
    });

    // manualShift反映後のam/pm/週カウントを再計算
    const effAmCounts = {}, effPmCounts = {}, effWeekCounts = {};
    staffList.forEach(s => { effAmCounts[s.id]=0; effPmCounts[s.id]=0; effWeekCounts[s.id]={}; });
    if (shift) {
      let wi2=0, prevM=null;
      const wkOf = {};
      weekdays.forEach(d => {
        const mon=new Date(d); mon.setDate(d.getDate()-((d.getDay()+6)%7));
        const mk=mon.toISOString().slice(0,10);
        if(mk!==prevM){wi2++;prevM=mk;}
        wkOf[dateKey(d)]=wi2;
      });
      Object.entries(shift).forEach(([dk,v])=>{
        const wk=wkOf[dk]||0;
        if(v.am){ effAmCounts[v.am]=(effAmCounts[v.am]||0)+1; effWeekCounts[v.am]={...effWeekCounts[v.am],[wk]:(effWeekCounts[v.am]?.[wk]||0)+1}; }
        if(v.pm){ effPmCounts[v.pm]=(effPmCounts[v.pm]||0)+1; effWeekCounts[v.pm]={...effWeekCounts[v.pm],[wk]:(effWeekCounts[v.pm]?.[wk]||0)+1}; }
      });
    }

    const DOW_LABELS = ["月","火","水","木","金"];

    // 手動コマ変更ハンドラ
    const handleSlotEdit = (dk, sl, newStaffId) => {
      setManualShift(prev => ({
        ...(prev||{}),
        [dk]: { ...(prev?.[dk]||{}), [sl]: newStaffId }
      }));
      setEditingSlot(null);
    };

    // 編集ポップアップ: そのコマに○をつけている人だけ選択肢に
    const EditPopup = ({ dk, sl }) => {
      const candidates = staffList.filter(s => availability[s.id]?.[dk]?.[sl] === true);
      const currentId = shift[dk]?.[sl];
      return (
        <div style={{
          position:"fixed",top:0,left:0,right:0,bottom:0,
          background:"rgba(0,0,0,0.4)",zIndex:1000,
          display:"flex",alignItems:"center",justifyContent:"center",
        }} onClick={()=>setEditingSlot(null)}>
          <div style={{
            background:C.surface,borderRadius:16,padding:"20px",
            minWidth:200,maxWidth:300,boxShadow:"0 8px 32px rgba(0,0,0,0.2)",
          }} onClick={e=>e.stopPropagation()}>
            <p style={{fontWeight:700,fontSize:14,color:C.text,marginBottom:4}}>
              {weekdays.find(d=>dateKey(d)===dk) ? fmtDate(weekdays.find(d=>dateKey(d)===dk)) : dk}　{sl==="am"?"午前":"午後"}
            </p>
            <p style={{fontSize:11,color:C.muted,marginBottom:12}}>担当者を選択</p>
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {candidates.length === 0 && (
                <p style={{fontSize:12,color:C.danger}}>このコマに○をつけた人がいません</p>
              )}
              {candidates.map(s=>{
                const isLim = s.role==="limited";
                const isCur = s.id === currentId;
                return (
                  <button key={s.id} onClick={()=>handleSlotEdit(dk,sl,s.id)} style={{
                    padding:"10px 14px",borderRadius:10,cursor:"pointer",textAlign:"left",
                    border:`2px solid ${isCur?(isLim?C.limited:C.accent):C.border}`,
                    background:isCur?(isLim?C.limitedLight:C.accentLight):C.surface,
                    fontWeight:isCur?700:400,fontSize:14,
                    color:isCur?(isLim?C.limited:C.accent):C.text,
                  }}>
                    {s.name} {isCur&&"✓"}
                  </button>
                );
              })}
              <button onClick={()=>handleSlotEdit(dk,sl,null)} style={{
                padding:"10px 14px",borderRadius:10,cursor:"pointer",textAlign:"left",
                border:`2px solid ${!currentId?C.danger:C.border}`,
                background:!currentId?C.dangerBg:C.surface,
                fontWeight:!currentId?700:400,fontSize:14,color:C.danger,
              }}>空き（未割り当て）{!currentId&&"✓"}</button>
            </div>
          </div>
        </div>
      );
    };

    const handlePrint = () => window.print();

    return (
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        <style>{`
          @media print {
            @page { size: A4 landscape; margin: 10mm; }
            body * { visibility: hidden; }
            #shift-print-area, #shift-print-area * { visibility: visible; }
            #shift-print-area {
              position: fixed; top: 0; left: 0;
              width: 100%; height: 100%;
              padding: 0; margin: 0;
            }
            .no-print { display: none !important; }
          }
        `}</style>
        {editingSlot && <EditPopup dk={editingSlot.dk} sl={editingSlot.sl}/>}
        <div className="no-print" style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
          <button onClick={()=>setView("adjust")} style={{background:"none",border:`1px solid ${C.border}`,borderRadius:8,padding:"5px 12px",cursor:"pointer",color:C.muted,fontSize:12}}>← 戻る</button>
          <span style={{fontWeight:700,fontSize:15,color:C.text}}>{year}年{month}月 シフト案</span>
          <div style={{marginLeft:"auto",display:"flex",gap:6,alignItems:"center"}}>
            <span style={{fontSize:11,color:"#16A34A",fontWeight:600}}>💾 保存済み</span>
            {manualShift && Object.keys(manualShift).length>0 && (
              <button onClick={()=>{setManualShift(null);setEditingSlot(null);}} style={{
                fontSize:11,color:C.muted,background:"none",
                border:`1px solid ${C.border}`,borderRadius:8,padding:"4px 10px",cursor:"pointer",
              }}>手動変更をリセット</button>
            )}
            <button onClick={handlePrint} style={{
              fontSize:12,fontWeight:700,color:"#fff",
              background:C.accent,border:"none",
              borderRadius:8,padding:"6px 14px",cursor:"pointer",
            }}>🖨 印刷</button>
          </div>
        </div>

        {/* パターン切替 */}
        <div style={{display:"flex",gap:6}}>
          {patterns.map((p,i)=>{
            const resolvedS = staffList.map(s =>
              s.role==="regular"&&regularCounts[s.id]!==undefined?{...s,fixedCount:regularCounts[s.id]}:s
            );
            const sc = shiftScore(p.counts,resolvedS,regularTarget??0);
            const active = i===selPattern;
            return (
              <button key={i} onClick={()=>setSelPattern(i)} style={{
                flex:1,padding:"10px 4px",borderRadius:10,cursor:"pointer",textAlign:"center",
                border:`2px solid ${active?C.accent:C.border}`,
                background:active?C.accentLight:C.surface,
              }}>
                <div style={{fontWeight:700,fontSize:14,color:active?C.accent:C.text}}>案 {i+1}</div>
                <div style={{fontSize:11,color:sc===0?C.amText:C.muted,marginTop:2,fontWeight:sc===0?700:400}}>
                  {sc===0?"✓ 完全均等":`ズレ度 ${sc}`}
                </div>
              </button>
            );
          })}
        </div>

        {/* 担当回数サマリー */}
        <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:"12px 14px"}}>
          <p style={{fontSize:12,fontWeight:700,color:C.muted,marginBottom:10}}>担当回数</p>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))",gap:6}}>
            {staffList.map(s=>{
              const isLim = s.role==="limited";
              const target = isLim ? (limitedCounts[s.id]??s.fixedCount) : (regularCounts[s.id] ?? regularTarget ?? 0);
              const effShift = getEffectiveShift() || {};
              const actual = Object.values(effShift).reduce((a,v)=>{
                if(v.am===s.id) a++; if(v.pm===s.id) a++; return a;
              }, 0);
              const amC = effAmCounts[s.id]||0;
              const pmC = effPmCounts[s.id]||0;
              const wkC = effWeekCounts[s.id]||{};
              const wkVals = Object.values(wkC);
              const wkSpread = wkVals.length>0 ? Math.max(...wkVals)-Math.min(...wkVals) : 0;
              const match = actual === target;
              const ampmOk = Math.abs(amC-pmC) <= 1;
              const weekOk = wkSpread <= 1;
              return (
                <div key={s.id} style={{
                  padding:"7px 11px",borderRadius:10,
                  background:match?(isLim?C.limitedLight:C.accentLight):"#FEF2F2",
                  border:`1.5px solid ${match?(isLim?C.limited:C.accent):"#FECACA"}`,
                }}>
                  <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:3}}>
                    <span style={{fontSize:12,fontWeight:700,color:C.text}}>{s.name}</span>
                    <span style={{fontSize:14,fontWeight:800,color:match?(isLim?C.limited:C.accent):C.danger}}>{actual}</span>
                    <span style={{fontSize:10,color:C.muted}}>/{target}回</span>
                    {!match && <span style={{fontSize:10,color:C.danger}}>⚠</span>}
                  </div>
                  <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                    <span style={{fontSize:10,padding:"1px 5px",borderRadius:4,
                      background:ampmOk?C.am:C.dangerBg,color:ampmOk?C.amText:C.danger,fontWeight:600}}>
                      午前{amC} 午後{pmC}
                    </span>
                    <span style={{fontSize:10,padding:"1px 5px",borderRadius:4,
                      background:weekOk?"#EDE9FE":"#FEF2F2",color:weekOk?"#6D28D9":C.danger,fontWeight:600}}>
                      週ズレ{wkSpread}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* シフト表（週グリッド） */}
        <div id="shift-print-area">
        <div style={{background:"#fff",fontFamily:"'Hiragino Sans','Noto Sans JP',sans-serif"}}>
          {/* タイトル行 */}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8,padding:"0 2px"}}>
            <span style={{fontSize:14,fontWeight:700,color:C.text}}>{year}年{month}月 シフト表</span>
            <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
              {staffList.map(s=>{
                const sc = STAFF_COLORS[s.id]||{bg:"#eee",text:"#333"};
                return <span key={s.id} style={{fontSize:10,fontWeight:700,padding:"2px 7px",borderRadius:4,background:sc.bg,color:sc.text}}>{s.name}</span>;
              })}
            </div>
          </div>
          {/* 担当回数サマリー（印刷用） */}
          <div style={{marginBottom:10,padding:"8px 10px",borderRadius:8,border:`1px solid ${C.border}`,background:"#FAFAFA"}}>
            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
              <span style={{fontSize:11,fontWeight:700,color:C.muted}}>担当回数</span>
            </div>
            <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
              {staffList.map(s=>{
                const sc = STAFF_COLORS[s.id]||{bg:"#eee",text:"#333"};
                const isLim = s.role==="limited";
                const target = isLim ? (limitedCounts[s.id]??s.fixedCount) : (regularCounts[s.id]??regularTarget??0);
                const effShift2 = getEffectiveShift()||{};
                const actual = Object.values(effShift2).reduce((a,v)=>{
                  if(v.am===s.id)a++; if(v.pm===s.id)a++; return a;
                },0);
                const amC2 = effAmCounts[s.id]||0;
                const pmC2 = effPmCounts[s.id]||0;
                const wkC2 = effWeekCounts[s.id]||{};
                const wkVals2 = Object.values(wkC2);
                const wkSpread2 = wkVals2.length>0?Math.max(...wkVals2)-Math.min(...wkVals2):0;
                const match = actual===target;
                const ampmOk = Math.abs(amC2-pmC2)<=1;
                const weekOk = wkSpread2<=1;
                return (
                  <div key={s.id} style={{
                    padding:"5px 9px",borderRadius:8,
                    background:sc.bg,
                    border:`1.5px solid ${match?sc.text+"55":"#FECACA"}`,
                    minWidth:0,
                  }}>
                    <div style={{display:"flex",alignItems:"baseline",gap:4}}>
                      <span style={{fontSize:12,fontWeight:800,color:sc.text}}>{s.name}</span>
                      <span style={{fontSize:13,fontWeight:800,color:match?sc.text:C.danger}}>{actual}</span>
                      <span style={{fontSize:9,color:C.muted}}>/{target}回</span>
                      {!match&&<span style={{fontSize:9,color:C.danger}}>⚠</span>}
                    </div>
                    <div style={{display:"flex",gap:3,marginTop:2}}>
                      <span style={{fontSize:9,padding:"1px 4px",borderRadius:3,
                        background:ampmOk?"#E8F5E9":"#FEE2E2",
                        color:ampmOk?"#2E7D32":C.danger,fontWeight:600}}>
                        前{amC2} 後{pmC2}
                      </span>
                      <span style={{fontSize:9,padding:"1px 4px",borderRadius:3,
                        background:weekOk?"#EDE9FE":"#FEE2E2",
                        color:weekOk?"#5B21B6":C.danger,fontWeight:600}}>
                        週ズレ{wkSpread2}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}>
          {/* 曜日ヘッダー */}
          <div style={{display:"grid",gridTemplateColumns:"60px repeat(5,1fr)",background:C.accent,color:"#fff",fontSize:12,fontWeight:700}}>
            <div style={{padding:"8px 6px",textAlign:"center"}}>区分</div>
            {DOW_LABELS.map(l=><div key={l} style={{padding:"8px 4px",textAlign:"center"}}>{l}</div>)}
          </div>

          {weeks.map((week,wi)=>(
            <div key={wi} style={{borderTop:`2px solid ${C.border}`}}>
              {/* 午前行 */}
              <div style={{display:"grid",gridTemplateColumns:"60px repeat(5,1fr)",borderBottom:`1px solid ${C.border}`}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"center",background:C.am,fontSize:11,fontWeight:700,color:C.amText}}>午前</div>
                {week.map((d,di)=>{
                  const borderL = di>0?`1px solid ${C.border}`:"none";
                  if (!d) return <div key={di} style={{background:"#F0EEE8",borderLeft:borderL}}/>;
                  const dk = dateKey(d);
                  const isHoliday = holidays.has(dk);
                  if (isHoliday) return (
                    <div key={dk} style={{padding:"6px 4px",textAlign:"center",borderLeft:borderL,background:"#F0EEE8",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:44}}>
                      <span style={{fontSize:10,color:"#B0A8A0"}}>{fmtDate(d)}</span>
                      <span style={{fontSize:9,color:C.danger,fontWeight:700}}>祝</span>
                    </div>
                  );
                  const staffId = shift[dk]?.am;
                  const isManual = manualShift?.[dk]?.am !== undefined;
                  const amColor = staffId ? (STAFF_COLORS[staffId]||{bg:C.am,text:C.amText}) : null;
                  return (
                    <div key={dk} onClick={()=>setEditingSlot({dk,sl:"am"})}
                      style={{padding:"6px 4px",textAlign:"center",borderLeft:borderL,
                        background:C.surface,cursor:"pointer",
                        outline:editingSlot?.dk===dk&&editingSlot?.sl==="am"?`2px solid ${C.accent}`:"none"}}>
                      <div style={{fontSize:10,color:C.muted,marginBottom:2}}>{fmtDate(d)}</div>
                      {staffId
                        ? <span style={{display:"inline-block",padding:"2px 8px",borderRadius:6,
                            background:isManual?"#FEF9C3":amColor.bg,
                            color:isManual?"#854D0E":amColor.text,
                            fontWeight:700,fontSize:12,
                            outline:isManual?`1px solid #D97706`:"none"}}>
                            {getName(staffId)}{isManual?"✎":""}
                          </span>
                        : <span style={{display:"inline-block",padding:"2px 8px",borderRadius:6,background:C.dangerBg,color:C.danger,fontWeight:700,fontSize:11}}>空き</span>}
                    </div>
                  );
                })}
              </div>
              {/* 午後行 */}
              <div style={{display:"grid",gridTemplateColumns:"60px repeat(5,1fr)"}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"center",background:C.pm,fontSize:11,fontWeight:700,color:C.pmText}}>午後</div>
                {week.map((d,di)=>{
                  const borderL = di>0?`1px solid ${C.border}`:"none";
                  if (!d) return <div key={di} style={{background:"#F0EEE8",borderLeft:borderL}}/>;
                  const dk = dateKey(d);
                  const isHoliday = holidays.has(dk);
                  if (isHoliday) return (
                    <div key={dk} style={{padding:"6px 4px",borderLeft:borderL,background:"#F0EEE8",minHeight:36}}/>
                  );
                  const staffId = shift[dk]?.pm;
                  const isManualPm = manualShift?.[dk]?.pm !== undefined;
                  const pmColor = staffId ? (STAFF_COLORS[staffId]||{bg:C.pm,text:C.pmText}) : null;
                  return (
                    <div key={dk} onClick={()=>setEditingSlot({dk,sl:"pm"})}
                      style={{padding:"6px 4px",textAlign:"center",borderLeft:borderL,
                        background:wi%2===0?C.bg:C.surface,cursor:"pointer",
                        outline:editingSlot?.dk===dk&&editingSlot?.sl==="pm"?`2px solid ${C.accent}`:"none"}}>
                      {staffId
                        ? <span style={{display:"inline-block",padding:"2px 8px",borderRadius:6,
                            background:isManualPm?"#FEF9C3":pmColor.bg,
                            color:isManualPm?"#854D0E":pmColor.text,
                            fontWeight:700,fontSize:12,
                            outline:isManualPm?`1px solid #D97706`:"none"}}>
                            {getName(staffId)}{isManualPm?"✎":""}
                          </span>
                        : <span style={{display:"inline-block",padding:"2px 8px",borderRadius:6,background:C.dangerBg,color:C.danger,fontWeight:700,fontSize:11}}>空き</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        </div> {/* end shift-print-area */}
      </div>
    );
  };

  // ── 希望提出ビュー ──────────────────────────────────────
  const submitView = () => {
    const DOW_LABELS = ["月","火","水","木","金"];
    const submissions = loadSubmissions();
    const monthKey = `${year}-${String(month).padStart(2,"0")}`;
    const monthSubs = submissions[monthKey] || {};
    const submittedIds = Object.keys(monthSubs);

    // 提出完了画面
    if (submitDone) {
      return (
        <div style={{display:"flex",flexDirection:"column",gap:16,alignItems:"center",paddingTop:40}}>
          <div style={{fontSize:48}}>✅</div>
          <p style={{fontSize:18,fontWeight:700,color:C.text}}>提出しました！</p>
          <p style={{fontSize:13,color:C.muted}}>{year}年{month}月の希望が保存されました</p>
          <button onClick={()=>{setSubmitDone(false);setSubmitStaffId(null);setSubmitAvail({});}}
            style={{marginTop:8,padding:"12px 28px",borderRadius:12,background:C.accent,color:"#fff",border:"none",fontSize:15,fontWeight:700,cursor:"pointer"}}>
            別の人が入力する
          </button>
        </div>
      );
    }

    // スタッフ選択画面
    if (!submitStaffId) {
      return (
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:"14px 16px"}}>
            <p style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:4}}>{year}年{month}月 希望提出状況</p>
            <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:8}}>
              {staffList.map(s=>{
                const done = submittedIds.includes(s.id);
                const sc = STAFF_COLORS[s.id]||{bg:"#eee",text:"#333"};
                return (
                  <span key={s.id} style={{
                    padding:"4px 12px",borderRadius:20,fontSize:13,fontWeight:700,
                    background:done?sc.bg:"#F3F4F6",
                    color:done?sc.text:C.muted,
                    border:`1.5px solid ${done?sc.text+"44":C.border}`,
                  }}>
                    {done?"✓ ":""}{s.name}
                  </span>
                );
              })}
            </div>
            <p style={{fontSize:11,color:C.muted,marginTop:8}}>
              {submittedIds.length}/{staffList.length}人 提出済み
            </p>
          </div>

          <p style={{fontSize:14,fontWeight:700,color:C.text}}>あなたの名前を選んでください</p>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {staffList.map(s=>{
              const done = submittedIds.includes(s.id);
              const sc = STAFF_COLORS[s.id]||{bg:"#eee",text:"#333"};
              return (
                <button key={s.id} onClick={()=>{
                  // 既提出の場合は既存データを読み込む
                  const existing = monthSubs[s.id] || {};
                  setSubmitAvail(existing);
                  setSubmitStaffId(s.id);
                }} style={{
                  display:"flex",alignItems:"center",gap:12,
                  padding:"14px 16px",borderRadius:12,cursor:"pointer",
                  border:`2px solid ${done?sc.text+"66":C.border}`,
                  background:done?sc.bg:C.surface,
                  textAlign:"left",
                }}>
                  <span style={{
                    width:36,height:36,borderRadius:"50%",
                    display:"flex",alignItems:"center",justifyContent:"center",
                    background:sc.bg,border:`2px solid ${sc.text}44`,
                    fontSize:16,fontWeight:800,color:sc.text,flexShrink:0,
                  }}>{s.name}</span>
                  <div>
                    <div style={{fontSize:15,fontWeight:700,color:C.text}}>{s.name}</div>
                    <div style={{fontSize:11,color:done?"#16A34A":C.muted}}>
                      {done ? `✓ 提出済み（修正も可能）` : "未提出"}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      );
    }

    // カレンダー入力画面
    const staff = staffList.find(s=>s.id===submitStaffId);
    const sc = STAFF_COLORS[submitStaffId]||{bg:"#eee",text:"#333"};
    const slotCount = Object.values(submitAvail).reduce((a,v)=>a+(v.am?1:0)+(v.pm?1:0),0);

    const toggleSubmitSlot = (dk, sl) => {
      setSubmitAvail(prev=>{
        const cur = prev[dk]||{am:false,pm:false};
        const next = {...cur,[sl]:!cur[sl]};
        if(!next.am&&!next.pm){const n={...prev};delete n[dk];return n;}
        return {...prev,[dk]:next};
      });
    };

    const handleSubmit = () => {
      saveSubmission(submitStaffId, year, month, submitAvail);
      setSubmitDone(true);
    };

    return (
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        {/* ヘッダー */}
        <div style={{display:"flex",alignItems:"center",gap:10,
          background:sc.bg,borderRadius:12,padding:"12px 16px",
          border:`2px solid ${sc.text}44`}}>
          <span style={{width:40,height:40,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",
            background:"#fff",fontSize:18,fontWeight:800,color:sc.text,flexShrink:0}}>{staff.name}</span>
          <div>
            <p style={{fontSize:15,fontWeight:700,color:sc.text}}>{staff.name}さんの希望入力</p>
            <p style={{fontSize:11,color:sc.text,opacity:.8}}>{year}年{month}月　選択中: {slotCount}コマ</p>
          </div>
          <button onClick={()=>{setSubmitStaffId(null);setSubmitAvail({});}}
            style={{marginLeft:"auto",background:"none",border:`1px solid ${sc.text}44`,borderRadius:8,padding:"5px 10px",cursor:"pointer",fontSize:12,color:sc.text}}>
            ← 戻る
          </button>
        </div>

        {/* コマ数カウンター */}
        {(() => {
          const amCount = Object.values(submitAvail).filter(v=>v.am).length;
          const pmCount = Object.values(submitAvail).filter(v=>v.pm).length;
          return (
            <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
              <span style={{fontSize:12,color:C.muted}}>
                出勤できるコマをタップして <span style={{color:sc.text,fontWeight:700}}>○</span> に
              </span>
              <div style={{marginLeft:"auto",display:"flex",gap:6}}>
                <span style={{fontSize:12,fontWeight:700,padding:"3px 10px",borderRadius:20,
                  background:C.am,color:C.amText}}>
                  午前 {amCount}コマ
                </span>
                <span style={{fontSize:12,fontWeight:700,padding:"3px 10px",borderRadius:20,
                  background:C.pm,color:C.pmText}}>
                  午後 {pmCount}コマ
                </span>
                <span style={{fontSize:12,fontWeight:700,padding:"3px 10px",borderRadius:20,
                  background:sc.bg,color:sc.text}}>
                  計 {amCount+pmCount}コマ
                </span>
              </div>
            </div>
          );
        })()}

        {/* カレンダー */}
        <div style={{borderRadius:10,overflow:"hidden",border:`1px solid ${C.border}`}}>
          <div style={{display:"grid",gridTemplateColumns:"44px repeat(5,1fr)",background:C.accent}}>
            <div/>
            {DOW_LABELS.map(l=>(
              <div key={l} style={{textAlign:"center",padding:"6px 0",fontSize:12,fontWeight:700,color:"#fff"}}>{l}</div>
            ))}
          </div>
          {weeks.map((week,wi)=>(
            <div key={wi} style={{borderTop:`2px solid ${C.border}`}}>
              {/* 日付行 */}
              <div style={{display:"grid",gridTemplateColumns:"44px repeat(5,1fr)",background:"#F7F6F3"}}>
                <div/>
                {week.map((d,di)=>{
                  const borderL = di>0?`1px solid ${C.border}`:"none";
                  if(!d) return <div key={di} style={{background:"#EEECEA",borderLeft:borderL,minHeight:18}}/>;
                  const dk=dateKey(d);
                  const isH=holidays.has(dk);
                  return (
                    <div key={dk} style={{textAlign:"center",padding:"3px 2px",borderLeft:borderL,
                      background:isH?"#F0EEE8":"#F7F6F3",fontSize:11,color:isH?"#B0A8A0":C.muted}}>
                      {fmtDate(d)}{isH&&<span style={{marginLeft:2,fontSize:9,color:C.danger}}>祝</span>}
                    </div>
                  );
                })}
              </div>
              {/* 午前行 */}
              <div style={{display:"grid",gridTemplateColumns:"44px repeat(5,1fr)",borderTop:`1px solid ${C.border}`}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"center",background:C.am}}>
                  <span style={{fontSize:10,fontWeight:700,color:C.amText}}>午前</span>
                </div>
                {week.map((d,di)=>{
                  const borderL=di>0?`1px solid ${C.border}`:"none";
                  if(!d) return <div key={di} style={{background:"#EEECEA",borderLeft:borderL}}/>;
                  const dk=dateKey(d);
                  if(holidays.has(dk)) return <div key={dk} style={{background:"#F0EEE8",borderLeft:borderL,minHeight:40}}/>;
                  const on=!!(submitAvail[dk]?.am);
                  return (
                    <button key={dk+"-am"} onClick={()=>toggleSubmitSlot(dk,"am")} style={{
                      minHeight:40,padding:"2px",cursor:"pointer",textAlign:"center",
                      border:"none",borderLeft:borderL,
                      background:on?sc.bg:C.surface,
                      color:on?sc.text:C.muted,
                      fontWeight:on?700:400,fontSize:14,
                    }}>{on?"○":"―"}</button>
                  );
                })}
              </div>
              {/* 午後行 */}
              <div style={{display:"grid",gridTemplateColumns:"44px repeat(5,1fr)",borderTop:`1px solid ${C.border}`}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"center",background:C.pm}}>
                  <span style={{fontSize:10,fontWeight:700,color:C.pmText}}>午後</span>
                </div>
                {week.map((d,di)=>{
                  const borderL=di>0?`1px solid ${C.border}`:"none";
                  if(!d) return <div key={di} style={{background:"#EEECEA",borderLeft:borderL}}/>;
                  const dk=dateKey(d);
                  if(holidays.has(dk)) return <div key={dk} style={{background:"#F0EEE8",borderLeft:borderL,minHeight:40}}/>;
                  const on=!!(submitAvail[dk]?.pm);
                  return (
                    <button key={dk+"-pm"} onClick={()=>toggleSubmitSlot(dk,"pm")} style={{
                      minHeight:40,padding:"2px",cursor:"pointer",textAlign:"center",
                      border:"none",borderLeft:borderL,
                      background:on?sc.bg:wi%2===0?C.bg:C.surface,
                      color:on?sc.text:C.muted,
                      fontWeight:on?700:400,fontSize:14,
                    }}>{on?"○":"―"}</button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <button onClick={handleSubmit} style={{
          background:sc.text,color:"#fff",border:"none",
          borderRadius:12,padding:"15px",fontSize:16,fontWeight:700,
          cursor:"pointer",letterSpacing:"0.04em",
        }}>
          {staff.name}の希望を提出する ✓
        </button>
      </div>
    );
  };

  // ── 管理者向け希望読み込み ──────────────────────────────
  const loadSubmissionsToAvailability = () => {
    const subs = loadSubmissions();
    const key = `${year}-${String(month).padStart(2,"0")}`;
    const monthSubs = subs[key];
    if (!monthSubs || Object.keys(monthSubs).length === 0) {
      alert("この月の提出データがありません");
      return;
    }
    const newAvail = {};
    staffList.forEach(s => { newAvail[s.id] = monthSubs[s.id] || {}; });
    setAvailability(newAvail);
    alert(`${Object.keys(monthSubs).length}人分の希望を読み込みました`);
  };

  return (
    <div style={{minHeight:"100vh",background:C.bg,fontFamily:"'Hiragino Sans','Noto Sans JP',sans-serif",paddingBottom:48}}>
      {/* モード切替ヘッダー */}
      <div style={{background:appMode==="submit"?"#065F46":C.accent,padding:"15px 20px 11px",marginBottom:18}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
          <p style={{color:"rgba(255,255,255,.6)",fontSize:11}}>クリニック シフト管理</p>
          <div style={{marginLeft:"auto",display:"flex",gap:4}}>
            <button onClick={()=>{setAppMode("manager");setSubmitStaffId(null);setSubmitAvail({});setSubmitDone(false);}} style={{
              padding:"4px 10px",borderRadius:20,border:"none",cursor:"pointer",fontSize:11,fontWeight:700,
              background:appMode==="manager"?"#fff":"rgba(255,255,255,0.2)",
              color:appMode==="manager"?C.accent:"#fff",
            }}>管理者</button>
            <button onClick={()=>{setAppMode("submit");setSubmitStaffId(null);setSubmitAvail({});setSubmitDone(false);}} style={{
              padding:"4px 10px",borderRadius:20,border:"none",cursor:"pointer",fontSize:11,fontWeight:700,
              background:appMode==="submit"?"#fff":"rgba(255,255,255,0.2)",
              color:appMode==="submit"?"#065F46":"#fff",
            }}>希望提出</button>
            <button onClick={()=>{
              if(!window.confirm("保存されたデータをすべてリセットしてアプリを初期状態に戻しますか？
（スタッフ設定・可能日入力・シフト案がすべて消えます）")) return;
              localStorage.removeItem(LS_KEY);
              localStorage.removeItem(LS_SUBMIT_KEY);
              window.location.reload();
            }} style={{
              padding:"4px 10px",borderRadius:20,border:"1px solid rgba(255,255,255,0.4)",
              cursor:"pointer",fontSize:11,fontWeight:700,
              background:"rgba(255,255,255,0.1)",color:"rgba(255,255,255,0.7)",
            }}>リセット</button>
          </div>
        </div>
        <h1 style={{color:"#fff",fontSize:19,fontWeight:700,letterSpacing:"0.03em"}}>
          {appMode==="submit"
            ? `${year}年${month}月 希望提出`
            : view==="input"?"可能日を入力":view==="adjust"?"回数を調整":`${year}年${month}月 シフト`}
        </h1>
      </div>
      <div style={{padding:"0 14px",maxWidth:620,margin:"0 auto"}}>
        {appMode==="submit" && submitView()}
        {appMode==="manager" && view==="input"  && inputView()}
        {appMode==="manager" && view==="adjust" && adjustView()}
        {appMode==="manager" && view==="result" && resultView()}
      </div>
    </div>
  );
}
