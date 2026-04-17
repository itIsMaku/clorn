import { db } from "../db/connection.js";
import { monitors, users } from "../db/schema.js";
import { eq, and, inArray } from "drizzle-orm";
import { decryptApiKey } from "../crypto/keys.js";
import { tornClient } from "../torn/client.js";
import type { Bar, BarsResponse } from "../torn/types.js";
import { Client } from "discord.js";

let discordClient: Client | null = null;

export function setDiscordClient(client: Client): void {
  discordClient = client;
}

function checkBar(
  bar: Bar,
  barName: string,
  target: number | null
): { met: boolean; message: string } {
  const threshold = target ?? bar.maximum;
  const met = bar.current >= threshold;
  const message = `Your ${barName} reached ${bar.current}/${bar.maximum}` +
    (target ? ` (target: ${target})` : " (full!)");
  return { met, message };
}

export async function executeMonitorChecks(): Promise<void> {
  if (!discordClient) return;

  const activeMonitors = await db.query.monitors.findMany({
    where: eq(monitors.isActive, true),
  });

  if (activeMonitors.length === 0) return;

  const now = new Date();

  // Batch-load all users needed by active monitors
  const userIds = [...new Set(activeMonitors.map((m) => m.userId))];
  const allUsers = await db.query.users.findMany({
    where: inArray(users.id, userIds),
  });
  const userMap = new Map(allUsers.map((u) => [u.id, u]));

  for (const monitor of activeMonitors) {
    if (monitor.lastCheckedAt) {
      const elapsed =
        (now.getTime() - monitor.lastCheckedAt.getTime()) / 1000;
      if (elapsed < monitor.checkIntervalSeconds) continue;
    }

    const user = userMap.get(monitor.userId);
    if (!user) continue;

    try {
      const apiKey = decryptApiKey(user);
      const data = await tornClient.fetch<BarsResponse & { travel?: { time_left: number }; cooldowns?: { drug: number; medical: number; booster: number } }>(
        "/user",
        apiKey,
        "bars,travel,cooldowns"
      );

      let conditionMet = false;
      let notificationMessage = "";
      const target = monitor.targetValue;

      switch (monitor.monitorType) {
        case "nerve_full": {
          const r = checkBar(data.nerve, "nerve", target);
          conditionMet = r.met; notificationMessage = r.message;
          break;
        }
        case "energy_full": {
          const r = checkBar(data.energy, "energy", target);
          conditionMet = r.met; notificationMessage = r.message;
          break;
        }
        case "happy_full": {
          const r = checkBar(data.happy, "happy", target);
          conditionMet = r.met; notificationMessage = r.message;
          break;
        }
        case "life_full": {
          const r = checkBar(data.life, "life", target);
          conditionMet = r.met; notificationMessage = r.message;
          break;
        }
        case "travel_landed":
          conditionMet = !data.travel || data.travel.time_left <= 0;
          notificationMessage = "You have landed!";
          break;
        case "drug_cooldown":
          conditionMet = !!data.cooldowns && data.cooldowns.drug === 0;
          notificationMessage = "Your drug cooldown is done!";
          break;
        case "medical_cooldown":
          conditionMet = !!data.cooldowns && data.cooldowns.medical === 0;
          notificationMessage = "Your medical cooldown is done!";
          break;
        case "booster_cooldown":
          conditionMet = !!data.cooldowns && data.cooldowns.booster === 0;
          notificationMessage = "Your booster cooldown is done!";
          break;
        case "cooldown_done":
          conditionMet =
            !!data.cooldowns &&
            data.cooldowns.drug === 0 &&
            data.cooldowns.medical === 0 &&
            data.cooldowns.booster === 0;
          notificationMessage = "All cooldowns are done!";
          break;
      }

      await db
        .update(monitors)
        .set({
          lastCheckedAt: now,
          lastValue: JSON.stringify({
            nerve: data.nerve,
            energy: data.energy,
            happy: data.happy,
            life: data.life,
          }),
          consecutiveFailures: 0,
        })
        .where(eq(monitors.id, monitor.id));

      if (conditionMet && !monitor.notifiedAt) {
        await sendNotification(user.discordId, monitor.discordChannelId, notificationMessage);

        if (monitor.recurring) {
          await db
            .update(monitors)
            .set({ notifiedAt: now })
            .where(eq(monitors.id, monitor.id));
        } else {
          await db
            .update(monitors)
            .set({ isActive: false, notifiedAt: now })
            .where(eq(monitors.id, monitor.id));
        }
      } else if (!conditionMet && monitor.notifiedAt && monitor.recurring) {
        await db
          .update(monitors)
          .set({ notifiedAt: null })
          .where(eq(monitors.id, monitor.id));
      }
    } catch (err) {
      console.error(`[monitor] Error checking monitor #${monitor.id}:`, err);

      const failures = monitor.consecutiveFailures + 1;
      if (failures >= 3) {
        await db
          .update(monitors)
          .set({ isActive: false, consecutiveFailures: failures })
          .where(eq(monitors.id, monitor.id));

        await sendNotification(
          user.discordId,
          monitor.discordChannelId,
          `Monitor #${monitor.id} (${monitor.monitorType}) deactivated after 3 consecutive failures.`
        );
      } else {
        await db
          .update(monitors)
          .set({ consecutiveFailures: failures })
          .where(eq(monitors.id, monitor.id));
      }
    }
  }
}

async function sendNotification(
  discordUserId: string,
  channelId: string,
  message: string
): Promise<void> {
  if (!discordClient) return;
  try {
    const channel = await discordClient.channels.fetch(channelId);
    if (channel && channel.isTextBased() && "send" in channel) {
      await channel.send(`<@${discordUserId}> ${message}`);
    }
  } catch (err) {
    console.error("[monitor] Failed to send notification:", err);
  }
}
