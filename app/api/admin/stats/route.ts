import { NextResponse } from "next/server";
import { addMonths, startOfMonth, subMonths } from "date-fns";
import { supabaseAdmin } from "@lib/supabaseServer";
import { ensureAdmin } from "../../_utils/ensureAdmin";

type AssignmentRow = {
  member_id: string | null;
  is_leader: boolean | null;
};

type ProfileRow = {
  user_id: string;
  name: string | null;
  username: string | null;
};

type CelebrationRow = {
  id: string;
  starts_at: string;
};

const HISTORY_MONTHS = 6;

function buildMonthBuckets(now: Date) {
  const firstMonth = startOfMonth(subMonths(now, HISTORY_MONTHS - 1));
  const buckets: Array<{ key: string; monthStart: string; total: number }> = [];

  for (let index = 0; index < HISTORY_MONTHS; index += 1) {
    const targetDate = startOfMonth(addMonths(firstMonth, index));
    const utcStart = new Date(Date.UTC(targetDate.getFullYear(), targetDate.getMonth(), 1));
    const isoMonthKey = `${utcStart.getUTCFullYear()}-${String(utcStart.getUTCMonth() + 1).padStart(2, "0")}`;
    buckets.push({
      key: isoMonthKey,
      monthStart: utcStart.toISOString(),
      total: 0
    });
  }

  return buckets;
}

export async function GET() {
  const adminCheck = await ensureAdmin();
  if ("errorResponse" in adminCheck) {
    return adminCheck.errorResponse;
  }

  const now = new Date();
  const monthBuckets = buildMonthBuckets(now);
  const earliestMonthIso = monthBuckets[0]?.monthStart ?? now.toISOString();
  const lastMonthIso = monthBuckets[monthBuckets.length - 1]?.monthStart ?? now.toISOString();
  const rangeEndIso = addMonths(new Date(lastMonthIso), 1).toISOString();
  const bucketLookup = new Map(monthBuckets.map((bucket) => [bucket.key, bucket]));

  const [assignmentsResult, celebrationsResult, ministriesCountResult, upcomingCelebrationsResult] = await Promise.all([
    supabaseAdmin.from("member_ministries").select("member_id, is_leader"),
    supabaseAdmin.from("celebrations").select("id, starts_at").gte("starts_at", earliestMonthIso).lt("starts_at", rangeEndIso),
    supabaseAdmin.from("ministries").select("id", { count: "exact", head: true }).eq("active", true),
    supabaseAdmin.from("celebrations").select("id", { count: "exact", head: true }).gte("starts_at", now.toISOString())
  ]);

  if (assignmentsResult.error) {
    return NextResponse.json({ error: assignmentsResult.error.message }, { status: 400 });
  }
  if (celebrationsResult.error) {
    return NextResponse.json({ error: celebrationsResult.error.message }, { status: 400 });
  }
  if (ministriesCountResult.error) {
    return NextResponse.json({ error: ministriesCountResult.error.message }, { status: 400 });
  }
  if (upcomingCelebrationsResult.error) {
    return NextResponse.json({ error: upcomingCelebrationsResult.error.message }, { status: 400 });
  }

  const assignmentRows = (assignmentsResult.data ?? []) as AssignmentRow[];
  const celebrationRows = (celebrationsResult.data ?? []) as CelebrationRow[];
  const memberIds = Array.from(
    new Set(
      assignmentRows
        .map((row) => row.member_id)
        .filter((value): value is string => typeof value === "string" && value.length > 0)
    )
  );

  let profileLookup = new Map<string, ProfileRow>();
  if (memberIds.length > 0) {
    const { data: profileRows, error: profilesError } = await supabaseAdmin
      .from("profiles")
      .select("user_id, name, username")
      .in("user_id", memberIds);

    if (profilesError) {
      return NextResponse.json({ error: profilesError.message }, { status: 400 });
    }

    profileLookup = new Map(
      (profileRows ?? []).map((profile) => [
        profile.user_id,
        {
          user_id: profile.user_id,
          name: profile.name ?? null,
          username: profile.username ?? null
        }
      ])
    );
  }

  type MemberAccumulator = { totalAssignments: number; leaderAssignments: number };
  const memberStats = new Map<string, MemberAccumulator>();
  const leaderIds = new Set<string>();

  for (const row of assignmentRows) {
    if (!row.member_id) continue;
    const current = memberStats.get(row.member_id) ?? { totalAssignments: 0, leaderAssignments: 0 };
    current.totalAssignments += 1;
    if (row.is_leader) {
      current.leaderAssignments += 1;
      leaderIds.add(row.member_id);
    }
    memberStats.set(row.member_id, current);
  }

  const assignmentsByMember = Array.from(memberStats.entries())
    .map(([memberId, counts]) => {
      const profile = profileLookup.get(memberId);
      const rawName = profile?.name?.trim();
      const rawUsername = profile?.username?.trim();
      return {
        memberId,
        memberName: rawName && rawName.length > 0 ? rawName : null,
        username: rawUsername && rawUsername.length > 0 ? rawUsername : null,
        totalAssignments: counts.totalAssignments,
        leaderAssignments: counts.leaderAssignments
      };
    })
    .sort((a, b) => {
      if (b.totalAssignments !== a.totalAssignments) {
        return b.totalAssignments - a.totalAssignments;
      }
      return (a.memberName ?? "").localeCompare(b.memberName ?? "");
    });

  for (const row of celebrationRows) {
    const date = new Date(row.starts_at);
    if (Number.isNaN(date.getTime())) continue;
    const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
    const bucket = bucketLookup.get(key);
    if (bucket) {
      bucket.total += 1;
    }
  }

  const responsePayload = {
    totals: {
      volunteers: assignmentsByMember.length,
      ministries: ministriesCountResult.count ?? 0,
      leaders: leaderIds.size,
      celebrationsUpcoming: upcomingCelebrationsResult.count ?? 0
    },
    assignmentsByMember,
    celebrationsPerMonth: monthBuckets.map((bucket) => ({
      month: bucket.monthStart,
      total: bucket.total
    }))
  };

  return NextResponse.json(responsePayload);
}
