import { describe, it, expect } from 'vitest';
import { analysePatterns } from '../src/patterns.js';

// Helper to build ISO date strings relative to now
function daysAgo(days, hour = 12, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

describe('analysePatterns', () => {
  it('detects frequent triggers', () => {
    const episodes = [];
    for (let i = 0; i < 4; i++) {
      episodes.push({
        id: String(i),
        datetime: daysAgo(i),
        intensity: 5,
        durationMinutes: 60,
        triggers: ['coffee'],
        medications: [],
        notes: ''
      });
    }
    const suggestions = analysePatterns(episodes);
    expect(suggestions.some(s => /Frequent triggers/.test(s.title))).toBe(true);
  });

  it('detects time‑of‑day cluster', () => {
    const episodes = [];
    // 4 out of 6 episodes within 18:00‑22:00 (>=40%)
    for (let i = 0; i < 6; i++) {
      const hour = i < 4 ? 19 : 9;
      episodes.push({
        id: String(i),
        datetime: daysAgo(i, hour, 0),
        intensity: 4,
        durationMinutes: 30,
        triggers: [],
        medications: [],
        notes: ''
      });
    }
    const suggestions = analysePatterns(episodes);
    expect(suggestions.some(s => /Time‑of‑day pattern/.test(s.title))).toBe(true);
  });

  it('detects day‑of‑week trend', () => {
    const episodes = [];
    // 4 episodes on Monday out of 6
    for (let i = 0; i < 6; i++) {
      const date = new Date();
      date.setDate(date.getDate() - (i * 2)); // every 2 days
      // force Monday by adjusting day
      date.setDate(date.getDate() - (date.getDay() + 6) % 7);
      episodes.push({
        id: String(i),
        datetime: date.toISOString(),
        intensity: 3,
        durationMinutes: 20,
        triggers: [],
        medications: [],
        notes: ''
      });
    }
    const suggestions = analysePatterns(episodes);
    expect(suggestions.some(s => /Day‑of‑week trend/.test(s.title))).toBe(true);
  });

  it('detects rising intensity', () => {
    const episodes = [];
    // first 3 weeks: intensity 2; next 3 weeks: intensity 5
    for (let i = 42; i > 21; i -= 3) {
      episodes.push({
        id: `a${i}`,
        datetime: daysAgo(i),
        intensity: 2,
        durationMinutes: 30,
        triggers: [],
        medications: [],
        notes: ''
      });
    }
    for (let i = 21; i >= 0; i -= 3) {
      episodes.push({
        id: `b${i}`,
        datetime: daysAgo(i),
        intensity: 5,
        durationMinutes: 30,
        triggers: [],
        medications: [],
        notes: ''
      });
    }
    const suggestions = analysePatterns(episodes);
    expect(suggestions.some(s => /Rising intensity/.test(s.title))).toBe(true);
  });

  it('detects medication overuse', () => {
    const episodes = [];
    // 10 distinct days with medications
    for (let i = 0; i < 10; i++) {
      episodes.push({
        id: String(i),
        datetime: daysAgo(i),
        intensity: 4,
        durationMinutes: 30,
        triggers: [],
        medications: [{ name: 'painkiller', doseMg: 50 }],
        notes: ''
      });
    }
    const suggestions = analysePatterns(episodes);
    expect(suggestions.some(s => /Medication use/.test(s.title))).toBe(true);
  });
});
