
import type { Timestamp, FieldValue } from "firebase/firestore";

export interface GameUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL?: string | null;
  gold: number;
  military: number;
  resources: number;
  attackLevel: number;
  defenseLevel: number;
  wins: number;
  losses: number;
  rank: string | null;
  xp: number;
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
  BARRICADE_TROOPS = "BARRICADE_TROOPS", // Defends against Raid Camp
  SECURE_STORAGE = "SECURE_STORAGE", // Defends against Resource Hijack
  GOLD_SENTINEL = "GOLD_SENTINEL", // Defends against Vault Break
}

export interface PlayerAction {
  playerId: string; 
  attack: AttackType;
  defense: DefenseType;
}

export interface TurnResult {
  turnNumber: number;
  playerActions: { [playerId: string]: PlayerAction }; 
  outcomeDetails: Array<{ 
    attackerId: string;
    targetId: string;
    attackType: AttackType;
    defenseType: DefenseType;
    isBlocked: boolean;
    message: string; 
  }>;
  resourceChanges: { 
    [playerId: string]: { 
      gold?: number; 
      military?: number; 
      resources?: number;
      xpGained?: number; 
    }
  };
  newResourceTotals?: { 
    [playerId: string]: { gold: number; military: number; resources: number; }
  };
}

export interface GameState {
  id: string; // Firestore document ID, could be same as roomId
  gameMode: GameMode;
  players: { 
    [playerId: string]: { // Keyed by player UID
      uid: string; 
      displayName: string | null;
      initialAttackLevel: number; // Snapshot at game start
      initialDefenseLevel: number; // Snapshot at game start
      // Live resources will be fetched from GameUser, but could be snapshotted here if needed.
      currentAction?: PlayerAction | null; 
      hasSubmittedAction: boolean;
      isAI?: boolean; 
      // Specific to game instance:
      gold: number; 
      military: number;
      resources: number;
    };
  };
  playerIds: [string, string]; // Tuple for exactly two players
  status: "WAITING_FOR_PLAYERS" | "CHOOSING_ACTIONS" | "PROCESSING_TURN" | "GAME_OVER" | "ABORTED";
  currentTurn: number;
  maxTurns: number; 
  riskLevel: RiskLevel;
  turnHistory: TurnResult[];
  winnerId?: string | null; // UID of the winner, 'DRAW', or null if ongoing/aborted
  winningCondition?: string; 
  createdAt: Timestamp | FieldValue; // Firestore serverTimestamp
  updatedAt: Timestamp | FieldValue;
  roomId: string; // Link back to the room this game originated from
}

export interface Room {
  id: string; // Firestore document ID
  name: string | null; // User-defined room name (for public rooms, can be null for private)
  riskLevel: RiskLevel;
  isPublic: boolean;
  createdBy: string; // UID of the player who created the room
  hostDisplayName: string | null; 
  status: "WAITING" | "FULL" | "IN_GAME" | "CLOSED" | "ABORTED"; // Room status
  playerIds: string[]; // List of UIDs of players currently in the room (max 2)
  gameId?: string | null; // Associated gameId when a match starts
  createdAt: Timestamp | FieldValue;
  updatedAt?: Timestamp | FieldValue;
}
