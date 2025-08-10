/* patterns.js
 *
 * Implements simple rule‑based heuristics to surface behavioural patterns
 * in the user's migraine episodes. No machine learning is used – instead
 * we compute statistics over recent episodes and return gentle
 * suggestions.  See README for description of the rules.
 */

/**
 * Given a list of Episode objects, compute suggestions according to
 * various heuristics.
 * Each suggestion is an object with `title` and `message` fields.
 *
 * @param {Episode[]} episodes
 * @returns {{title:string,message:string}[]}
 */
export function analysePatterns(episodes) {
  const suggestions = [];
  if (!Array.isArray(episodes) || episodes.length === 0) return suggestions;
  const now = new Date();

  // Helper: filter episodes within last N days
  function inLastDays(days) {
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - days);
    return episodes.filter(ep => new Date(ep.datetime) >= cutoff);
  }

  // Top triggers rule: any trigger present in >=25% of last‑30‑day episodes
  (function topTriggersRule() {
    const recent = inLastDays(30);
    if (recent.length === 0) return;
    const triggerCounts = {};
    recent.forEach(ep => {
      (ep.triggers || []).forEach(t => {
        const key = t.trim().toLowerCase();
        triggerCounts[key] = (triggerCounts[key] || 0) + 1;
      });
    });
    const threshold = Math.ceil(recent.length * 0.25);
    const commonTriggers = Object.entries(triggerCounts)
      .filter(([, count]) => count >= threshold)
      .map(([name]) => name);
    if (commonTriggers.length > 0) {
      const list = commonTriggers.map(t => capitalize(t)).join(', ');
      suggestions.push({
        title: 'Frequent triggers',
        message: `You often report triggers like ${list}. Consider what adjustments might help you avoid or mitigate these.`
      });
    }
  })();

  // Time‑of‑day cluster: ≥40% episodes within any 4‑hour window in last 30 days
  (function timeOfDayRule() {
    const recent = inLastDays(30);
    if (recent.length === 0) return;
    // convert times to minutes since midnight
    const minutes = recent.map(ep => {
      const d = new Date(ep.datetime);
      return d.getHours() * 60 + d.getMinutes();
    });
    minutes.sort((a, b) => a - b);
    const total = minutes.length;
    const threshold = Math.ceil(total * 0.4);
    // sliding window of 4 hours (240 minutes)
    let maxCount = 0;
    let windowStartIdx = 0;
    let windowStartTime = 0;
    for (let i = 0; i < minutes.length; i++) {
      // shrink window while difference > 240
      while (minutes[i] - minutes[windowStartIdx] > 240) {
        windowStartIdx++;
      }
      const count = i - windowStartIdx + 1;
      if (count > maxCount) {
        maxCount = count;
        windowStartTime = minutes[windowStartIdx];
      }
    }
    if (maxCount >= threshold) {
      const start = windowStartTime;
      const end = (start + 240) % (24 * 60);
      const startStr = formatTime(start);
      const endStr = formatTime(end);
      suggestions.push({
        title: 'Time‑of‑day pattern',
        message: `Around ${Math.round((maxCount / total) * 100)}% of your episodes happen between ${startStr} and ${endStr}. You might try adjusting your routine or preparing for triggers during this period.`
      });
    }
  })();

  // Day‑of‑week cluster: ≥40% on same weekday
  (function dayOfWeekRule() {
    const recent = inLastDays(30);
    if (recent.length === 0) return;
    const counts = Array(7).fill(0);
    recent.forEach(ep => {
      const day = new Date(ep.datetime).getDay(); // 0=Sun
      counts[day]++;
    });
    const total = recent.length;
    const threshold = Math.ceil(total * 0.4);
    const maxCount = Math.max(...counts);
    if (maxCount >= threshold) {
      const dayIndex = counts.indexOf(maxCount);
      const weekdays = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
      suggestions.push({
        title: 'Day‑of‑week trend',
        message: `About ${Math.round((maxCount / total) * 100)}% of recent episodes occur on ${weekdays[dayIndex]}s. There may be something about those days worth investigating.`
      });
    }
  })();

  // Rising intensity trend: 3‑week moving average up ≥20% vs previous 3 weeks
  (function risingIntensityRule() {
    // consider last 6 weeks
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - 42);
    const recent = episodes.filter(ep => new Date(ep.datetime) >= cutoff);
    if (recent.length < 2) return;
    // split into two windows: first 3 weeks and last 3 weeks
    const midCutoff = new Date(now);
    midCutoff.setDate(midCutoff.getDate() - 21);
    const firstWindow = recent.filter(ep => new Date(ep.datetime) < midCutoff);
    const secondWindow = recent.filter(ep => new Date(ep.datetime) >= midCutoff);
    if (firstWindow.length === 0 || secondWindow.length === 0) return;
    const avg1 = firstWindow.reduce((sum, ep) => sum + ep.intensity, 0) / firstWindow.length;
    const avg2 = secondWindow.reduce((sum, ep) => sum + ep.intensity, 0) / secondWindow.length;
    if (avg2 >= avg1 * 1.2) {
      suggestions.push({
        title: 'Rising intensity',
        message: `Your average migraine intensity over the last three weeks (${avg2.toFixed(1)}) is noticeably higher than the preceding three weeks (${avg1.toFixed(1)}). It may be worth discussing this with a healthcare professional.`
      });
    }
  })();

  // Medication overuse: meds used ≥10 days in last 30
  (function medicationOveruseRule() {
    const recent = inLastDays(30);
    // gather unique days where any medication taken
    const daysWithMeds = new Set();
    recent.forEach(ep => {
      if (Array.isArray(ep.medications) && ep.medications.length > 0) {
        const date = new Date(ep.datetime).toISOString().slice(0, 10);
        daysWithMeds.add(date);
      }
    });
    if (daysWithMeds.size >= 10) {
      suggestions.push({
        title: 'Medication use',
        message: `You've taken migraine medication on ${daysWithMeds.size} days in the last month. Overuse can sometimes worsen migraines – consider discussing your medication plan with a doctor.`
      });
    }
  })();

  return suggestions;
}

// Helpers
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function formatTime(minutes) {
  const hh = Math.floor(minutes / 60);
  const mm = minutes % 60;
  const pad = n => n.toString().padStart(2, '0');
  return `${pad(hh)}:${pad(mm)}`;
}
