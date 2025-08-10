/* reminders.js
 *
 * Handles scheduling and displaying local notifications to remind
 * the user to log their migraine episodes each day at a chosen time.
 */

let reminderTimeoutId = null;

/**
 * Initialise reminders based on user settings. Should be called
 * after settings are loaded and whenever settings.reminderEnabled
 * or settings.reminderTime changes.
 *
 * @param {Settings} settings
 */
export function initReminders(settings) {
  // cancel any existing scheduled reminder
  if (reminderTimeoutId) {
    clearTimeout(reminderTimeoutId);
    reminderTimeoutId = null;
  }
  if (!settings.reminderEnabled) return;
  const perm = Notification.permission;
  if (perm === 'default') {
    // ask for permission when not yet decided
    Notification.requestPermission().then(() => {
      scheduleNextReminder(settings.reminderTime);
    });
  } else if (perm === 'denied') {
    // show banner explaining how to enable in-app (if implemented via UI)
    // we trigger a custom event so UI can react
    const event = new CustomEvent('notifications-denied');
    document.dispatchEvent(event);
  } else {
    scheduleNextReminder(settings.reminderTime);
  }
}

/**
 * Schedule the next daily reminder given a HH:mm time string.
 * Uses setTimeout to wait until the next occurrence; then sends
 * a notification and schedules the following day.
 *
 * @param {string} timeStr - in HH:mm format, local time
 */
function scheduleNextReminder(timeStr) {
  const now = new Date();
  const [hh, mm] = timeStr.split(':').map(n => parseInt(n, 10));
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm, 0, 0);
  if (next <= now) {
    // time has passed today; schedule for tomorrow
    next.setDate(next.getDate() + 1);
  }
  const msUntil = next.getTime() - now.getTime();
  reminderTimeoutId = setTimeout(function triggerReminder() {
    showReminderNotification();
    // schedule for following day (24 hours later)
    reminderTimeoutId = setTimeout(triggerReminder, 24 * 60 * 60 * 1000);
  }, msUntil);
}

/**
 * Display a notification to the user reminding them to log
 * their migraine episode. Uses Notification API.
 */
function showReminderNotification() {
  const title = 'Migraine log reminder';
  const body = 'Don\'t forget to record today\'s migraine episode if you have one.';
  try {
    new Notification(title, { body });
  } catch (err) {
    console.warn('Failed to show notification', err);
  }
}

/**
 * Cancel any scheduled reminder. Useful when disabling reminders.
 */
export function cancelReminders() {
  if (reminderTimeoutId) {
    clearTimeout(reminderTimeoutId);
    reminderTimeoutId = null;
  }
}
