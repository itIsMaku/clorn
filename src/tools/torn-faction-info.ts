import type { ToolDefinition } from "../agent/types.js";
import { tornClient } from "../torn/client.js";

export const tornFactionInfo: ToolDefinition = {
  name: "torn_faction_info",
  description:
    "Get information about a Torn City faction by ID, including member count, respect, best chain, and age.",
  input_schema: {
    type: "object" as const,
    properties: {
      faction_id: {
        type: "number",
        description: "Torn faction ID",
      },
    },
    required: ["faction_id"],
  },
  handler: async (input, context) => {
    const factionId = input.faction_id as number;

    const data = await tornClient.fetch<Record<string, unknown>>(
      "/faction",
      context.tornApiKey,
      "basic",
      factionId
    );

    if ((data as any).error) {
      return `Torn API error: ${(data as any).error.error}`;
    }

    return JSON.stringify(data, null, 2);
  },
};
