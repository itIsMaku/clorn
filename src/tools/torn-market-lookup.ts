import type { ToolDefinition } from "../agent/types.js";
import { tornClient } from "../torn/client.js";
import { loadItemCache, searchItems } from "./torn-item-search.js";

export const tornMarketLookup: ToolDefinition = {
  name: "torn_market_lookup",
  description:
    "Look up market prices for a Torn City item. Accepts item name (fuzzy search) or numeric item ID. Returns bazaar and item market listings with prices.",
  input_schema: {
    type: "object" as const,
    properties: {
      query: {
        type: "string",
        description: "Item name or numeric item ID to search for",
      },
    },
    required: ["query"],
  },
  handler: async (input, context) => {
    const query = input.query as string;
    let itemId: number;
    let itemName: string;

    // Check if query is a numeric ID
    if (/^\d+$/.test(query)) {
      itemId = parseInt(query, 10);
      itemName = `Item #${itemId}`;
    } else {
      // Search by name
      await loadItemCache(context.tornApiKey);
      const matches = searchItems(query);
      if (matches.length === 0) {
        return `No items found matching "${query}"`;
      }
      itemId = matches[0]!.id;
      itemName = matches[0]!.name;

      if (matches.length > 1) {
        const options = matches
          .slice(0, 5)
          .map((m) => `  - ${m.name} (ID: ${m.id})`)
          .join("\n");
        // Use the first match but show alternatives
        itemName = `${matches[0]!.name} (found ${matches.length} results:\n${options})`;
      }
    }

    const data = await tornClient.fetch<Record<string, unknown>>(
      "/market",
      context.tornApiKey,
      "bazaar,itemmarket",
      itemId
    );

    if ((data as any).error) {
      return `Torn API error: ${(data as any).error.error}`;
    }

    const bazaar = (data as any).bazaar as Array<{ cost: number; quantity: number }> | undefined;
    const itemmarket = (data as any).itemmarket as Array<{ cost: number; quantity: number }> | undefined;

    const lines: string[] = [`**${itemName}** (ID: ${itemId})`];

    if (bazaar && bazaar.length > 0) {
      const sorted = [...bazaar].sort((a, b) => a.cost - b.cost);
      const lowest = sorted.slice(0, 5);
      lines.push("\n**Bazaar:**");
      for (const listing of lowest) {
        lines.push(`  $${listing.cost.toLocaleString()} x${listing.quantity}`);
      }
    }

    if (itemmarket && itemmarket.length > 0) {
      const sorted = [...itemmarket].sort((a, b) => a.cost - b.cost);
      const lowest = sorted.slice(0, 5);
      lines.push("\n**Item Market:**");
      for (const listing of lowest) {
        lines.push(`  $${listing.cost.toLocaleString()} x${listing.quantity}`);
      }
    }

    if ((!bazaar || bazaar.length === 0) && (!itemmarket || itemmarket.length === 0)) {
      lines.push("No listings on the market.");
    }

    return lines.join("\n");
  },
};
