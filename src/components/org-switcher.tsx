"use client";

import { switchOrg } from "@/app/(app)/actions";

type Props = { currentOrgId: string; orgs: { id: string; name: string }[] };

export function OrgSwitcher({ currentOrgId, orgs }: Props) {
  if (orgs.length < 2) {
    return <span className="truncate text-sm font-medium text-slate-700">{orgs[0]?.name}</span>;
  }
  return (
    <form action={switchOrg}>
      <label htmlFor="orgId" className="sr-only">
        Switch company
      </label>
      <select
        id="orgId"
        name="orgId"
        defaultValue={currentOrgId}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="max-w-[12rem] truncate rounded-md border border-slate-300 bg-white py-1.5 pl-2 pr-7 text-sm font-medium"
      >
        {orgs.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </form>
  );
}
