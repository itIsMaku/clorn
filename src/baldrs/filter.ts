import type { BaldrsTarget } from "./data.js";

export interface FilterOptions {
  maxLevel?: number;
  minLevel?: number;
  maxTotal?: number;
  minTotal?: number;
  listName?: string;
  sortBy?: "total" | "level";
}

export function filterTargets(
  targets: BaldrsTarget[],
  opts: FilterOptions
): BaldrsTarget[] {
  let filtered = targets;

  if (opts.maxLevel !== undefined) {
    filtered = filtered.filter((t) => t.level <= opts.maxLevel!);
  }
  if (opts.minLevel !== undefined) {
    filtered = filtered.filter((t) => t.level >= opts.minLevel!);
  }
  if (opts.maxTotal !== undefined) {
    filtered = filtered.filter((t) => t.total <= opts.maxTotal!);
  }
  if (opts.minTotal !== undefined) {
    filtered = filtered.filter((t) => t.total >= opts.minTotal!);
  }
  if (opts.listName) {
    const lower = opts.listName.toLowerCase();
    filtered = filtered.filter((t) =>
      t.listName.toLowerCase().includes(lower)
    );
  }

  const sortKey = opts.sortBy ?? "total";
  filtered = [...filtered].sort((a, b) => a[sortKey] - b[sortKey]);

  return filtered;
}
