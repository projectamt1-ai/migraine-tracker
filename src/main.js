/* main.js
 *
 * Entry point for the AI Migraine Tracker PWA. This module
 * initialises the application state and the user interface.
 */

import { initApp } from './app.js';
import { initUI } from './ui.js';

// Wait until DOM content is ready
document.addEventListener('DOMContentLoaded', () => {
  initApp();
  initUI();
});
