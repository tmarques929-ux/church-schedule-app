import { NextResponse } from "next/server";
import { supabaseAdmin } from "@lib/supabaseServer";
import { ensureAdmin } from "../_utils/ensureAdmin";

type FamilyPayload = {
  name?: unknown;
};

const MIN_NAME_LENGTH = 3;

export async function GET() {
  const adminCheck = await ensureAdmin();
  if ("errorResponse" in adminCheck) {
    return adminCheck.errorResponse;
  }

  const { data, error } = await supabaseAdmin
    .from("families")
    .select("id, name, profiles:profiles(count)")
    .order("name");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const families =
    data?.map((family: any) => ({
      id: family.id,
      name: family.name,
      membersCount: family.profiles?.[0]?.count ?? 0
    })) ?? [];

  return NextResponse.json({ families });
}

export async function POST(request: Request) {
  const adminCheck = await ensureAdmin();
  if ("errorResponse" in adminCheck) {
    return adminCheck.errorResponse;
  }

  let payload: FamilyPayload = {};
  try {
    payload = (await request.json()) as FamilyPayload;
  } catch {
    // mantem objeto vazio para validacao
  }

  const rawName = typeof payload.name === "string" ? payload.name.trim() : "";
  if (!rawName) {
    return NextResponse.json({ error: "Informe o nome da familia." }, { status: 400 });
  }
  if (rawName.length < MIN_NAME_LENGTH) {
    return NextResponse.json(
      { error: `O nome deve ter pelo menos ${MIN_NAME_LENGTH} caracteres.` },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("families")
    .insert({ name: rawName })
    .select("id, name")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({
    family: data,
    message: "Familia criada com sucesso."
  });
}
