import type { ToolDefinition } from "../agent/types.js";
import { db } from "../db/connection.js";
import { monitors, users } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import { MONITOR_TYPES, type MonitorType } from "../monitor/types.js";

export const monitorCreate: ToolDefinition = {
  name: "monitor_create",
  description:
    "Create a monitoring alert. The bot will periodically check the specified bar/stat and send a Discord notification when the condition is met. Available types: nerve_full, energy_full, happy_full, life_full, travel_landed, drug_cooldown (drug only), medical_cooldown (medical only), booster_cooldown (booster only), cooldown_done (all three cooldowns together). Options: target_value to trigger at a specific value instead of max; recurring=true for repeated notifications (default is one-shot).",
  input_schema: {
    type: "object" as const,
    properties: {
      monitor_type: {
        type: "string",
        enum: MONITOR_TYPES as unknown as string[],
        description: "What to monitor",
      },
      target_value: {
        type: "number",
        description:
          "Optional: trigger when the bar reaches this specific value instead of maximum. E.g. target_value=6 for nerve means notify when nerve >= 6.",
      },
      recurring: {
        type: "boolean",
        description:
          "If true, the monitor keeps running and notifies every time the condition is met again (after it drops and rises back). Default: false (one-shot).",
      },
      check_interval_seconds: {
        type: "number",
        description:
          "How often to check (in seconds). Default: 60. Minimum: 30.",
      },
    },
    required: ["monitor_type"],
  },
  handler: async (input, context) => {
    const monitorType = input.monitor_type as MonitorType;
    const interval = Math.max(30, (input.check_interval_seconds as number) ?? 60);
    const targetValue = (input.target_value as number) ?? null;
    const recurring = (input.recurring as boolean) ?? false;

    if (!MONITOR_TYPES.includes(monitorType)) {
      return `Invalid monitor type. Available: ${MONITOR_TYPES.join(", ")}`;
    }

    const user = await db.query.users.findFirst({
      where: eq(users.discordId, context.discordUserId),
    });
    if (!user) return "User not found.";

    // Check for duplicate
    const existing = await db.query.monitors.findFirst({
      where: and(
        eq(monitors.userId, user.id),
        eq(monitors.monitorType, monitorType),
        eq(monitors.isActive, true)
      ),
    });

    if (existing) {
      return `You already have an active monitor for ${monitorType} (ID: ${existing.id}). Cancel it first with monitor_cancel.`;
    }

    const [inserted] = await db
      .insert(monitors)
      .values({
        userId: user.id,
        discordChannelId: context.discordChannelId,
        monitorType,
        targetValue,
        recurring,
        checkIntervalSeconds: interval,
      })
      .returning({ id: monitors.id });

    const targetDesc = targetValue ? `>= ${targetValue}` : "at maximum";
    const recurDesc = recurring ? ", recurring" : ", one-shot";

    return `Monitor created (ID: ${inserted!.id}). Checking ${monitorType} (${targetDesc}${recurDesc}) every ${interval}s.`;
  },
};
