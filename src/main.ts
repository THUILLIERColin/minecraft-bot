import { loadConfig } from "./config.js";
import { logger } from "./logger.js";
import { createDiscordClient } from "./discord/client.js";
import { CategoryPresence } from "./discord/categoryPresence.js";
import { PlayerFeed } from "./discord/playerFeed.js";
import { PingSource } from "./minecraft/pingSource.js";
import { Monitor } from "./monitor/monitor.js";
import type { MonitorEvent } from "./events.js";

async function main(): Promise<void> {
  const config = loadConfig();

  const client = await createDiscordClient(config.discordToken);
  logger.info("connecté à Discord", { user: client.user?.tag });

  const presence = new CategoryPresence(client, config.categoryId, logger);
  const feed = new PlayerFeed(client, config.feedChannelId, logger);

  const source = new PingSource({ host: config.mcHost, port: config.mcPort });
  const monitor = new Monitor({
    source,
    intervalMs: config.pollIntervalMs,
    logger,
  });

  monitor.onEvent(async (event: MonitorEvent) => {
    switch (event.type) {
      case "serverWentOnline":
        await presence.setOnline();
        break;
      case "serverWentOffline":
        await presence.setOffline();
        break;
      case "playerJoined":
        await feed.announceJoin(event.name);
        break;
      case "playerLeft":
        await feed.announceLeave(event.name);
        break;
    }
  });

  monitor.start();
  logger.info("monitoring démarré", {
    target: `${config.mcHost}:${config.mcPort}`,
    intervalMs: config.pollIntervalMs,
  });

  const shutdown = (): void => {
    logger.info("arrêt en cours");
    monitor.stop();
    void client.destroy();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  logger.error("échec au démarrage", { error });
  process.exit(1);
});
