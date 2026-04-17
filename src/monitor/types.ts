export const MONITOR_TYPES = [
  "nerve_full",
  "energy_full",
  "happy_full",
  "life_full",
  "travel_landed",
  "drug_cooldown",
  "medical_cooldown",
  "booster_cooldown",
  "cooldown_done",
] as const;

export type MonitorType = (typeof MONITOR_TYPES)[number];
