import { NextResponse } from "next/server";
import { supabaseAdmin } from "@lib/supabaseServer";

export async function POST(request: Request) {
  const { username } = await request.json().catch(() => ({}));
  if (!username || typeof username !== "string") {
    return NextResponse.json({ error: "Username obrigatorio" }, { status: 400 });
  }
  const normalized = username.trim().toLowerCase();
  if (!normalized) {
    return NextResponse.json({ error: "Username obrigatorio" }, { status: 400 });
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("user_id, username")
    .eq("username", normalized)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }
  if (!profile) {
    return NextResponse.json({ error: "Usuario nao encontrado" }, { status: 404 });
  }

  const { data: userResult, error: userError } = await supabaseAdmin.auth.admin.getUserById(profile.user_id);
  if (userError || !userResult?.user?.email) {
    return NextResponse.json({ error: userError?.message || "Nao foi possivel localizar o email" }, { status: 400 });
  }

  return NextResponse.json({ email: userResult.user.email });
}
