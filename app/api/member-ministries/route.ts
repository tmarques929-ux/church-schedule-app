import { NextResponse } from "next/server";
import { supabaseAdmin } from "@lib/supabaseServer";
import { ensureAdmin } from "../_utils/ensureAdmin";

type AssignmentPayload = {
  userId?: unknown;
  ministryIds?: unknown;
  leaderMinistryIds?: unknown;
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function normalizeUuid(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!UUID_REGEX.test(trimmed)) return null;
  return trimmed;
}

export async function GET(request: Request) {
  const adminCheck = await ensureAdmin();
  if ("errorResponse" in adminCheck) {
    return adminCheck.errorResponse;
  }

  const url = new URL(request.url);
  const userIdParam = url.searchParams.get("userId");
  const userId = normalizeUuid(userIdParam);

  if (!userId) {
    return NextResponse.json({ error: "Informe um userId valido." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("member_ministries")
    .select("ministry_id, is_leader, ministries(name, description, active)")
    .eq("member_id", userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const assignments =
    data?.map((item) => ({
      ministryId: item.ministry_id,
      isLeader: Boolean(item.is_leader),
      ministry: {
        id: item.ministry_id,
        name: item.ministries?.name ?? null,
        description: item.ministries?.description ?? null,
        active: item.ministries?.active ?? null
      }
    })) ?? [];

  return NextResponse.json({ assignments });
}

export async function POST(request: Request) {
  const adminCheck = await ensureAdmin();
  if ("errorResponse" in adminCheck) {
    return adminCheck.errorResponse;
  }

  let payload: AssignmentPayload = {};
  try {
    payload = (await request.json()) as AssignmentPayload;
  } catch {
    // Mantem payload vazio para validacoes abaixo
  }

  const userId = normalizeUuid(payload.userId);

  if (!userId) {
    return NextResponse.json({ error: "Informe userId valido para vincular ministerios." }, { status: 400 });
  }

  const rawIds = Array.isArray(payload.ministryIds) ? payload.ministryIds : [];
  const normalizedMinistryIds = rawIds
    .map((value) => normalizeUuid(value))
    .filter((value): value is string => Boolean(value));

  const rawLeaderIds = Array.isArray(payload.leaderMinistryIds) ? payload.leaderMinistryIds : [];
  const normalizedLeaderIds = rawLeaderIds
    .map((value) => normalizeUuid(value))
    .filter((value): value is string => Boolean(value));

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  if (!profile) {
    return NextResponse.json({ error: "Usuario nao encontrado." }, { status: 404 });
  }

  if (normalizedMinistryIds.length > 0) {
    const { data: ministriesLookup, error: ministriesError } = await supabaseAdmin
      .from("ministries")
      .select("id")
      .in("id", normalizedMinistryIds);

    if (ministriesError) {
      return NextResponse.json({ error: ministriesError.message }, { status: 400 });
    }

    const existingIds = new Set((ministriesLookup ?? []).map((entry) => entry.id));
    const invalidIds = normalizedMinistryIds.filter((id) => !existingIds.has(id));

    if (invalidIds.length > 0) {
      return NextResponse.json(
        { error: "Um ou mais ministerios informados nao existem.", invalidIds },
        { status: 400 }
      );
    }

    const invalidLeaderIds = normalizedLeaderIds.filter((id) => !existingIds.has(id));
    if (invalidLeaderIds.length > 0) {
      return NextResponse.json(
        { error: "Um ou mais ministerios indicados como lideranca nao existem.", invalidIds: invalidLeaderIds },
        { status: 400 }
      );
    }
  }

  const { error: deleteError } = await supabaseAdmin
    .from("member_ministries")
    .delete()
    .eq("member_id", userId);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 400 });
  }

  if (normalizedMinistryIds.length > 0) {
    const leaderSet = new Set(normalizedLeaderIds.filter((id) => normalizedMinistryIds.includes(id)));
    const rows = normalizedMinistryIds.map((ministryId) => ({
      member_id: userId,
      ministry_id: ministryId,
      is_leader: leaderSet.has(ministryId)
    }));

    const { error: insertError } = await supabaseAdmin.from("member_ministries").insert(rows);

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 400 });
    }
  }

  return NextResponse.json({
    success: true,
    ministryIds: normalizedMinistryIds,
    leaderMinistryIds: normalizedLeaderIds.filter((id) => normalizedMinistryIds.includes(id))
  });
}
