import type { ToolDefinition } from "../agent/types.js";
import { tornClient } from "../torn/client.js";
import { searchPlayerByName, cachePlayer } from "../torn/player-cache.js";

export const tornUserLookup: ToolDefinition = {
  name: "torn_user_lookup",
  description:
    "Look up a Torn City player by their numeric ID or by name. Returns profile info including level, status, faction, last action, awards, etc. When a name is provided, the bot searches the faction member list and local cache. Use this when the user asks about a specific player.",
  input_schema: {
    type: "object" as const,
    properties: {
      player_id: {
        type: "number",
        description: "Torn player ID to look up (use this if you know the ID)",
      },
      player_name: {
        type: "string",
        description:
          "Torn player name to search for (use this if the user provides a name instead of ID)",
      },
    },
    required: [],
  },
  handler: async (input, context) => {
    let playerId = input.player_id as number | undefined;

    // If name provided, resolve to ID
    if (!playerId && input.player_name) {
      const name = input.player_name as string;

      const found = await searchPlayerByName(
        name,
        context.tornApiKey,
        context.tornPlayerId
      );
      if (!found) {
        return `Player "${name}" not found in cache, faction, or known contacts. Try providing their Torn ID (numeric).`;
      }
      playerId = found.id;
    }

    if (!playerId) {
      return "You must provide either player_id or player_name.";
    }

    const data = await tornClient.fetch<Record<string, unknown>>(
      "/user",
      context.tornApiKey,
      "basic,profile,personalstats",
      playerId
    );

    if ((data as any).error) {
      return `Torn API error: ${(data as any).error.error}`;
    }

    // Cache the looked-up player
    if ((data as any).name && (data as any).player_id) {
      cachePlayer((data as any).name, (data as any).player_id);
    }

    return JSON.stringify(data, null, 2);
  },
};
