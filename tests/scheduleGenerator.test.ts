import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateSchedule } from '../lib/scheduleGenerator';

// Mock supabaseAdmin to isolate tests da base real. O mock retorna
// dados simplificados para testar a lÃ³gica de distribuiÃ§Ã£o.
vi.mock('../lib/supabaseServer', () => {
  // Dados fake
  const bands = [
    { id: 'bandA', name: 'Banda A', active: true },
    { id: 'bandB', name: 'Banda B', active: true }
  ];
  const bandMembers = [
    { band_id: 'bandA', member_id: 'm1', role_in_band: 'Vocal' },
    { band_id: 'bandA', member_id: 'm2', role_in_band: 'Baixo' },
    { band_id: 'bandB', member_id: 'm3', role_in_band: 'Vocal' },
    { band_id: 'bandB', member_id: 'm4', role_in_band: 'Baixo' }
  ];
  const profiles = [
    { user_id: 'm1', name: 'Ana', family_id: 'f1' },
    { user_id: 'm2', name: 'JoÃ£o', family_id: 'f1' },
    { user_id: 'm3', name: 'Beatriz', family_id: null },
    { user_id: 'm4', name: 'Carlos', family_id: null }
  ];
  const ministries = [
    { id: 'min-band', name: 'Bandas' },
    { id: 'min-audio', name: 'Ãudio' }
  ];
  const roles = [
    { id: 'role-vocal', ministry_id: 'min-band', name: 'Vocal' },
    { id: 'role-baixo', ministry_id: 'min-band', name: 'Baixo' },
    { id: 'role-audio', ministry_id: 'min-audio', name: 'Operador de Ãudio' }
  ];
  const memberMinistries = [
    { member_id: 'm1', ministry_id: 'min-band' },
    { member_id: 'm2', ministry_id: 'min-band' },
    { member_id: 'm3', ministry_id: 'min-band' },
    { member_id: 'm4', ministry_id: 'min-band' },
    { member_id: 'm2', ministry_id: 'min-audio' },
    { member_id: 'm4', ministry_id: 'min-audio' }
  ];
  const celebrations = [
    { id: 'c1', starts_at: '2025-11-02T19:00:00Z', location: '', notes: '' },
    { id: 'c2', starts_at: '2025-11-09T19:00:00Z', location: '', notes: '' }
  ];
  const availabilities = [
    // todos disponÃ­veis
    { member_id: 'm1', celebration_id: 'c1', available: true },
    { member_id: 'm2', celebration_id: 'c1', available: true },
    { member_id: 'm3', celebration_id: 'c1', available: true },
    { member_id: 'm4', celebration_id: 'c1', available: true },
    { member_id: 'm1', celebration_id: 'c2', available: true },
    { member_id: 'm2', celebration_id: 'c2', available: true },
    { member_id: 'm3', celebration_id: 'c2', available: true },
    { member_id: 'm4', celebration_id: 'c2', available: true }
  ];
  // simples armazenamento de assignments
  let assignments: any[] = [];
  let scheduleRuns: any[] = [];
  return {
    supabaseAdmin: {
      from: (table: string) => {
        return {
          select: () => {
            if (table === 'bands') return Promise.resolve({ data: bands });
            if (table === 'band_members') return Promise.resolve({ data: bandMembers });
            if (table === 'profiles') return Promise.resolve({ data: profiles });
            if (table === 'ministries') return Promise.resolve({ data: ministries });
            if (table === 'roles') return Promise.resolve({ data: roles });
            if (table === 'member_ministries') return Promise.resolve({ data: memberMinistries });
            if (table === 'celebrations') return Promise.resolve({ data: celebrations });
            if (table === 'availabilities') return Promise.resolve({ data: availabilities });
            if (table === 'assignments') return Promise.resolve({ data: assignments });
            if (table === 'schedule_runs') return Promise.resolve({ data: scheduleRuns });
            return Promise.resolve({ data: [] });
          },
          insert: (rows: any) => {
            if (table === 'assignments') {
              assignments = assignments.concat(rows);
              return Promise.resolve({ data: rows });
            }
            if (table === 'schedule_runs') {
              scheduleRuns.push({ ...rows[0], id: 'sr1' });
              return Promise.resolve({ data: [{ ...rows[0], id: 'sr1' }] });
            }
            return Promise.resolve({ data: rows });
          },
          delete: () => {
            assignments = [];
            return Promise.resolve({ data: null });
          },
          update: () => Promise.resolve({ data: null }),
          eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }),
          maybeSingle: () => Promise.resolve({ data: null }),
          gte: () => ({ lte: () => ({ order: () => Promise.resolve({ data: celebrations }) }) }),
          lte: () => ({ order: () => Promise.resolve({ data: celebrations }) }),
          order: () => Promise.resolve({ data: celebrations })
        };
      }
    }
  };
});

describe('generateSchedule', () => {
  beforeEach(() => {
    // limpar assignments antes de cada teste
  });
  it('deve gerar assignments balanceados para duas celebraÃ§Ãµes', async () => {
    const { scheduleRunId, assignments } = await generateSchedule(11, 2025, {
      createdBy: 'admin-id'
    } as any);
    expect(assignments.length).toBeGreaterThan(0);
    // cada membro deve aparecer no mÃ¡ximo uma vez por funÃ§Ã£o
    const counts: Record<string, number> = {};
    assignments.forEach((a: any) => {
      counts[a.member_id] = (counts[a.member_id] || 0) + 1;
    });
    const values = Object.values(counts);
    const max = Math.max(...values);
    const min = Math.min(...values);
    expect(max - min).toBeLessThanOrEqual(1);
  });
});