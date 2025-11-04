import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createServerComponentSupabaseClient } from "@supabase/auth-helpers-nextjs";
import AdminMembersClient from "./AdminMembersClient";

export default async function AdminMembersPage() {
  const cookieStore = await cookies();
  const headerList = await headers();
  const supabase = createServerComponentSupabaseClient({
    cookies: () => cookieStore,
    headers: () => headerList
  });

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, name")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile || profile.role !== "ADMIN") {
    redirect("/dashboard");
  }

  return <AdminMembersClient adminName={profile.name ?? user.email ?? "Administrador"} />;
}
