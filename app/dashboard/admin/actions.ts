"use server";

import { cookies, headers } from "next/headers";
import { createServerComponentSupabaseClient } from "@supabase/auth-helpers-nextjs";
import { supabaseAdmin } from "@lib/supabaseServer";
import { revalidatePath } from "next/cache";

type AdminValidationResult = { success: true } | { success: false; error: string };

async function ensureAdminAccess(): Promise<AdminValidationResult> {
  const cookieStore = await cookies();
  const headerList = await headers();
  const supabase = createServerComponentSupabaseClient({
    cookies: () => cookieStore,
    headers: () => headerList
  });

  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { success: false, error: "Sessao expirada. Faca login novamente." };
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError) {
    return { success: false, error: profileError.message };
  }

  if (!profile || profile.role !== "ADMIN") {
    return { success: false, error: "Apenas administradores podem executar esta acao." };
  }

  return { success: true };
}

type CreateMinistryInput = {
  name: string;
  description?: string;
  active: boolean;
};

export type MutationResult = {
  success: boolean;
  error?: string;
};

export async function createMinistryAction(input: CreateMinistryInput): Promise<MutationResult> {
  const adminValidation = await ensureAdminAccess();
  if (!adminValidation.success) {
    return { success: false, error: adminValidation.error };
  }

  const trimmedName = input.name.trim();
  const trimmedDescription = (input.description ?? "").trim();

  if (!trimmedName) {
    return { success: false, error: "Informe o nome do ministerio." };
  }

  const { error } = await supabaseAdmin
    .from("ministries")
    .insert({
      name: trimmedName,
      description: trimmedDescription ? trimmedDescription : null,
      active: Boolean(input.active)
    })
    .select("id")
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/dashboard/admin");

  return { success: true };
}
