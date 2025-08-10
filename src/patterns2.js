/* patterns.js
 * Implements simple rule-based heuristics to surface behavioural patterns
 * in the user's migraine episodes. No machine learning is used – instead
 * we compute statistics over recent episodes and return gentle suggestions.
 */

export function analysePatterns(episodes) {
  const suggestions = [];
  if (!Array.isArray(episodes) || episodes.length === 0) return suggestions;
  const now = new Date();

  function inLastDays(days) {
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - days);
    return episodes.filter(ep => new Date(ep.datetime) >= cutoff);
  }

  function capitalize(s) {
    return !s ? '' : s.charAt(0).toUpperCase() + s.slice(1);
  }

  function computeStreak(eps) {
    if (eps.length === 0) return 0;
    const dateStrings = [...new Set(eps.map(ep => ep.datetime.slice(0, 10)))]
      .sort((a, b) => new Date(b) - new Date(a));
    let streak = 1;
    for (let i = 0; i < dateStrings.length - 1; i++) {
      const d1 = new Date(dateStrings[i]);
      const d2 = new Date(dateStrings[i + 1]);
      const diff = (d1 - d2) / (1000 * 60 * 60 * 24);
      if (diff === 1) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  }

  function groupBy(array, keyFn) {
    return array.reduce((acc, item) => {
      const key = keyFn(item);
      acc[key] = acc[key] || [];
      acc[key].push(item);
      return acc;
    }, {});
  }

  (function topTriggersRule() {
    const recent = inLastDays(30);
    if (recent.length === 0) return;
    const triggerCounts = {};
    recent.forEach(ep => {
      (ep.triggers || []).forEach(t => {
        triggerCounts[t] = (triggerCounts[t] || 0) + 1;
      });
    });
    const threshold = Math.ceil(recent.length * 0.25);
    const common = Object.entries(triggerCounts)
      .filter(([t, count]) => count >= threshold)
      .map(([t]) => t);
    if (common.length > 0) {
      const list = common.map(t => capitalize(t)).join(', ');
      suggestions.push({
        title: 'Frequent triggers',
        message: `You often report triggers like ${list}. Gentle adjustments might help you avoid or mitigate these.`
      });
    }
  })();

  (function timeOfDayRule() {
    const recent = inLastDays(30);
    if (recent.length === 0) return;
    const minutes = recent
      .map(ep => {
        const d = new Date(ep.datetime);
        return d.getHours() * 60 + d.getMinutes();
      })
      .sort((a, b) => a - b);
    const total = minutes.length;
    const threshold = Math.ceil(total * 0.4);
    let windowStartIdx = 0;
    let maxCount = 0;
    let windowStartTime = 0;
    for (let i = 0; i < minutes.length; i++) {
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
      const startHour = Math.floor(windowStartTime / 60);
      const endHour = Math.floor((windowStartTime + 240) / 60);
      const pad = n => n.toString().padStart(2, '0');
      const range = `${pad(startHour)}:00–${pad(endHour)}:00`;
      suggestions.push({
        title: 'Time‑of‑day cluster',
        message: `A significant share of your episodes occur between ${range}. Consider a pre‑emptive routine or relaxation practice then.`
      });
    }
  })();

  (function dayOfWeekRule() {
    const recent = inLastDays(30);
    if (recent.length === 0) return;
    const weekdayCounts = {};
    recent.forEach(ep => {
      const day = new Date(ep.datetime).getDay();
      weekdayCounts[day] = (weekdayCounts[day] || 0) + 1;
    });
    const total = recent.length;
    const threshold = Math.ceil(total * 0.4);
    const maxEntry = Object.entries(weekdayCounts).reduce(
      (max, entry) => (entry[1] > max[1] ? entry : max),
      [null, 0]
    );
    const day = maxEntry[0];
    const count = maxEntry[1];
    if (count >= threshold) {
      const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      suggestions.push({
        title: 'Day‑of‑week cluster',
        message: `About ${Math.round((count / total) * 100)}% of your episodes happen on ${weekdays[day]}. Reflect on factors specific to that day.`
      });
    }
  })();

  (function risingIntensityRule() {
    const sixWeeks = inLastDays(42);
    if (sixWeeks.length < 3) return;
    const weekGroups = groupBy(sixWeeks, ep => {
      const d = new Date(ep.datetime);
      const first = new Date(d.getFullYear(), 0, 1);
      const dayOffset = (d.getDay() + 6) % 7;
      const dayOfYear = Math.floor((d - first) / (24 * 60 * 60 * 1000)) + 1;
      return Math.ceil((dayOfYear - dayOffset) / 7);
    });
    const weekNumbers = Object.keys(weekGroups)
      .map(Number)
      .sort((a, b) => a - b);
    if (weekNumbers.length < 6) return;
    const weeklyAvg = weekNumbers.map(wn => {
      const eps = weekGroups[wn];
      const totalIntensity = eps.reduce((sum, ep) => sum + Number(ep.intensity || 0), 0);
      return totalIntensity / eps.length;
    });
    const len = weeklyAvg.length;
    const last3 = weeklyAvg.slice(len - 3).reduce((a, b) => a + b, 0) / 3;
    const prev3 = weeklyAvg.slice(len - 6, len - 3).reduce((a, b) => a + b, 0) / 3;
    if (prev3 > 0 && last3 >= prev3 * 1.2) {
      suggestions.push({
        title: 'Rising intensity trend',
        message: `Your 3‑week average intensity has risen by over 20%. Consider consulting a healthcare provider or reviewing possible triggers.`
      });
    }
  })();

  (function medicationOveruseRule() {
    const recent = inLastDays(30);
    const daysWithMed = new Set();
    recent.forEach(ep => {
      if ((ep.medications || []).length > 0) {
        daysWithMed.add(ep.datetime.slice(0, 10));
      }
    });
    if (daysWithMed.size >= 10) {
      suggestions.push({
        title: 'Medication usage',
        message: `You've used medication on ${daysWithMed.size} days in the last month. Over‑use can sometimes worsen migraines; speak with your doctor.`
      });
    }
  })();

  (function averageIntensityByHourRule() {
    const recent = inLastDays(30);
    if (recent.length === 0) return;
    const hourBuckets = {};
    recent.forEach(ep => {
      const d = new Date(ep.datetime);
      const h = d.getHours();
      if (!hourBuckets[h]) hourBuckets[h] = { sum: 0, count: 0 };
      hourBuckets[h].sum += Number(ep.intensity || 0);
      hourBuckets[h].count += 1;
    });
    const averages = Object.entries(hourBuckets).map(([h, val]) => ({
      hour: Number(h),
      avg: val.sum / val.count,
      count: val.count
    }));
    if (averages.length === 0) return;
    const maxEntry = averages.reduce((max, entry) => (entry.avg > max.avg ? entry : max), averages[0]);
    if (maxEntry.avg >= 6 && maxEntry.count >= 3) {
      const pad = n => String(n).padStart(2, '0');
      suggestions.push({
        title: 'Peak intensity hour',
        message: `Episodes logged around ${pad(maxEntry.hour)}:00 tend to be more intense. Planning rest or adjustments then might help.`
      });
    }
  })();

  (function averageIntensityByWeekdayRule() {
    const recent = inLastDays(30);
    if (recent.length === 0) return;
    const buckets = {};
    recent.forEach(ep => {
      const d = new Date(ep.datetime);
      const wd = d.getDay();
      if (!buckets[wd]) buckets[wd] = { sum: 0, count: 0 };
      buckets[wd].sum += Number(ep.intensity || 0);
      buckets[wd].count += 1;
    });
    const avgs = Object.entries(buckets).map(([wd, val]) => ({
      wd: Number(wd),
      avg: val.sum / val.count,
      count: val.count
    }));
    if (avgs.length === 0) return;
    const top = avgs.reduce((max, entry) => (entry.avg > max.avg ? entry : max), avgs[0]);
    if (top.avg >= 6 && top.count >= 3) {
      const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      suggestions.push({
        title: 'Toughest day',
        message: `Your migraines tend to be most intense on ${weekdays[top.wd]}. Consider easing your schedule on those days.`
      });
    }
  })();

  (function streakRule() {
    const sortedEpisodes = episodes
      .slice()
      .sort((a, b) => new Date(b.datetime) - new Date(a.datetime));
    const streak = computeStreak(sortedEpisodes);
    if (streak >= 3) {
      suggestions.push({
        title: 'Consistent tracking',
        message: `Great job! You've logged episodes for ${streak} consecutive days. Keeping track consistently helps identify patterns.`
      });
    }
  })();

  (function weeklyChangeRule() {
    const lastWeek = inLastDays(7);
    const prevCutoff = new Date(now);
    prevCutoff.setDate(prevCutoff.getDate() - 14);
    const prevWeekEnd = new Date(now);
    prevWeekEnd.setDate(prevWeekEnd.getDate() - 7);
    const prevWeek = episodes.filter(ep => {
      const d = new Date(ep.datetime);
      return d >= prevCutoff && d < prevWeekEnd;
    });
    const lastCount = lastWeek.length;
    const prevCount = prevWeek.length;
    if (prevCount > 0 && lastCount > prevCount) {
      suggestions.push({
        title: 'Increased frequency',
        message: `You logged ${lastCount} episodes in the last week, up from ${prevCount} the week before. Watch for triggers and consider adjustments.`
      });
    } else if (prevCount > 0 && lastCount < prevCount) {
      suggestions.push({
        title: 'Decreased frequency',
        message: `Nice progress! You've logged fewer episodes this week (${lastCount}) than the previous week (${prevCount}). Keep it up!`
      });
    }
  })();

  return suggestions;
}
