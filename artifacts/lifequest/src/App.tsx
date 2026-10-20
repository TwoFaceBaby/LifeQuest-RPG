import { useEffect, useMemo, useState, type ChangeEvent, type ReactNode, type CSSProperties } from 'react';
import { Link, Route, Switch, useLocation } from 'wouter';
import {
  Activity, ArrowDownLeft, ArrowLeft, ArrowRight, ArrowUpRight, Award,
  AlertTriangle, BookOpen, Check, CheckCircle2, CircleHelp, Compass, CreditCard,
  FileDown, FileUp,
  Dumbbell, Gem, LayoutDashboard, ListTodo, LockKeyhole, MoreHorizontal,
  Plus, ScrollText, Shield, Swords, Trash2, Trophy, UserRound, Wallet,
  X, Zap
} from 'lucide-react';
import { AdvancedWorld, defaultExtras, normalizeExtras, type LifeExtras } from './AdvancedWorld';
import { PhaseTwoWorld, emptyPhaseTwo, normalizePhaseTwo, validPhaseTwo, type PhaseTwoData } from './PhaseTwo';

type Difficulty = 'Trivial' | 'Easy' | 'Medium' | 'Hard' | 'Epic';
type QuestStatus = 'active' | 'postponed' | 'completed' | 'archived';
type Currency = 'ZAR' | 'USD' | 'EUR' | 'GBP';
type Skill = { id: string; name: string; xp: number; history: { amount: number; quest: string; at: string }[] };
type QuestCadence = 'once' | 'daily' | 'weekly' | 'boss' | 'epic';
type QuestSubtask = { id: string; title: string; done: boolean };
type QuestPriority = 'low' | 'normal' | 'high';
type QuestOccurrence = { periodKey: string; completedAt: string; xpAwarded: number };
type Quest = { id: string; title: string; description: string; difficulty: Difficulty; skillId: string; status: QuestStatus; createdAt: string; completedAt?: string; xpAwarded?: number; cadence?: QuestCadence; occurrences?: QuestOccurrence[]; category?: string; priority?: QuestPriority; estimatedMinutes?: number; startDate?: string; dueDate?: string; completionCriteria?: string; evidence?: string; subtasks?: QuestSubtask[]; financialImpact?: number };
type Achievement = { id: string; title: string; detail: string; earnedAt: string };
type Transaction = { id: string; amount: number; currency: Currency; type: 'income' | 'expense'; category: string; note: string; at: string };
type State = { version: number; profile: null | { name: string; className: string; focus: string[]; createdAt: string }; totalXp: number; skills: Skill[]; quests: Quest[]; achievements: Achievement[]; wallet: { baseCurrency: Currency }; transactions: Transaction[]; phaseTwo: PhaseTwoData; extras: LifeExtras };

const DB_NAME = 'lifequest-local';
const STORE = 'state';
const REWARDS: Record<Difficulty, number> = { Trivial: 5, Easy: 20, Medium: 50, Hard: 100, Epic: 250 };
const emptyState = (): State => ({ version: 1, profile: null, totalXp: 0, skills: [], quests: [], achievements: [], wallet: { baseCurrency: 'ZAR' }, transactions: [], phaseTwo: emptyPhaseTwo(), extras: defaultExtras() });
const id = () => crypto.randomUUID();
const levelInfo = (xp: number) => {
  let level = 1;
  while (xp >= Math.round(100 * Math.pow(level, 1.5))) { xp -= Math.round(100 * Math.pow(level, 1.5)); level++; }
  const next = Math.round(100 * Math.pow(level, 1.5));
  return { level, into: xp, next, percent: Math.min(100, xp / next * 100) };
};
const safeState = (value: unknown): State => {
  if (!value || typeof value !== 'object') return emptyState();
  const v = value as Partial<State>;
  const base = emptyState();
  return {
    version: 1,
    profile: v.profile && typeof v.profile.name === 'string' ? v.profile : null,
    totalXp: Number.isFinite(v.totalXp) && (v.totalXp ?? 0) >= 0 ? v.totalXp! : 0,
    skills: Array.isArray(v.skills) ? v.skills.filter(s => s && typeof s.id === 'string' && typeof s.name === 'string' && Number.isFinite(s.xp)).map(s => ({ ...s, history: Array.isArray(s.history) ? s.history : [] })) : [],
    quests: Array.isArray(v.quests) ? v.quests.filter(q => q && typeof q.id === 'string' && typeof q.title === 'string' && q.status && q.difficulty in REWARDS).map(q => ({ ...q, cadence: q.cadence === 'daily' || q.cadence === 'weekly' || q.cadence === 'boss' || q.cadence === 'epic' ? q.cadence : 'once', priority: ['low','normal','high'].includes(q.priority || '') ? q.priority : 'normal', estimatedMinutes: Number.isFinite(q.estimatedMinutes) && (q.estimatedMinutes || 0) >= 0 ? q.estimatedMinutes : 30, subtasks: Array.isArray(q.subtasks) ? q.subtasks.filter(t => t && typeof t.id === 'string' && typeof t.title === 'string' && typeof t.done === 'boolean') : [], occurrences: Array.isArray(q.occurrences) ? q.occurrences.filter(o => o && typeof o.periodKey === 'string' && typeof o.completedAt === 'string' && Number.isFinite(o.xpAwarded)) : [] })) : [],
    achievements: Array.isArray(v.achievements) ? v.achievements.filter(a => a && typeof a.id === 'string') : [],
    wallet: { baseCurrency: ['ZAR','USD','EUR','GBP'].includes(v.wallet?.baseCurrency || '') ? v.wallet!.baseCurrency : base.wallet.baseCurrency },
    transactions: Array.isArray(v.transactions) ? v.transactions.filter(t => t && typeof t.id === 'string' && Number.isFinite(t.amount) && t.amount > 0 && ['ZAR','USD','EUR','GBP'].includes(t.currency) && ['income','expense'].includes(t.type)) : [],
    phaseTwo: normalizePhaseTwo(v.phaseTwo),
    extras: normalizeExtras(v.extras),
  };
};
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isDateString = (value: unknown): value is string =>
  typeof value === 'string' && Number.isFinite(Date.parse(value));
function readBackup(text: string): State {
  if (text.length > 10 * 1024 * 1024) throw new Error('This backup is larger than 10 MB and cannot be restored.');
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { throw new Error('This file is not valid JSON. Choose a LIFEQUEST backup file.'); }
  if (!isRecord(parsed) || parsed.format !== 'LIFEQUEST_BACKUP' || parsed.backupVersion !== 1 || !isDateString(parsed.createdAt)) {
    throw new Error('This is not a supported LIFEQUEST backup. Choose a version 1 backup file.');
  }
  const value = parsed.data;
  if (!isRecord(value) || value.version !== 1 || !Number.isFinite(value.totalXp) || (value.totalXp as number) < 0) {
    throw new Error('The backup is incomplete or uses an unsupported data version.');
  }
  const profile = value.profile;
  const validProfile = profile === null || (isRecord(profile) &&
    typeof profile.name === 'string' && typeof profile.className === 'string' &&
    Array.isArray(profile.focus) && profile.focus.every(item => typeof item === 'string') &&
    isDateString(profile.createdAt));
  const validSkills = Array.isArray(value.skills) && value.skills.every(skill =>
    isRecord(skill) && typeof skill.id === 'string' && typeof skill.name === 'string' &&
    Number.isFinite(skill.xp) && (skill.xp as number) >= 0 &&
    Array.isArray(skill.history) && skill.history.every(entry =>
      isRecord(entry) && Number.isFinite(entry.amount) && (entry.amount as number) >= 0 &&
      typeof entry.quest === 'string' && isDateString(entry.at)));
  const validQuests = Array.isArray(value.quests) && value.quests.every(quest =>
    isRecord(quest) && typeof quest.id === 'string' && typeof quest.title === 'string' &&
    typeof quest.description === 'string' && typeof quest.skillId === 'string' &&
    typeof quest.difficulty === 'string' && quest.difficulty in REWARDS &&
    ['active', 'postponed', 'completed', 'archived'].includes(String(quest.status)) &&
    isDateString(quest.createdAt) &&
    (quest.completedAt === undefined || isDateString(quest.completedAt)) &&
    (quest.cadence === undefined || ['once', 'daily', 'weekly', 'boss', 'epic'].includes(String(quest.cadence))) &&
    (quest.occurrences === undefined || (Array.isArray(quest.occurrences) && quest.occurrences.every(o =>
      isRecord(o) && typeof o.periodKey === 'string' && isDateString(o.completedAt) &&
      Number.isFinite(o.xpAwarded) && (o.xpAwarded as number) >= 0))) &&
    (quest.xpAwarded === undefined || (Number.isFinite(quest.xpAwarded) && (quest.xpAwarded as number) >= 0)));
  const validAchievements = Array.isArray(value.achievements) && value.achievements.every(achievement =>
    isRecord(achievement) && typeof achievement.id === 'string' &&
    typeof achievement.title === 'string' && typeof achievement.detail === 'string' &&
    isDateString(achievement.earnedAt));
  const validWallet = isRecord(value.wallet) && ['ZAR', 'USD', 'EUR', 'GBP'].includes(String(value.wallet.baseCurrency));
  const validTransactions = Array.isArray(value.transactions) && value.transactions.every(transaction =>
    isRecord(transaction) && typeof transaction.id === 'string' &&
    Number.isFinite(transaction.amount) && (transaction.amount as number) > 0 &&
    ['ZAR', 'USD', 'EUR', 'GBP'].includes(String(transaction.currency)) &&
    ['income', 'expense'].includes(String(transaction.type)) &&
    typeof transaction.category === 'string' && typeof transaction.note === 'string' &&
    isDateString(transaction.at));
  const validPhaseTwoData = value.phaseTwo === undefined || validPhaseTwo(value.phaseTwo);
  if (!validProfile || !validSkills || !validQuests || !validAchievements || !validWallet || !validTransactions || !validPhaseTwoData) {
    throw new Error('The backup contains incomplete or invalid LIFEQUEST data. Your current progress has not been changed.');
  }
  return safeState(value);
}
function clearPersistedState(db: IDBDatabase): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Could not erase local progress.'));
    tx.onabort = () => reject(tx.error || new Error('Erasing local progress was cancelled.'));
  });
}
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) { reject(new Error('IndexedDB is unavailable in this browser.')); return; }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => { const db = request.result; if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Could not open local storage.'));
  });
}
async function loadState(db: IDBDatabase): Promise<State> {
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE, 'readonly').objectStore(STORE).get('main');
    request.onsuccess = () => resolve(safeState(request.result));
    request.onerror = () => reject(request.error);
  });
}
async function persist(db: IDBDatabase, value: State): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put({ ...value, version: 1 }, 'main');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Could not save your changes.'));
    tx.onabort = () => reject(tx.error || new Error('Save was cancelled.'));
  });
}
const dateLabel = (iso: string) => new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(iso));
const currencyFmt = (amount: number, currency: Currency) => new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount);
const localPeriodKey = (cadence: QuestCadence, date = new Date()) => {
  const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  if (cadence !== 'weekly') return day;
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return `week-${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
};
function usePeriodRefresh() {
  const [, refresh] = useState(0);
  useEffect(() => { const timer = window.setInterval(() => refresh(value => value + 1), 60_000); return () => window.clearInterval(timer); }, []);
}

function App() {
  const [db, setDb] = useState<IDBDatabase | null>(null);
  const [data, setData] = useState<State>(emptyState());
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [path, setPath] = useLocation();
  const [modal, setModal] = useState<'profile' | 'quest' | 'transaction' | 'skill' | null>(null);
  const [editingQuest, setEditingQuest] = useState<Quest | null>(null);
  const [returnToQuest, setReturnToQuest] = useState(false);
  const [toast, setToast] = useState('');
  useEffect(() => {
    let alive = true;
    openDatabase().then(async connection => {
      const saved = await loadState(connection);
      if (!alive) { connection.close(); return; }
      setDb(connection); setData(saved); setLoaded(true);
    }).catch(e => { if (alive) { setError(e instanceof Error ? e.message : 'Local storage could not be loaded.'); setLoaded(true); } });
    return () => { alive = false; };
  }, []);
  useEffect(() => {
    document.documentElement.dataset.lifequestTheme = data.extras.theme;
    return () => { delete document.documentElement.dataset.lifequestTheme; };
  }, [data.extras.theme]);
  useEffect(() => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register(`${import.meta.env.BASE_URL}service-worker.js`).catch(() => undefined);
  }, []);
  useEffect(() => {
    if (!db || !loaded || error) return;
    persist(db, data).catch(e => setError(e instanceof Error ? e.message : 'Your changes could not be saved.'));
  }, [db, data, loaded, error]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (path === '/character' && !data.profile && loaded) setModal('profile');
  }, [path, data.profile, loaded]);
  const lvl = useMemo(() => levelInfo(data.totalXp), [data.totalXp]);
  const recordLessonXp = (word: string, amount: number) => {
    const earnedAt = new Date().toISOString();
    const englishSkillId = id();
    setData(d => {
      if (d.phaseTwo.lessons[word]?.mastered) return d;
      const englishSkill = d.skills.find(skill => skill.name.trim().toLowerCase() === 'english');
      const skills = englishSkill
        ? d.skills.map(skill => skill.id === englishSkill.id ? { ...skill, xp: skill.xp + amount, history: [{ amount, quest: `English Magick: ${word}`, at: earnedAt }, ...skill.history] } : skill)
        : [...d.skills, { id: englishSkillId, name: 'English', xp: amount, history: [{ amount, quest: `English Magick: ${word}`, at: earnedAt }] }];
      const achievements = [...d.achievements];
      const masteredCount = Object.values(d.phaseTwo.lessons).filter(lesson => lesson.mastered).length;
      if (masteredCount >= 4 && !d.phaseTwo.lessons[word]?.mastered && !achievements.some(a => a.id === 'vocabulary-apprentice')) achievements.push({ id: 'vocabulary-apprentice', title: 'Vocabulary Apprentice', detail: 'Mastered five English Magick lessons.', earnedAt });
      return { ...d, totalXp: d.totalXp + amount, skills, achievements };
    });
  };
  const saveProfile = (name: string, className: string, focus: string[]) => {
    const profile = { name: name.trim(), className, focus, createdAt: data.profile?.createdAt || new Date().toISOString() };
    setData(d => {
      const skills = [...d.skills];
      focus.forEach(name => { if (!skills.some(s => s.name.toLowerCase() === name.toLowerCase())) skills.push({ id: id(), name, xp: 0, history: [] }); });
      return { ...d, profile, skills };
    });
    setModal(null); setToast('Character record saved locally.');
  };
  const addSkill = (name: string) => {
    if (data.skills.some(s => s.name.toLowerCase() === name.trim().toLowerCase())) { setToast('That skill already exists.'); return; }
    setData(d => ({ ...d, skills: [...d.skills, { id: id(), name: name.trim(), xp: 0, history: [] }] }));
    setModal(returnToQuest ? 'quest' : null); setReturnToQuest(false); setToast('Skill added.');
  };
  const saveQuest = (values: Omit<Quest, 'id' | 'status' | 'createdAt' | 'completedAt' | 'xpAwarded'>, existing?: Quest) => {
    if (existing) setData(d => ({ ...d, quests: d.quests.map(q => q.id === existing.id ? { ...q, ...values } : q) }));
    else setData(d => ({ ...d, quests: [{ ...values, id: id(), status: 'active', createdAt: new Date().toISOString() }, ...d.quests] }));
    setEditingQuest(null); setModal(null); setToast(existing ? 'Quest updated.' : 'Quest added to your log.');
  };
  const completeQuest = (quest: Quest) => {
    const cadence = quest.cadence || 'once';
    if (quest.status === 'completed' && cadence !== 'daily' && cadence !== 'weekly') return;
    const reward = REWARDS[quest.difficulty];
    const now = new Date().toISOString();
    const periodKey = localPeriodKey(cadence);
    setData(d => {
      const current = d.quests.find(q => q.id === quest.id);
      if (!current || (current.status === 'completed' && cadence !== 'daily' && cadence !== 'weekly')) return d;
      if ((cadence === 'daily' || cadence === 'weekly') && (current.occurrences || []).some(o => o.periodKey === periodKey)) return d;
      const skills = d.skills.map(s => s.id === quest.skillId ? { ...s, xp: s.xp + reward, history: [{ amount: reward, quest: quest.title, at: now }, ...s.history] } : s);
      const achievements = [...d.achievements];
       const hasPriorCompletion = d.quests.some(q => q.status === 'completed' || (q.occurrences?.length || 0) > 0);
       if (!achievements.some(a => a.id === 'first-quest') && !hasPriorCompletion) achievements.push({ id: 'first-quest', title: 'First Step', detail: 'Completed your first quest.', earnedAt: now });
      return { ...d, totalXp: d.totalXp + reward, skills, achievements, quests: d.quests.map(q => {
        if (q.id !== quest.id) return q;
        if (cadence === 'daily' || cadence === 'weekly') return { ...q, status: 'active', occurrences: [...(q.occurrences || []), { periodKey, completedAt: now, xpAwarded: reward }] };
        return { ...q, status: 'completed', completedAt: now, xpAwarded: reward };
      }) };
    });
    setToast(`${reward} XP recorded. You did the real-world work.`);
  };
  const updateStatus = (quest: Quest, status: QuestStatus) => {
    if (quest.status === 'completed') return;
    setData(d => ({ ...d, quests: d.quests.map(q => q.id === quest.id ? { ...q, status } : q) }));
    setToast(status === 'postponed' ? 'Quest postponed. No progress was lost.' : status === 'archived' ? 'Quest archived.' : 'Quest returned to active.');
  };
  const addTransaction = (transaction: Omit<Transaction, 'id' | 'at'>) => {
    setData(d => ({ ...d, transactions: [{ ...transaction, id: id(), at: new Date().toISOString() }, ...d.transactions] }));
    setModal(null); setToast('Real-currency entry saved.');
  };
  const changeCurrency = (baseCurrency: Currency) => setData(d => ({ ...d, wallet: { baseCurrency } }));
  const downloadBackup = (snapshot: State, prefix = 'lifequest-backup') => {
    const backup = { format: 'LIFEQUEST_BACKUP', backupVersion: 1, createdAt: new Date().toISOString(), data: { ...snapshot, version: 1 } };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.download = `${prefix}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(href), 1000);
  };
  const exportBackup = async () => {
    if (!db) throw new Error('Local storage is not ready.');
    await persist(db, data);
    downloadBackup(data);
  };
  const restoreBackup = async (backup: State) => {
    if (!db) throw new Error('Local storage is not ready.');
    // Preserve the current player record before replacing it.
    const previous = await loadState(db);
    downloadBackup(previous, 'lifequest-before-restore');
    await persist(db, backup);
    setData(backup);
    setToast('Backup restored. This device now uses the restored progress.');
  };
  const eraseProgress = async () => {
    if (!db) throw new Error('Local storage is not ready.');
    await clearPersistedState(db);
    setData(emptyState());
    setToast('All LIFEQUEST progress was erased from this device.');
  };
  const templates = () => {
    if (!data.skills.length) { setToast('Create a character and at least one skill before adding starter quests.'); setPath('/character'); return; }
    const skillId = data.skills[0]?.id || '';
    const starter: Quest[] = [
      { id: id(), title: 'Take a 15-minute walk', description: 'A small reset, at your own pace.', difficulty: 'Trivial', skillId, status: 'active', createdAt: new Date().toISOString() },
      { id: id(), title: 'Read one chapter', description: 'Choose something that holds your attention.', difficulty: 'Easy', skillId, status: 'active', createdAt: new Date().toISOString() },
      { id: id(), title: 'Plan a focused work session', description: 'Choose one priority and protect the time.', difficulty: 'Medium', skillId, status: 'active', createdAt: new Date().toISOString() },
    ];
    setData(d => ({ ...d, quests: [...starter, ...d.quests] })); setToast('Three optional starter quests added. Edit or remove them any time.');
  };
  if (!loaded) return <div className="loading-screen"><div className="brand-mark"><Swords size={22}/></div><div className="skeleton-line"/></div>;
  if (error) return <main className="error-screen"><div className="brand-mark"><Shield size={22}/></div><h1>Local save is unavailable</h1><p>{error}</p><p>Your data stays on this device. Check browser storage permissions, then reload.</p><button className="button button-gold" onClick={() => window.location.reload()} data-testid="button-retry">Retry</button></main>;
  const nav = [
    { href: '/', label: 'Overview', icon: LayoutDashboard },
    { href: '/quests', label: 'Quests', icon: ScrollText },
    { href: '/character', label: 'Character', icon: UserRound },
    { href: '/skills', label: 'Skills', icon: Activity },
    { href: '/world', label: 'World', icon: Compass },
  ];
  return <div className="app-shell">
    <aside className="sidebar">
      <Link href="/" className="brand" data-testid="link-brand"><span className="brand-mark"><Swords size={19}/></span><span>LIFEQUEST<small>REALITY RPG</small></span></Link>
      <div className="sidebar-label">YOUR JOURNEY</div>
      <nav aria-label="Main navigation">{nav.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={`nav-link ${path === href ? 'selected' : ''}`} data-testid={`link-nav-${label.toLowerCase()}`}><Icon size={18}/><span>{label}</span>{label === 'Quests' && data.quests.filter(q => q.status === 'active').length > 0 && <i>{data.quests.filter(q => q.status === 'active').length}</i>}</Link>)}</nav>
      <div className="sidebar-bottom">
        <div className="local-note"><LockKeyhole size={14}/><span>Stored on this device<br/><b>No cloud sync</b></span></div>
        {data.profile && <button className="profile-mini" onClick={() => setPath('/character')} data-testid="button-open-profile"><span className="avatar">{data.profile.name.charAt(0).toUpperCase()}</span><span><b>{data.profile.name}</b><small>{data.profile.className} · Lv {lvl.level}</small></span><MoreHorizontal size={17}/></button>}
      </div>
    </aside>
    <header className="mobile-header"><Link href="/" className="brand"><span className="brand-mark"><Swords size={18}/></span><span>LIFEQUEST<small>REALITY RPG</small></span></Link><div className="mobile-level"><Gem size={14}/>{lvl.level}</div></header>
    <main className="main-content">
      <div className="topline"><span>YOUR LIFE, WITH A LITTLE MORE INTENTION.</span><span className="save-indicator"><span/> SAVED LOCALLY</span></div>
      <Switch>
        <Route path="/"><Dashboard data={data} level={lvl} onNavigate={setPath} onComplete={completeQuest} onCreate={() => { setEditingQuest(null); setModal('quest'); }} onTemplates={templates}/></Route>
        <Route path="/quests"><Quests data={data} onCreate={() => { setEditingQuest(null); setModal('quest'); }} onEdit={q => { setEditingQuest(q); setModal('quest'); }} onComplete={completeQuest} onStatus={updateStatus} onTemplates={templates} onToggleSubtask={(questId,subtaskId)=>setData(d=>({...d,quests:d.quests.map(q=>q.id===questId?{...q,subtasks:(q.subtasks||[]).map(t=>t.id===subtaskId?{...t,done:!t.done}:t)}:q)}))} onDelete={q => { if (q.status !== 'completed' && window.confirm('Delete this quest permanently? Completed history cannot be removed.')) setData(d => ({ ...d, quests: d.quests.filter(item => item.id !== q.id) })); }}/></Route>
        <Route path="/character"><Character data={data} level={lvl} onEdit={() => setModal('profile')} onAddSkill={() => setModal('skill')} onNavigate={setPath}/></Route>
        <Route path="/skills"><Skills data={data} onAdd={() => setModal('skill')}/></Route>
       <Route path="/world"><World data={data} onData={phaseTwo => setData(d => ({ ...d, phaseTwo }))} onLessonXp={recordLessonXp} onTrainingComplete={questId => { const quest = data.quests.find(q => q.id === questId); if (quest) completeQuest(quest); }} onBusinessTransaction={addTransaction} onAddTransaction={() => setModal('transaction')} onCurrency={changeCurrency} onNavigate={setPath} onDeleteTransaction={transactionId => { if (window.confirm('Delete this ledger entry? This cannot be undone.')) setData(d => ({ ...d, transactions: d.transactions.filter(t => t.id !== transactionId) })); }} onExport={exportBackup} onRestore={restoreBackup} onErase={eraseProgress} onExtras={extras=>setData(d=>({...d,extras}))}/></Route>
        <Route><NotFound onHome={() => setPath('/')}/></Route>
      </Switch>
    </main>
    <nav className="bottom-nav" aria-label="Mobile navigation">{nav.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={`bottom-link ${path === href ? 'selected' : ''}`} data-testid={`mobile-nav-${label.toLowerCase()}`}><Icon size={19}/><span>{label}</span></Link>)}</nav>
    {modal && <Modal title={modal === 'profile' ? (data.profile ? 'Your character' : 'Create your character') : modal === 'quest' ? editingQuest ? 'Edit quest' : 'A new quest' : modal === 'transaction' ? 'Record a transaction' : 'Add a skill'} onClose={() => { setModal(null); setEditingQuest(null); setReturnToQuest(false); }}>
      {modal === 'profile' && <ProfileForm profile={data.profile} onSubmit={saveProfile}/>}
       {modal === 'quest' && <QuestForm skills={data.skills} initial={editingQuest} onSubmit={v => saveQuest(v, editingQuest || undefined)} onAddSkill={() => { setReturnToQuest(true); setModal('skill'); }}/>}
      {modal === 'transaction' && <TransactionForm baseCurrency={data.wallet.baseCurrency} onSubmit={addTransaction}/>}
      {modal === 'skill' && <SkillForm onSubmit={addSkill}/>}
    </Modal>}
    {toast && <div className="toast" role="status" data-testid="status-toast"><CheckCircle2 size={17}/>{toast}</div>}
  </div>;
}

function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: ReactNode; description: string; action?: ReactNode }) {
  return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{action}</div>;
}
function Dashboard({ data, level, onNavigate, onComplete, onCreate, onTemplates }: { data: State; level: ReturnType<typeof levelInfo>; onNavigate: (p:string)=>void; onComplete:(q:Quest)=>void; onCreate:()=>void; onTemplates:()=>void }) {
  const active = data.quests.filter(q => q.status === 'active');
  const completed = data.quests.filter(q => q.status === 'completed');
  const latest = [...completed].sort((a,b) => (b.completedAt || '').localeCompare(a.completedAt || '')).slice(0,3);
  const [useTemplates, setUseTemplates] = useState(false);
  if (!data.profile) return <section className="welcome-panel"><div className="welcome-art"><div className="sigil"><Swords size={54}/></div><span className="orbit orbit-one"/><span className="orbit orbit-two"/><span className="star star-a"/><span className="star star-b"/></div><div className="eyebrow">A PERSONAL PROGRESSION LOG</div><h1>Make your real life<br/><em>the main quest.</em></h1><p>Small, meaningful actions become a record of progress. No streaks to protect. No punishment for rest. Just a place to notice what you do.</p><button className="button button-gold" onClick={() => onNavigate('/character')} data-testid="button-create-character">Begin your character <ArrowRight size={16}/></button><div className="welcome-foot"><LockKeyhole size={14}/> Your character and progress live on this device.</div></section>;
  return <div className="page">
    <PageHeading eyebrow="FIELD JOURNAL / OVERVIEW" title={<>A good day to <em>begin.</em></>} description={`${new Intl.DateTimeFormat(undefined,{weekday:'long',month:'long',day:'numeric'}).format(new Date())} · Progress at your own pace.`} action={<button className="button button-gold" onClick={onCreate} data-testid="button-new-quest"><Plus size={16}/> New quest</button>}/>
    <section className="hero-grid">
      <div className="level-card">
        <div className="card-kicker"><span>YOUR PROGRESSION</span><span className="level-pill">LEVEL {level.level}</span></div>
        <div className="level-layout"><div className="level-orb" style={{'--progress':`${level.percent}%`} as CSSProperties}><span><b>{level.level}</b><small>LEVEL</small></span></div><div className="level-copy"><h2>{data.profile.className}</h2><p>{data.profile.name} · Keep showing up for what matters.</p><div className="xp-copy"><span>{level.into} / {level.next} XP</span><span>{Math.max(0,level.next-level.into)} to next level</span></div><div className="progress-track"><i style={{width:`${level.percent}%`}}/></div><div className="all-time">{data.totalXp.toLocaleString()} total XP earned</div></div></div>
        <div className="level-card-foot"><span>REAL-WORLD EFFORT, RECORDED.</span><span><Gem size={14}/> EXPERIENCE</span></div>
      </div>
      <div className="today-card"><div className="card-kicker"><span>IN YOUR LOG</span><ListTodo size={16}/></div><div className="today-number">{active.length.toString().padStart(2,'0')}</div><h3>active quests</h3><p>Take one on. Or take a pause. Your progress is yours.</p><button className="text-link" onClick={()=>onNavigate('/quests')} data-testid="button-view-quests">Open quest log <ArrowRight size={15}/></button><div className="decorative-lines"/></div>
    </section>
    <section className="section-block">
      <div className="section-heading"><div><div className="eyebrow">READY WHEN YOU ARE</div><h2>Active quests</h2></div><button className="subtle-link" onClick={()=>onNavigate('/quests')} data-testid="button-all-quests">Quest log <ArrowRight size={14}/></button></div>
      {active.length ? <div className="quest-list">{active.slice(0,4).map(q=><QuestRow key={q.id} quest={q} skills={data.skills} onComplete={onComplete}/>)}</div> : <div className="empty-state"><div className="empty-emblem"><ScrollText size={21}/></div><h3>Your quest log is clear.</h3><p>Add a quest when you have something meaningful to track.</p><div className="empty-actions"><button className="button button-outline" onClick={onCreate} data-testid="button-empty-create"><Plus size={15}/> Create a quest</button><label className="check-label"><input type="checkbox" checked={useTemplates} onChange={e=>setUseTemplates(e.target.checked)} data-testid="checkbox-starter-quests"/> Include optional examples</label><button className="text-link" disabled={!useTemplates} onClick={onTemplates} data-testid="button-starter-quests">Add examples</button></div></div>}
    </section>
    <section className="lower-grid">
      <div className="panel recent-panel"><div className="section-heading compact"><div><div className="eyebrow">YOUR MOMENTUM</div><h2>Recently completed</h2></div><button className="icon-button" aria-label="View all quests" onClick={()=>onNavigate('/quests')} data-testid="button-history"><ArrowRight size={16}/></button></div>{latest.length ? latest.map(q=><div className="history-row" key={q.id}><span className="history-check"><Check size={14}/></span><span className="history-title">{q.title}<small>{q.completedAt ? dateLabel(q.completedAt) : ''}</small></span><b>+{q.xpAwarded || REWARDS[q.difficulty]} XP</b></div>) : <p className="muted-note">Completions will live here. Only actions you mark complete earn XP.</p>}</div>
      <div className="panel focus-panel"><div className="section-heading compact"><div><div className="eyebrow">WHERE YOU'RE GROWING</div><h2>Focus attributes</h2></div><button className="icon-button" aria-label="View skills" onClick={()=>onNavigate('/skills')} data-testid="button-open-skills"><ArrowRight size={16}/></button></div>{data.skills.length ? data.skills.slice(0,3).map(s=><div className="skill-mini" key={s.id}><span className="skill-dot"/><span>{s.name}</span><b>{s.xp} XP</b></div>) : <p className="muted-note">Add skills to connect real actions to the areas you care about.</p>}</div>
    </section>
    <div className="gentle-note"><CircleHelp size={15}/> Missed a day? Nothing is taken away. This log only rewards completions you choose to record.</div>
  </div>;
}
function QuestRow({ quest, skills, onComplete }: { quest: Quest; skills: Skill[]; onComplete: (q:Quest)=>void }) {
  usePeriodRefresh();
  const cadence=quest.cadence||'once';const period=(cadence==='daily'||cadence==='weekly')?localPeriodKey(cadence):'';const recorded=(quest.occurrences||[]).some(o=>o.periodKey===period);
  return <div className="quest-row" data-testid={`quest-row-${quest.id}`}><div className="quest-mark"><ScrollText size={16}/></div><div className="quest-info"><h3>{quest.title}</h3><p>{quest.description || 'A real-world action, chosen by you.'}</p><div className="quest-meta"><span>{quest.difficulty.toUpperCase()}</span><span>{quest.priority||'normal'} priority</span>{quest.dueDate&&<span>Due {quest.dueDate}</span>}{(quest.subtasks?.length||0)>0&&<span>{quest.subtasks?.filter(t=>t.done).length}/{quest.subtasks?.length} subtasks</span>}<span>{skills.find(s=>s.id===quest.skillId)?.name || 'Unassigned'}</span><span className="status-tag">{cadence==='once'?'ONE-TIME':cadence.toUpperCase()}</span>{recorded&&<span>Completed this {cadence==='daily'?'day':'week'}</span>}</div></div><div className="quest-reward"><Gem size={13}/>{REWARDS[quest.difficulty]} XP</div><button className="complete-button" disabled={recorded} onClick={()=>onComplete(quest)} aria-label={recorded?`${quest.title} already completed this period`:`Complete ${quest.title}`} data-testid={`button-complete-${quest.id}`}><Check size={17}/><span>{recorded?'Done':'Done'}</span></button></div>;
}
function Quests({ data, onCreate, onEdit, onComplete, onStatus, onTemplates, onDelete, onToggleSubtask }: { data:State; onCreate:()=>void; onEdit:(q:Quest)=>void; onComplete:(q:Quest)=>void; onStatus:(q:Quest,s:QuestStatus)=>void; onTemplates:()=>void; onDelete:(q:Quest)=>void; onToggleSubtask:(questId:string,subtaskId:string)=>void }) {
  const [availableMinutes,setAvailableMinutes]=useState(120);
  const [restMinutes,setRestMinutes]=useState(20);
  const today=new Date().toLocaleDateString("en-CA");
  const candidates=data.quests.filter(q=>q.status==="active"&&(!q.startDate||q.startDate<=today)).sort((a,b)=>Number(b.priority==="high")-Number(a.priority==="high")||(a.dueDate||"9999").localeCompare(b.dueDate||"9999"));
  let used=0; const scheduled=candidates.filter(q=>{const minutes=Math.max(1,q.estimatedMinutes||30);if(used+minutes>Math.max(0,availableMinutes-restMinutes))return false;used+=minutes;return true});
  const [filter,setFilter]=useState<QuestStatus|'all'>('active');
  const list=data.quests.filter(q=>filter==='all'||q.status===filter).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  return <div className="page"><PageHeading eyebrow="FIELD JOURNAL / QUEST LOG" title={<>Choose your <em>next step.</em></>} description="Self-directed tasks for real life. Complete, postpone, or archive without penalty." action={<button className="button button-gold" onClick={onCreate} data-testid="button-new-quest"><Plus size={16}/> New quest</button>}/>
    <section className="panel" aria-label="Daily quest planner" style={{padding:16,marginBottom:16}}><h3>Daily quest planner</h3><p>Plan tasks within your available time, with recovery reserved. Suggested order is based on priority and due dates.</p><label className="field-label">Available minutes today<input className="field-input" type="number" min="0" max="1440" value={availableMinutes} onChange={e=>setAvailableMinutes(Math.min(1440,Math.max(0,Number(e.target.value)||0)))}/></label><label className="field-label">Rest and recovery minutes<input className="field-input" type="number" min="0" max="1440" value={restMinutes} onChange={e=>setRestMinutes(Math.min(1440,Math.max(0,Number(e.target.value)||0)))}/></label><p>{used} minutes planned · {Math.max(0,availableMinutes-used)} minutes unallocated including rest</p>{scheduled.length?<ol>{scheduled.map(q=><li key={q.id}>{q.title} — {q.estimatedMinutes||30} min</li>)}</ol>:<p>No quests fit the available task time. Rest is valid progress.</p>}</section>
    <div className="quest-toolbar"><div className="filter-tabs">{(['active','postponed','completed','archived','all'] as const).map(s=><button key={s} className={filter===s?'active':''} onClick={()=>setFilter(s)} data-testid={`filter-quests-${s}`}>{s==='all'?'All':s[0].toUpperCase()+s.slice(1)}<span>{s==='all'?data.quests.length:data.quests.filter(q=>q.status===s).length}</span></button>)}</div><span className="reward-legend"><Gem size={13}/> XP only on completion</span></div>
    {list.length ? <div className="quest-list full-list">{list.map(q=><QuestManageRow key={q.id} quest={q} skills={data.skills} onComplete={onComplete} onEdit={()=>onEdit(q)} onStatus={s=>onStatus(q,s)} onDelete={()=>onDelete(q)} onToggleSubtask={subtaskId=>onToggleSubtask(q.id,subtaskId)}/>)}</div> : <div className="empty-state quest-empty"><div className="empty-emblem"><ScrollText size={21}/></div><h3>{filter==='active'?'No active quests.':''}{filter==='completed'?'No completed quests yet.':''}{filter==='postponed'?'Nothing postponed.':''}{filter==='archived'?'No archived quests.':''}{filter==='all'?'Your journal is waiting.':''}</h3><p>{filter==='active'?'Your pace is yours. Add something when it feels right.':'Your recorded history will appear here.'}</p>{filter==='active'&&<div className="empty-actions"><button className="button button-outline" onClick={onCreate} data-testid="button-empty-create"><Plus size={15}/> Create a quest</button><button className="text-link" onClick={onTemplates} data-testid="button-add-examples">Add optional starter examples</button></div>}</div>}
    <div className="gentle-note"><CircleHelp size={15}/> There are no streaks or missed-day deductions here. Rest does not reduce XP.</div>
  </div>;
}
function QuestManageRow({quest,skills,onComplete,onEdit,onStatus,onDelete,onToggleSubtask}:{quest:Quest;skills:Skill[];onComplete:(q:Quest)=>void;onEdit:()=>void;onStatus:(s:QuestStatus)=>void;onDelete:()=>void;onToggleSubtask:(id:string)=>void}) {
  usePeriodRefresh();
  const [menu,setMenu]=useState(false);
  const cadence=quest.cadence||'once';const period=(cadence==='daily'||cadence==='weekly')?localPeriodKey(cadence):'';const recorded=!!period&&(quest.occurrences||[]).some(o=>o.periodKey===period);
  return <article className={`quest-row manage-row ${quest.status==='completed'?'is-complete':''}`} data-testid={`quest-row-${quest.id}`}><div className="quest-mark">{quest.status==='completed'?<Check size={16}/>:<ScrollText size={16}/>}</div><div className="quest-info"><h3>{quest.title}</h3><p>{quest.description||'A real-world action, chosen by you.'}</p><div className="quest-meta"><span>{quest.difficulty.toUpperCase()}</span><span>{quest.priority||'normal'} priority</span>{quest.dueDate&&<span>Due {quest.dueDate}</span>}{(quest.subtasks?.length||0)>0&&<span>{quest.subtasks?.filter(t=>t.done).length}/{quest.subtasks?.length} subtasks</span>}<span>{skills.find(s=>s.id===quest.skillId)?.name||'Unassigned'}</span><span className={`status-tag ${quest.status}`}>{quest.status}</span><span className="status-tag">{cadence==='once'?'ONE-TIME':cadence.toUpperCase()}</span>{recorded&&<span>Completed this period</span>}{(quest.occurrences?.length||0)>0&&<span>{quest.occurrences?.length} logged occurrences</span>}{quest.completedAt&&<span>{dateLabel(quest.completedAt)}</span>}</div>{(quest.subtasks||[]).length>0&&<div style={{marginTop:8}}>{quest.subtasks!.map(t=><label key={t.id} style={{display:"flex",gap:8,alignItems:"center",marginTop:5}}><input type="checkbox" checked={t.done} disabled={quest.status==="completed"} onChange={()=>onToggleSubtask(t.id)}/><span>{t.title}</span></label>)}</div>}</div><div className="quest-reward"><Gem size={13}/>{REWARDS[quest.difficulty]} XP</div>{quest.status==='active'&&<button className="complete-button" disabled={recorded} onClick={()=>onComplete(quest)} data-testid={`button-complete-${quest.id}`}><Check size={17}/><span>{recorded?'Recorded':'Done'}</span></button>}<div className="manage-menu"><button className="icon-button" aria-label={`Actions for ${quest.title}`} onClick={()=>setMenu(!menu)} data-testid={`button-actions-${quest.id}`}><MoreHorizontal size={18}/></button>{menu&&<div className="menu-popover">{quest.status!=='completed'&&<><button onClick={()=>{onEdit();setMenu(false)}} data-testid={`button-edit-${quest.id}`}>Edit quest</button>{quest.status==='active'?<button onClick={()=>{onStatus('postponed');setMenu(false)}} data-testid={`button-postpone-${quest.id}`}>Postpone</button>:<button onClick={()=>{onStatus('active');setMenu(false)}} data-testid={`button-reactivate-${quest.id}`}>Make active</button>}<button onClick={()=>{onStatus('archived');setMenu(false)}} data-testid={`button-archive-${quest.id}`}>Archive</button><button className="danger-action" onClick={()=>{onDelete();setMenu(false)}} data-testid={`button-delete-quest-${quest.id}`}>Delete permanently</button></>}{quest.status==='completed'&&<span>Completed quests stay in your history.</span>}</div>}</div></article>;
}
function Character({data,level,onEdit,onAddSkill,onNavigate}:{data:State;level:ReturnType<typeof levelInfo>;onEdit:()=>void;onAddSkill:()=>void;onNavigate:(p:string)=>void}) {
  if(!data.profile)return <div className="page"><PageHeading eyebrow="YOUR CHARACTER" title={<>Your story, <em>your shape.</em></>} description="A private record of the person doing the work."/><div className="empty-state"><div className="empty-emblem"><UserRound size={22}/></div><h3>Your character begins with you.</h3><p>Set a name and focus attributes. You can change them whenever your priorities shift.</p><button className="button button-gold" onClick={onEdit} data-testid="button-create-character">Create character <ArrowRight size={15}/></button></div></div>;
  return <div className="page"><PageHeading eyebrow="FIELD JOURNAL / CHARACTER" title={<>The person behind the <em>progress.</em></>} description="Your identity is yours to revise. Your real-world experience stays recorded." action={<button className="button button-outline" onClick={onEdit} data-testid="button-edit-character">Edit character</button>}/>
    <section className="character-banner"><div className="character-sigil"><Swords size={45}/><span>LV {level.level}</span></div><div className="character-main"><div className="eyebrow">YOUR CHARACTER</div><h2>{data.profile.name}</h2><div className="class-label"><Shield size={14}/>{data.profile.className}</div><p>Built from choices made beyond this screen.</p></div><div className="char-xp"><span>TOTAL EXPERIENCE</span><b>{data.totalXp.toLocaleString()}</b><small>XP · {level.into} toward level {level.level+1}</small><div className="progress-track"><i style={{width:`${level.percent}%`}}/></div></div></section>
    <section className="section-block"><div className="section-heading"><div><div className="eyebrow">THE THINGS YOU'RE CULTIVATING</div><h2>Focus attributes</h2></div><button className="button button-outline" onClick={onAddSkill} data-testid="button-add-skill"><Plus size={15}/> Add skill</button></div><div className="attribute-grid">{data.skills.map((s,i)=><div className="attribute-card" key={s.id}><div className="attribute-top"><div className={`attribute-icon tone-${i%4}`}>{[<Activity key="activity"/>,<BookOpen key="book"/>,<Dumbbell key="dumbbell"/>,<Zap key="zap"/>][i%4]}</div><span>ATTRIBUTE {String(i+1).padStart(2,'0')}</span></div><h3>{s.name}</h3><div className="attribute-xp">{s.xp.toLocaleString()} <small>XP EARNED</small></div><div className="attribute-footer"><span>{s.history.length} recorded {s.history.length===1?'action':'actions'}</span><button onClick={()=>onNavigate('/skills')} data-testid={`button-skill-history-${s.id}`}>History <ArrowRight size={13}/></button></div></div>)}
      {!data.skills.length&&<div className="empty-state"><h3>No focus attributes yet.</h3><p>Add areas you want to build through real actions.</p><button className="button button-outline" onClick={onAddSkill} data-testid="button-add-first-skill"><Plus size={15}/> Add first skill</button></div>}</div></section>
    <div className="gentle-note"><LockKeyhole size={15}/> Your character, level, and progress are stored locally on this device only.</div>
  </div>;
}
function Skills({data,onAdd}:{data:State;onAdd:()=>void}) {
  const [selected,setSelected]=useState(data.skills[0]?.id||'');
  const skill=data.skills.find(s=>s.id===selected);
  useEffect(()=>{if(!data.skills.some(s=>s.id===selected))setSelected(data.skills[0]?.id||'')},[data.skills,selected]);
  return <div className="page"><PageHeading eyebrow="FIELD JOURNAL / PRACTICE" title={<>Growth is <em>made visible.</em></>} description="Skill XP is tied to quest completions you record. No automatic deductions." action={<button className="button button-gold" onClick={onAdd} data-testid="button-add-skill"><Plus size={16}/> New skill</button>}/>
    {data.skills.length?<><div className="skill-selector">{data.skills.map((s,i)=><button key={s.id} className={`skill-choice ${s.id===selected?'active':''}`} onClick={()=>setSelected(s.id)} data-testid={`button-select-skill-${s.id}`}><span className={`skill-dot tone-${i%4}`}/>{s.name}<b>{s.xp} XP</b></button>)}</div>{skill&&<div className="skill-detail panel"><div className="skill-detail-head"><div><div className="eyebrow">PRACTICE RECORD</div><h2>{skill.name}</h2><p>{skill.xp.toLocaleString()} XP across {skill.history.length} {skill.history.length===1?'completion':'completions'}</p></div><div className="skill-emblem"><Activity size={23}/></div></div><div className="section-heading compact history-heading"><div><div className="eyebrow">RECENT HISTORY</div><h2>Where XP came from</h2></div></div>{skill.history.length?skill.history.map((h,i)=><div className="skill-history-row" key={`${h.at}-${i}`}><span className="history-check"><Check size={14}/></span><span>{h.quest}<small>{dateLabel(h.at)}</small></span><b>+{h.amount} XP</b></div>):<div className="empty-history"><p>Complete a quest linked to this skill to begin a history.</p></div>}</div>}</>:<div className="empty-state"><div className="empty-emblem"><Activity size={21}/></div><h3>Skills are yours to define.</h3><p>Choose meaningful areas of growth. XP is added only when you complete a linked quest.</p><button className="button button-gold" onClick={onAdd} data-testid="button-add-first-skill"><Plus size={15}/> Add a skill</button></div>}
     <SkillTree skills={data.skills}/>
     <ProgressAnalytics data={data}/>
     <div className="gentle-note"><CircleHelp size={15}/> Skill XP is a personal progress marker, not a measure of worth or expertise. Tree gates use only the recorded XP shown here; they never erase existing skills or experience.</div>
  </div>;
}
function SkillTree({skills}:{skills:Skill[]}) {
  const nodes=[{name:'First practice',at:0,copy:'The branch is open as soon as you define a skill.'},{name:'Early roots',at:25,copy:'Build the first visible body of practice.'},{name:'Steady growth',at:75,copy:'Continue through linked, completed efforts.'},{name:'Deepening craft',at:150,copy:'A longer record of deliberate practice.'},{name:'Seasoned path',at:250,copy:'A substantial body of recorded effort.'}];
  return <section className="section-block phase2-skill-tree"><div className="section-heading"><div><div className="eyebrow">PREREQUISITE PATHS</div><h2>Skill trees</h2></div></div><p className="muted-note">Each branch is a transparent XP threshold. Existing skills start with their recorded XP intact; nodes show eligibility, not a judgment of ability.</p>
    {skills.length?<div className="skill-tree-list">{skills.map(skill=><article className="skill-tree-branch" key={skill.id}><div className="skill-tree-title"><b>{skill.name}</b><span>{skill.xp.toLocaleString()} recorded XP</span></div><div className="skill-tree-nodes">{nodes.map((node,index)=>{const previous=index===0?true:skill.xp>=nodes[index-1].at;const unlocked=skill.xp>=node.at;const progress=unlocked?100:Math.min(100,Math.max(0,(skill.xp-nodes[index-1].at)/(node.at-nodes[index-1].at)*100));return <div className={`skill-tree-node ${unlocked?'unlocked':''}`} key={node.name}><div className="tree-node-mark">{unlocked?<Check size={14}/>:<LockKeyhole size={13}/>}</div><div className="tree-node-copy"><b>{node.name}</b><span>{unlocked?'Unlocked':previous?`${Math.max(0,node.at-skill.xp)} XP to unlock`:`Requires previous node · ${node.at} XP`}</span><small>{node.copy}</small></div><div className="tree-progress"><i style={{width:`${progress}%`}}/></div></div>})}</div></article>)}</div>:<div className="empty-state"><div className="empty-emblem"><Activity size={21}/></div><h3>No tree roots yet.</h3><p>Add a skill to create a visible progression path. Existing XP is never reset.</p></div>}
  </section>;
}
function ProgressAnalytics({data}:{data:State}) {
  const [windowDays,setWindowDays]=useState<7|30>(7);
  const now=Date.now();
  const days=Array.from({length:windowDays},(_,i)=>{
    const date=new Date(now); date.setHours(12,0,0,0);date.setDate(date.getDate()-(windowDays-1-i));
    const key=[date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
    return {key,label:date.toLocaleDateString(undefined,{month:'short',day:'numeric'}),xp:0,count:0};
  });
  const byDay=new Map(days.map(d=>[d.key,d]));
  for(const skill of data.skills)for(const entry of skill.history){
    const date=new Date(entry.at);if(!Number.isFinite(date.getTime()))continue;
    const key=[date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
    const day=byDay.get(key);if(day){day.xp+=entry.amount;day.count++}
  }
  const max=Math.max(1,...days.map(d=>d.xp));
  const total=days.reduce((n,d)=>n+d.xp,0);
  const active=days.filter(d=>d.count>0).length;
  return <section className="section-block"><div className="section-heading"><div><div className="eyebrow">ACTIVITY JOURNAL</div><h2>Progress analytics</h2></div><div style={{display:'flex',gap:8}}><button className="button button-outline" aria-pressed={windowDays===7} onClick={()=>setWindowDays(7)}>7 days</button><button className="button button-outline" aria-pressed={windowDays===30} onClick={()=>setWindowDays(30)}>30 days</button></div></div>
    <div className="panel" style={{padding:20}}><p>{total.toLocaleString()} recorded skill XP · {active} active days · {days.reduce((n,d)=>n+d.count,0)} recorded actions</p><div role="img" aria-label={`Skill XP over ${windowDays} days`} style={{display:'flex',alignItems:'end',height:150,gap:3,marginTop:20}}>{days.map(day=><div key={day.key} title={`${day.label}: ${day.xp} XP`} style={{flex:1,height:`${Math.max(3,day.xp/max*100)}%`,background:'#b79a5b',borderRadius:'4px 4px 0 0',minWidth:2}}/>)}</div><p className="muted-note">Based on locally recorded skill history. This is not an independent verification of activities.</p></div>
  </section>;
}
function World({data,onData,onLessonXp,onTrainingComplete,onBusinessTransaction,onAddTransaction,onCurrency,onNavigate,onDeleteTransaction,onExport,onRestore,onErase,onExtras}:{data:State;onData:(value:PhaseTwoData)=>void;onLessonXp:(word:string,amount:number)=>void;onTrainingComplete:(questId:string)=>void;onBusinessTransaction:(value:{amount:number;currency:string;type:'income'|'expense';category:string;note:string})=>void;onAddTransaction:()=>void;onCurrency:(c:Currency)=>void;onNavigate:(p:string)=>void;onDeleteTransaction:(id:string)=>void;onExport:()=>Promise<void>;onRestore:(backup:State)=>Promise<void>;onErase:()=>Promise<void>;onExtras:(extras:LifeExtras)=>void}) {
  const currency=data.wallet.baseCurrency;
  const balance=data.transactions.filter(t=>t.currency===currency).reduce((sum,t)=>sum+(t.type==='income'?t.amount:-t.amount),0);
  const achieved=data.achievements;
  const [tab,setTab]=useState<'wallet'|'achievements'|'data'|'phase2'|'advanced'>('wallet');
  return <div className="page"><PageHeading eyebrow="FIELD JOURNAL / THE WORLD" title={<>The real world, <em>accounted for.</em></>} description="A personal ledger and earned milestones. Real money stays separate from game XP."/>
     <div className="world-tabs"><button className={tab==='wallet'?'active':''} onClick={()=>setTab('wallet')} data-testid="tab-wallet"><Wallet size={16}/> Wallet</button><button className={tab==='achievements'?'active':''} onClick={()=>setTab('achievements')} data-testid="tab-achievements"><Trophy size={16}/> Achievements <span>{achieved.length}</span></button><button className={tab==='phase2'?'active':''} onClick={()=>setTab('phase2')} data-testid="tab-phase2-world"><BookOpen size={16}/> Practice &amp; business</button><button className={tab==='advanced'?'active':''} onClick={()=>setTab('advanced')}>Life systems</button><button className={tab==='data'?'active':''} onClick={()=>setTab('data')} data-testid="tab-data-privacy"><LockKeyhole size={16}/> Data &amp; privacy</button></div>
     {tab==='wallet'?<><section className="wallet-overview"><div className="wallet-copy"><div className="eyebrow">MANUAL MONEY LEDGER</div><h2>Real currency.<br/><em>No game crossover.</em></h2><p>Only entries you add are shown. Balances are kept per currency; no conversion rates are assumed.</p><div className="currency-select"><label htmlFor="base-currency">View balance in</label><select id="base-currency" value={currency} onChange={e=>onCurrency(e.target.value as Currency)} data-testid="select-base-currency">{(['ZAR','USD','EUR','GBP'] as Currency[]).map(c=><option key={c} value={c}>{c}</option>)}</select></div></div><div className="balance-plaque"><span>NET BALANCE · {currency}</span><b data-testid="text-wallet-balance">{currencyFmt(balance,currency)}</b><small>{data.transactions.filter(t=>t.currency===currency).length} entries in this currency</small><div className="plaque-lines"/></div></section>
      <div className="section-heading"><div><div className="eyebrow">YOUR ENTRIES</div><h2>Transaction ledger</h2></div><button className="button button-gold" onClick={onAddTransaction} data-testid="button-add-transaction"><Plus size={16}/> Add entry</button></div>
      <div className="transaction-list">{data.transactions.length?data.transactions.map(t=><div className="transaction-row" key={t.id} data-testid={`transaction-row-${t.id}`}><span className={`transaction-icon ${t.type}`}>{t.type==='income'?<ArrowDownLeft size={17}/>:<ArrowUpRight size={17}/>}</span><span className="transaction-name"><b>{t.category}</b><small>{t.note||t.type} · {dateLabel(t.at)}</small></span><span className="transaction-amount"><b className={t.type==='income'?'income':'expense'}>{t.type==='income'?'+':'−'}{currencyFmt(t.amount,t.currency)}</b><small>{t.currency}</small></span><button className="icon-button delete-transaction" aria-label={`Delete ${t.category}`} onClick={()=>onDeleteTransaction(t.id)} data-testid={`button-delete-transaction-${t.id}`}><Trash2 size={15}/></button></div>):<div className="empty-state ledger-empty"><div className="empty-emblem"><CreditCard size={21}/></div><h3>No transactions recorded.</h3><p>Add a real-world income or expense when you're ready. Nothing is imported automatically.</p><button className="button button-outline" onClick={onAddTransaction} data-testid="button-add-first-transaction"><Plus size={15}/> Record an entry</button></div>}</div>
      <div className="separation-note"><LockKeyhole size={15}/><span><b>Separate by design.</b> Ledger amounts are real currency only. Quest XP is fictional progression only. They are never combined.</span></div>
        </>:tab==='achievements'?<section className="achievement-area"><div className="achievement-intro"><div className="achievement-emblem"><Award size={30}/></div><div><div className="eyebrow">MILESTONES YOU EARNED</div><h2>Not given. <em>Remembered.</em></h2><p>Achievements appear only after you take a real action in the app.</p></div></div>{achieved.length?achieved.map(a=><div className="achievement-row" key={a.id} data-testid={`achievement-${a.id}`}><span className="achievement-stamp"><Trophy size={18}/></span><div><b>{a.title}</b><p>{a.detail}</p></div><small>{dateLabel(a.earnedAt)}</small></div>):<div className="empty-state"><div className="empty-emblem"><Award size={21}/></div><h3>No milestones earned yet.</h3><p>Complete your first quest to earn a simple, honest milestone.</p><button className="button button-outline" onClick={()=>onNavigate('/quests')} data-testid="button-go-quests">Explore quests <ArrowRight size={15}/></button></div>}</section>:tab==='advanced'?<AdvancedWorld value={data.extras} onChange={onExtras} transactions={data.transactions} quests={data.quests} baseCurrency={currency} totalXp={data.totalXp}/>:tab==='phase2'?<PhaseTwoWorld value={data.phaseTwo} onChange={onData} transactions={data.transactions} onTransaction={v=>onBusinessTransaction({...v,currency:v.currency as Currency})} currencies={['ZAR','USD','EUR','GBP']} skills={data.skills} quests={data.quests} onLessonXp={onLessonXp} onTrainingComplete={onTrainingComplete}/>:<DataManagement data={data} onExport={onExport} onRestore={onRestore} onErase={onErase}/>}
  </div>;
}
function DataManagement({data,onExport,onRestore,onErase}:{data:State;onExport:()=>Promise<void>;onRestore:(backup:State)=>Promise<void>;onErase:()=>Promise<void>}) {
  const [candidate,setCandidate]=useState<State|null>(null);
  const [fileName,setFileName]=useState('');
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const [eraseOpen,setEraseOpen]=useState(false);
  const [eraseText,setEraseText]=useState('');
  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const input=event.currentTarget;
    const file=input.files?.[0];
    input.value='';
    if(!file)return;
    setMessage('');
    setCandidate(null);
    setBusy(true);
    try {
      const parsed=readBackup(await file.text());
      setCandidate(parsed);
      setFileName(file.name);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'This backup could not be read.');
    } finally {
      setBusy(false);
    }
  };
  const handleExport = async () => {
    setMessage('');
    setBusy(true);
    try { await onExport(); setMessage('Backup downloaded. Keep a copy somewhere safe.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'The backup could not be downloaded.'); }
    finally { setBusy(false); }
  };
  const handleRestore = async () => {
    if(!candidate)return;
    setMessage('');
    setBusy(true);
    try { await onRestore(candidate); setCandidate(null); setFileName(''); setMessage('Backup restored. Your previous local progress was replaced.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'The backup could not be restored.'); }
    finally { setBusy(false); }
  };
  const handleErase = async () => {
    setMessage('');
    setBusy(true);
    try { await onErase(); setEraseOpen(false); setEraseText(''); setMessage('All LIFEQUEST progress has been erased from this device.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Local progress could not be erased.'); }
    finally { setBusy(false); }
  };
  return <section className="data-management" data-testid="panel-data-privacy">
    <div className="data-intro"><span className="data-shield"><LockKeyhole size={20}/></span><div><div className="eyebrow">YOUR DEVICE · YOUR RECORD</div><h2>Keep your progress <em>in your hands.</em></h2><p>LifeQuest data stays in this browser. Backups are files you control; they are not uploaded anywhere.</p></div></div>
    <div className="data-actions">
      <article className="data-action-card"><div className="data-action-icon"><FileDown size={18}/></div><div className="data-action-copy"><h3>Download a backup</h3><p>Save your character, quests and recurring history, skills, lessons, business records, training, social reflections, achievements, and real-currency ledger.</p></div><button className="button button-outline" onClick={handleExport} disabled={busy} data-testid="button-export-backup"><FileDown size={15}/> {busy?'Working…':'Download backup'}</button></article>
      <article className="data-action-card"><div className="data-action-icon"><FileUp size={18}/></div><div className="data-action-copy"><h3>Restore from a backup</h3><p>Choose a LIFEQUEST backup file. It is checked before any saved progress can be replaced.</p></div><label className={`button button-outline backup-file-label ${busy?'disabled':''}`} data-testid="label-import-backup"><FileUp size={15}/> {busy?'Reading…':'Choose backup'}<input type="file" accept=".json,application/json" onChange={handleFile} disabled={busy} aria-label="Choose a LIFEQUEST JSON backup" data-testid="input-import-backup"/></label></article>
    </div>
    {candidate&&<div className="backup-preview" data-testid="panel-backup-preview"><div className="eyebrow">BACKUP READY · {fileName}</div><h3>Restore this record?</h3><p>This file contains {candidate.profile?'a character':'no character'}, {candidate.quests.length} quests, {candidate.skills.length} skills, {Object.keys(candidate.phaseTwo.lessons).length} lesson records, {candidate.phaseTwo.customers.length} customers, {candidate.phaseTwo.projects.length} projects, {candidate.phaseTwo.budgets.length} spending budgets, {candidate.phaseTwo.training.length} training challenges, {candidate.phaseTwo.socialCompletions.length} social reflections, {candidate.achievements.length} achievements, and {candidate.transactions.length} ledger entries ({candidate.totalXp.toLocaleString()} total XP).</p><p className="replace-warning"><AlertTriangle size={15}/> Restoring replaces all current LIFEQUEST progress on this device. It does not merge records. A safety backup of your current progress will be downloaded automatically before replacement. Keep that file safe.</p><div className="data-button-row"><button className="button button-outline" onClick={()=>{setCandidate(null);setFileName('');}} disabled={busy} data-testid="button-cancel-restore">Cancel</button><button className="button button-gold" onClick={handleRestore} disabled={busy} data-testid="button-confirm-restore">Replace with this backup <ArrowRight size={15}/></button></div></div>}
    <div className="erase-section"><div><div className="eyebrow">PERMANENT ACTION</div><h3>Erase local progress</h3><p>Remove your character, all quests and occurrence history, lessons, business records, training and reflection progress, wallet settings, and ledger entries from this browser. This cannot be undone. Download a backup first if you want to keep a copy.</p></div>{!eraseOpen?<button className="button button-danger-outline" onClick={()=>{setMessage('');setEraseOpen(true);}} disabled={busy} data-testid="button-open-erase"><Trash2 size={15}/> Erase all progress</button>:<div className="erase-confirm" data-testid="panel-erase-confirm"><p>To confirm, type <b>ERASE</b>. This only removes LIFEQUEST data saved in this browser.</p><label className="sr-only" htmlFor="confirm-erase-text">Type ERASE to confirm data removal</label><input id="confirm-erase-text" className="field-input" value={eraseText} onChange={event=>setEraseText(event.target.value)} placeholder="Type ERASE" autoComplete="off" data-testid="input-confirm-erase"/><div className="data-button-row"><button className="button button-outline" onClick={()=>{setEraseOpen(false);setEraseText('');}} disabled={busy} data-testid="button-cancel-erase">Keep my progress</button><button className="button button-danger" onClick={handleErase} disabled={busy||eraseText!=='ERASE'} data-testid="button-confirm-erase"><Trash2 size={15}/> {busy?'Erasing…':'Erase permanently'}</button></div></div>}</div>
    {message&&<p className={`data-message ${message.toLowerCase().includes('could not')||message.toLowerCase().includes('invalid')||message.toLowerCase().includes('not a supported')?'error':''}`} role="status" data-testid="status-data-action">{message}</p>}
    <p className="data-footnote"><LockKeyhole size={14}/> Restoring is a full replacement, not a merge. Erasing affects this browser only; downloaded backup files are not removed.</p>
  </section>;
}
function Modal({title,onClose,children}:{title:string;onClose:()=>void;children:ReactNode}) {
  useEffect(()=>{const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose()};window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey)},[onClose]);
  return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-heading"><div className="modal-heading"><div><div className="eyebrow">LIFEQUEST · LOCAL RECORD</div><h2 id="modal-heading">{title}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close dialog" data-testid="button-close-modal"><X size={18}/></button></div>{children}</section></div>;
}
function ProfileForm({profile,onSubmit}:{profile:State['profile'];onSubmit:(name:string,className:string,focus:string[])=>void}) {
  const [name,setName]=useState(profile?.name||'');const [className,setClassName]=useState(profile?.className||'Adventurer');const [focus,setFocus]=useState(profile?.focus||[]);const [custom,setCustom]=useState('');
  const classes=[['Warrior','Fitness, discipline and resilience.'],['Scholar','Education, knowledge and language.'],['Merchant','Business and entrepreneurship.'],['Diplomat','Communication and relationships.'],['Creator','Art, programming and creativity.'],['Explorer','Discovery and adventure.'],['Strategist','Planning and problem solving.'],['Adventurer','Balanced development across all classes.']];
  const focusChoices=['Health','Learning','Creativity','Relationships','Career','Wellbeing'];
  const toggle=(v:string)=>setFocus(f=>f.includes(v)?f.filter(x=>x!==v):[...f,v]);
  return <form onSubmit={e=>{e.preventDefault();onSubmit(name,className,[...focus,...(custom.trim()?[custom.trim()]:[])])}}><label className="field-label" htmlFor="character-name">What should we call you?</label><input id="character-name" className="field-input" value={name} onChange={e=>setName(e.target.value)} placeholder="Your name" required maxLength={36} autoFocus data-testid="input-character-name"/><div className="field-label spaced">Choose a class <small>Just a lens, not a constraint.</small></div><div className="class-options">{classes.map(([c,d])=><button type="button" key={c} className={`class-option ${className===c?'selected':''}`} onClick={()=>setClassName(c)} data-testid={`button-class-${c.toLowerCase()}`}><b>{c}</b><small>{d}</small>{className===c&&<Check size={15}/>}</button>)}</div><div className="field-label spaced">Focus attributes <small>Pick what matters to you.</small></div><div className="focus-options">{focusChoices.map(f=><button type="button" className={`focus-chip ${focus.includes(f)?'selected':''}`} onClick={()=>toggle(f)} key={f} data-testid={`button-focus-${f.toLowerCase()}`}>{focus.includes(f)&&<Check size={12}/>} {f}</button>)}</div><label className="field-label spaced" htmlFor="custom-focus">Add your own (optional)</label><input id="custom-focus" className="field-input" value={custom} onChange={e=>setCustom(e.target.value)} placeholder="A quality or skill you choose" maxLength={32} data-testid="input-custom-focus"/><p className="form-note"><LockKeyhole size={13}/> Saved to this device only. Edit anytime.</p><button className="button button-gold full-button" type="submit" disabled={!name.trim()||(!focus.length&&!custom.trim())} data-testid="button-save-character">Save character <ArrowRight size={15}/></button></form>;
}
function QuestForm({skills,initial,onSubmit,onAddSkill}:{skills:Skill[];initial:Quest|null;onSubmit:(v:Omit<Quest,'id'|'status'|'createdAt'|'completedAt'|'xpAwarded'>)=>void;onAddSkill:()=>void}) {
  const [title,setTitle]=useState(initial?.title||'');const [description,setDescription]=useState(initial?.description||'');const [difficulty,setDifficulty]=useState<Difficulty>(initial?.difficulty||'Easy');const [skillId,setSkillId]=useState(initial?.skillId||skills[0]?.id||'');const [cadence,setCadence]=useState<QuestCadence>(initial?.cadence||'once');
  const [category,setCategory]=useState(initial?.category||'Personal');
  const [priority,setPriority]=useState<QuestPriority>(initial?.priority||'normal');
  const [estimatedMinutes,setEstimatedMinutes]=useState(initial?.estimatedMinutes||30);
  const [startDate,setStartDate]=useState(initial?.startDate||'');
  const [dueDate,setDueDate]=useState(initial?.dueDate||'');
  const [completionCriteria,setCompletionCriteria]=useState(initial?.completionCriteria||'');
  const [evidence,setEvidence]=useState(initial?.evidence||'');
  const [subtasksText,setSubtasksText]=useState((initial?.subtasks||[]).map(t=>t.title).join('\n'));
  const [financialImpact,setFinancialImpact]=useState(initial?.financialImpact||0);
  const cadenceCopy:Record<QuestCadence,string>={once:'One completion only. XP is awarded once.',daily:'Earn once per local calendar day. Missed days have no penalty.',weekly:'Earn once per local Monday–Sunday week. Rest is penalty-free.',boss:'A symbolic real-life challenge; objective effort, never violence.',epic:'A long-term milestone with a single completion reward.'};
  return <form onSubmit={e=>{e.preventDefault();onSubmit({title:title.trim(),description:description.trim(),difficulty,skillId,cadence,category,priority,estimatedMinutes,startDate,dueDate,completionCriteria,evidence,financialImpact,subtasks:subtasksText.split('\n').map(t=>t.trim()).filter(Boolean).map((title,i)=>({id:initial?.subtasks?.[i]?.title===title?initial.subtasks[i].id:id(),title,done:initial?.subtasks?.[i]?.title===title?initial.subtasks[i].done:false})),occurrences:initial?.occurrences||[]})}}><label className="field-label" htmlFor="quest-title">Quest title</label><input id="quest-title" className="field-input" value={title} onChange={e=>setTitle(e.target.value)} placeholder="A real action you want to take" required maxLength={72} autoFocus data-testid="input-quest-title"/><label className="field-label spaced" htmlFor="quest-description">A note for yourself <small>Optional</small></label><textarea id="quest-description" className="field-input field-textarea" value={description} onChange={e=>setDescription(e.target.value)} placeholder="What does done look like?" maxLength={240} data-testid="input-quest-description"/><label className="field-label spaced" htmlFor="quest-difficulty">Effort level</label><select id="quest-difficulty" className="field-input" value={difficulty} onChange={e=>setDifficulty(e.target.value as Difficulty)} data-testid="select-quest-difficulty">{(Object.keys(REWARDS) as Difficulty[]).map(d=><option key={d} value={d}>{d} · {REWARDS[d]} XP</option>)}</select><label className="field-label spaced" htmlFor="quest-cadence">Quest kind</label><select id="quest-cadence" className="field-input" value={cadence} onChange={e=>setCadence(e.target.value as QuestCadence)} data-testid="select-quest-cadence"><option value="once">One-time</option><option value="daily">Daily recurring</option><option value="weekly">Weekly recurring</option><option value="boss">Boss challenge</option><option value="epic">Epic long-term quest</option></select><label className="field-label spaced">Category<input className="field-input" value={category} onChange={e=>setCategory(e.target.value)} maxLength={40}/></label><label className="field-label spaced">Priority<select className="field-input" value={priority} onChange={e=>setPriority(e.target.value as QuestPriority)}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option></select></label><label className="field-label spaced">Estimated minutes<input className="field-input" type="number" min="1" max="1440" value={estimatedMinutes} onChange={e=>setEstimatedMinutes(Math.max(1,Number(e.target.value)||1))}/></label><label className="field-label spaced">Start date<input className="field-input" type="date" value={startDate} onChange={e=>setStartDate(e.target.value)}/></label><label className="field-label spaced">Due date<input className="field-input" type="date" min={startDate||undefined} value={dueDate} onChange={e=>setDueDate(e.target.value)}/></label><label className="field-label spaced">Completion requirements<input className="field-input" value={completionCriteria} onChange={e=>setCompletionCriteria(e.target.value)} maxLength={250}/></label><label className="field-label spaced">Subtasks (one per line)<textarea className="field-input field-textarea" value={subtasksText} onChange={e=>setSubtasksText(e.target.value)}/></label><label className="field-label spaced">Evidence or notes<textarea className="field-input field-textarea" value={evidence} onChange={e=>setEvidence(e.target.value)}/></label><label className="field-label spaced">Estimated real financial impact (optional, not a transaction)<input className="field-input" type="number" step="0.01" value={financialImpact} onChange={e=>setFinancialImpact(Number(e.target.value)||0)}/></label><div className="reward-explainer"><Gem size={14}/> {cadenceCopy[cadence]} Reward: {REWARDS[difficulty]} XP.</div><label className="field-label spaced" htmlFor="quest-skill">Connect to a skill</label>{skills.length?<select id="quest-skill" className="field-input" value={skillId} onChange={e=>setSkillId(e.target.value)} data-testid="select-quest-skill">{skills.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select>:<button type="button" className="button button-outline full-button" onClick={onAddSkill} data-testid="button-create-skill-from-quest"><Plus size={14}/> Add a skill first</button>}<button className="button button-gold full-button" type="submit" disabled={!title.trim()||!skills.length} data-testid="button-save-quest">{initial?'Save changes':'Add to quest log'} <ArrowRight size={15}/></button></form>;
}
function SkillForm({onSubmit}:{onSubmit:(name:string)=>void}) {const [name,setName]=useState('');return <form onSubmit={e=>{e.preventDefault();onSubmit(name)}}><label className="field-label" htmlFor="skill-name">What are you building?</label><input className="field-input" id="skill-name" value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Patience, writing, strength" maxLength={36} required autoFocus data-testid="input-skill-name"/><p className="form-note">Skill names are yours to define. XP comes from completed, linked quests.</p><button className="button button-gold full-button" type="submit" disabled={!name.trim()} data-testid="button-save-skill">Add skill <ArrowRight size={15}/></button></form>}
function TransactionForm({baseCurrency,onSubmit}:{baseCurrency:Currency;onSubmit:(t:Omit<Transaction,'id'|'at'>)=>void}) {
  const [type,setType]=useState<'income'|'expense'>('expense');const [amount,setAmount]=useState('');const [currency,setCurrency]=useState<Currency>(baseCurrency);const [category,setCategory]=useState('');const [note,setNote]=useState('');
  return <form onSubmit={e=>{e.preventDefault();const numeric=Number(amount);if(Number.isFinite(numeric)&&numeric>0)onSubmit({amount:numeric,currency,type,category:category.trim(),note:note.trim()})}}><div className="type-switch"><button type="button" className={type==='expense'?'active':''} onClick={()=>setType('expense')} data-testid="button-type-expense"><ArrowUpRight size={15}/> Expense</button><button type="button" className={type==='income'?'active':''} onClick={()=>setType('income')} data-testid="button-type-income"><ArrowDownLeft size={15}/> Income</button></div><label className="field-label" htmlFor="transaction-amount">Amount</label><div className="amount-fields"><input id="transaction-amount" className="field-input" type="number" min="0.01" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0.00" required data-testid="input-transaction-amount"/><select className="field-input currency-input" aria-label="Currency" value={currency} onChange={e=>setCurrency(e.target.value as Currency)} data-testid="select-transaction-currency">{(['ZAR','USD','EUR','GBP'] as Currency[]).map(c=><option key={c}>{c}</option>)}</select></div><label className="field-label spaced" htmlFor="transaction-category">Category</label><input id="transaction-category" className="field-input" value={category} onChange={e=>setCategory(e.target.value)} placeholder="e.g. Groceries, freelance work" maxLength={48} required data-testid="input-transaction-category"/><label className="field-label spaced" htmlFor="transaction-note">Note <small>Optional</small></label><input id="transaction-note" className="field-input" value={note} onChange={e=>setNote(e.target.value)} placeholder="A little context" maxLength={100} data-testid="input-transaction-note"/><p className="form-note"><LockKeyhole size={13}/> Manual entry. This does not affect XP or fictional gold.</p><button className="button button-gold full-button" type="submit" disabled={!amount||Number(amount)<=0||!category.trim()} data-testid="button-save-transaction">Save {type} <ArrowRight size={15}/></button></form>;
}
function NotFound({onHome}:{onHome:()=>void}) {return <div className="page not-found"><div className="empty-emblem"><Compass size={22}/></div><div className="eyebrow">UNCHARTED</div><h1>This path isn't on your map.</h1><p>The page may have moved, or it may not exist yet.</p><button className="button button-gold" onClick={onHome} data-testid="button-return-home"><ArrowLeft size={15}/> Return to overview</button></div>}

export default App;
