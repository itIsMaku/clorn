import type { ToolDefinition } from "../agent/types.js";
import { tornClient } from "../torn/client.js";

interface CachedItem {
  id: number;
  name: string;
  type: string;
  marketValue: number;
}

let itemCache: CachedItem[] = [];
let cacheLoaded = false;

export async function loadItemCache(apiKey: string): Promise<void> {
  if (cacheLoaded) return;

  const data = await tornClient.fetch<{ items: Record<string, { name: string; type: string; market_value: number }> }>(
    "/torn",
    apiKey,
    "items"
  );

  if ((data as any).error) {
    throw new Error(`Failed to load items: ${(data as any).error.error}`);
  }

  itemCache = Object.entries(data.items).map(([id, item]) => ({
    id: parseInt(id, 10),
    name: item.name,
    type: item.type,
    marketValue: item.market_value,
  }));
  cacheLoaded = true;
  console.log(`[items] Cached ${itemCache.length} items`);
}

export function searchItems(query: string): CachedItem[] {
  const lower = query.toLowerCase();
  return itemCache
    .filter((item) => item.name.toLowerCase().includes(lower))
    .sort((a, b) => {
      // Exact match first, then startsWith, then includes
      const aExact = a.name.toLowerCase() === lower ? 0 : 1;
      const bExact = b.name.toLowerCase() === lower ? 0 : 1;
      if (aExact !== bExact) return aExact - bExact;

      const aStarts = a.name.toLowerCase().startsWith(lower) ? 0 : 1;
      const bStarts = b.name.toLowerCase().startsWith(lower) ? 0 : 1;
      return aStarts - bStarts;
    })
    .slice(0, 10);
}

export const tornItemSearch: ToolDefinition = {
  name: "torn_item_search",
  description:
    "Search for a Torn City item by name. Returns matching items with their IDs, types, and market values.",
  input_schema: {
    type: "object" as const,
    properties: {
      name: {
        type: "string",
        description: "Item name to search for (partial match)",
      },
    },
    required: ["name"],
  },
  handler: async (input, context) => {
    const name = input.name as string;
    await loadItemCache(context.tornApiKey);

    const matches = searchItems(name);
    if (matches.length === 0) {
      return `No items found matching "${name}"`;
    }

    const lines = matches.map(
      (item) =>
        `- **${item.name}** (ID: ${item.id}) | Type: ${item.type} | Value: $${item.marketValue.toLocaleString()}`
    );

    return lines.join("\n");
  },
};
