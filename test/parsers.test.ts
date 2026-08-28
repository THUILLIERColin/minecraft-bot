import { describe, it, expect } from "vitest";
import { parsePlayerList, parseTps } from "../src/minecraft/parsers.js";

describe("parsePlayerList", () => {
  it("lit joueurs et maximum avec des noms", () => {
    const result = parsePlayerList(
      "There are 2 of a max of 20 players online: Alice, Bob",
    );
    expect(result).toEqual({ online: 2, max: 20, players: ["Alice", "Bob"] });
  });

  it("gère un serveur vide", () => {
    const result = parsePlayerList(
      "There are 0 of a max of 20 players online:",
    );
    expect(result).toEqual({ online: 0, max: 20, players: [] });
  });

  it("gère un seul joueur", () => {
    const result = parsePlayerList(
      "There are 1 of a max of 100 players online: Steve",
    );
    expect(result.players).toEqual(["Steve"]);
  });

  it("renvoie un résultat vide sur une sortie inattendue", () => {
    expect(parsePlayerList("Unknown command")).toEqual({
      online: 0,
      max: 0,
      players: [],
    });
  });
});

describe("parseTps", () => {
  it("extrait un TPS Paper", () => {
    expect(parseTps("TPS from last 1m, 5m, 15m: 19.98, 20.0, 20.0")).toBe(
      19.98,
    );
  });

  it("extrait un TPS Forge/NeoForge", () => {
    expect(parseTps("Overall: Mean tick time: 3.2 ms. Mean TPS: 20.0")).toBe(
      20.0,
    );
  });

  it("rejette une valeur hors bornes", () => {
    expect(parseTps("no number here")).toBeNull();
  });
});
