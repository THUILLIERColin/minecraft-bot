export interface PlayerListResult {
  online: number;
  max: number;
  players: string[];
}

const LIST_HEADER =
  /There are (\d+) of a max of (\d+) players online:?\s*(.*)/s;

/**
 * Analyse la sortie de la commande vanilla `list`, présente sur tous les
 * loaders (Fabric, Forge, NeoForge, Paper, vanilla). Exemple :
 *   "There are 2 of a max of 20 players online: Alice, Bob"
 */
export function parsePlayerList(output: string): PlayerListResult {
  const match = LIST_HEADER.exec(output.trim());
  if (match === null) {
    return { online: 0, max: 0, players: [] };
  }

  const online = Number(match[1]);
  const max = Number(match[2]);
  const names = (match[3] ?? "")
    .split(",")
    .map((name) => name.trim())
    .filter((name) => name.length > 0);

  return { online, max, players: names };
}

const TPS_PATTERNS = [
  // Paper : "TPS from last 1m, 5m, 15m: 19.98, 20.0, 20.0"
  /TPS from last[^:]*:\s*(\d{1,2}(?:\.\d+)?)/,
  // Forge/NeoForge : "Mean tick time: 3.2 ms. Mean TPS: 20.0"
  /Mean TPS:\s*(\d{1,2}(?:\.\d+)?)/i,
  // Générique "20.0 TPS"
  /(\d{1,2}(?:\.\d+)?)\s*TPS/i,
];

/**
 * Extrait un TPS d'une sortie de commande. Le format varie selon la plateforme
 * (Paper `/tps`, Forge/NeoForge `/forge tps`, Spark…), donc on essaie des
 * motifs ancrés sur les libellés réels plutôt qu'une capture de nombre nu, qui
 * attraperait par erreur les "1m/5m/15m" des en-têtes.
 */
export function parseTps(output: string): number | null {
  for (const pattern of TPS_PATTERNS) {
    const match = pattern.exec(output);
    const captured = match?.[1];
    if (captured === undefined) continue;

    const value = Number(captured);
    if (Number.isFinite(value) && value >= 0 && value <= 20) {
      return value;
    }
  }
  return null;
}
