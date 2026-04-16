import type { ToolDefinition } from "../agent/types.js";
import { db } from "../db/connection.js";
import { monitors, users } from "../db/schema.js";
import { eq, and } from "drizzle-orm";

export const monitorList: ToolDefinition = {
  name: "monitor_list",
  description: "List all active monitoring alerts for the current user.",
  input_schema: {
    type: "object" as const,
    properties: {},
    required: [],
  },
  handler: async (_input, context) => {
    const user = await db.query.users.findFirst({
      where: eq(users.discordId, context.discordUserId),
    });
    if (!user) return "User not found.";

    const activeMonitors = await db.query.monitors.findMany({
      where: and(
        eq(monitors.userId, user.id),
        eq(monitors.isActive, true)
      ),
    });

    if (activeMonitors.length === 0) {
      return "No active monitors.";
    }

    const lines = activeMonitors.map(
      (m) =>
        `- **#${m.id}** | ${m.monitorType} | interval: ${m.checkIntervalSeconds}s | created: ${m.createdAt.toISOString()}`
    );

    return `Active monitors (${activeMonitors.length}):\n${lines.join("\n")}`;
  },
};
