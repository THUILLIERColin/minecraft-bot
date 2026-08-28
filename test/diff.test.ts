import { describe, it, expect } from "vitest";
import { diffStates } from "../src/monitor/diff.js";
import type { ServerState } from "../src/minecraft/types.js";

const offline: ServerState = {
  online: false,
  playerCount: 0,
  maxPlayers: 0,
  players: [],
};
const online = (players: string[]): ServerState => ({
  online: true,
  playerCount: players.length,
  maxPlayers: 20,
  players,
});

describe("diffStates", () => {
  it("émet serverWentOnline à la montée", () => {
    expect(diffStates(offline, online([]))).toEqual([
      { type: "serverWentOnline", playerCount: 0, maxPlayers: 20 },
    ]);
  });

  it("émet serverWentOffline à la chute", () => {
    expect(diffStates(online(["Bob"]), offline)).toEqual([
      { type: "serverWentOffline" },
    ]);
  });

  it("ne génère pas de faux départ quand le serveur s'éteint", () => {
    const events = diffStates(online(["Bob"]), offline);
    expect(events.some((e) => e.type === "playerLeft")).toBe(false);
  });

  it("détecte les arrivées et départs", () => {
    const events = diffStates(
      online(["Alice", "Bob"]),
      online(["Bob", "Carol"]),
    );
    expect(events).toContainEqual({ type: "playerJoined", name: "Carol" });
    expect(events).toContainEqual({ type: "playerLeft", name: "Alice" });
  });

  it("ne produit rien si rien ne change", () => {
    expect(diffStates(online(["Bob"]), online(["Bob"]))).toEqual([]);
  });
});
