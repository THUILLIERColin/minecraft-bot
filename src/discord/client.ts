import { Client, GatewayIntentBits } from "discord.js";

/**
 * Crée un client Discord et résout quand il est prêt. Intents réduits au
 * minimum : on n'observe aucun message, on agit sur des salons connus par ID.
 */
export async function createDiscordClient(token: string): Promise<Client> {
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });

  await new Promise<void>((resolve, reject) => {
    client.once("clientReady", () => resolve());
    client.once("error", reject);
    client.login(token).catch(reject);
  });

  return client;
}
