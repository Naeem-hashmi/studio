
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
  createdAt?: Timestamp | FieldValue;
  updatedAt?: Timestamp | FieldValue;
}

export type GameMode = "TRAINING" | "QUICK_WAR" | "ROOM_MATCH";
export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

export enum AttackType {
  RAID_CAMP = "RAID_CAMP",
  RESOURCE_HIJACK = "RESOURCE_HIJACK",
  VAULT_BREAK = "VAULT_BREAK",
}

export enum DefenseType {
  BARRICADE_TROOPS = "BARRICADE_TROOPS",
  SECURE_STORAGE = "SECURE_STORAGE",
  GOLD_SENTINEL = "GOLD_SENTINEL",
}

export interface PlayerAction {
  playerId: string;
  attack: AttackType;
  defense: DefenseType;
}

export interface GamePlayerState {
  uid: string;
  displayName: string | null;
  initialAttackLevel: number;
  initialDefenseLevel: number;
  gold: number;
  military: number;
  resources: number;
  currentAction?: PlayerAction | null;
  hasSubmittedAction: boolean;
  isAI?: boolean;
}

export interface TurnResultEffect {
  actingPlayerId: string;
  targetPlayerId: string;
  actionType: 'ATTACK' | 'DEFENSE_EFFECT';
  attackType?: AttackType;
  defenseType?: DefenseType;
  isBlocked: boolean;
  resourceChanges: { // Net change for the targetPlayerId for THIS specific effect (negative for loss)
    gold?: number;
    military?: number;
    resources?: number;
  };
  attackerResourceGains?: { // What the attacker gained from THIS specific successful attack
    gold?: number;
    military?: number;
    resources?: number;
  };
  message: string;
}

export interface TurnResult {
  turnNumber: number;
  playerActions: { [playerId: string]: PlayerAction };
  effects: TurnResultEffect[];
  newResourceTotals: {
    [playerId: string]: { gold: number; military: number; resources: number; };
  };
  enteredRecoveryMode?: string[];
}

export interface GameState {
  id: string;
  gameMode: GameMode;
  players: {
    [playerId: string]: GamePlayerState;
  };
  playerIds: [string, string?]; 
  status: "WAITING_FOR_PLAYERS" | "CHOOSING_ACTIONS" | "PROCESSING_TURN" | "GAME_OVER" | "ABORTED";
  currentTurn: number;
  maxTurns: number;
  riskLevel: RiskLevel;
  turnHistory: TurnResult[];
  winnerId?: string | "DRAW" | null;
  winningCondition?: string;
  createdAt: Timestamp | FieldValue;
  updatedAt: Timestamp | FieldValue;
  startedAt?: Timestamp | FieldValue;
  endedAt?: Timestamp | FieldValue;
  roomId: string; // Link back to the room this game originated from
  turnProcessingError?: string | null; // For debugging if processing fails
}

export interface Room {
  id: string;
  name: string | null;
  riskLevel: RiskLevel;
  isPublic: boolean;
  createdBy: string;
  hostDisplayName: string | null;
  playerDisplayNames: {[playerId: string]: string | null }; // Store display names of players in room
  status: "WAITING" | "IN_GAME" | "CLOSED" | "ABORTED";
  playerIds: string[];
  gameId?: string | null; // ID of the GameState document, typically same as roomId
  createdAt: Timestamp | FieldValue;
  updatedAt?: Timestamp | FieldValue;
}
