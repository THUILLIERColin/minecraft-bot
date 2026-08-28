export const PacketType = {
  Auth: 3,
  AuthResponse: 2,
  Command: 2,
  CommandResponse: 0,
} as const;

export interface RconPacket {
  id: number;
  type: number;
  payload: string;
}

const HEADER_SIZE = 10; // id (4) + type (4) + deux octets nuls de fin (2)

/**
 * Encode un paquet au format Source RCON.
 * Structure : [longueur i32 LE][id i32 LE][type i32 LE][payload ASCII][0x00][0x00]
 * La longueur annoncée couvre tout sauf ses propres 4 octets.
 */
export function encodePacket(packet: RconPacket): Buffer {
  const payload = Buffer.from(packet.payload, "ascii");
  const length = HEADER_SIZE + payload.length;
  const buffer = Buffer.alloc(4 + length);

  buffer.writeInt32LE(length, 0);
  buffer.writeInt32LE(packet.id, 4);
  buffer.writeInt32LE(packet.type, 8);
  payload.copy(buffer, 12);
  // Les deux derniers octets restent à 0x00 (Buffer.alloc les initialise).

  return buffer;
}

/**
 * Tente de décoder un paquet depuis le début du buffer.
 * Renvoie le paquet décodé et le nombre d'octets consommés, ou null si le
 * buffer ne contient pas encore un paquet complet (cas normal en TCP fragmenté).
 */
export function decodePacket(
  buffer: Buffer,
): { packet: RconPacket; bytesRead: number } | null {
  if (buffer.length < 4) return null;

  const length = buffer.readInt32LE(0);
  const totalSize = 4 + length;
  if (buffer.length < totalSize) return null;

  const id = buffer.readInt32LE(4);
  const type = buffer.readInt32LE(8);
  const payload = buffer.toString("ascii", 12, totalSize - 2);

  return { packet: { id, type, payload }, bytesRead: totalSize };
}
