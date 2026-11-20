import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Alert, Card, Input, Label, PageHeader, Select } from "@/components/ui";
import { CopyButton } from "@/components/copy-button";
import { SubmitButton } from "@/components/submit-button";
import { ROLE_LABELS, canManageOrg, getOrgContext } from "@/lib/auth";
import { env } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { first } from "@/lib/utils";
import type { OrgRole } from "@/lib/types";
import { changeRole, inviteMember, revokeInvitation, setMemberActive } from "./actions";

export const metadata: Metadata = { title: "Team" };

const INVITABLE_ROLES: OrgRole[] = ["admin", "office", "crew_lead", "crew"];

export default async function MembersPage({ searchParams }: PageProps<"/settings/members">) {
  const ctx = await getOrgContext();
  if (!canManageOrg(ctx.role)) redirect("/dashboard");

  const params = await searchParams;
  const error = first(params.error);
  const notice = first(params.notice);
  const isOwner = ctx.role === "owner";
  const assignableRoles: OrgRole[] = isOwner ? ["owner", ...INVITABLE_ROLES] : INVITABLE_ROLES;

  const supabase = await createClient();
  const [{ data: members }, { data: invites }] = await Promise.all([
    supabase
      .from("memberships")
      .select("id, role, active, user_id, profiles(full_name, email)")
      .eq("organization_id", ctx.org.id)
      .order("active", { ascending: false })
      .order("created_at", { ascending: true }),
    supabase
      .from("invitations")
      .select("id, email, role, token, expires_at")
      .eq("organization_id", ctx.org.id)
      .is("accepted_at", null)
      .order("created_at", { ascending: false }),
  ]);

  return (
    <>
      <PageHeader title="Team" description="Invite people and choose what they can do." />

      <div className="space-y-6">
        {error && <Alert>{error}</Alert>}
        {notice && <Alert tone="success">{notice}</Alert>}

        <Card>
          <h2 className="font-semibold">Invite someone</h2>
          <form action={inviteMember} className="mt-4 grid gap-3 sm:grid-cols-[1fr_12rem_auto] sm:items-end">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" inputMode="email" required placeholder="name@company.ca" />
            </div>
            <div>
              <Label htmlFor="role">Role</Label>
              <Select id="role" name="role" defaultValue="office">
                {INVITABLE_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </Select>
            </div>
            <SubmitButton pendingText="Inviting…">Send invite</SubmitButton>
          </form>
          <p className="mt-3 text-xs text-slate-500">
            Admins manage the team and settings. Office staff handle clients and scheduling. Crew leads and crews see
            their own jobs.
          </p>
        </Card>

        {invites && invites.length > 0 && (
          <Card>
            <h2 className="font-semibold">Pending invitations</h2>
            <ul className="mt-3 divide-y divide-slate-100">
              {invites.map((inv) => {
                const expired = new Date(inv.expires_at) < new Date();
                return (
                  <li key={inv.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{inv.email}</p>
                      <p className="text-sm text-slate-500">
                        {ROLE_LABELS[inv.role]} · {expired ? "Expired" : `Expires ${new Date(inv.expires_at).toLocaleDateString("en-CA", { timeZone: ctx.org.timezone })}`}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {!expired && <CopyButton value={`${env.NEXT_PUBLIC_SITE_URL}/invite/${inv.token}`} />}
                      <form action={revokeInvitation}>
                        <input type="hidden" name="invitationId" value={inv.id} />
                        <SubmitButton variant="danger">{expired ? "Remove" : "Revoke"}</SubmitButton>
                      </form>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        )}

        <Card>
          <h2 className="font-semibold">Members</h2>
          <ul className="mt-3 divide-y divide-slate-100">
            {(members ?? []).map((m) => {
              const isSelf = m.user_id === ctx.user.id;
              const lockedOwner = m.role === "owner" && !isOwner;
              return (
                <li key={m.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className={`truncate font-medium ${m.active ? "" : "text-slate-400 line-through"}`}>
                      {m.profiles?.full_name || m.profiles?.email || "Unnamed"}
                      {isSelf && <span className="ml-2 text-xs font-normal text-slate-500">(you)</span>}
                    </p>
                    <p className="truncate text-sm text-slate-500">{m.profiles?.email}</p>
                  </div>
                  {lockedOwner ? (
                    <span className="text-sm text-slate-600">Owner</span>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <form action={changeRole} className="flex items-center gap-2">
                        <input type="hidden" name="membershipId" value={m.id} />
                        <label htmlFor={`role-${m.id}`} className="sr-only">
                          Role
                        </label>
                        <Select id={`role-${m.id}`} name="role" defaultValue={m.role} className="w-36" disabled={!m.active}>
                          {assignableRoles.map((r) => (
                            <option key={r} value={r}>
                              {ROLE_LABELS[r]}
                            </option>
                          ))}
                        </Select>
                        <SubmitButton variant="secondary" disabled={!m.active}>
                          Save
                        </SubmitButton>
                      </form>
                      {!isSelf && (
                        <form action={setMemberActive}>
                          <input type="hidden" name="membershipId" value={m.id} />
                          <input type="hidden" name="active" value={m.active ? "false" : "true"} />
                          <SubmitButton variant={m.active ? "danger" : "secondary"}>
                            {m.active ? "Remove access" : "Restore access"}
                          </SubmitButton>
                        </form>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
    </>
  );
}
