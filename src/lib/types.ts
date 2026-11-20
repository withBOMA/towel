import type { Database } from "@/lib/database.types";

// App-facing aliases, kept separate so `npm run db:types` can overwrite database.types.ts freely.
export type OrgRole = Database["public"]["Enums"]["org_role"];
