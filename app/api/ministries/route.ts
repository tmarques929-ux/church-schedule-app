import { NextResponse } from "next/server";
import { supabaseAdmin } from "@lib/supabaseServer";
import { ensureAdmin, ensureAuthenticated } from "../_utils/ensureAdmin";

type BaseMinistry = {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
};

type MinistryWithMembers = BaseMinistry & {
  members: Array<{
    userId: string;
    name: string | null;
    username: string | null;
    role: string | null;
  }>;
  leaders: Array<{
    userId: string;
    name: string | null;
    username: string | null;
  }>;
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const includeMembers = url.searchParams.get("includeMembers") === "true";

  const authResult = includeMembers ? await ensureAdmin() : await ensureAuthenticated();
  if ("errorResponse" in authResult) {
    return authResult.errorResponse;
  }

  const { data, error } = await supabaseAdmin
    .from("ministries")
    .select("id, name, description, active")
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const ministries: BaseMinistry[] =
    data?.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      active: item.active
    })) ?? [];

  if (!includeMembers || ministries.length === 0) {
    return NextResponse.json({ ministries });
  }

  const ministryIds = ministries.map((item) => item.id);

  const { data: relations, error: relationsError } = await supabaseAdmin
    .from("member_ministries")
    .select(
      "ministry_id, is_leader, profiles:profiles!inner(user_id, name, username, role)"
    )
    .in("ministry_id", ministryIds);

  if (relationsError) {
    return NextResponse.json({ error: relationsError.message }, { status: 400 });
  }

  const membersByMinistry = new Map<string, MinistryWithMembers["members"]>();
  const leadersByMinistry = new Map<string, MinistryWithMembers["leaders"]>();

  relations?.forEach((relation) => {
    const profile = relation.profiles as
      | { user_id: string; name: string | null; username: string | null; role: string | null }
      | null
      | undefined;

    if (!profile?.user_id || !relation.ministry_id) {
      return;
    }

    const memberEntry = {
      userId: profile.user_id,
      name: profile.name ?? null,
      username: profile.username ?? null,
      role: profile.role ?? null
    };

    if (!membersByMinistry.has(relation.ministry_id)) {
      membersByMinistry.set(relation.ministry_id, []);
    }
    membersByMinistry.get(relation.ministry_id)!.push(memberEntry);

    if (relation.is_leader) {
      if (!leadersByMinistry.has(relation.ministry_id)) {
        leadersByMinistry.set(relation.ministry_id, []);
      }
      leadersByMinistry.get(relation.ministry_id)!.push({
        userId: profile.user_id,
        name: profile.name ?? null,
        username: profile.username ?? null
      });
    }
  });

  const ministriesWithMembers: MinistryWithMembers[] = ministries.map((ministry) => ({
    ...ministry,
    members: membersByMinistry.get(ministry.id) ?? [],
    leaders: leadersByMinistry.get(ministry.id) ?? []
  }));

  return NextResponse.json({ ministries: ministriesWithMembers });
}

export async function POST(request: Request) {
  const adminCheck = await ensureAdmin();
  if ("errorResponse" in adminCheck) {
    return adminCheck.errorResponse;
  }

  let payload: Record<string, unknown> = {};
  try {
    payload = (await request.json()) ?? {};
  } catch {
    // manter payload vazio para validar abaixo
  }

  const rawName = typeof payload.name === "string" ? payload.name.trim() : "";
  const rawDescription = typeof payload.description === "string" ? payload.description.trim() : "";
  const activeInput =
    typeof payload.active === "boolean"
      ? payload.active
      : typeof payload.active === "string"
      ? payload.active.toLowerCase() !== "false"
      : true;

  if (!rawName) {
    return NextResponse.json({ error: "Informe o nome do ministerio." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("ministries")
    .insert({
      name: rawName,
      description: rawDescription || null,
      active: activeInput
    })
    .select("id, name, description, active")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json(
    {
      ministry: {
        id: data.id,
        name: data.name,
        description: data.description,
        active: data.active
      }
    },
    { status: 201 }
  );
}
