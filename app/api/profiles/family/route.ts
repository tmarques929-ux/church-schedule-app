import { NextResponse } from "next/server";
import { supabaseAdmin } from "@lib/supabaseServer";
import { ensureAdmin } from "../../_utils/ensureAdmin";

type UpdateFamilyPayload = {
  userId?: unknown;
  familyId?: unknown;
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function normalizeUuid(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!UUID_REGEX.test(trimmed)) return null;
  return trimmed;
}

export async function PATCH(request: Request) {
  const adminCheck = await ensureAdmin();
  if ("errorResponse" in adminCheck) {
    return adminCheck.errorResponse;
  }

  let payload: UpdateFamilyPayload = {};
  try {
    payload = (await request.json()) as UpdateFamilyPayload;
  } catch {
    // mantem objeto vazio para validacao
  }

  const userId = normalizeUuid(payload.userId);
  if (!userId) {
    return NextResponse.json({ error: "Informe um usuario valido." }, { status: 400 });
  }

  const hasFamilyField = Object.prototype.hasOwnProperty.call(payload, "familyId");
  if (!hasFamilyField) {
    return NextResponse.json({ error: "Informe o identificador da familia (ou null para remover)." }, { status: 400 });
  }

  let familyId: string | null = null;
  if (payload.familyId !== null) {
    familyId = normalizeUuid(payload.familyId);
    if (!familyId) {
      return NextResponse.json({ error: "Informe um identificador de familia valido." }, { status: 400 });
    }
    const { data: family, error: familyError } = await supabaseAdmin
      .from("families")
      .select("id, name")
      .eq("id", familyId)
      .maybeSingle();

    if (familyError) {
      return NextResponse.json({ error: familyError.message }, { status: 400 });
    }

    if (!family) {
      return NextResponse.json({ error: "Familia nao encontrada." }, { status: 404 });
    }
  }

  const { data: updatedProfile, error: updateError } = await supabaseAdmin
    .from("profiles")
    .update({ family_id: familyId })
    .eq("user_id", userId)
    .select("user_id, family_id, families(id, name)")
    .maybeSingle();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 });
  }

  if (!updatedProfile) {
    return NextResponse.json({ error: "Usuario nao encontrado." }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    profile: {
      user_id: updatedProfile.user_id,
      family_id: updatedProfile.family_id ?? null,
      family_name: updatedProfile.families?.name ?? null
    }
  });
}
