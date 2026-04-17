import {
  SlashCommandBuilder,
  REST,
  Routes,
  ChatInputCommandInteraction,
} from "discord.js";
import { config } from "../config.js";
import { db } from "../db/connection.js";
import { users } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { decryptApiKey } from "../crypto/keys.js";
import { runAgentLoop } from "../agent/loop.js";
import type { AgentContext } from "../agent/types.js";
import { registerUser } from "./register.js";

const commands = [
  new SlashCommandBuilder()
    .setName("torn")
    .setDescription("Ask Clorn anything about Torn City")
    .addStringOption((opt) =>
      opt
        .setName("query")
        .setDescription("Your question or command")
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName("register")
    .setDescription("Register your Torn API key (use in DM for privacy)")
    .addStringOption((opt) =>
      opt
        .setName("api_key")
        .setDescription("Your Torn API key")
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName("bars")
    .setDescription("Check your current bars (nerve, energy, happy, life)"),
  new SlashCommandBuilder()
    .setName("money")
    .setDescription("Check your cash, bank, points, and networth"),
  new SlashCommandBuilder()
    .setName("lookup")
    .setDescription("Look up a Torn player")
    .addStringOption((opt) =>
      opt
        .setName("player")
        .setDescription("Player name or numeric ID")
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName("market")
    .setDescription("Check item market prices")
    .addStringOption((opt) =>
      opt
        .setName("item")
        .setDescription("Item name or ID")
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName("targets")
    .setDescription("Find leveling targets from Baldr's List")
    .addIntegerOption((opt) =>
      opt
        .setName("max_level")
        .setDescription("Maximum target level")
    )
    .addIntegerOption((opt) =>
      opt
        .setName("max_total")
        .setDescription("Maximum total battle stats")
    )
    .addIntegerOption((opt) =>
      opt
        .setName("limit")
        .setDescription("How many targets to show (default 10, max 50)")
    ),
];

export async function registerCommands(): Promise<void> {
  const rest = new REST({ version: "10" }).setToken(config.DISCORD_TOKEN);

  console.log("[commands] Registering slash commands...");
  await rest.put(Routes.applicationCommands(config.DISCORD_CLIENT_ID), {
    body: commands.map((c) => c.toJSON()),
  });
  console.log("[commands] Slash commands registered");
}

export async function handleInteraction(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const { commandName } = interaction;

  // Handle /register separately - no auth needed
  if (commandName === "register") {
    await handleRegisterCommand(interaction);
    return;
  }

  // All other commands need registration
  const user = await db.query.users.findFirst({
    where: eq(users.discordId, interaction.user.id),
  });

  if (!user) {
    await interaction.reply({
      content:
        "You're not registered. Use `/register` with your Torn API key (preferably in DM).",
      ephemeral: true,
    });
    return;
  }

  const apiKey = decryptApiKey(user);
  const context: AgentContext = {
    tornApiKey: apiKey,
    discordUserId: interaction.user.id,
    discordChannelId: interaction.channelId,
    tornPlayerId: user.tornPlayerId ?? undefined,
    tornPlayerName: user.tornPlayerName ?? undefined,
  };

  await interaction.deferReply();

  try {
    let query: string;

    switch (commandName) {
      case "torn":
        query = interaction.options.getString("query", true);
        break;
      case "bars":
        query = "Show me my current bars (nerve, energy, happy, life)";
        break;
      case "money":
        query = "Show me my money, networth and financial overview";
        break;
      case "lookup": {
        const player = interaction.options.getString("player", true);
        query = `Look up player ${player}`;
        break;
      }
      case "market": {
        const item = interaction.options.getString("item", true);
        query = `What are the market prices for ${item}?`;
        break;
      }
      case "targets": {
        const maxLevel = interaction.options.getInteger("max_level");
        const maxTotal = interaction.options.getInteger("max_total");
        const limit = interaction.options.getInteger("limit");
        const parts: string[] = ["Find leveling targets from Baldr's list"];
        if (maxLevel !== null) parts.push(`max level ${maxLevel}`);
        if (maxTotal !== null) parts.push(`max total ${maxTotal}`);
        if (limit !== null) parts.push(`show ${limit} results`);
        query = parts.join(", ");
        break;
      }
      default:
        await interaction.editReply("Unknown command.");
        return;
    }

    const response = await runAgentLoop(query, context);

    const chunks = response.match(/[\s\S]{1,1900}/g) ?? [response];
    await interaction.editReply(chunks[0]!);
    for (const chunk of chunks.slice(1)) {
      await interaction.followUp(chunk);
    }
  } catch (err) {
    console.error("[command] Error:", err);
    await interaction.editReply("An error occurred while processing the command.");
  }
}

async function handleRegisterCommand(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const apiKey = interaction.options.getString("api_key", true);

  try {
    const result = await registerUser(interaction.user.id, apiKey);
    await interaction.reply({
      content: result.success
        ? `Registered as **${result.name}** [${result.playerId}]`
        : result.error,
      ephemeral: true,
    });
  } catch (err) {
    console.error("[register] Error:", err);
    await interaction.reply({
      content: "Registration failed. Check your API key.",
      ephemeral: true,
    });
  }
}
