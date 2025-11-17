import { NextResponse } from "next/server";
import { supabaseAdmin } from "@lib/supabaseServer";
import { ensureAdmin } from "../../_utils/ensureAdmin";

const MAX_PAGE_SIZE = 100;

function buildMembersSelect(includeBirthDate: boolean) {
  const birthDateField = includeBirthDate ? "birth_date," : "";
  return `
        user_id,
        name,
        username,
        role,
        ${birthDateField}
        family_id,
        families ( id, name ),
        member_ministries (
          ministry_id,
          is_leader,
          ministries (
            id,
            name
          )
        )
      `;
}

function isBirthDateMissingError(error: { message?: string } | null) {
  if (!error?.message) return false;
  return error.message.toLowerCase().includes("birth_date");
}

export async function GET(request: Request) {
  const adminCheck = await ensureAdmin();
  if ("errorResponse" in adminCheck) {
    return adminCheck.errorResponse;
  }

  const url = new URL(request.url);
  const rawQuery = url.searchParams.get("q")?.trim() ?? "";
  const normalizedQuery = rawQuery.replace(/[%]/g, "").replace(/,/g, "");

  const roleFilter = url.searchParams.get("role")?.trim().toUpperCase() ?? "";
  const familyFilter = url.searchParams.get("familyId")?.trim() ?? "";

  const pageParam = Number(url.searchParams.get("page"));
  const limitParam = Number(url.searchParams.get("limit"));
  const pageSize = Math.min(Math.max(Number.isFinite(limitParam) ? limitParam : 25, 1), MAX_PAGE_SIZE);
  const page = Math.max(Number.isFinite(pageParam) ? pageParam : 1, 1);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const runQuery = (includeBirthDate: boolean) => {
    let query = supabaseAdmin
      .from("profiles")
      .select(buildMembersSelect(includeBirthDate), { count: "exact" })
      .order("name")
      .range(from, to);

    if (normalizedQuery) {
      const ilike = `%${normalizedQuery}%`;
      query = query.or(`name.ilike.${ilike},username.ilike.${ilike}`);
    }

    if (roleFilter === "ADMIN" || roleFilter === "LEADER" || roleFilter === "MEMBER") {
      query = query.eq("role", roleFilter);
    }

    if (familyFilter) {
      query = query.eq("family_id", familyFilter);
    }

    return query;
  };

  let includesBirthDate = true;
  let { data, error, count } = await runQuery(includesBirthDate);

  if (error && includesBirthDate && isBirthDateMissingError(error)) {
    includesBirthDate = false;
    ({ data, error, count } = await runQuery(includesBirthDate));
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const members =
    data?.map((profile: any) => {
      const ministries =
        Array.isArray(profile.member_ministries) && profile.member_ministries.length > 0
          ? profile.member_ministries
              .map((entry: any) => {
                const ministryName = entry?.ministries?.name ?? null;
                if (!ministryName) return null;
                const leaderLabel = entry?.is_leader ? " (lider)" : "";
                return `${ministryName}${leaderLabel}`;
              })
              .filter((value: string | null): value is string => Boolean(value))
          : [];

      return {
        id: profile.user_id,
        name: profile.name,
        username: profile.username,
        role: profile.role,
        birthDate: includesBirthDate ? profile.birth_date ?? null : null,
        family: profile.families
          ? { id: profile.families.id as string, name: profile.families.name as string }
          : null,
        ministries
      };
    }) ?? [];

  const total = count ?? members.length;
  const hasMore = to + 1 < (count ?? 0);

  return NextResponse.json({
    members,
    pagination: {
      page,
      pageSize,
      total,
      hasMore
    },
    features: {
      birthDate: includesBirthDate
    }
  });
}

