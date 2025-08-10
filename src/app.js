/* app.js
 *
 * Central state manager for the migraine tracker. Coordinates
 * persistence, UI and reminders, and exposes functions for
 * manipulating episodes and settings. Other modules can import
 * these functions to interact with the underlying data.
 */

import {
  loadEpisodes,
  addEpisode as storageAddEpisode,
  updateEpisode as storageUpdateEpisode,
  deleteEpisode as storageDeleteEpisode,
  getSettings,
  updateSettings as storageUpdateSettings
} from './storage.js';
import { analysePatterns } from './patterns.js';
import { renderCharts } from './charts.js';
import { initReminders, cancelReminders } from './reminders.js';

// internal state
const state = {
  episodes: [],
  settings: {},
  listeners: []
};

/**
 * Initialise application state and set up reminders. Should be called
 * once on page load before rendering UI.
 */
export function initApp() {
  state.episodes = loadEpisodes();
  state.settings = getSettings();
  // initialise reminders based on settings
  initReminders(state.settings);
  notify();
}

/** Register a listener to be notified whenever state changes.
 * Listener is called with the latest state object.
 * @param {(state: any) => void} fn
 */
export function subscribe(fn) {
  state.listeners.push(fn);
  fn(state); // call once initially
}

function notify() {
  state.listeners.forEach(fn => fn({ ...state }));
}

/**
 * Create a new episode and update state.
 * @param {Partial<Episode>} episodeData
 */
export function addEpisode(episodeData) {
  const episode = storageAddEpisode(episodeData);
  state.episodes = loadEpisodes();
  notify();
}

/**
 * Update an existing episode.
 * @param {string} id
 * @param {Partial<Episode>} updates
 */
export function updateEpisode(id, updates) {
  storageUpdateEpisode(id, updates);
  state.episodes = loadEpisodes();
  notify();
}

/**
 * Delete an episode by id.
 * @param {string} id
 */
export function deleteEpisode(id) {
  storageDeleteEpisode(id);
  state.episodes = loadEpisodes();
  notify();
}

/**
 * Update user settings and persist them. Also reinitialises
 * reminders if relevant settings changed.
 * @param {Partial<Settings>} updates
 */
export function updateSettings(updates) {
  state.settings = storageUpdateSettings(updates);
  // if reminders toggled or time changed, reschedule
  cancelReminders();
  if (state.settings.reminderEnabled) {
    initReminders(state.settings);
  }
  notify();
}

/**
 * Compute suggestions based on current episodes.
 * @returns {Array<{title:string,message:string}>}
 */
export function getSuggestions() {
  return analysePatterns(state.episodes);
}

/**
 * Render charts into a container element. Wrapper around charts.js
 * to provide episodes from state.
 * @param {HTMLElement} container
 */
export function updateCharts(container) {
  renderCharts(container, state.episodes);
}

/**
 * Get a fresh copy of the current state (episodes + settings).
 * Useful for tests or debugging.
 */
export function getState() {
  return { episodes: [...state.episodes], settings: { ...state.settings } };
}
