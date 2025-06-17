
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
  playerId: string; // Add playerId to associate action with a player
  attack: AttackType;
  defense: DefenseType;
}

export interface TurnResult {
  turnNumber: number;
  playerActions: { [playerId: string]: PlayerAction }; // Actions submitted by each player for the turn
  outcomeDetails: Array<{ // More detailed outcomes
    attackerId: string;
    targetId: string;
    attackType: AttackType;
    defenseType: DefenseType;
    isBlocked: boolean;
    message: string; // e.g., "Player1's Raid Camp was successful!", "Player2's Vault Break was blocked."
  }>;
  resourceChanges: { // Delta changes for this turn
    [playerId: string]: { 
      gold?: number; 
      military?: number; 
      resources?: number;
      xpGained?: number; 
    }
  };
  newResourceTotals?: { // Optional: snapshot of totals after this turn for easier history display
    [playerId: string]: { gold: number; military: number; resources: number; }
  };
}

export interface GameState {
  id: string;
  gameMode: GameMode;
  players: { // Keyed by player UID
    [playerId: string]: {
      uid: string; // Firebase Auth UID
      displayName: string | null;
      initialAttackLevel: number;
      initialDefenseLevel: number;
      // Current resources are part of GameUser, but can be snapshotted here at game start if needed
      // For simplicity, we'll mostly rely on GameUser for live stats.
      // Game-specific state:
      currentAction?: PlayerAction | null; // Player's submitted action for the current turn
      hasSubmittedAction: boolean;
      isAI?: boolean; // Flag if this player is an AI
    };
  };
  playerIds: string[]; // Array of player UIDs in the game [player1Id, player2Id]
  status: "WAITING_FOR_PLAYERS" | "CHOOSING_ACTIONS" | "PROCESSING_TURN" | "GAME_OVER" | "ABORTED";
  currentTurn: number;
  maxTurns: number; // e.g., 20
  riskLevel: RiskLevel;
  turnHistory: TurnResult[];
  winnerId?: string | null; // UID of the winner, 'DRAW', or null if ongoing/aborted
  winningCondition?: string; // e.g., "RESOURCE_DEPLETION", "MAX_TURNS_REACHED", "OPPONENT_RESIGNED"
  createdAt: FieldValue | Timestamp; // Firestore serverTimestamp or Date
  updatedAt: FieldValue | Timestamp;
  // Optional fields based on game mode
  roomId?: string; // If it's a room match
}

export interface Room {
  id: string; // Firestore document ID
  name: string; // User-defined room name (for public rooms)
  riskLevel: RiskLevel;
  isPublic: boolean;
  createdBy: string; // UID of the player who created the room
  hostDisplayName: string | null; // Display name of the host
  status: "WAITING" | "FULL" | "IN_GAME" | "CLOSED"; // Room status
  playerIds: string[]; // List of UIDs of players currently in the room (max 2)
  gameId?: string | null; // Associated gameId when a match starts
  createdAt: FieldValue | Timestamp;
  // For private rooms, an invite code might be useful (not implemented yet)
  // inviteCode?: string; 
}
