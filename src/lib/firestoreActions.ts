
"use server";
import { doc, setDoc, getDoc, updateDoc, serverTimestamp, runTransaction, Timestamp, FieldValue, collection, addDoc, query, where, getDocs, orderBy, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { GameUser, Room, RiskLevel, GameState, GamePlayerState, PlayerAction } from "@/types";
import type { User as FirebaseUserType } from "firebase/auth";
import { MAX_LEVEL, ATTACK_UPGRADE_COSTS, DEFENSE_UPGRADE_COSTS, RECOVERY_BASE_STATS, MAX_TURNS, RESOURCE_THRESHOLD_PERCENT } from "./gameConfig";

const USER_COLLECTION = "users";
const ROOMS_COLLECTION = "rooms";
const GAMES_COLLECTION = "games";


const buildGameUserFromData = (userId: string, data: any = {}): GameUser => {
  const profile: GameUser = {
    uid: data.uid || userId,
    email: data.email !== undefined ? data.email : null,
    displayName: data.displayName !== undefined ? data.displayName : "Anonymous Warlord",
    photoURL: data.photoURL !== undefined ? data.photoURL : null,
    gold: typeof data.gold === 'number' ? data.gold : RECOVERY_BASE_STATS.gold,
    military: typeof data.military === 'number' ? data.military : RECOVERY_BASE_STATS.military,
    resources: typeof data.resources === 'number' ? data.resources : RECOVERY_BASE_STATS.resources,
    attackLevel: typeof data.attackLevel === 'number' ? data.attackLevel : 1,
    defenseLevel: typeof data.defenseLevel === 'number' ? data.defenseLevel : 1,
    wins: typeof data.wins === 'number' ? data.wins : 0,
    losses: typeof data.losses === 'number' ? data.losses : 0,
    inRecoveryMode: typeof data.inRecoveryMode === 'boolean' ? data.inRecoveryMode : false,
    recoveryProgress: (data.recoveryProgress &&
                        typeof data.recoveryProgress.successfulAttacks === 'number' &&
                        typeof data.recoveryProgress.successfulDefenses === 'number')
                      ? { successfulAttacks: data.recoveryProgress.successfulAttacks, successfulDefenses: data.recoveryProgress.successfulDefenses }
                      : { successfulAttacks: 0, successfulDefenses: 0 },
    rank: data.rank !== undefined ? data.rank : null,
    xp: typeof data.xp === 'number' ? data.xp : 0,
    createdAt: data.createdAt || serverTimestamp(),
    updatedAt: data.updatedAt || serverTimestamp(),
  };
  return profile;
};

export async function getUserProfile(userId: string): Promise<GameUser | null> {
  try {
    const userDocRef = doc(db, USER_COLLECTION, userId);
    const userDocSnap = await getDoc(userDocRef);
    if (userDocSnap.exists()) {
      return buildGameUserFromData(userId, userDocSnap.data());
    }
    return null;
  } catch (error) {
    console.error(`Error fetching user profile for ${userId}:`, error);
    if (error instanceof Error) {
        throw new Error(`Firestore error getting profile for ${userId}: ${error.message}`);
    }
    throw new Error(`Failed to fetch user profile for ${userId} due to an unknown server error.`);
  }
}

export async function createUserProfile(firebaseUser: FirebaseUserType): Promise<GameUser> {
  const userProfileRef = doc(db, USER_COLLECTION, firebaseUser.uid);
  try {
    const existingProfileSnap = await getDoc(userProfileRef);
    let finalDataForFirestore: { [key: string]: any };
    
    if (existingProfileSnap.exists()) {
      const currentData = buildGameUserFromData(firebaseUser.uid, existingProfileSnap.data());
      const updates: { [key: string]: any | FieldValue } = {updatedAt: serverTimestamp()};
      let changed = false;

      if (firebaseUser.displayName && firebaseUser.displayName !== currentData.displayName) {
        updates.displayName = firebaseUser.displayName;
        changed = true;
      }
      if (firebaseUser.email && firebaseUser.email !== currentData.email) {
        updates.email = firebaseUser.email;
        changed = true;
      }
      if (firebaseUser.photoURL !== currentData.photoURL) { 
         updates.photoURL = firebaseUser.photoURL || null;
         changed = true;
      }
      
      finalDataForFirestore = changed ? updates : { updatedAt: serverTimestamp() }; // Ensure updatedAt is always set
      Object.keys(finalDataForFirestore).forEach(key => {
        if (finalDataForFirestore[key] === undefined) finalDataForFirestore[key] = null;
      });
      await updateDoc(userProfileRef, finalDataForFirestore);
    } else {
      const newProfileData = buildGameUserFromData(firebaseUser.uid, {
        email: firebaseUser.email || null,
        displayName: firebaseUser.displayName || "Anonymous Warlord",
        photoURL: firebaseUser.photoURL || null,
        gold: RECOVERY_BASE_STATS.gold,
        military: RECOVERY_BASE_STATS.military,
        resources: RECOVERY_BASE_STATS.resources,
      });
      finalDataForFirestore = { 
        ...newProfileData, 
        createdAt: serverTimestamp(), // Set upon creation
        updatedAt: serverTimestamp(),
      };
      
      Object.keys(finalDataForFirestore).forEach(key => {
        if (finalDataForFirestore[key] === undefined) finalDataForFirestore[key] = null;
      });
      await setDoc(userProfileRef, finalDataForFirestore);
    }
    
    const finalProfileSnap = await getDoc(userProfileRef);
    if (!finalProfileSnap.exists()) throw new Error("Profile could not be retrieved after create/update operation.");
    return buildGameUserFromData(firebaseUser.uid, finalProfileSnap.data());

  } catch (error: any) {
    console.error(`Error in createUserProfile for ${firebaseUser.uid}:`, error);
    throw new Error(`Failed to create or update user profile for ${firebaseUser.uid}: ${error.message || 'Unknown server error.'}`);
  }
}

export async function updateUserProfile(userId: string, data: Partial<GameUser>): Promise<void> {
  try {
    const userDocRef = doc(db, USER_COLLECTION, userId);
    const updateData: { [key: string]: any | FieldValue } = { ...data, updatedAt: serverTimestamp() };
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) updateData[key] = null;
    });
    await updateDoc(userDocRef, updateData);
  } catch (error) {
    console.error(`Error updating user profile for ${userId}:`, error);
    if (error instanceof Error) throw new Error(`Failed to update user profile: ${error.message}`);
    throw new Error(`Failed to update user profile due to an unknown server error.`);
  }
}

export async function performStatUpgrade(userId: string, statType: 'attack' | 'defense'): Promise<GameUser> {
  const userDocRef = doc(db, USER_COLLECTION, userId);
  try {
    const finalProfile = await runTransaction(db, async (transaction) => {
      const userSnap = await transaction.get(userDocRef);
      if (!userSnap.exists()) throw new Error("User profile not found. Cannot perform upgrade.");

      const gameUser = buildGameUserFromData(userId, userSnap.data());
      let currentLevel: number;
      let costsForNextLevel: { gold: number; resources: number; } | undefined;

      if (statType === 'attack') {
        currentLevel = gameUser.attackLevel;
        costsForNextLevel = ATTACK_UPGRADE_COSTS[currentLevel + 1];
      } else {
        currentLevel = gameUser.defenseLevel;
        costsForNextLevel = DEFENSE_UPGRADE_COSTS[currentLevel + 1];
      }

      if (currentLevel >= MAX_LEVEL) throw new Error(`Already at max ${statType} level.`);
      if (!costsForNextLevel) throw new Error(`No upgrade cost defined for ${statType} level ${currentLevel + 1}.`);
      if (gameUser.gold < costsForNextLevel.gold || gameUser.resources < costsForNextLevel.resources) {
        throw new Error("Insufficient Gold or Resources for upgrade.");
      }

      const updates: { [key: string]: any | FieldValue } = {
        gold: gameUser.gold - costsForNextLevel.gold,
        resources: gameUser.resources - costsForNextLevel.resources,
        [statType === 'attack' ? 'attackLevel' : 'defenseLevel']: currentLevel + 1,
        updatedAt: serverTimestamp(),
      };
      transaction.update(userDocRef, updates);
      // Return the updated user data structure for the calling function, 
      // but it won't have server-resolved timestamps yet.
      // The actual server-resolved data will be fetched after transaction.
      return { ...gameUser, ...updates, [statType === 'attack' ? 'attackLevel' : 'defenseLevel']: currentLevel + 1 };
    });
    
    // Fetch the profile again to get server-resolved timestamps
    const finalProfileSnap = await getDoc(userDocRef);
    if (!finalProfileSnap.exists()) throw new Error("Profile vanished after upgrade transaction.");
    return buildGameUserFromData(userId, finalProfileSnap.data());

  } catch (error: any) {
    console.error(`Error upgrading ${statType} for user ${userId}:`, error);
    if (error.message.startsWith("User profile not found") ||
        error.message.startsWith("Already at max") ||
        error.message.startsWith("No upgrade cost defined") ||
        error.message.startsWith("Insufficient Gold or Resources")) {
        throw error;
    }
    throw new Error(`Failed to upgrade ${statType}. Please try again.`);
  }
}

// Room Actions
export async function createRoom(
  userId: string,
  hostDisplayName: string | null,
  roomName: string,
  riskLevel: RiskLevel,
  isPublic: boolean
): Promise<string> { // Returns room ID
  try {
    const roomData: Omit<Room, 'id'> = {
      name: roomName,
      riskLevel,
      isPublic,
      createdBy: userId,
      hostDisplayName: hostDisplayName || "Anonymous Host",
      status: "WAITING", // Initial status
      playerIds: [userId], // Host is the first player
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    const newRoomRef = await addDoc(collection(db, ROOMS_COLLECTION), roomData);
    return newRoomRef.id;
  } catch (error: any) {
    console.error("Error creating room:", error);
    throw new Error(error.message || "Could not create the room on the server.");
  }
}

// Game State Actions

async function createGameFromRoom(roomId: string, roomData: Room, player1Profile: GameUser, player2Profile: GameUser): Promise<string> {
  const gameId = roomId; // Often gameId is the same as roomId for simplicity
  const gameDocRef = doc(db, GAMES_COLLECTION, gameId);

  const player1GameState: GamePlayerState = {
    uid: player1Profile.uid,
    displayName: player1Profile.displayName,
    initialAttackLevel: player1Profile.attackLevel,
    initialDefenseLevel: player1Profile.defenseLevel,
    gold: player1Profile.gold,
    military: player1Profile.military,
    resources: player1Profile.resources,
    hasSubmittedAction: false,
  };

  const player2GameState: GamePlayerState = {
    uid: player2Profile.uid,
    displayName: player2Profile.displayName,
    initialAttackLevel: player2Profile.attackLevel,
    initialDefenseLevel: player2Profile.defenseLevel,
    gold: player2Profile.gold,
    military: player2Profile.military,
    resources: player2Profile.resources,
    hasSubmittedAction: false,
  };

  const newGameState: Omit<GameState, "id"> = {
    roomId: roomId,
    gameMode: "ROOM_MATCH", // Assuming from room context
    players: {
      [player1Profile.uid]: player1GameState,
      [player2Profile.uid]: player2GameState,
    },
    playerIds: [player1Profile.uid, player2Profile.uid], // Ensure order matches roomData if needed
    status: "CHOOSING_ACTIONS",
    currentTurn: 1,
    maxTurns: MAX_TURNS,
    riskLevel: roomData.riskLevel,
    turnHistory: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    startedAt: serverTimestamp(),
  };

  try {
    await setDoc(gameDocRef, newGameState);
    return gameId;
  } catch (error: any) {
    console.error(`Error creating game state for room ${roomId}:`, error);
    throw new Error(`Failed to initialize game: ${error.message}`);
  }
}


export async function joinRoom(roomId: string, userId: string, userDisplayName: string): Promise<string | null> { // Returns gameId if created, else null
  const roomRef = doc(db, ROOMS_COLLECTION, roomId);
  const userProfile = await getUserProfile(userId);
  if (!userProfile) throw new Error("Your profile was not found. Cannot join room.");

  try {
    return await runTransaction(db, async (transaction) => {
      const roomSnap = await transaction.get(roomRef);
      if (!roomSnap.exists()) {
        throw new Error("Room not found or has been closed.");
      }
      const roomData = roomSnap.data() as Room;

      if (roomData.playerIds.includes(userId)) {
        console.warn(`User ${userId} is already in room ${roomId}.`);
        return roomData.gameId || null; // Already in, return existing gameId if any
      }

      if (roomData.playerIds.length >= 2) {
        throw new Error("Room is already full.");
      }
      if (roomData.status !== "WAITING") {
        throw new Error("Room is not available for joining.");
      }

      const hostProfile = await getUserProfile(roomData.createdBy); // Fetch host profile for game creation
      if (!hostProfile) throw new Error("Host profile could not be loaded. Cannot start game.");

      const updatedPlayerIds = [...roomData.playerIds, userId];
      let newGameId: string | null = null;

      if (updatedPlayerIds.length === 2) {
        // Room is now full, create the game state
        newGameId = await createGameFromRoom(roomId, roomData, hostProfile, userProfile);
        transaction.update(roomRef, {
          playerIds: updatedPlayerIds,
          status: "IN_GAME", // Set to IN_GAME as game is created
          gameId: newGameId,
          updatedAt: serverTimestamp(),
        });
      } else {
        // Still waiting for one more player
        transaction.update(roomRef, {
          playerIds: updatedPlayerIds,
          updatedAt: serverTimestamp(),
        });
      }
      return newGameId; // This will be the gameId if created, or null
    });
  } catch (error: any) {
    console.error(`Error joining room ${roomId} for user ${userId}:`, error);
    throw new Error(error.message || "Could not join the room due to a server error.");
  }
}


export async function submitPlayerAction(gameId: string, playerId: string, action: PlayerAction): Promise<void> {
  const gameDocRef = doc(db, GAMES_COLLECTION, gameId);
  try {
    // Atomically update the player's action and check if both players have submitted
    await runTransaction(db, async (transaction) => {
      const gameSnap = await transaction.get(gameDocRef);
      if (!gameSnap.exists()) throw new Error("Game not found.");
      
      const gameState = gameSnap.data() as GameState;
      if (gameState.status !== "CHOOSING_ACTIONS") throw new Error("Not in action selection phase.");
      if (gameState.players[playerId]?.hasSubmittedAction) throw new Error("Action already submitted for this turn.");

      const playerUpdatePath = `players.${playerId}.currentAction`;
      const playerHasSubmittedPath = `players.${playerId}.hasSubmittedAction`;
      
      transaction.update(gameDocRef, {
        [playerUpdatePath]: action,
        [playerHasSubmittedPath]: true,
        updatedAt: serverTimestamp(),
      });

      // Check if the other player has also submitted.
      // This logic ideally triggers a Cloud Function for turn processing.
      // For now, it's a client-side check that would require one client to initiate.
      const otherPlayerId = gameState.playerIds.find(id => id !== playerId);
      if (otherPlayerId && gameState.players[otherPlayerId]?.hasSubmittedAction) {
        // Both players have submitted.
        // Here, you would typically trigger a Cloud Function.
        // For now, we can log or set a flag, but true processing is server-side.
        console.log(`Both players in game ${gameId} have submitted actions. Turn processing should be triggered.`);
        // transaction.update(gameDocRef, { status: "PROCESSING_TURN" }); // Example: if client could trigger
      }
    });

  } catch (error: any) {
    console.error(`Error submitting action for game ${gameId}, player ${playerId}:`, error);
    throw new Error(error.message || "Failed to submit action.");
  }
}

// PLACEHOLDER for turn processing. This should be a Cloud Function.
export async function processTurn(gameId: string): Promise<void> {
  console.warn(`processTurn called for game ${gameId}. This should be a secure server-side operation (e.g., Cloud Function).`);
  const gameDocRef = doc(db, GAMES_COLLECTION, gameId);

  try {
    await runTransaction(db, async (transaction) => {
      const gameSnap = await transaction.get(gameDocRef);
      if (!gameSnap.exists()) throw new Error("Game not found for processing.");
      let gameState = gameSnap.data() as GameState;

      // Ensure both players have submitted (double check, though submitPlayerAction should gate this)
      const player1 = gameState.players[gameState.playerIds[0]!];
      const player2 = gameState.players[gameState.playerIds[1]!];
      if (!player1.hasSubmittedAction || !player2.hasSubmittedAction || !player1.currentAction || !player2.currentAction) {
        console.log("Turn processing skipped: Not all players have submitted actions.");
        // Potentially reset status if it was stuck in PROCESSING_TURN incorrectly
        // transaction.update(gameDocRef, { status: "CHOOSING_ACTIONS", updatedAt: serverTimestamp() });
        return; 
      }

      // 1. Mark as processing
      transaction.update(gameDocRef, { status: "PROCESSING_TURN", updatedAt: serverTimestamp() });
      // Simulate getting the latest state after update
      // In a real CF, you'd work with the state read at the start of the transaction or re-read if needed.
      gameState.status = "PROCESSING_TURN";


      // --- CORE GAME LOGIC SIMPLIFIED PLACEHOLDER ---
      // This section needs to implement the full logic from GDD sections 4, 8, 9, 10.
      // For now, it's a very basic comparison and log.

      const p1Action = player1.currentAction!;
      const p2Action = player2.currentAction!;
      
      let p1AttackBlocked = false;
      let p2AttackBlocked = false;

      // Player 1 attacks Player 2
      if (p1Action.attack === DefenseType.BARRICADE_TROOPS && p2Action.defense === DefenseType.BARRICADE_TROOPS) p1AttackBlocked = true;
      if (p1Action.attack === DefenseType.SECURE_STORAGE && p2Action.defense === DefenseType.SECURE_STORAGE) p1AttackBlocked = true;
      if (p1Action.attack === DefenseType.GOLD_SENTINEL && p2Action.defense === DefenseType.GOLD_SENTINEL) p1AttackBlocked = true;
      
      // Player 2 attacks Player 1
      if (p2Action.attack === DefenseType.BARRICADE_TROOPS && p1Action.defense === DefenseType.BARRICADE_TROOPS) p2AttackBlocked = true;
      if (p2Action.attack === DefenseType.SECURE_STORAGE && p1Action.defense === DefenseType.SECURE_STORAGE) p2AttackBlocked = true;
      if (p2Action.attack === DefenseType.GOLD_SENTINEL && p1Action.defense === DefenseType.GOLD_SENTINEL) p2AttackBlocked = true;

      const turnResult: TurnResult = {
        turnNumber: gameState.currentTurn,
        playerActions: { [player1.uid]: p1Action, [player2.uid]: p2Action },
        effects: [], // To be populated by detailed game logic
        newResourceTotals: { // To be updated by detailed game logic
          [player1.uid]: { gold: player1.gold, military: player1.military, resources: player1.resources },
          [player2.uid]: { gold: player2.gold, military: player2.military, resources: player2.resources },
        }
      };
      
      // Example effect message (very simplified)
      turnResult.effects.push({
        actingPlayerId: player1.uid, targetPlayerId: player2.uid, actionType: 'ATTACK',
        attackType: p1Action.attack, defenseType: p2Action.defense, isBlocked: p1AttackBlocked,
        resourceChanges: {}, attackerResourceGains: {},
        message: `${player1.displayName}'s ${p1Action.attack} vs ${player2.displayName}'s ${p2Action.defense}. Blocked: ${p1AttackBlocked}`
      });
       turnResult.effects.push({
        actingPlayerId: player2.uid, targetPlayerId: player1.uid, actionType: 'ATTACK',
        attackType: p2Action.attack, defenseType: p1Action.defense, isBlocked: p2AttackBlocked,
        resourceChanges: {}, attackerResourceGains: {},
        message: `${player2.displayName}'s ${p2Action.attack} vs ${player1.displayName}'s ${p1Action.defense}. Blocked: ${p2AttackBlocked}`
      });
      
      // --- END OF SIMPLIFIED PLACEHOLDER ---

      // Update game state after processing
      const updates: Partial<GameState> = {
        currentTurn: gameState.currentTurn + 1,
        status: "CHOOSING_ACTIONS", // Default next state
        turnHistory: [...gameState.turnHistory, turnResult],
        players: {
          ...gameState.players,
          [player1.uid]: { ...player1, hasSubmittedAction: false, currentAction: null },
          [player2.uid]: { ...player2, hasSubmittedAction: false, currentAction: null },
        },
        updatedAt: serverTimestamp(),
      };

      // Check for game over conditions (Simplified placeholder)
      // This needs to check resource thresholds based on GDD Section 2
      // (e.g., any resource < 50 (absolute) or 50% of initial if initial values can vary)
      // For now, let's use an absolute 50 as per GDD.
      const player1Lost = player1.gold < 50 || player1.military < 50 || player1.resources < 50;
      const player2Lost = player2.gold < 50 || player2.military < 50 || player2.resources < 50;

      if (player1Lost && player2Lost) {
        updates.status = "GAME_OVER";
        updates.winnerId = "DRAW";
        updates.winningCondition = "Both players fell below resource threshold simultaneously.";
        updates.endedAt = serverTimestamp();
      } else if (player1Lost) {
        updates.status = "GAME_OVER";
        updates.winnerId = player2.uid;
        updates.winningCondition = `${player1.displayName} fell below resource threshold.`;
        updates.endedAt = serverTimestamp();
      } else if (player2Lost) {
        updates.status = "GAME_OVER";
        updates.winnerId = player1.uid;
        updates.winningCondition = `${player2.displayName} fell below resource threshold.`;
        updates.endedAt = serverTimestamp();
      } else if (gameState.currentTurn +1 > MAX_TURNS) {
         updates.status = "GAME_OVER";
         // Determine winner by total resources (placeholder sum)
         const p1Total = player1.gold + player1.military + player1.resources;
         const p2Total = player2.gold + player2.military + player2.resources;
         if (p1Total > p2Total) updates.winnerId = player1.uid;
         else if (p2Total > p1Total) updates.winnerId = player2.uid;
         else updates.winnerId = "DRAW";
         updates.winningCondition = "Max turns reached.";
         updates.endedAt = serverTimestamp();
      }
      
      // If game is over, update user profiles (wins/losses, recovery mode)
      if (updates.status === "GAME_OVER") {
        const batch = writeBatch(db);
        const p1ProfileRef = doc(db, USER_COLLECTION, player1.uid);
        const p2ProfileRef = doc(db, USER_COLLECTION, player2.uid);

        if (updates.winnerId === player1.uid) {
          batch.update(p1ProfileRef, { wins: player1Profile.wins + 1, updatedAt: serverTimestamp() });
          batch.update(p2ProfileRef, { losses: player2Profile.losses + 1, updatedAt: serverTimestamp() });
          // Check if player2 needs recovery
          if (player2Lost) batch.update(p2ProfileRef, { inRecoveryMode: true, recoveryProgress: { successfulAttacks: 0, successfulDefenses: 0 } });
        } else if (updates.winnerId === player2.uid) {
          batch.update(p2ProfileRef, { wins: player2Profile.wins + 1, updatedAt: serverTimestamp() });
          batch.update(p1ProfileRef, { losses: player1Profile.losses + 1, updatedAt: serverTimestamp() });
           // Check if player1 needs recovery
          if (player1Lost) batch.update(p1ProfileRef, { inRecoveryMode: true, recoveryProgress: { successfulAttacks: 0, successfulDefenses: 0 } });
        } else { // Draw
          // Optionally handle draws for stats
        }
        await batch.commit();
      }


      transaction.update(gameDocRef, updates);
    });
  } catch (error: any) {
    console.error(`Error processing turn for game ${gameId}:`, error);
    // Potentially reset status to CHOOSING_ACTIONS if processing fails critically
    await updateDoc(gameDocRef, { status: "CHOOSING_ACTIONS", updatedAt: serverTimestamp(), turnProcessingError: error.message });
    throw new Error(error.message || "Failed to process turn.");
  }
}

// Get a specific game's state (not real-time, for one-off reads if needed by server actions)
export async function getGame(gameId: string): Promise<GameState | null> {
    const gameDocRef = doc(db, GAMES_COLLECTION, gameId);
    const gameSnap = await getDoc(gameDocRef);
    if (gameSnap.exists()) {
        return gameSnap.data() as GameState;
    }
    return null;
}
