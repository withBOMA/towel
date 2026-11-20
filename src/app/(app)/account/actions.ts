"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { withParams } from "@/lib/utils";

const schema = z.object({
  fullName: z.string().trim().min(1, "Enter your name.").max(120),
  phone: z
    .string()
    .trim()
    .max(30)
    .regex(/^[0-9+()\-.\s]*$/, "Phone can only contain numbers and + ( ) - .")
    .transform((v) => v || null),
});

export async function updateProfile(formData: FormData) {
  const user = await requireUser();
  const parsed = schema.safeParse({ fullName: formData.get("fullName"), phone: formData.get("phone") ?? "" });
  if (!parsed.success) redirect(withParams("/account", { error: parsed.error.issues[0]?.message }));

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: parsed.data.fullName, phone: parsed.data.phone })
    .eq("id", user.id);

  if (error) redirect(withParams("/account", { error: "Couldn't save your details." }));
  revalidatePath("/", "layout");
  redirect(withParams("/account", { notice: "Saved." }));
}
