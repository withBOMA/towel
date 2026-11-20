"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser, setCurrentOrg } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CANADIAN_TIMEZONES, slugify, withParams } from "@/lib/utils";

const schema = z.object({
  fullName: z.string().trim().min(1, "Enter your name.").max(120),
  orgName: z.string().trim().min(2, "Enter your company name.").max(120),
  timezone: z.enum(CANADIAN_TIMEZONES.map((t) => t.value) as [string, ...string[]]),
});

export async function createOrganization(formData: FormData) {
  const user = await requireUser();
  const parsed = schema.safeParse({
    fullName: formData.get("fullName"),
    orgName: formData.get("orgName"),
    timezone: formData.get("timezone"),
  });
  if (!parsed.success) {
    redirect(withParams("/onboarding", { error: parsed.error.issues[0]?.message }));
  }
  const { fullName, orgName, timezone } = parsed.data;

  const supabase = await createClient();
  await supabase.from("profiles").update({ full_name: fullName }).eq("id", user.id);

  // Try the plain slug first, then add a short suffix if it's taken.
  const base = slugify(orgName);
  let orgId: string | null = null;
  for (let attempt = 0; attempt < 5 && !orgId; attempt++) {
    const slug = attempt === 0 ? base : `${base}-${Math.random().toString(36).slice(2, 6)}`;
    const { data, error } = await supabase.rpc("create_organization", {
      org_name: orgName,
      org_slug: slug,
      org_timezone: timezone,
    });
    if (!error) orgId = data;
    else if (error.code !== "23505") {
      redirect(withParams("/onboarding", { error: "Couldn't create the organization. Try again." }));
    }
  }
  if (!orgId) redirect(withParams("/onboarding", { error: "Couldn't create the organization. Try again." }));

  await setCurrentOrg(orgId);
  redirect("/dashboard");
}
