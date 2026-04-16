import {
  Client,
  ChannelType,
  GatewayIntentBits,
  Partials,
  Events,
} from "discord.js";
import { config } from "../config.js";
import { handleMessage } from "./handler.js";
import { handleInteraction } from "./commands.js";

export async function createDiscordClient(): Promise<Client> {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.DirectMessages,
    ],
    partials: [Partials.Channel, Partials.Message],
  });

  // Guild messages only - skip DMs here (handled via raw)
  client.on(Events.MessageCreate, (message) => {
    if (message.channel.type === ChannelType.DM) return;
    handleMessage(message);
  });

  // DMs via raw event (Bun + discord.js partial workaround)
  client.on("raw", async (event: any) => {
    if (event.t !== "MESSAGE_CREATE") return;
    if (event.d.guild_id) return;

    try {
      const channel = await client.channels.fetch(event.d.channel_id);
      if (!channel || !channel.isTextBased()) return;

      const messages = "messages" in channel ? channel.messages : null;
      if (!messages) return;

      const message = await messages.fetch(event.d.id);
      handleMessage(message);
    } catch (err) {
      console.error("[discord] DM raw handler error:", err);
    }
  });

  // Slash commands
  client.on(Events.InteractionCreate, (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    handleInteraction(interaction);
  });

  client.on(Events.Error, (err) => {
    console.error("[discord] Client error:", err);
  });

  client.once(Events.ClientReady, (c) => {
    console.log(`[discord] Logged in as ${c.user.tag}`);
  });

  await client.login(config.DISCORD_TOKEN);
  return client;
}
