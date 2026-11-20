"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { ROLE_LABELS, canManageOrg, getOrgContext } from "@/lib/auth";
import { env } from "@/lib/env";
import { escapeHtml, sendEmail } from "@/lib/email";
import { createClient } from "@/lib/supabase/server";
import { withParams } from "@/lib/utils";
import type { OrgRole } from "@/lib/types";

const PAGE = "/settings/members";
const roleSchema = z.enum(["owner", "admin", "office", "crew_lead", "crew"]);

async function requireManager() {
  const ctx = await getOrgContext();
  if (!canManageOrg(ctx.role)) redirect("/dashboard");
  return ctx;
}

function fail(message: string): never {
  redirect(withParams(PAGE, { error: message }));
}

export async function inviteMember(formData: FormData) {
  const ctx = await requireManager();
  const parsed = z
    .object({ email: z.email(), role: roleSchema.exclude(["owner"]) })
    .safeParse({ email: String(formData.get("email") ?? "").trim().toLowerCase(), role: formData.get("role") });
  if (!parsed.success) fail("Enter a valid email and pick a role.");
  const { email, role } = parsed.data;

  const supabase = await createClient();
  const { data: invite, error } = await supabase
    .from("invitations")
    .insert({ organization_id: ctx.org.id, email, role, invited_by: ctx.user.id })
    .select("token")
    .single();

  if (error) {
    fail(error.code === "23505" ? `${email} already has a pending invitation.` : "Couldn't create the invitation.");
  }

  const link = `${env.NEXT_PUBLIC_SITE_URL}/invite/${invite.token}`;
  const sent = await sendEmail({
    to: email,
    subject: `You're invited to join ${ctx.org.name}`,
    text: `You've been invited to join ${ctx.org.name} as ${ROLE_LABELS[role as OrgRole]}.\n\nAccept the invitation: ${link}\n\nThis link expires in 7 days.`,
    html: `<p>You've been invited to join <strong>${escapeHtml(ctx.org.name)}</strong> as ${ROLE_LABELS[role as OrgRole]}.</p><p><a href="${link}">Accept the invitation</a></p><p>This link expires in 7 days.</p>`,
  });

  revalidatePath(PAGE);
  redirect(
    withParams(PAGE, {
      notice: sent ? `Invitation emailed to ${email}.` : `Invitation created for ${email}. Copy the link below and send it to them.`,
    }),
  );
}

export async function revokeInvitation(formData: FormData) {
  const ctx = await requireManager();
  const supabase = await createClient();
  const { error } = await supabase
    .from("invitations")
    .delete()
    .eq("id", String(formData.get("invitationId")))
    .eq("organization_id", ctx.org.id);
  if (error) fail("Couldn't revoke the invitation.");
  revalidatePath(PAGE);
  redirect(withParams(PAGE, { notice: "Invitation revoked." }));
}

export async function changeRole(formData: FormData) {
  const ctx = await requireManager();
  const role = roleSchema.safeParse(formData.get("role"));
  if (!role.success) fail("Pick a valid role.");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("memberships")
    .update({ role: role.data })
    .eq("id", String(formData.get("membershipId")))
    .eq("organization_id", ctx.org.id)
    .select("id");

  if (error) fail(friendlyDbError(error.message));
  if (!data?.length) fail("You can't change that person's role.");
  revalidatePath(PAGE);
  redirect(withParams(PAGE, { notice: "Role updated." }));
}

export async function setMemberActive(formData: FormData) {
  const ctx = await requireManager();
  const active = formData.get("active") === "true";

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("memberships")
    .update({ active })
    .eq("id", String(formData.get("membershipId")))
    .eq("organization_id", ctx.org.id)
    .select("id");

  if (error) fail(friendlyDbError(error.message));
  if (!data?.length) fail("You can't change that person's access.");
  revalidatePath(PAGE);
  redirect(withParams(PAGE, { notice: active ? "Access restored." : "Access removed." }));
}

function friendlyDbError(message: string) {
  if (message.includes("at least one active owner")) return "Every company needs at least one owner. Make someone else an owner first.";
  if (message.includes("only an owner")) return "Only an owner can change another owner or make someone an owner.";
  return "That change couldn't be saved.";
}
