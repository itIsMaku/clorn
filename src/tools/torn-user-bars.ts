import type { ToolDefinition } from "../agent/types.js";
import { tornClient } from "../torn/client.js";
import type { Bar } from "../torn/types.js";

function formatBar(name: string, bar: Bar): string {
  const pct = Math.round((bar.current / bar.maximum) * 100);
  let timeStr = "";
  if (bar.fulltime && bar.fulltime > 0) {
    const mins = Math.ceil(bar.fulltime / 60);
    if (mins >= 60) {
      const hours = Math.floor(mins / 60);
      const remainMins = mins % 60;
      timeStr = ` (full in ~${hours}h ${remainMins}m)`;
    } else {
      timeStr = ` (full in ~${mins} min)`;
    }
  } else if (bar.current >= bar.maximum) {
    timeStr = " (FULL!)";
  }
  return `${name}: ${bar.current.toLocaleString()}/${bar.maximum.toLocaleString()} (${pct}%)${timeStr}`;
}

export const tornUserBars: ToolDefinition = {
  name: "torn_user_bars",
  description:
    "Get the current status of a user's bars (nerve, energy, happy, life) and cooldowns. If no player_id is provided, returns the calling user's own bars.",
  input_schema: {
    type: "object" as const,
    properties: {
      player_id: {
        type: "number",
        description:
          "Torn player ID. If omitted, uses the current user's ID.",
      },
    },
    required: [],
  },
  handler: async (input, context) => {
    const playerId = (input.player_id as number) ?? context.tornPlayerId;
    if (!playerId) {
      return "Cannot determine your ID. Try re-registering.";
    }

    const data = await tornClient.fetch<Record<string, unknown>>(
      "/user",
      context.tornApiKey,
      "bars,cooldowns,travel",
      playerId
    );

    if ((data as any).error) {
      return `Torn API error: ${(data as any).error.error}`;
    }

    const bars = data as any;
    const lines: string[] = [];

    if (bars.energy) lines.push(formatBar("Energy", bars.energy));
    if (bars.nerve) lines.push(formatBar("Nerve", bars.nerve));
    if (bars.happy) lines.push(formatBar("Happy", bars.happy));
    if (bars.life) lines.push(formatBar("Life", bars.life));

    if (bars.cooldowns) {
      const cd = bars.cooldowns;
      const parts: string[] = [];
      if (cd.drug > 0) parts.push(`Drug: ${Math.ceil(cd.drug / 60)} min`);
      if (cd.medical > 0) parts.push(`Medical: ${Math.ceil(cd.medical / 60)} min`);
      if (cd.booster > 0) parts.push(`Booster: ${Math.ceil(cd.booster / 60)} min`);
      if (parts.length > 0) {
        lines.push(`Cooldowns: ${parts.join(", ")}`);
      }
    }

    if (bars.travel && bars.travel.time_left > 0) {
      lines.push(
        `Travel: ${bars.travel.destination} (${Math.ceil(bars.travel.time_left / 60)} min remaining)`
      );
    }

    return lines.join("\n");
  },
};
