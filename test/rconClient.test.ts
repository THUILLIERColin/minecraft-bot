import { describe, it, expect, afterEach } from "vitest";
import { createServer, type Server } from "node:net";
import {
  decodePacket,
  encodePacket,
  PacketType,
} from "../src/rcon/protocol.js";
import { RconClient, RconAuthError } from "../src/rcon/rconClient.js";

/**
 * Faux serveur RCON minimal qui parle le vrai protocole : il authentifie si le
 * mot de passe correspond, puis répond à `list` par une ligne type vanilla.
 */
function startFakeServer(password: string): Promise<{
  server: Server;
  port: number;
}> {
  const server = createServer((socket) => {
    let buffer = Buffer.alloc(0);
    socket.on("data", (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      for (;;) {
        const decoded = decodePacket(buffer);
        if (decoded === null) break;
        buffer = buffer.subarray(decoded.bytesRead);
        const { id, type, payload } = decoded.packet;

        if (type === PacketType.Auth) {
          const replyId = payload === password ? id : -1;
          socket.write(
            encodePacket({
              id: replyId,
              type: PacketType.AuthResponse,
              payload: "",
            }),
          );
        } else {
          socket.write(
            encodePacket({
              id,
              type: PacketType.CommandResponse,
              payload: "There are 2 of a max of 20 players online: Alice, Bob",
            }),
          );
        }
      }
    });
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address === null || typeof address === "string") {
        throw new Error("adresse serveur inattendue");
      }
      resolve({ server, port: address.port });
    });
  });
}

let active: Server | null = null;
afterEach(() => {
  active?.close();
  active = null;
});

describe("RconClient", () => {
  it("s'authentifie et exécute une commande", async () => {
    const { server, port } = await startFakeServer("secret");
    active = server;

    const client = new RconClient({
      host: "127.0.0.1",
      port,
      password: "secret",
    });
    await client.connect();

    const response = await client.send("list");
    expect(response).toContain("Alice, Bob");

    client.disconnect();
  });

  it("rejette un mot de passe incorrect", async () => {
    const { server, port } = await startFakeServer("secret");
    active = server;

    const client = new RconClient({
      host: "127.0.0.1",
      port,
      password: "wrong",
    });

    await expect(client.connect()).rejects.toBeInstanceOf(RconAuthError);
  });

  it("sérialise les commandes concurrentes", async () => {
    const { server, port } = await startFakeServer("secret");
    active = server;

    const client = new RconClient({
      host: "127.0.0.1",
      port,
      password: "secret",
    });
    await client.connect();

    const results = await Promise.all([
      client.send("list"),
      client.send("list"),
      client.send("list"),
    ]);

    expect(results).toHaveLength(3);
    for (const r of results) expect(r).toContain("Alice, Bob");

    client.disconnect();
  });
});
