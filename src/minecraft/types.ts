export interface ServerState {
  online: boolean;
  playerCount: number;
  maxPlayers: number;
  players: string[];
}

export const OFFLINE_STATE: ServerState = {
  online: false,
  playerCount: 0,
  maxPlayers: 0,
  players: [],
};
