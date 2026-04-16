import type { ToolDefinition } from "../agent/types.js";
import { db } from "../db/connection.js";
import { monitors, users } from "../db/schema.js";
import { eq, and } from "drizzle-orm";

export const monitorCancel: ToolDefinition = {
  name: "monitor_cancel",
  description: "Cancel an active monitoring alert by its ID.",
  input_schema: {
    type: "object" as const,
    properties: {
      monitor_id: {
        type: "number",
        description: "ID of the monitor to cancel",
      },
    },
    required: ["monitor_id"],
  },
  handler: async (input, context) => {
    const monitorId = input.monitor_id as number;

    const user = await db.query.users.findFirst({
      where: eq(users.discordId, context.discordUserId),
    });
    if (!user) return "User not found.";

    const monitor = await db.query.monitors.findFirst({
      where: and(
        eq(monitors.id, monitorId),
        eq(monitors.userId, user.id)
      ),
    });

    if (!monitor) {
      return `Monitor #${monitorId} not found or doesn't belong to you.`;
    }

    if (!monitor.isActive) {
      return `Monitor #${monitorId} is already inactive.`;
    }

    await db
      .update(monitors)
      .set({ isActive: false })
      .where(eq(monitors.id, monitorId));

    return `Monitor #${monitorId} (${monitor.monitorType}) cancelled.`;
  },
};
