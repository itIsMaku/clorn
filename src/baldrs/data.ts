import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

export interface BaldrsTarget {
  name: string;
  id: number;
  level: number;
  total: number;
  str: number;
  def: number;
  spd: number;
  dex: number;
  listName: string;
}

type RawTarget = {
  name: string;
  id: string;
  lvl: string;
  total: string;
  str: string;
  def: string;
  spd: string;
  dex: string;
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = join(__dirname, "../../assets/baldrs_data.json");

let cache: BaldrsTarget[] | null = null;

export function loadBaldrsTargets(): BaldrsTarget[] {
  if (cache) return cache;

  const raw = JSON.parse(readFileSync(DATA_PATH, "utf8")) as Record<
    string,
    RawTarget[]
  >;

  const targets: BaldrsTarget[] = [];
  for (const [listName, entries] of Object.entries(raw)) {
    for (const e of entries) {
      targets.push({
        name: e.name,
        id: parseInt(e.id, 10),
        level: parseInt(e.lvl, 10),
        total: parseInt(e.total, 10),
        str: parseInt(e.str, 10),
        def: parseInt(e.def, 10),
        spd: parseInt(e.spd, 10),
        dex: parseInt(e.dex, 10),
        listName,
      });
    }
  }

  cache = targets;
  console.log(`[baldrs] Loaded ${targets.length} targets`);
  return targets;
}

export function getListNames(): string[] {
  const targets = loadBaldrsTargets();
  return [...new Set(targets.map((t) => t.listName))];
}
