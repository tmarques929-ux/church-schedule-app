import { NextResponse } from "next/server";
import { supabaseAdmin } from "@lib/supabaseServer";
import { ensureAdmin } from "../../_utils/ensureAdmin";

type MemberEntry = {
  userId: string;
  name: string | null;
  username: string | null;
  role: string | null;
  isLeader: boolean;
};

export async function GET(request: Request) {
  const adminCheck = await ensureAdmin();
  if ("errorResponse" in adminCheck) {
    return adminCheck.errorResponse;
  }

  const url = new URL(request.url);
  const includePast = url.searchParams.get("includePast") === "true";
  const ministryIdFilter = url.searchParams.get("ministryId");
  const limitParam = Number(url.searchParams.get("limit"));
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 100) : 25;

  const nowIso = new Date().toISOString();

  let celebrationsQuery = supabaseAdmin
    .from("celebrations")
    .select("id, starts_at, location, notes")
    .order("starts_at", { ascending: true })
    .limit(limit);

  if (!includePast) {
    celebrationsQuery = celebrationsQuery.gte("starts_at", nowIso);
  }

  const { data: celebrationsData, error: celebrationsError } = await celebrationsQuery;
  if (celebrationsError) {
    return NextResponse.json({ error: celebrationsError.message }, { status: 400 });
  }

  const celebrations = celebrationsData ?? [];
  if (celebrations.length === 0) {
    return NextResponse.json({
      ministries: [],
      celebrations: [],
      generatedAt: new Date().toISOString()
    });
  }

  let ministriesQuery = supabaseAdmin
    .from("ministries")
    .select(
      `
        id,
        name,
        description,
        active,
        member_ministries (
          member_id,
          is_leader,
          profiles!inner (
            user_id,
            name,
            username,
            role
          )
        )
      `
    )
    .order("name", { ascending: true });

  if (ministryIdFilter) {
    ministriesQuery = ministriesQuery.eq("id", ministryIdFilter);
  }

  const { data: ministriesData, error: ministriesError } = await ministriesQuery;
  if (ministriesError) {
    return NextResponse.json({ error: ministriesError.message }, { status: 400 });
  }

  const ministries = (ministriesData ?? []).map((ministry) => {
    const members: MemberEntry[] =
      ministry.member_ministries
        ?.map((entry: any) => {
          const profile = entry.profiles as
            | { user_id: string; name: string | null; username: string | null; role: string | null }
            | null
            | undefined;
          if (!profile?.user_id) {
            return null;
          }
          return {
            userId: profile.user_id,
            name: profile.name ?? null,
            username: profile.username ?? null,
            role: profile.role ?? null,
            isLeader: Boolean(entry.is_leader)
          };
        })
        .filter(Boolean) ?? [];

    return {
      id: ministry.id as string,
      name: ministry.name as string,
      description: (ministry.description as string | null) ?? null,
      active: Boolean(ministry.active),
      members
    };
  });

  const memberIds = new Set<string>();
  ministries.forEach((ministry) => {
    ministry.members.forEach((member) => memberIds.add(member.userId));
  });

  const celebrationIds = celebrations.map((item) => item.id as string);

  let availabilities: Array<{ celebration_id: string; member_id: string; available: boolean }> = [];
  if (memberIds.size > 0 && celebrationIds.length > 0) {
    const { data: availabilitiesData, error: availabilitiesError } = await supabaseAdmin
      .from("availabilities")
      .select("celebration_id, member_id, available")
      .in("celebration_id", celebrationIds)
      .in("member_id", Array.from(memberIds));

    if (availabilitiesError) {
      return NextResponse.json({ error: availabilitiesError.message }, { status: 400 });
    }
    availabilities = availabilitiesData ?? [];
  }

  const availabilityByCelebration = new Map<string, Map<string, boolean>>();
  availabilities.forEach((record) => {
    const celebrationId = record.celebration_id;
    const map = availabilityByCelebration.get(celebrationId) ?? new Map<string, boolean>();
    map.set(record.member_id, record.available);
    availabilityByCelebration.set(celebrationId, map);
  });

  const celebrationSummaries = celebrations.map((celebration) => {
    const celebrationId = celebration.id as string;
    const ministriesForCelebration = ministries
      .map((ministry) => {
        const confirmed: MemberEntry[] = [];
        const pending: MemberEntry[] = [];
        const declined: MemberEntry[] = [];

        const map = availabilityByCelebration.get(celebrationId);
        ministry.members.forEach((member) => {
          const status = map?.get(member.userId);
          if (status === true) {
            confirmed.push(member);
          } else if (status === false) {
            declined.push(member);
          } else {
            pending.push(member);
          }
        });

        return {
          ministryId: ministry.id,
          ministryName: ministry.name,
          confirmed,
          declined,
          pending,
          totals: {
            totalMembers: ministry.members.length,
            confirmed: confirmed.length,
            declined: declined.length,
            pending: pending.length
          }
        };
      })
      .filter((item) => item.totals.totalMembers > 0);

    return {
      id: celebrationId,
      starts_at: celebration.starts_at,
      location: celebration.location,
      notes: celebration.notes,
      ministries: ministriesForCelebration
    };
  });

  const ministriesSummary = ministries.map((ministry) => ({
    id: ministry.id,
    name: ministry.name,
    description: ministry.description,
    active: ministry.active,
    membersCount: ministry.members.length
  }));

  return NextResponse.json({
    ministries: ministriesSummary,
    celebrations: celebrationSummaries,
    generatedAt: new Date().toISOString()
  });
}
