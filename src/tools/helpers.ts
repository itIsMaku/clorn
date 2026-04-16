import { db } from "../db/connection.js";
import { users } from "../db/schema.js";
import { eq } from "drizzle-orm";
import type { AgentContext } from "../agent/types.js";

export async function requireUser(context: AgentContext) {
  const user = await db.query.users.findFirst({
    where: eq(users.discordId, context.discordUserId),
  });
  return user ?? null;
}

export function tornError(data: unknown): string | null {
  const d = data as Record<string, unknown>;
  if (d.error && typeof d.error === "object") {
    return `Torn API error: ${(d.error as any).error}`;
  }
  return null;
}
