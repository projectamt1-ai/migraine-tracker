// src/storage.js
// Local-first data layer using localStorage (no external services).

const EPISODES_KEY = 'aiMigraineEpisodes';
const SETTINGS_KEY = 'aiMigraineSettings';
let onChange = () => {}; // notify app when data changes

export function setOnChange(cb) { onChange = typeof cb === 'function' ? cb : () => {}; }

// ---------- Episodes ----------
export function loadEpisodes() {
  try {
    const raw = localStorage.getItem(EPISODES_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

function saveEpisodes(arr) {
  localStorage.setItem(EPISODES_KEY, JSON.stringify(arr));
  onChange();
}

export function addEpisode(ep) {
  const eps = loadEpisodes();
  // generate id if missing
  ep.id = ep.id || crypto.randomUUID?.() || String(Date.now());
  eps.push(ep);
  saveEpisodes(eps);
  return ep;
}

export function updateEpisode(id, patch) {
  const eps = loadEpisodes();
  const i = eps.findIndex(e => e.id === id);
  if (i !== -1) {
    eps[i] = { ...eps[i], ...patch, id };
    saveEpisodes(eps);
    return eps[i];
  }
  return null;
}

export function deleteEpisode(id) {
  const eps = loadEpisodes().filter(e => e.id !== id);
  saveEpisodes(eps);
}

// ---------- Settings ----------
const DEFAULT_SETTINGS = {
  reminderEnabled: false,
  reminderTime: '20:30',
  theme: 'system',
  reducedMotion: false
};

export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS };
  } catch { return { ...DEFAULT_SETTINGS }; }
}

export function saveSettings(s) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  onChange();
}

// ---------- Export / Import ----------
export function exportEpisodesToCSV() {
  const eps = loadEpisodes().sort((a,b)=>new Date(b.datetime)-new Date(a.datetime));
  const header = [
    'id','datetime','intensity','durationMinutes','triggers','medications','notes'
  ];
  const rows = eps.map(e => [
    e.id,
    e.datetime,
    e.intensity,
    e.durationMinutes,
    (e.triggers||[]).join(';'),
    (e.medications||[]).map(m => m.doseMg ? `${m.name}(${m.doseMg}mg)` : m.name).join(';'),
    (e.notes||'').replace(/\r?\n/g,' ')
  ]);
  const csv = [header, ...rows]
    .map(r => r.map(cell => {
      const s = String(cell ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s;
    }).join(','))
    .join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  download(url, `migraine_episodes_${new Date().toISOString().slice(0,10)}.csv`);
}

export function exportBackupJSON() {
  const data = {
    episodes: loadEpisodes(),
    settings: loadSettings(),
    exportedAt: new Date().toISOString()
  };
  const blob = new Blob([JSON.stringify(data,null,2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  download(url, `migraine_backup_${new Date().toISOString().slice(0,10)}.json`);
}

export async function importBackupJSON(file, { mode = 'merge' } = {}) {
  const text = await file.text();
  const data = JSON.parse(text || '{}');
  const incoming = Array.isArray(data.episodes) ? data.episodes : [];
  const current = loadEpisodes();

  let merged;
  if (mode === 'replace') {
    merged = incoming;
  } else {
    const map = new Map(current.map(e => [e.id, e]));
    for (const e of incoming) map.set(e.id || (crypto.randomUUID?.() || String(Date.now()+Math.random())), e);
    merged = Array.from(map.values());
  }
  saveEpisodes(merged);

  if (data.settings && typeof data.settings === 'object') {
    saveSettings({ ...loadSettings(), ...data.settings });
  }
}

// ---------- Helpers ----------
function download(url, filename) {
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
