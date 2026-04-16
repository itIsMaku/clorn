import { CronJob } from "cron";
import { executeMonitorChecks } from "./executor.js";

let job: CronJob | null = null;

export function startScheduler(): void {
  // Tick every 30 seconds
  job = new CronJob("*/30 * * * * *", async () => {
    try {
      await executeMonitorChecks();
    } catch (err) {
      console.error("[scheduler] Error during monitor check:", err);
    }
  });
  job.start();
}

export function stopScheduler(): void {
  if (job) {
    job.stop();
    job = null;
  }
}
