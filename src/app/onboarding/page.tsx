import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Alert, Card, Input, Label, Select } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { requireUser } from "@/lib/auth";
import { APP_NAME } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { CANADIAN_TIMEZONES, first } from "@/lib/utils";
import { signOut } from "@/app/login/actions";
import { createOrganization } from "./actions";

export const metadata: Metadata = { title: "Set up your company" };

export default async function OnboardingPage({ searchParams }: PageProps<"/onboarding">) {
  const user = await requireUser("/onboarding");
  const error = first((await searchParams).error);
  const supabase = await createClient();

  const [{ count }, { data: profile }] = await Promise.all([
    supabase.from("memberships").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("active", true),
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
  ]);
  if (count && count > 0) redirect("/dashboard");

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <p className="mb-6 text-center text-lg font-semibold text-brand-700">{APP_NAME}</p>
        <Card>
          <h1 className="text-xl font-semibold">Set up your company</h1>
          <p className="mt-1 text-sm text-slate-600">
            You&apos;ll be the owner. You can invite your office staff and crews next.
          </p>
          <form action={createOrganization} className="mt-5 space-y-4">
            <div>
              <Label htmlFor="fullName">Your name</Label>
              <Input id="fullName" name="fullName" autoComplete="name" required defaultValue={profile?.full_name ?? ""} />
            </div>
            <div>
              <Label htmlFor="orgName">Company name</Label>
              <Input id="orgName" name="orgName" autoComplete="organization" required />
            </div>
            <div>
              <Label htmlFor="timezone">Time zone</Label>
              <Select id="timezone" name="timezone" defaultValue="America/Winnipeg">
                {CANADIAN_TIMEZONES.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </Select>
            </div>
            {error && <Alert>{error}</Alert>}
            <SubmitButton className="w-full" pendingText="Creating…">
              Create company
            </SubmitButton>
          </form>
          <p className="mt-5 text-center text-sm text-slate-600">
            Were you invited to a team? Open the link in your invitation email instead.
          </p>
        </Card>
        <form action={signOut} className="mt-4 text-center">
          <button className="text-sm text-slate-500 hover:text-slate-700">Sign out ({user.email})</button>
        </form>
      </div>
    </main>
  );
}
