import { NextResponse } from 'next/server';
import { generateSchedule, IncompleteAvailabilityError } from '@lib/scheduleGenerator';
import { ensureAdmin } from '../../_utils/ensureAdmin';

/**
 * Gera a escala para um determinado mes e ano. A rota espera um
 * parametro de query `month=YYYY-MM` (ex.: 2025-11) e aceita no
 * corpo JSON as opcoes `ministry` (nome do ministerio a regenerar),
 * `preserveLocked` (boolean) para preservar posicoes travadas e
 * `force` para permitir geracao mesmo com lacunas de disponibilidade.
 */
export async function POST(request: Request) {
  const url = new URL(request.url);
  const monthParam = url.searchParams.get('month');
  if (!monthParam || !/\d{4}-\d{2}/.test(monthParam)) {
    return NextResponse.json({ error: 'Parametro month invalido' }, { status: 400 });
  }

  const [yearStr, monthStr] = monthParam.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);

  const optionsBody = (await request.json().catch(() => ({}))) as Partial<{
    ministry: string;
    preserveLocked: boolean;
    force: boolean;
  }>;

  const forceQuery = url.searchParams.get('force');
  const allowIncomplete = optionsBody.force === true || forceQuery === '1' || forceQuery === 'true';

  const adminCheck = await ensureAdmin();
  if ('errorResponse' in adminCheck) {
    return adminCheck.errorResponse;
  }

  try {
    const result = await generateSchedule(month, year, {
      ministry: optionsBody.ministry,
      preserveLocked: optionsBody.preserveLocked,
      createdBy: adminCheck.user.id,
      allowIncomplete
    });
    return NextResponse.json({
      scheduleRunId: result.scheduleRunId,
      assignments: result.assignments,
      warnings: result.warnings
    });
  } catch (error: any) {
    console.error(error);
    const warnings = (error instanceof IncompleteAvailabilityError || Array.isArray(error?.warnings))
      ? error.warnings
      : undefined;
    const status =
      error instanceof IncompleteAvailabilityError || error?.code === 'INCOMPLETE_AVAILABILITY'
        ? 409
        : 500;
    const message =
      error instanceof Error && error.message
        ? error.message
        : 'Erro ao gerar escala';
    return NextResponse.json({ error: message, warnings }, { status });
  }
}
