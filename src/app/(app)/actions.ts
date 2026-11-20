"use server";

import { redirect } from "next/navigation";
import { requireUser, setCurrentOrg } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function switchOrg(formData: FormData) {
  const user = await requireUser();
  const orgId = String(formData.get("orgId") ?? "");

  // Only switch to an org the user really belongs to (RLS also enforces this).
  const supabase = await createClient();
  const { data } = await supabase
    .from("memberships")
    .select("organization_id")
    .eq("user_id", user.id)
    .eq("organization_id", orgId)
    .eq("active", true)
    .maybeSingle();

  if (data) {
    await setCurrentOrg(orgId);
  }
  redirect("/dashboard");
}
