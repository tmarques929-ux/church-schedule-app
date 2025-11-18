import { NextResponse } from "next/server";
import { supabaseAdmin } from "@lib/supabaseServer";
import { ensureScheduleManager } from "../../_utils/ensureScheduleManager";

type ManualAvailabilityPayload = {
  celebrationId?: unknown;
  memberId?: unknown;
  available?: unknown;
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function normalizeUuid(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return UUID_REGEX.test(trimmed) ? trimmed : null;
}

export async function POST(request: Request) {
  const managerResult = await ensureScheduleManager(true);
  if ("errorResponse" in managerResult) {
    return managerResult.errorResponse;
  }
  const managerContext = managerResult;

  let payload: ManualAvailabilityPayload = {};
  try {
    payload = (await request.json()) as ManualAvailabilityPayload;
  } catch {
    // Mantem payload vazio
  }

  const celebrationId = normalizeUuid(payload.celebrationId);
  const memberId = normalizeUuid(payload.memberId);
  const available =
    typeof payload.available === "boolean" ? payload.available : null;

  if (!celebrationId) {
    return NextResponse.json({ error: "Informe celebrationId valido." }, { status: 400 });
  }
  if (!memberId) {
    return NextResponse.json({ error: "Informe memberId valido." }, { status: 400 });
  }
  if (available === null) {
    return NextResponse.json(
      { error: "Informe o status de disponibilidade (true ou false)." },
      { status: 400 }
    );
  }

  if (managerContext.role !== "ADMIN") {
    const { data: memberMinistries, error: memberMinistriesError } = await supabaseAdmin
      .from("member_ministries")
      .select("ministry_id")
      .eq("member_id", memberId);

    if (memberMinistriesError) {
      return NextResponse.json({ error: memberMinistriesError.message }, { status: 400 });
    }

    const managedSet = new Set(managerContext.leaderMinistryIds);
    const hasAuthority = (memberMinistries ?? []).some((entry) =>
      entry?.ministry_id ? managedSet.has(entry.ministry_id) : false
    );

    if (!hasAuthority) {
      return NextResponse.json(
        { error: "Apenas administradores ou lideres do ministerio do membro podem registrar disponibilidade." },
        { status: 403 }
      );
    }
  }

  const { data, error } = await supabaseAdmin
    .from("availabilities")
    .upsert(
      {
        member_id: memberId,
        celebration_id: celebrationId,
        available
      },
      { onConflict: "member_id,celebration_id" }
    )
    .select("id, celebration_id, member_id, available, updated_at")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({
    availability: data,
    updatedAt: new Date().toISOString()
  });
}
