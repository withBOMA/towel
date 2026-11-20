"use server";

import { redirect } from "next/navigation";
import { requireUser, setCurrentOrg } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { withParams } from "@/lib/utils";

export async function acceptInvitation(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const back = `/invite/${encodeURIComponent(token)}`;
  await requireUser(back);

  const supabase = await createClient();
  const { data: orgId, error } = await supabase.rpc("accept_invitation", { invite_token: token });
  if (error || !orgId) {
    redirect(withParams(back, { error: error?.message ?? "Couldn't accept the invitation." }));
  }

  await setCurrentOrg(orgId);
  redirect("/dashboard");
}
