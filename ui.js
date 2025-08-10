/* ui.js
 *
 * Handles rendering of the user interface and wiring up UI events
 * to the application state. All DOM manipulation occurs here.
 */

import {
  subscribe,
  addEpisode,
  updateEpisode,
  deleteEpisode as deleteEp,
  updateSettings as appUpdateSettings,
  getSuggestions,
  updateCharts,
  getState,
  initApp
} from './app.js';
import {
  exportEpisodesToCSV,
  exportEpisodesToJSON,
  importEpisodesFromJSON
} from './storage.js';

// keep track of current tab and editing state
let currentTab = 'log';
let editingId = null;
let timelineFilterDays = 30;
let timelineSearchQuery = '';

// caches for view containers
const views = {};

export function initUI() {
  const root = document.getElementById('app');
  if (!root) {
    console.error('No #app element found');
    return;
  }
  // Header
  const header = document.createElement('header');
  const title = document.createElement('h1');
  title.textContent = 'AI Migraine Tracker';
  header.appendChild(title);
  // theme toggle button
  const themeToggle = document.createElement('div');
  themeToggle.className = 'theme-toggle';
  const themeBtn = document.createElement('button');
  themeBtn.setAttribute('aria-label', 'Toggle theme');
  themeBtn.textContent = '🌓';
  themeToggle.appendChild(themeBtn);
  header.appendChild(themeToggle);
  root.appendChild(header);

  // Notification banner (hidden by default)
  const notifBanner = document.createElement('div');
  notifBanner.id = 'notif-banner';
  notifBanner.textContent = 'Notifications are blocked. Please enable them in your browser settings to receive reminders.';
  document.body.appendChild(notifBanner);
  // event to show banner
  document.addEventListener('notifications-denied', () => {
    notifBanner.style.display = 'block';
    setTimeout(() => {
      notifBanner.style.display = 'none';
    }, 8000);
  });

  // Nav
  const nav = document.createElement('nav');
  const tabs = [
    { id: 'log', label: 'Log' },
    { id: 'timeline', label: 'Timeline' },
    { id: 'charts', label: 'Charts' },
    { id: 'insights', label: 'Insights' },
    { id: 'settings', label: 'Settings' }
  ];
  tabs.forEach(tab => {
    const btn = document.createElement('button');
    btn.textContent = tab.label;
    btn.dataset.tab = tab.id;
    if (tab.id === currentTab) btn.classList.add('active');
    btn.addEventListener('click', () => {
      showTab(tab.id);
    });
    nav.appendChild(btn);
  });
  root.appendChild(nav);

  // Main container for views
  const main = document.createElement('main');
  root.appendChild(main);
  // Create view containers
  tabs.forEach(tab => {
    const section = document.createElement('div');
    section.id = `view-${tab.id}`;
    if (tab.id !== currentTab) section.style.display = 'none';
    views[tab.id] = section;
    main.appendChild(section);
  });

  // Build subviews
  buildLogView();
  buildTimelineView();
  buildChartsView();
  buildInsightsView();
  buildSettingsView();

  // Theme toggle behaviour
  themeBtn.addEventListener('click', () => {
    const state = getState();
    const newTheme = nextTheme(state.settings.theme);
    appUpdateSettings({ theme: newTheme });
  });

  // Listen for state changes to update UI
  subscribe(state => {
    applyTheme(state.settings);
    applyReducedMotion(state.settings);
    // update timeline
    renderTimeline(state);
    // update charts
    const chartsContainer = views.charts.querySelector('.charts-container');
    if (chartsContainer) {
      updateCharts(chartsContainer);
    }
    // update insights
    renderInsights(state);
    // update settings form values
    syncSettingsUI(state);
    // update log triggers list
    updateTriggersUI(state);
  });
}

// Determine next theme cycle: system -> dark -> light -> system
function nextTheme(current) {
  if (current === 'system') return 'dark';
  if (current === 'dark') return 'light';
  return 'system';
}

function applyTheme(settings) {
  const root = document.documentElement;
  let theme = settings.theme;
  if (theme === 'system') {
    // follow system
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    theme = prefersDark ? 'dark' : 'light';
  }
  root.setAttribute('data-theme', theme);
}

function applyReducedMotion(settings) {
  const root = document.documentElement;
  root.style.setProperty('--transition-duration', settings.reducedMotion ? '0s' : '0.2s');
}

function showTab(tabId) {
  currentTab = tabId;
  for (const [id, section] of Object.entries(views)) {
    section.style.display = id === tabId ? 'block' : 'none';
  }
  // update nav active class
  const navButtons = document.querySelectorAll('nav button');
  navButtons.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });
  // if switching to charts, ensure charts redraw with current size
  if (tabId === 'charts') {
    const chartsContainer = views.charts.querySelector('.charts-container');
    if (chartsContainer) {
      updateCharts(chartsContainer);
    }
  }
  // if switching to log and editing, re-render form with editing data
  if (tabId === 'log') {
    buildLogView();
  }
}

/* --------- Log view ----------- */
function buildLogView() {
  const container = views.log;
  container.innerHTML = '';
  const form = document.createElement('form');
  form.addEventListener('submit', e => {
    e.preventDefault();
    saveLogForm(form);
  });
  // date/time
  const dateLabel = document.createElement('label');
  dateLabel.textContent = 'Date & Time';
  const dateInput = document.createElement('input');
  dateInput.type = 'datetime-local';
  dateInput.required = true;
  dateInput.id = 'log-datetime';
  form.appendChild(dateLabel);
  form.appendChild(dateInput);
  // intensity
  const intensityLabel = document.createElement('label');
  intensityLabel.textContent = 'Intensity (0–10)';
  const intensityInput = document.createElement('input');
  intensityInput.type = 'number';
  intensityInput.min = 0;
  intensityInput.max = 10;
  intensityInput.required = true;
  intensityInput.id = 'log-intensity';
  form.appendChild(intensityLabel);
  form.appendChild(intensityInput);
  // duration
  const durationLabel = document.createElement('label');
  durationLabel.textContent = 'Duration (minutes)';
  const durationInput = document.createElement('input');
  durationInput.type = 'number';
  durationInput.min = 1;
  durationInput.required = true;
  durationInput.id = 'log-duration';
  form.appendChild(durationLabel);
  form.appendChild(durationInput);
  // triggers list container
  const triggersLabel = document.createElement('label');
  triggersLabel.textContent = 'Triggers';
  const triggersContainer = document.createElement('div');
  triggersContainer.id = 'triggers-container';
  form.appendChild(triggersLabel);
  form.appendChild(triggersContainer);
  // custom trigger input
  const customTriggerRow = document.createElement('div');
  customTriggerRow.style.display = 'flex';
  customTriggerRow.style.gap = '8px';
  const customInput = document.createElement('input');
  customInput.type = 'text';
  customInput.placeholder = 'Add custom trigger';
  customInput.id = 'custom-trigger';
  const addTriggerBtn = document.createElement('button');
  addTriggerBtn.type = 'button';
  addTriggerBtn.textContent = 'Add Trigger';
  addTriggerBtn.className = 'secondary';
  addTriggerBtn.addEventListener('click', () => {
    const val = customInput.value.trim();
    if (!val) return;
    // update settings triggers list via appUpdateSettings
    const state = getState();
    const list = state.settings.triggersList.map(t => t.toLowerCase());
    if (!list.includes(val.toLowerCase())) {
      const newList = [...state.settings.triggersList, val];
      appUpdateSettings({ triggersList: newList });
    }
    // preselect this trigger by checking its checkbox after re-render
    setTimeout(() => {
      const checkbox = document.querySelector(`#triggers-container input[data-trigger="${val}"]`);
      if (checkbox) checkbox.checked = true;
    }, 0);
    customInput.value = '';
  });
  customTriggerRow.appendChild(customInput);
  customTriggerRow.appendChild(addTriggerBtn);
  form.appendChild(customTriggerRow);
  // medications
  const medsLabel = document.createElement('label');
  medsLabel.textContent = 'Medications';
  const medsList = document.createElement('div');
  medsList.className = 'meds-list';
  form.appendChild(medsLabel);
  form.appendChild(medsList);
  const addMedBtn = document.createElement('button');
  addMedBtn.type = 'button';
  addMedBtn.textContent = 'Add Medication';
  addMedBtn.className = 'secondary';
  addMedBtn.addEventListener('click', () => {
    addMedicationRow(medsList);
  });
  form.appendChild(addMedBtn);
  // notes
  const notesLabel = document.createElement('label');
  notesLabel.textContent = 'Notes';
  const notesInput = document.createElement('textarea');
  notesInput.rows = 3;
  notesInput.id = 'log-notes';
  form.appendChild(notesLabel);
  form.appendChild(notesInput);
  // action buttons
  const actionsDiv = document.createElement('div');
  actionsDiv.style.display = 'flex';
  actionsDiv.style.gap = '8px';
  actionsDiv.style.marginTop = '12px';
  const saveBtn = document.createElement('button');
  saveBtn.className = 'primary';
  saveBtn.textContent = editingId ? 'Update' : 'Save';
  saveBtn.type = 'submit';
  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'secondary';
  cancelBtn.textContent = 'Clear';
  cancelBtn.addEventListener('click', () => {
    editingId = null;
    buildLogView();
  });
  actionsDiv.appendChild(saveBtn);
  actionsDiv.appendChild(cancelBtn);
  form.appendChild(actionsDiv);
  container.appendChild(form);
  // populate triggers and default values from state
  const state = getState();
  updateTriggersUI(state);
  // Pre-populate if editing
  if (editingId) {
    const ep = state.episodes.find(e => e.id === editingId);
    if (ep) {
      // convert ISO to local datetime-local value
      const dt = new Date(ep.datetime);
      const localISO = dt.getFullYear() + '-' + pad(dt.getMonth()+1) + '-' + pad(dt.getDate()) + 'T' + pad(dt.getHours()) + ':' + pad(dt.getMinutes());
      dateInput.value = localISO;
      intensityInput.value = ep.intensity;
      durationInput.value = ep.durationMinutes;
      // triggers
      setTimeout(() => {
        ep.triggers.forEach(t => {
          const cb = document.querySelector(`#triggers-container input[data-trigger="${t}"]`);
          if (cb) cb.checked = true;
        });
      }, 0);
      // medications
      medsList.innerHTML = '';
      (ep.medications || []).forEach(m => {
        addMedicationRow(medsList, m);
      });
      // notes
      notesInput.value = ep.notes || '';
      saveBtn.textContent = 'Update';
    }
  } else {
    // when creating new episode default date/time to now (rounded to next 5 minutes)
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getMinutes() % 5);
    const localISO = now.getFullYear() + '-' + pad(now.getMonth()+1) + '-' + pad(now.getDate()) + 'T' + pad(now.getHours()) + ':' + pad(now.getMinutes());
    dateInput.value = localISO;
  }
}

function pad(n) {
  return n.toString().padStart(2, '0');
}

function addMedicationRow(container, med = { name: '', doseMg: '' }) {
  const row = document.createElement('div');
  row.className = 'med-row';
  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.placeholder = 'Name';
  nameInput.value = med.name || '';
  const doseInput = document.createElement('input');
  doseInput.type = 'number';
  doseInput.placeholder = 'Dose (mg)';
  doseInput.min = 0;
  doseInput.step = 0.1;
  doseInput.value = med.doseMg || '';
  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'danger';
  removeBtn.textContent = '×';
  removeBtn.addEventListener('click', () => {
    row.remove();
  });
  row.appendChild(nameInput);
  row.appendChild(doseInput);
  row.appendChild(removeBtn);
  container.appendChild(row);
}

function saveLogForm(form) {
  // gather values
  const datetime = form.querySelector('#log-datetime').value;
  const intensity = parseInt(form.querySelector('#log-intensity').value, 10);
  const durationMinutes = parseInt(form.querySelector('#log-duration').value, 10);
  const note = form.querySelector('#log-notes').value.trim();
  // triggers selected
  const triggerCheckboxes = form.querySelectorAll('#triggers-container input[type="checkbox"]');
  const triggers = [];
  triggerCheckboxes.forEach(cb => {
    if (cb.checked) triggers.push(cb.dataset.trigger);
  });
  // medications
  const meds = [];
  form.querySelectorAll('.med-row').forEach(row => {
    const name = row.querySelector('input[type="text"]').value.trim();
    const doseVal = row.querySelector('input[type="number"]').value;
    if (name) {
      const dose = doseVal ? parseFloat(doseVal) : undefined;
      meds.push({ name, doseMg: isNaN(dose) ? undefined : dose });
    }
  });
  // validation
  if (intensity < 0 || intensity > 10) {
    alert('Intensity must be between 0 and 10.');
    return;
  }
  if (!durationMinutes || durationMinutes <= 0) {
    alert('Duration must be a positive number.');
    return;
  }
  const iso = new Date(datetime);
  if (isNaN(iso.getTime())) {
    alert('Please enter a valid date/time.');
    return;
  }
  const now = new Date();
  if (iso > now) {
    const proceed = confirm('The selected date/time is in the future. Continue?');
    if (!proceed) return;
  }
  const data = {
    datetime: iso.toISOString(),
    intensity,
    durationMinutes,
    triggers,
    medications: meds,
    notes: note
  };
  if (editingId) {
    updateEpisode(editingId, data);
    editingId = null;
  } else {
    addEpisode(data);
  }
  // clear form
  buildLogView();
  // maybe navigate to timeline
  showTab('timeline');
}

function updateTriggersUI(state) {
  const triggersContainer = document.getElementById('triggers-container');
  if (!triggersContainer) return;
  triggersContainer.innerHTML = '';
  const list = state.settings.triggersList;
  list.forEach(tr => {
    const id = `trigger-${tr}`;
    const wrapper = document.createElement('label');
    wrapper.style.display = 'block';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.dataset.trigger = tr;
    input.id = id;
    const span = document.createElement('span');
    span.textContent = tr;
    wrapper.appendChild(input);
    wrapper.appendChild(span);
    triggersContainer.appendChild(wrapper);
  });
}

/* --------- Timeline view ----------- */
function buildTimelineView() {
  const container = views.timeline;
  container.innerHTML = '';
  // Filter controls
  const controls = document.createElement('div');
  controls.style.display = 'flex';
  controls.style.gap = '8px';
  controls.style.flexWrap = 'wrap';
  // select for days
  const select = document.createElement('select');
  [
    { label: '7 days', value: 7 },
    { label: '30 days', value: 30 },
    { label: '90 days', value: 90 },
    { label: 'All', value: 0 }
  ].forEach(opt => {
    const o = document.createElement('option');
    o.value = opt.value;
    o.textContent = opt.label;
    if (opt.value === timelineFilterDays) o.selected = true;
    select.appendChild(o);
  });
  select.addEventListener('change', () => {
    timelineFilterDays = parseInt(select.value, 10);
    renderTimeline(getState());
  });
  controls.appendChild(select);
  // search input
  const search = document.createElement('input');
  search.type = 'search';
  search.placeholder = 'Search notes';
  search.value = timelineSearchQuery;
  search.addEventListener('input', () => {
    timelineSearchQuery = search.value.toLowerCase();
    renderTimeline(getState());
  });
  controls.appendChild(search);
  container.appendChild(controls);
  // entries list container
  const list = document.createElement('div');
  list.id = 'timeline-list';
  container.appendChild(list);
}

function renderTimeline(state) {
  const list = document.getElementById('timeline-list');
  if (!list) return;
  list.innerHTML = '';
  let episodes = [...state.episodes];
  // sort descending by datetime
  episodes.sort((a, b) => new Date(b.datetime) - new Date(a.datetime));
  // filter by days
  if (timelineFilterDays > 0) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - timelineFilterDays);
    episodes = episodes.filter(ep => new Date(ep.datetime) >= cutoff);
  }
  // search filter
  if (timelineSearchQuery) {
    episodes = episodes.filter(ep => (ep.notes || '').toLowerCase().includes(timelineSearchQuery));
  }
  if (episodes.length === 0) {
    const empty = document.createElement('p');
    empty.textContent = 'No episodes found.';
    list.appendChild(empty);
    return;
  }
  episodes.forEach(ep => {
    const card = document.createElement('div');
    card.className = 'card';
    const entry = document.createElement('div');
    entry.className = 'timeline-entry';
    // datetime
    const dt = new Date(ep.datetime);
    const dateStr = dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    const timeStr = dt.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    const heading = document.createElement('strong');
    heading.textContent = `${dateStr} ${timeStr}`;
    entry.appendChild(heading);
    // intensity
    const intensity = document.createElement('span');
    intensity.textContent = `Intensity: ${ep.intensity}`;
    entry.appendChild(intensity);
    // duration
    const duration = document.createElement('span');
    duration.textContent = `Duration: ${ep.durationMinutes} min`;
    entry.appendChild(duration);
    // triggers
    if (ep.triggers && ep.triggers.length > 0) {
      const trig = document.createElement('span');
      trig.textContent = `Triggers: ${ep.triggers.join(', ')}`;
      entry.appendChild(trig);
    }
    // medications
    if (ep.medications && ep.medications.length > 0) {
      const meds = document.createElement('span');
      const medsStr = ep.medications
        .map(m => m.name + (m.doseMg ? ` (${m.doseMg}mg)` : ''))
        .join(', ');
      meds.textContent = `Meds: ${medsStr}`;
      entry.appendChild(meds);
    }
    // notes
    if (ep.notes) {
      const notes = document.createElement('span');
      notes.textContent = `Notes: ${ep.notes}`;
      entry.appendChild(notes);
    }
    // actions
    const actions = document.createElement('div');
    actions.className = 'timeline-actions';
    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'secondary';
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', () => {
      editingId = ep.id;
      showTab('log');
    });
    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'danger';
    delBtn.textContent = 'Delete';
    delBtn.addEventListener('click', () => {
      if (confirm('Delete this episode?')) {
        deleteEp(ep.id);
      }
    });
    actions.appendChild(editBtn);
    actions.appendChild(delBtn);
    entry.appendChild(actions);
    card.appendChild(entry);
    list.appendChild(card);
  });
}

/* --------- Charts view ----------- */
function buildChartsView() {
  const container = views.charts;
  container.innerHTML = '';
  const chartsContainer = document.createElement('div');
  chartsContainer.className = 'charts-container';
  container.appendChild(chartsContainer);
  // Charts will be drawn via subscribe
}

/* --------- Insights view ----------- */
function buildInsightsView() {
  const container = views.insights;
  container.innerHTML = '';
  const insightsList = document.createElement('div');
  insightsList.id = 'insights-list';
  container.appendChild(insightsList);
  // initial message
  insightsList.textContent = 'No insights yet.';
}

function renderInsights(state) {
  const list = document.getElementById('insights-list');
  if (!list) return;
  const suggestions = getSuggestions();
  list.innerHTML = '';
  if (suggestions.length === 0) {
    const p = document.createElement('p');
    p.textContent = 'No significant patterns detected in the last month.';
    list.appendChild(p);
    return;
  }
  suggestions.forEach(s => {
    const div = document.createElement('div');
    div.className = 'insight';
    const h3 = document.createElement('h3');
    h3.textContent = s.title;
    const p = document.createElement('p');
    p.textContent = s.message;
    div.appendChild(h3);
    div.appendChild(p);
    list.appendChild(div);
  });
}

/* --------- Settings view ----------- */
function buildSettingsView() {
  const container = views.settings;
  container.innerHTML = '';
  const form = document.createElement('div');
  form.className = 'card';
  // Theme select
  const themeLabel = document.createElement('label');
  themeLabel.textContent = 'Theme';
  const themeSelect = document.createElement('select');
  themeSelect.id = 'settings-theme';
  ['system', 'light', 'dark'].forEach(val => {
    const opt = document.createElement('option');
    opt.value = val;
    opt.textContent = val.charAt(0).toUpperCase() + val.slice(1);
    themeSelect.appendChild(opt);
  });
  themeSelect.addEventListener('change', () => {
    appUpdateSettings({ theme: themeSelect.value });
  });
  form.appendChild(themeLabel);
  form.appendChild(themeSelect);
  // Reduced motion
  const rmLabel = document.createElement('label');
  rmLabel.textContent = 'Reduce motion';
  const rmCheckbox = document.createElement('input');
  rmCheckbox.type = 'checkbox';
  rmCheckbox.id = 'settings-reduced-motion';
  rmCheckbox.addEventListener('change', () => {
    appUpdateSettings({ reducedMotion: rmCheckbox.checked });
  });
  const rmWrapper = document.createElement('div');
  rmWrapper.style.display = 'flex';
  rmWrapper.style.alignItems = 'center';
  rmWrapper.style.gap = '8px';
  rmWrapper.appendChild(rmCheckbox);
  rmWrapper.appendChild(document.createTextNode('Enable reduced motion'));
  form.appendChild(rmLabel);
  form.appendChild(rmWrapper);
  // Reminder toggle and time
  const remLabel = document.createElement('label');
  remLabel.textContent = 'Daily reminder';
  const remCheckbox = document.createElement('input');
  remCheckbox.type = 'checkbox';
  remCheckbox.id = 'settings-reminder-enabled';
  const remTime = document.createElement('input');
  remTime.type = 'time';
  remTime.id = 'settings-reminder-time';
  remTime.style.marginLeft = '8px';
  remCheckbox.addEventListener('change', () => {
    appUpdateSettings({ reminderEnabled: remCheckbox.checked });
  });
  remTime.addEventListener('change', () => {
    appUpdateSettings({ reminderTime: remTime.value });
  });
  const remRow = document.createElement('div');
  remRow.style.display = 'flex';
  remRow.style.alignItems = 'center';
  remRow.style.gap = '8px';
  remRow.appendChild(remCheckbox);
  remRow.appendChild(document.createTextNode('Enable'));
  remRow.appendChild(remTime);
  form.appendChild(remLabel);
  form.appendChild(remRow);
  // Export section
  const exportDiv = document.createElement('div');
  exportDiv.style.marginTop = '16px';
  const exportLabel = document.createElement('strong');
  exportLabel.textContent = 'Export';
  exportDiv.appendChild(exportLabel);
  const exportCsvBtn = document.createElement('button');
  exportCsvBtn.type = 'button';
  exportCsvBtn.className = 'primary';
  exportCsvBtn.textContent = 'Export CSV';
  exportCsvBtn.addEventListener('click', () => {
    const csv = exportEpisodesToCSV();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'migraine_episodes.csv';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
  const exportJsonBtn = document.createElement('button');
  exportJsonBtn.type = 'button';
  exportJsonBtn.className = 'primary';
  exportJsonBtn.style.marginLeft = '8px';
  exportJsonBtn.textContent = 'Backup JSON';
  exportJsonBtn.addEventListener('click', () => {
    const json = exportEpisodesToJSON();
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'migraine_backup.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
  exportDiv.appendChild(exportCsvBtn);
  exportDiv.appendChild(exportJsonBtn);
  form.appendChild(exportDiv);
  // Import section
  const importDiv = document.createElement('div');
  importDiv.style.marginTop = '16px';
  const importLabel = document.createElement('strong');
  importLabel.textContent = 'Import';
  importDiv.appendChild(importLabel);
  const importInput = document.createElement('input');
  importInput.type = 'file';
  importInput.accept = '.json';
  importInput.addEventListener('change', () => {
    const file = importInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const content = reader.result;
      const merge = confirm('Merge imported episodes with existing ones? Click Cancel to replace existing episodes.');
      try {
        importEpisodesFromJSON(content, merge);
        // refresh state after import
        initApp();
        alert('Import successful');
      } catch (err) {
        alert('Failed to import: ' + err.message);
      }
    };
    reader.readAsText(file);
    // reset input so change event triggers again if same file selected
    importInput.value = '';
  });
  importDiv.appendChild(importInput);
  form.appendChild(importDiv);
  container.appendChild(form);
}

function syncSettingsUI(state) {
  // set theme select
  const themeSelect = document.getElementById('settings-theme');
  if (themeSelect && themeSelect.value !== state.settings.theme) {
    themeSelect.value = state.settings.theme;
  }
  // reduced motion
  const rmCheckbox = document.getElementById('settings-reduced-motion');
  if (rmCheckbox) rmCheckbox.checked = state.settings.reducedMotion;
  // reminder
  const remCheckbox = document.getElementById('settings-reminder-enabled');
  if (remCheckbox) remCheckbox.checked = state.settings.reminderEnabled;
  const remTime = document.getElementById('settings-reminder-time');
  if (remTime) {
    remTime.value = state.settings.reminderTime;
    remTime.disabled = !state.settings.reminderEnabled;
  }
}