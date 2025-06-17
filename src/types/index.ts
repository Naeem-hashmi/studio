
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
  rank: string | null; // Could be e.g., "Bronze", "Silver", "Gold"
  xp: number;
  inRecoveryMode: boolean;
  recoveryProgress: {
    successfulAttacks: number;
    successfulDefenses: number;
  };
  // Timestamps for user record
  createdAt?: Timestamp | FieldValue;
  updatedAt?: Timestamp | FieldValue;
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
  // timestamp: Timestamp | FieldValue; // When action was submitted
}

// Represents the state of a player within a specific game instance
export interface GamePlayerState {
  uid: string;
  displayName: string | null;
  initialAttackLevel: number; // Snapshot at game start
  initialDefenseLevel: number; // Snapshot at game start
  // Live resources for THIS game instance
  gold: number;
  military: number;
  resources: number;
  // Action for the current turn
  currentAction?: PlayerAction | null;
  hasSubmittedAction: boolean;
  isAI?: boolean; // For training mode
}

export interface TurnResult {
  turnNumber: number;
  playerActions: { [playerId: string]: PlayerAction }; // Actions taken by each player this turn
  effects: Array<{ // Detailed effects of actions
    actingPlayerId: string; // Player whose action is being described (attacker)
    targetPlayerId: string; // Player affected by the action
    actionType: 'ATTACK' | 'DEFENSE_EFFECT'; // Could expand
    attackType?: AttackType;
    defenseType?: DefenseType;
    isBlocked: boolean;
    resourceChanges: { // Net change for the targetPlayerId for THIS specific effect
      gold?: number; // e.g., -10 if target lost gold
      military?: number;
      resources?: number;
    };
    attackerResourceGains?: { // What the attacker gained from THIS specific successful attack
      gold?: number;
      military?: number;
      resources?: number;
    };
    message: string; // Descriptive message, e.g., "Player A's Raid Camp was blocked by Player B's Barricade!"
  }>;
  // Snapshot of resources AFTER this turn's effects are applied
  newResourceTotals: {
    [playerId: string]: { gold: number; military: number; resources: number; };
  };
  // Who, if anyone, entered recovery mode this turn
  enteredRecoveryMode?: string[];
}


export interface GameState {
  id: string; // Firestore document ID, should be unique for the game
  gameMode: GameMode;
  players: {
    [playerId: string]: GamePlayerState; // Keyed by player UID
  };
  playerIds: [string, string?]; // Tuple for one or two players. Second is optional until matched.
  status: "WAITING_FOR_PLAYERS" | "CHOOSING_ACTIONS" | "PROCESSING_TURN" | "GAME_OVER" | "ABORTED";
  currentTurn: number;
  maxTurns: number;
  riskLevel: RiskLevel;
  turnHistory: TurnResult[];
  winnerId?: string | "DRAW" | null; // UID of the winner, 'DRAW', or null if ongoing/aborted
  winningCondition?: string; // e.g., "Opponent resources depleted", "Max turns reached"
  // Timestamps for game lifecycle
  createdAt: Timestamp | FieldValue;
  updatedAt: Timestamp | FieldValue;
  startedAt?: Timestamp | FieldValue; // When game actually begins with 2 players
  endedAt?: Timestamp | FieldValue;
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
  // Timestamps for room lifecycle
  createdAt: Timestamp | FieldValue;
  updatedAt?: Timestamp | FieldValue;
}
