import { NextResponse } from "next/server";
import { supabaseAdmin } from "@lib/supabaseServer";
import { ensureScheduleManager, canManageMinistry } from "../_utils/ensureScheduleManager";

type AssignmentUpdatePayload = {
  assignmentId?: unknown;
  memberId?: unknown;
  placeholderReason?: unknown;
  lockAssignment?: unknown;
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function normalizeUuid(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return UUID_REGEX.test(trimmed) ? trimmed : null;
}

export async function PATCH(request: Request) {
  const managerResult = await ensureScheduleManager(true);
  if ("errorResponse" in managerResult) {
    return managerResult.errorResponse;
  }
  const managerContext = managerResult;

  let payload: AssignmentUpdatePayload = {};
  try {
    payload = (await request.json()) as AssignmentUpdatePayload;
  } catch {
    // Mantem payload vazio e valida abaixo
  }

  const assignmentId = normalizeUuid(payload.assignmentId);
  if (!assignmentId) {
    return NextResponse.json(
      { error: "Informe um assignmentId valido para atualizar a escala." },
      { status: 400 }
    );
  }

  const wantsPlaceholder = payload.memberId === null;
  const memberId = normalizeUuid(payload.memberId);
  if (!memberId && payload.memberId && payload.memberId !== null) {
    return NextResponse.json({ error: "memberId invalido." }, { status: 400 });
  }

  const placeholderReason =
    typeof payload.placeholderReason === "string"
      ? payload.placeholderReason.trim().slice(0, 140)
      : null;
  const lockAssignment =
    typeof payload.lockAssignment === "boolean" ? payload.lockAssignment : null;

  const { data: assignment, error: assignmentError } = await supabaseAdmin
    .from("assignments")
    .select("id, ministry_id, celebration_id, member_id, is_placeholder, placeholder_reason, locked")
    .eq("id", assignmentId)
    .maybeSingle();

  if (assignmentError) {
    return NextResponse.json({ error: assignmentError.message }, { status: 400 });
  }
  if (!assignment) {
    return NextResponse.json({ error: "Assignment nao encontrado." }, { status: 404 });
  }

  if (!canManageMinistry(managerContext, assignment.ministry_id)) {
    return NextResponse.json(
      { error: "Apenas administradores ou lideres do ministerio podem alterar este item." },
      { status: 403 }
    );
  }

  const updates: Record<string, unknown> = {};

  if (memberId) {
    const { data: membership, error: membershipError } = await supabaseAdmin
      .from("member_ministries")
      .select("member_id")
      .eq("member_id", memberId)
      .eq("ministry_id", assignment.ministry_id)
      .maybeSingle();

    if (membershipError) {
      return NextResponse.json({ error: membershipError.message }, { status: 400 });
    }
    if (!membership) {
      return NextResponse.json(
        { error: "O membro escolhido nao pertence a este ministerio." },
        { status: 400 }
      );
    }

    updates.member_id = memberId;
    updates.is_placeholder = false;
    updates.placeholder_reason = null;
  } else if (wantsPlaceholder) {
    updates.member_id = null;
    updates.is_placeholder = true;
    updates.placeholder_reason = placeholderReason || "Pendente";
  }

  if (lockAssignment !== null) {
    updates.locked = lockAssignment;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "Nenhuma alteracao informada. Defina um membro, placeholder ou bloqueio." },
      { status: 400 }
    );
  }

  const { data: updated, error: updateError } = await supabaseAdmin
    .from("assignments")
    .update(updates)
    .eq("id", assignmentId)
    .select("id, ministry_id, celebration_id, member_id, is_placeholder, placeholder_reason, locked")
    .maybeSingle();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 });
  }

  return NextResponse.json({
    assignment: updated,
    updatedAt: new Date().toISOString()
  });
}
