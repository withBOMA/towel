import type { Metadata } from "next";
import { Alert, Card, Input, Label, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { ROLE_LABELS, getOrgContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { first } from "@/lib/utils";
import { updateProfile } from "./actions";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage({ searchParams }: PageProps<"/account">) {
  const ctx = await getOrgContext();
  const params = await searchParams;
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, phone, email")
    .eq("id", ctx.user.id)
    .single();

  return (
    <>
      <PageHeader title="Account" description={`${profile?.email ?? ""} · ${ROLE_LABELS[ctx.role]} at ${ctx.org.name}`} />
      <Card className="max-w-lg">
        <form action={updateProfile} className="space-y-4">
          <div>
            <Label htmlFor="fullName">Name</Label>
            <Input id="fullName" name="fullName" autoComplete="name" required defaultValue={profile?.full_name ?? ""} />
          </div>
          <div>
            <Label htmlFor="phone">Mobile phone</Label>
            <Input id="phone" name="phone" type="tel" autoComplete="tel" defaultValue={profile?.phone ?? ""} />
          </div>
          {first(params.error) && <Alert>{first(params.error)}</Alert>}
          {first(params.notice) && <Alert tone="success">{first(params.notice)}</Alert>}
          <SubmitButton pendingText="Saving…">Save</SubmitButton>
        </form>
      </Card>
    </>
  );
}
