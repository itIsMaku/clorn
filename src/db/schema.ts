import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  discordId: text("discord_id").notNull().unique(),
  tornApiKeyEncrypted: text("torn_api_key_encrypted").notNull(),
  tornApiKeyIv: text("torn_api_key_iv").notNull(),
  tornApiKeyTag: text("torn_api_key_tag").notNull(),
  tornPlayerId: integer("torn_player_id"),
  tornPlayerName: text("torn_player_name"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const monitors = pgTable("monitors", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  discordChannelId: text("discord_channel_id").notNull(),
  monitorType: text("monitor_type").notNull(),
  targetValue: integer("target_value"),
  recurring: boolean("recurring").notNull().default(false),
  checkIntervalSeconds: integer("check_interval_seconds").notNull().default(60),
  isActive: boolean("is_active").notNull().default(true),
  lastCheckedAt: timestamp("last_checked_at"),
  lastValue: text("last_value"),
  consecutiveFailures: integer("consecutive_failures").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  notifiedAt: timestamp("notified_at"),
});

export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  discordChannelId: text("discord_channel_id").notNull(),
  discordUserId: text("discord_user_id").notNull(),
  messagesJson: text("messages_json").notNull().default("[]"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
});
