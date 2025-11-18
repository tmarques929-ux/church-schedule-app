import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { supabaseAdmin } from "@lib/supabaseServer";
import { ensureAuthenticated } from "./ensureAdmin";

type EnsureErrorResponse = { errorResponse: NextResponse };

export type ScheduleManagerRole = "ADMIN" | "LEADER" | "MEMBER";

export type ScheduleManagerContext = {
  user: User;
  role: ScheduleManagerRole;
  leaderMinistryIds: string[];
};

/**
 * Resolve dados básicos do usuário autenticado e garante que ele é
 * administrador ou líder de pelo menos um ministério quando requireManager = true.
 */
export async function ensureScheduleManager(
  requireManager = true
): Promise<ScheduleManagerContext | EnsureErrorResponse> {
  const authResult = await ensureAuthenticated();
  if ("errorResponse" in authResult) {
    return authResult;
  }

  const { user } = authResult;

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError) {
    return {
      errorResponse: NextResponse.json({ error: profileError.message }, { status: 400 })
    };
  }

  const role = (profile?.role ?? "MEMBER") as ScheduleManagerRole;
  let leaderMinistryIds: string[] = [];

  if (role === "LEADER") {
    const { data: leadershipRows, error: leadershipError } = await supabaseAdmin
      .from("member_ministries")
      .select("ministry_id")
      .eq("member_id", user.id)
      .eq("is_leader", true);

    if (leadershipError) {
      return {
        errorResponse: NextResponse.json({ error: leadershipError.message }, { status: 400 })
      };
    }

    leaderMinistryIds =
      leadershipRows
        ?.map((row) => row.ministry_id)
        .filter((id): id is string => typeof id === "string") ?? [];
  }

  if (requireManager && role !== "ADMIN" && leaderMinistryIds.length === 0) {
    return {
      errorResponse: NextResponse.json(
        { error: "Apenas administradores ou lideres podem executar esta operacao." },
        { status: 403 }
      )
    };
  }

  return {
    user,
    role,
    leaderMinistryIds
  };
}

export function canManageMinistry(
  context: ScheduleManagerContext,
  ministryId: string | null | undefined
) {
  if (!ministryId) {
    return context.role === "ADMIN";
  }
  return context.role === "ADMIN" || context.leaderMinistryIds.includes(ministryId);
}
