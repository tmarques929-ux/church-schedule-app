import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@lib/supabaseServer';
import { ensureAdmin } from '../../_utils/ensureAdmin';

function parseMonthParam(request: Request): { month: number; year: number } | { error: NextResponse } {
  const url = new URL(request.url);
  const monthParam = url.searchParams.get('month');
  if (!monthParam || !/\d{4}-\d{2}/.test(monthParam)) {
    return {
      error: NextResponse.json({ error: 'Parametro month invalido' }, { status: 400 })
    };
  }
  const [yearStr, monthStr] = monthParam.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  if (Number.isNaN(year) || Number.isNaN(month) || month < 1 || month > 12) {
    return {
      error: NextResponse.json({ error: 'Parametro month invalido' }, { status: 400 })
    };
  }
  return { month, year };
}

async function fetchSchedule(month: number, year: number) {
  return supabaseAdmin
    .from('schedule_runs')
    .select('id, month, year, status, created_at, published_at')
    .eq('month', month)
    .eq('year', year)
    .maybeSingle();
}

export async function GET(request: Request) {
  const adminCheck = await ensureAdmin();
  if ('errorResponse' in adminCheck) {
    return adminCheck.errorResponse;
  }

  const parsed = parseMonthParam(request);
  if ('error' in parsed) {
    return parsed.error;
  }

  const { month, year } = parsed;

  const { data: schedule, error } = await fetchSchedule(month, year);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ schedule: schedule ?? null });
}

export async function DELETE(request: Request) {
  const adminCheck = await ensureAdmin();
  if ('errorResponse' in adminCheck) {
    return adminCheck.errorResponse;
  }

  const parsed = parseMonthParam(request);
  if ('error' in parsed) {
    return parsed.error;
  }

  const { month, year } = parsed;
  const { data: schedule, error } = await fetchSchedule(month, year);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (!schedule) {
    return NextResponse.json(
      { error: 'Nenhuma escala encontrada para o periodo informado.' },
      { status: 404 }
    );
  }

  const { error: deleteError } = await supabaseAdmin
    .from('schedule_runs')
    .delete()
    .eq('id', schedule.id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 400 });
  }

  return NextResponse.json({
    deletedId: schedule.id,
    message: 'Escala removida com sucesso. Gere uma nova em seguida, se desejar.'
  });
}
