import type { User as FirebaseUser } from "firebase/auth";

export interface GameUser extends FirebaseUser {
  // FirebaseUser already has uid, email, displayName, photoURL
  gold: number;
  military: number;
  resources: number;
  attackLevel: number;
  defenseLevel: number;
  wins: number;
  losses: number;
  rank?: string; // Optional, can be developed later
  xp?: number;   // Optional
  inRecoveryMode: boolean;
  recoveryProgress: {
    successfulAttacks: number;
    successfulDefenses: number;
  };
}

export type GameMode = "TRAINING" | "QUICK_WAR" | "ROOM_MATCH";
export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

export enum AttackType {
  RAID_CAMP = "RAID_CAMP", // Target: Military
  RESOURCE_HIJACK = "RESOURCE_HIJACK", // Target: Resources
  VAULT_BREAK = "VAULT_BREAK", // Target: Gold
}

export enum DefenseType {
  BARRICADE_TROOPS = "BARRICADE_TROOPS", // Defends: Raid Camp
  SECURE_STORAGE = "SECURE_STORAGE", // Defends: Resource Hijack
  GOLD_SENTINEL = "GOLD_SENTINEL", // Defends: Vault Break
}

export interface PlayerAction {
  attack: AttackType;
  defense: DefenseType;
}

export interface TurnResult {
  turnNumber: number;
  playerActions: { [playerId: string]: PlayerAction };
  outcome: string; // e.g., "Player1's Raid Camp was successful!", "Player2's Vault Break was blocked."
  resourceChanges: { [playerId: string]: { gold?: number; military?: number; resources?: number } };
}

export interface GameState {
  id: string;
  players: {
    [playerId: string]: {
      id: string;
      displayName: string | null;
      // Store initial resources for this game, actual current resources are tied to GameUser profile
      // but could be snapshotted or delta-tracked here if needed for game history.
      // For simplicity, we'll fetch GameUser for current stats.
      currentAction?: PlayerAction;
      hasSubmittedAction: boolean;
    };
  };
  playerIds: [string, string | null]; // [player1Id, player2Id (null if AI or waiting)]
  status: "WAITING" | "ACTIVE" | "RECOVERY_PLAYER_1" | "RECOVERY_PLAYER_2" | "FINISHED";
  currentTurn: number;
  maxTurns: number;
  riskLevel: RiskLevel;
  turnHistory: TurnResult[];
  winner?: string | null; // playerId or 'DRAW' or null if ongoing
  createdAt: number; // timestamp
  updatedAt: number; // timestamp
}

export interface Room {
  id: string;
  name: string;
  riskLevel: RiskLevel;
  isPublic: boolean;
  createdBy: string; // userId
  status: "WAITING" | "FULL" | "IN_GAME";
  players: string[]; // list of userIds
  gameId?: string; // Associated gameId when match starts
}
