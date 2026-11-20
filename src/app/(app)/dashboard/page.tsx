import type { Metadata } from "next";
import Link from "next/link";
import { Card, PageHeader, buttonStyles } from "@/components/ui";
import { ROLE_LABELS, canManageOrg, getOrgContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const ctx = await getOrgContext();
  const supabase = await createClient();
  const manage = canManageOrg(ctx.role);

  const [{ count: memberCount }, invites] = await Promise.all([
    supabase
      .from("memberships")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", ctx.org.id)
      .eq("active", true),
    manage
      ? supabase
          .from("invitations")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", ctx.org.id)
          .is("accepted_at", null)
      : Promise.resolve({ count: null }),
  ]);

  return (
    <>
      <PageHeader title={ctx.org.name} description={`You're signed in as ${ROLE_LABELS[ctx.role]}.`} />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-slate-500">Active team members</p>
          <p className="mt-1 text-3xl font-semibold">{memberCount ?? 0}</p>
        </Card>
        {manage && (
          <Card>
            <p className="text-sm text-slate-500">Pending invitations</p>
            <p className="mt-1 text-3xl font-semibold">{invites.count ?? 0}</p>
          </Card>
        )}
        <Card>
          <p className="text-sm text-slate-500">Open jobs</p>
          <p className="mt-1 text-3xl font-semibold text-slate-300">—</p>
          <p className="mt-1 text-xs text-slate-500">Jobs arrive in phase 1.</p>
        </Card>
      </div>

      {manage && (memberCount ?? 0) < 2 && (
        <Card className="mt-6">
          <h2 className="font-semibold">Invite your team</h2>
          <p className="mt-1 text-sm text-slate-600">Add your office staff and crew leads so they can sign in.</p>
          <Link href="/settings/members" className={`${buttonStyles.primary} mt-4`}>
            Invite people
          </Link>
        </Card>
      )}
    </>
  );
}
