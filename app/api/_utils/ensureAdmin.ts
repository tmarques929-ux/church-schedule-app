// ./app/api/_utils/ensureAdmin.ts
import { NextResponse } from "next/server";
import { createRouteHandlerSupabaseClient } from "@supabase/auth-helpers-nextjs";
import { cookies, headers } from "next/headers";
import { supabaseAdmin } from "@lib/supabaseServer";
import type { User } from "@supabase/supabase-js";

type EnsureErrorResponse = { errorResponse: NextResponse };
type EnsureAuthenticatedSuccess = { user: User };

/**
 * Garante que há um usuário autenticado.
 * Retorna { user } (User não-nulo) ou { errorResponse } com 401.
 */
export async function ensureAuthenticated(): Promise<
  EnsureAuthenticatedSuccess | EnsureErrorResponse
> {
  const supabase = createRouteHandlerSupabaseClient({ cookies, headers });

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      errorResponse: NextResponse.json(
        { error: "Nao autenticado" },
        { status: 401 }
      ),
    };
  }

  // Aqui o 'user' é garantidamente não-nulo
  return { user: user as User };
}

/**
 * Exige perfil com role = 'ADMIN'.
 * Retorna { user } (User não-nulo) ou { errorResponse } com 4xx apropriado.
 */
export async function ensureAdmin(): Promise<
  EnsureAuthenticatedSuccess | EnsureErrorResponse
> {
  const authResult = await ensureAuthenticated();
  if ("errorResponse" in authResult) {
    return authResult;
  }

  const { user } = authResult; // 'user' é do tipo User (não-nulo)

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError) {
    return {
      errorResponse: NextResponse.json(
        { error: profileError.message },
        { status: 400 }
      ),
    };
  }

  if (!profile || profile.role !== "ADMIN") {
    return {
      errorResponse: NextResponse.json(
        { error: "Apenas administradores podem acessar" },
        { status: 403 }
      ),
    };
  }

  return { user };
}
