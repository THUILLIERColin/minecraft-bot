import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  DISCORD_TOKEN: z.string().min(1),
  DISCORD_CATEGORY_ID: z.string().min(1),
  DISCORD_FEED_CHANNEL_ID: z.string().min(1),
  DISCORD_CHAT_CHANNEL_ID: z.string().min(1),
  MC_HOST: z.string().min(1),
  MC_PORT: z.coerce.number().int().positive().default(25565),
  RCON_PORT: z.coerce.number().int().positive().default(25575),
  RCON_PASSWORD: z.string().min(1),
  POLL_INTERVAL_SECONDS: z.coerce.number().int().positive().default(15),
});

export interface Config {
  discord: {
    token: string;
    categoryId: string;
    feedChannelId: string;
    chatChannelId: string;
  };
  minecraft: {
    host: string;
    port: number;
    rconPort: number;
    rconPassword: string;
  };
  pollIntervalMs: number;
}

/**
 * Charge et valide l'environnement. En cas d'erreur, lève une exception avec la
 * liste précise des variables fautives : le bot refuse de démarrer plutôt que
 * de planter plus tard sur une valeur manquante.
 */
export function loadConfig(): Config {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Configuration invalide :\n${issues}`);
  }

  const env = parsed.data;
  return {
    discord: {
      token: env.DISCORD_TOKEN,
      categoryId: env.DISCORD_CATEGORY_ID,
      feedChannelId: env.DISCORD_FEED_CHANNEL_ID,
      chatChannelId: env.DISCORD_CHAT_CHANNEL_ID,
    },
    minecraft: {
      host: env.MC_HOST,
      port: env.MC_PORT,
      rconPort: env.RCON_PORT,
      rconPassword: env.RCON_PASSWORD,
    },
    pollIntervalMs: env.POLL_INTERVAL_SECONDS * 1000,
  };
}
