import "dotenv/config";

export interface Config {
  discordToken: string;
  categoryId: string;
  feedChannelId: string;
  mcHost: string;
  mcPort: number;
  pollIntervalMs: number;
}

function required(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.trim() === "") {
    throw new Error(`Variable d'environnement manquante : ${name}`);
  }
  return value;
}

function numeric(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Variable d'environnement invalide (nombre attendu) : ${name}`);
  }
  return parsed;
}

export function loadConfig(): Config {
  return {
    discordToken: required("DISCORD_TOKEN"),
    categoryId: required("DISCORD_CATEGORY_ID"),
    feedChannelId: required("DISCORD_FEED_CHANNEL_ID"),
    mcHost: required("MC_HOST"),
    mcPort: numeric("MC_PORT", 25565),
    pollIntervalMs: numeric("POLL_INTERVAL_SECONDS", 15) * 1000,
  };
}
