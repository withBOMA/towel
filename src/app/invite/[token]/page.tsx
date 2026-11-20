import type { Metadata } from "next";
import Link from "next/link";
import { Alert, Card, buttonStyles } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { ROLE_LABELS, requireUser } from "@/lib/auth";
import { APP_NAME } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { first } from "@/lib/utils";
import { signOut } from "@/app/login/actions";
import { acceptInvitation } from "./actions";

export const metadata: Metadata = { title: "Invitation" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function InvitePage({ params, searchParams }: PageProps<"/invite/[token]">) {
  const { token } = await params;
  const error = first((await searchParams).error);
  const user = await requireUser(`/invite/${token}`);

  const supabase = await createClient();
  const { data } = UUID.test(token) ? await supabase.rpc("get_invitation", { invite_token: token }) : { data: null };
  const invite = data?.[0];
  const wrongEmail = invite && user.email && invite.email.toLowerCase() !== user.email.toLowerCase();

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <p className="mb-6 text-center text-lg font-semibold text-brand-700">{APP_NAME}</p>
        <Card>
          {!invite ? (
            <Problem title="Invitation not found" text="This link isn't valid. Ask whoever invited you to send a new one." />
          ) : invite.accepted ? (
            <Problem title="Already accepted" text="This invitation has been used.">
              <Link href="/dashboard" className={`${buttonStyles.primary} mt-4`}>
                Go to dashboard
              </Link>
            </Problem>
          ) : invite.expired ? (
            <Problem title="Invitation expired" text="Ask whoever invited you to send a new one." />
          ) : wrongEmail ? (
            <Problem
              title="Wrong account"
              text={`This invitation is for ${invite.email}, but you're signed in as ${user.email}. Sign out and sign in with ${invite.email}.`}
            >
              <form action={signOut} className="mt-4">
                <SubmitButton variant="secondary">Sign out</SubmitButton>
              </form>
            </Problem>
          ) : (
            <>
              <h1 className="text-xl font-semibold">Join {invite.organization_name}</h1>
              <p className="mt-1 text-sm text-slate-600">
                You&apos;ve been invited as <span className="font-medium text-slate-900">{ROLE_LABELS[invite.role]}</span>.
              </p>
              <form action={acceptInvitation} className="mt-5 space-y-4">
                <input type="hidden" name="token" value={token} />
                {error && <Alert>{error}</Alert>}
                <SubmitButton className="w-full" pendingText="Joining…">
                  Accept and join
                </SubmitButton>
              </form>
            </>
          )}
        </Card>
      </div>
    </main>
  );
}

function Problem({ title, text, children }: { title: string; text: string; children?: React.ReactNode }) {
  return (
    <>
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="mt-1 text-sm text-slate-600">{text}</p>
      {children}
    </>
  );
}
