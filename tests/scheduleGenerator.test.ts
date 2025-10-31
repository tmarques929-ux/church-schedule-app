import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateSchedule } from '../lib/scheduleGenerator';

const mockData = {
  bands: [
    { id: 'bandA', name: 'Banda A', active: true },
    { id: 'bandB', name: 'Banda B', active: true }
  ],
  bandMembers: [
    { band_id: 'bandA', member_id: 'm1', role_in_band: 'Vocal' },
    { band_id: 'bandA', member_id: 'm2', role_in_band: 'Baixo' },
    { band_id: 'bandB', member_id: 'm3', role_in_band: 'Vocal' },
    { band_id: 'bandB', member_id: 'm4', role_in_band: 'Baixo' }
  ],
  profiles: [
    { user_id: 'm1', name: 'Ana', family_id: 'f1' },
    { user_id: 'm2', name: 'Joao', family_id: 'f1' },
    { user_id: 'm3', name: 'Beatriz', family_id: null },
    { user_id: 'm4', name: 'Carlos', family_id: null }
  ],
  ministries: [
    { id: 'min-band', name: 'Bandas' },
    { id: 'min-audio', name: 'Audio' }
  ],
  roles: [
    { id: 'role-vocal', ministry_id: 'min-band', name: 'Vocal' },
    { id: 'role-baixo', ministry_id: 'min-band', name: 'Baixo' },
    { id: 'role-audio', ministry_id: 'min-audio', name: 'Operador de Audio' }
  ],
  memberMinistries: [
    { member_id: 'm1', ministry_id: 'min-band' },
    { member_id: 'm2', ministry_id: 'min-band' },
    { member_id: 'm3', ministry_id: 'min-band' },
    { member_id: 'm4', ministry_id: 'min-band' },
    { member_id: 'm2', ministry_id: 'min-audio' },
    { member_id: 'm4', ministry_id: 'min-audio' }
  ],
  celebrations: [
    { id: 'c1', starts_at: '2025-11-02T19:00:00Z', location: '', notes: '' },
    { id: 'c2', starts_at: '2025-11-09T19:00:00Z', location: '', notes: '' }
  ],
  availabilities: [
    { member_id: 'm1', celebration_id: 'c1', available: true },
    { member_id: 'm2', celebration_id: 'c1', available: true },
    { member_id: 'm3', celebration_id: 'c1', available: true },
    { member_id: 'm4', celebration_id: 'c1', available: true },
    { member_id: 'm1', celebration_id: 'c2', available: true },
    { member_id: 'm2', celebration_id: 'c2', available: true },
    { member_id: 'm3', celebration_id: 'c2', available: true },
    { member_id: 'm4', celebration_id: 'c2', available: true }
  ],
  assignments: [] as any[],
  scheduleRuns: [] as any[]
};

vi.mock('../lib/supabaseServer', () => {
  const celebrationsChain = {
    order: () => Promise.resolve({ data: mockData.celebrations })
  };

  function makeScheduleRunsQuery() {
    const filters: Record<string, any> = {};
    const chain: any = {
      eq: (column: string, value: any) => {
        filters[column] = value;
        return chain;
      },
      maybeSingle: () => {
        const found =
          mockData.scheduleRuns.find((run) => {
            const matchesMonth =
              filters.month === undefined ? true : run.month === filters.month;
            const matchesYear =
              filters.year === undefined ? true : run.year === filters.year;
            return matchesMonth && matchesYear;
          }) ?? null;
        return Promise.resolve({ data: found, error: null });
      },
      order: () =>
        Promise.resolve({
          data: [...mockData.scheduleRuns].sort(
            (a, b) => a.year - b.year || a.month - b.month
          ),
          error: null
        })
    };
    return chain;
  }

  function scheduleRunsAdapter() {
    return {
      select: () => makeScheduleRunsQuery(),
      insert: (payload: any) => {
        const rows = Array.isArray(payload) ? payload : [payload];
        const inserted = rows.map((row: any, index: number) => {
          const id = `sr${mockData.scheduleRuns.length + index + 1}`;
          const record = { ...row, id };
          mockData.scheduleRuns.push(record);
          return record;
        });
        return {
          select: () => ({
            single: () => Promise.resolve({ data: inserted[0], error: null })
          })
        };
      },
      delete: () => ({
        eq: () => ({
          eq: () => {
            mockData.scheduleRuns = [];
            return Promise.resolve({ data: null, error: null });
          }
        })
      })
    };
  }

  function bandsAdapter() {
    return {
      select: () => ({
        eq: (column: string, value: any) =>
          Promise.resolve({
            data: mockData.bands.filter((band: any) => band[column] === value)
          })
      })
    };
  }

  function simpleSelect(data: any[]) {
    return {
      select: () => Promise.resolve({ data })
    };
  }

  function celebrationsAdapter() {
    return {
      select: () => ({
        gte: () => ({
          lte: () => celebrationsChain
        }),
        lte: () => celebrationsChain,
        order: () => Promise.resolve({ data: mockData.celebrations })
      })
    };
  }

  function assignmentsAdapter() {
    return {
      insert: (rows: any) => {
        const payload = Array.isArray(rows) ? rows : [rows];
        mockData.assignments.push(...payload);
        return Promise.resolve({ data: payload });
      },
      select: () => Promise.resolve({ data: mockData.assignments }),
      delete: () => ({
        eq: () => ({
          eq: () => {
            mockData.assignments = [];
            return Promise.resolve({ data: null, error: null });
          }
        })
      })
    };
  }

  return {
    supabaseAdmin: {
      from: (table: string) => {
        switch (table) {
          case 'bands':
            return bandsAdapter();
          case 'band_members':
            return simpleSelect(mockData.bandMembers);
          case 'profiles':
            return simpleSelect(mockData.profiles);
          case 'ministries':
            return simpleSelect(mockData.ministries);
          case 'roles':
            return simpleSelect(mockData.roles);
          case 'member_ministries':
            return simpleSelect(mockData.memberMinistries);
          case 'celebrations':
            return celebrationsAdapter();
          case 'availabilities':
            return simpleSelect(mockData.availabilities);
          case 'assignments':
            return assignmentsAdapter();
          case 'schedule_runs':
            return scheduleRunsAdapter();
          default:
            return simpleSelect([]);
        }
      }
    }
  };
});

describe('generateSchedule', () => {
  beforeEach(() => {
    mockData.assignments = [];
    mockData.scheduleRuns = [];
  });

  it('deve gerar assignments balanceados para duas celebracoes', async () => {
    const { scheduleRunId, assignments } = await generateSchedule(11, 2025, {
      createdBy: 'admin-id'
    } as any);
    expect(scheduleRunId).toBeTruthy();
    expect(assignments.length).toBeGreaterThan(0);
    const counts: Record<string, number> = {};
    assignments.forEach((assignment: any) => {
      counts[assignment.member_id] = (counts[assignment.member_id] || 0) + 1;
    });
    const values = Object.values(counts);
    const max = Math.max(...values);
    const min = Math.min(...values);
    expect(max - min).toBeLessThanOrEqual(1);
  });

  it('nao permite gerar escala duplicada para o mesmo periodo', async () => {
    await generateSchedule(11, 2025, { createdBy: 'admin-id' } as any);
    await expect(
      generateSchedule(11, 2025, { createdBy: 'admin-id' } as any)
    ).rejects.toMatchObject({
      message: expect.stringContaining('Ja existe uma escala registrada')
    });
  });
});
