import { describe, it, expect, beforeEach } from 'vitest';
import { exportEpisodesToCSV } from '../src/storage.js';

// stub localStorage for export function
const EPISODES_KEY = 'aiMigraineEpisodes';

describe('exportEpisodesToCSV', () => {
  beforeEach(() => {
    global.localStorage = {
      storage: {},
      getItem(key) {
        return this.storage[key] || null;
      },
      setItem(key, value) {
        this.storage[key] = value;
      }
    };
  });

  it('exports header and rows correctly', () => {
    const episodes = [
      {
        id: '1',
        datetime: '2023-01-01T10:00:00.000Z',
        intensity: 5,
        durationMinutes: 60,
        triggers: ['stress','coffee'],
        medications: [{ name: 'DrugA', doseMg: 50 }],
        notes: 'Feeling bad'
      },
      {
        id: '2',
        datetime: '2023-01-02T12:30:00.000Z',
        intensity: 3,
        durationMinutes: 30,
        triggers: [],
        medications: [],
        notes: 'Short note'
      }
    ];
    global.localStorage.setItem(EPISODES_KEY, JSON.stringify(episodes));
    const csv = exportEpisodesToCSV();
    const lines = csv.trim().split(/\r?\n/);
    expect(lines[0]).toBe('id,datetime,intensity,durationMinutes,triggers,medications,notes');
    expect(lines.length).toBe(3);
    // second line should contain both triggers separated by |
    expect(lines[1]).toContain('stress|coffee');
    // medications field should include name and dose
    expect(lines[1]).toContain('DrugA:50');
  });
});
