import type { ToolDefinition } from "../agent/types.js";
import { tornClient } from "../torn/client.js";

export const tornUserMoney: ToolDefinition = {
  name: "torn_user_money",
  description:
    "Get the current user's financial info: cash on hand, money in bank (vault), points, networth, and company/stock info. Only works for the authenticated user (cannot check other players' money).",
  input_schema: {
    type: "object" as const,
    properties: {},
    required: [],
  },
  handler: async (_input, context) => {
    if (!context.tornPlayerId) {
      return "Cannot determine your ID. Try re-registering.";
    }

    const data = await tornClient.fetch<Record<string, unknown>>(
      "/user",
      context.tornApiKey,
      "money,networth,stocks",
      context.tornPlayerId
    );

    if ((data as any).error) {
      return `Torn API error: ${(data as any).error.error}`;
    }

    const lines: string[] = [];

    // Money
    if ((data as any).money_onhand !== undefined) {
      lines.push(`**Cash:** $${Number((data as any).money_onhand).toLocaleString()}`);
    }
    if ((data as any).cayman_bank !== undefined) {
      lines.push(`**Cayman Bank:** $${Number((data as any).cayman_bank).toLocaleString()}`);
    }
    if ((data as any).vault_amount !== undefined) {
      lines.push(`**Vault:** $${Number((data as any).vault_amount).toLocaleString()}`);
    }
    if ((data as any).city_bank) {
      const cb = (data as any).city_bank;
      lines.push(`**City Bank:** $${Number(cb.amount).toLocaleString()} (time left: ${Math.ceil(cb.time_left / 86400)} days)`);
    }
    if ((data as any).points !== undefined) {
      lines.push(`**Points:** ${Number((data as any).points).toLocaleString()}`);
    }
    if ((data as any).daily_networth !== undefined) {
      lines.push(`**Daily Networth:** $${Number((data as any).daily_networth).toLocaleString()}`);
    }

    // Networth breakdown
    if ((data as any).networth) {
      const nw = (data as any).networth;
      lines.push("\n**Networth breakdown:**");
      const fields: [string, string][] = [
        ["Pending", nw.pending],
        ["Wallet", nw.wallet],
        ["Bank", nw.bank],
        ["Points", nw.points],
        ["Cayman", nw.cayman],
        ["Vault", nw.vault],
        ["Display Case", nw.displaycase],
        ["Bazaar", nw.bazaar],
        ["Items", nw.itemmarket],
        ["Property", nw.property],
        ["Stock Market", nw.stockmarket],
        ["Auction House", nw.auctionhouse],
        ["Company", nw.company],
        ["Bookie", nw.bookie],
        ["Loan", nw.loan],
        ["Unpaid Fees", nw.unpaidfees],
        ["**Total**", nw.total],
      ];
      for (const [label, val] of fields) {
        if (val !== undefined && Number(val) !== 0) {
          lines.push(`  ${label}: $${Number(val).toLocaleString()}`);
        }
      }
    }

    // Stocks
    if ((data as any).stocks && typeof (data as any).stocks === "object") {
      const stocks = (data as any).stocks as Record<
        string,
        { stock_id: number; total_shares: number; benefit?: { ready: number } }
      >;
      const stockEntries = Object.values(stocks);
      if (stockEntries.length > 0) {
        lines.push(`\n**Stocks:** ${stockEntries.length} positions`);
      }
    }

    return lines.join("\n") || "No financial data available.";
  },
};
