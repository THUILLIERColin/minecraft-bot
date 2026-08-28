import { describe, it, expect } from "vitest";
import {
  encodePacket,
  decodePacket,
  PacketType,
} from "../src/rcon/protocol.js";

describe("RCON protocol", () => {
  it("encode la longueur, l'id et le type correctement", () => {
    const buffer = encodePacket({
      id: 42,
      type: PacketType.Command,
      payload: "list",
    });

    // longueur = 10 (header) + 4 ("list") = 14
    expect(buffer.readInt32LE(0)).toBe(14);
    expect(buffer.readInt32LE(4)).toBe(42);
    expect(buffer.readInt32LE(8)).toBe(PacketType.Command);
    expect(buffer.toString("ascii", 12, 16)).toBe("list");
    // total = 4 (champ longueur) + 14 = 18 octets
    expect(buffer.length).toBe(18);
  });

  it("encode puis décode sans perte (round-trip)", () => {
    const original = { id: 7, type: PacketType.Auth, payload: "secret" };
    const decoded = decodePacket(encodePacket(original));

    expect(decoded).not.toBeNull();
    expect(decoded?.packet).toEqual(original);
  });

  it("renvoie null si le buffer est incomplet", () => {
    const full = encodePacket({ id: 1, type: 0, payload: "hello" });
    const partial = full.subarray(0, full.length - 3);

    expect(decodePacket(partial)).toBeNull();
  });

  it("indique le nombre exact d'octets consommés", () => {
    const packet = encodePacket({ id: 1, type: 0, payload: "abc" });
    const withExtra = Buffer.concat([packet, Buffer.from([0xff, 0xff])]);

    const result = decodePacket(withExtra);
    expect(result?.bytesRead).toBe(packet.length);
  });

  it("gère un payload vide", () => {
    const decoded = decodePacket(encodePacket({ id: 5, type: 2, payload: "" }));
    expect(decoded?.packet.payload).toBe("");
  });
});
