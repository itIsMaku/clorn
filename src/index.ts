import { config } from "./config.js";
import { db, sql } from "./db/connection.js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { createDiscordClient } from "./discord/client.js";
import { startScheduler, stopScheduler } from "./monitor/scheduler.js";
import { setDiscordClient } from "./monitor/executor.js";
import { registerCommands } from "./discord/commands.js";

async function main() {
  console.log("[clorn] Starting...");

  // Run DB migrations
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("[clorn] Database ready");

  // Register slash commands
  await registerCommands();

  // Start Discord bot
  const client = await createDiscordClient();
  console.log("[clorn] Discord bot online");

  // Wire Discord client to monitor executor
  setDiscordClient(client);

  // Start monitor scheduler
  startScheduler();
  console.log("[clorn] Monitor scheduler started");

  // Graceful shutdown
  const shutdown = async () => {
    console.log("\n[clorn] Shutting down...");
    stopScheduler();
    client.destroy();
    await sql.end();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("[clorn] Fatal error:", err);
  process.exit(1);
});
