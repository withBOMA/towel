import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { OrgRole } from "@/lib/types";

export const CURRENT_ORG_COOKIE = "current_org";

export async function setCurrentOrg(orgId: string) {
  (await cookies()).set(CURRENT_ORG_COOKIE, orgId, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export type SessionUser = { id: string; email: string | null };

export type OrgContext = {
  user: SessionUser;
  membershipId: string;
  role: OrgRole;
  org: { id: string; name: string; slug: string; timezone: string };
  orgs: { id: string; name: string; role: OrgRole }[];
};

/** The signed-in user, verified against Supabase Auth. Null when signed out. */
export const getUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  if (!sub) return null;
  return { id: sub, email: (data.claims.email as string | undefined) ?? null };
});

export async function requireUser(next?: string): Promise<SessionUser> {
  const user = await getUser();
  if (!user) redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  return user;
}

/**
 * The org the user is working in (from a cookie, falling back to their first org).
 * Sends users with no org to onboarding.
 */
export const getOrgContext = cache(async (): Promise<OrgContext> => {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: memberships, error } = await supabase
    .from("memberships")
    .select("id, role, organizations!inner(id, name, slug, timezone)")
    .eq("user_id", user.id)
    .eq("active", true)
    .order("created_at", { ascending: true });

  if (error) throw error;
  if (!memberships || memberships.length === 0) redirect("/onboarding");

  const wanted = (await cookies()).get(CURRENT_ORG_COOKIE)?.value;
  const current = memberships.find((m) => m.organizations.id === wanted) ?? memberships[0];

  return {
    user,
    membershipId: current.id,
    role: current.role,
    org: current.organizations,
    orgs: memberships.map((m) => ({ id: m.organizations.id, name: m.organizations.name, role: m.role })),
  };
});

export function canManageOrg(role: OrgRole) {
  return role === "owner" || role === "admin";
}

export const ROLE_LABELS: Record<OrgRole, string> = {
  owner: "Owner",
  admin: "Admin",
  office: "Office",
  crew_lead: "Crew lead",
  crew: "Crew",
};
