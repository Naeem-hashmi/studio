
"use server";
import { doc, setDoc, getDoc, updateDoc, serverTimestamp, runTransaction, Timestamp, FieldValue, collection, addDoc, query, where, getDocs, orderBy, writeBatch, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { GameUser, Room, RiskLevel, GameState, GamePlayerState, PlayerAction, TurnResult, AttackType, DefenseType } from "@/types";
import type { User as FirebaseUserType } from "firebase/auth";
import { MAX_LEVEL, ATTACK_UPGRADE_COSTS, DEFENSE_UPGRADE_COSTS, RECOVERY_BASE_STATS, MAX_TURNS, RESOURCE_THRESHOLD_PERCENT, BLOCKED_ATTACK_PENALTY_PERCENT, SUCCESSFUL_ATTACK_GAIN_SHARE_PERCENT, RISK_LEVEL_EFFECTS } from "./gameConfig";


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
      
      finalDataForFirestore = changed ? updates : { updatedAt: serverTimestamp() }; 
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
        createdAt: serverTimestamp(), 
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
      let costsForNextLevel: { gold: number; resources: number } | undefined;

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
      return { ...gameUser, ...updates, [statType === 'attack' ? 'attackLevel' : 'defenseLevel']: currentLevel + 1 };
    });
    
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
      status: "WAITING",
      playerIds: [userId], 
      playerDisplayNames: {[userId]: hostDisplayName || "Anonymous Host"},
      gameId: null,
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

// Internal function to create game state
async function createGameFromRoomTransaction(
  transaction: any,
  roomId: string,
  roomData: Room,
  player1Profile: GameUser,
  player2Profile: GameUser
): Promise<string> {
  const gameId = roomId; // Game ID is the same as Room ID
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
    gameMode: "ROOM_MATCH",
    players: {
      [player1Profile.uid]: player1GameState,
      [player2Profile.uid]: player2GameState,
    },
    playerIds: [player1Profile.uid, player2Profile.uid],
    status: "CHOOSING_ACTIONS",
    currentTurn: 1,
    maxTurns: MAX_TURNS,
    riskLevel: roomData.riskLevel,
    turnHistory: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    startedAt: serverTimestamp(),
  };

  transaction.set(gameDocRef, newGameState);
  return gameId;
}

export async function joinRoom(roomId: string, userId: string, userDisplayName: string): Promise<string | null> {
  const roomRef = doc(db, ROOMS_COLLECTION, roomId);
  const joiningUserProfile = await getUserProfile(userId);
  if (!joiningUserProfile) throw new Error("Your profile was not found. Cannot join room.");

  try {
    return await runTransaction(db, async (transaction) => {
      const roomSnap = await transaction.get(roomRef);
      if (!roomSnap.exists()) {
        throw new Error("Room not found or has been closed.");
      }
      const roomData = roomSnap.data() as Room;

      if (roomData.playerIds.includes(userId)) {
        console.warn(`User ${userId} is already in room ${roomId}.`);
        return roomData.gameId || roomId; 
      }

      if (roomData.playerIds.length >= 2) {
        throw new Error("Room is already full.");
      }
      if (roomData.status !== "WAITING") {
        throw new Error("Room is not available for joining.");
      }

      const hostProfile = await getUserProfile(roomData.createdBy);
      if (!hostProfile) throw new Error("Host profile could not be loaded. Cannot start game.");

      const updatedPlayerIds = [...roomData.playerIds, userId];
      const updatedPlayerDisplayNames = {
        ...roomData.playerDisplayNames,
        [userId]: userDisplayName
      };
      let newGameId: string | null = null;

      if (updatedPlayerIds.length === 2) { // Second player joining, create the game
        newGameId = await createGameFromRoomTransaction(transaction, roomId, roomData, hostProfile, joiningUserProfile);
        transaction.update(roomRef, {
          playerIds: updatedPlayerIds,
          playerDisplayNames: updatedPlayerDisplayNames,
          status: "IN_GAME",
          gameId: newGameId,
          updatedAt: serverTimestamp(),
        });
      } else { // This case should ideally not be hit if the first player creates the room correctly
         transaction.update(roomRef, {
            playerIds: updatedPlayerIds,
            playerDisplayNames: updatedPlayerDisplayNames,
            updatedAt: serverTimestamp(),
        });
      }
      
      return newGameId || roomId; // Return gameId if created, otherwise roomId for lobby
    });
  } catch (error: any) {
    console.error(`Error joining room ${roomId} for user ${userId}:`, error);
    throw new Error(error.message || "Could not join the room due to a server error.");
  }
}

export async function deleteRoom(roomId: string, userId: string): Promise<void> {
    const roomRef = doc(db, ROOMS_COLLECTION, roomId);
    // Game ID is the same as Room ID
    const gameRef = doc(db, GAMES_COLLECTION, roomId); 

    try {
        await runTransaction(db, async (transaction) => {
            const roomSnap = await transaction.get(roomRef);
            if (!roomSnap.exists()) {
                // If room doesn't exist, it might have been already deleted.
                // Check if a game document exists and delete it if user is host.
                const gameSnap = await transaction.get(gameRef);
                if (gameSnap.exists()) {
                    const gameState = gameSnap.data() as GameState;
                    // Find host from game state if possible, or assume only creator can delete orphaned games.
                    // This logic might need refinement based on how/when games are created vs rooms.
                    // For now, if room is gone, and user is trying to delete based on roomId,
                    // and game exists, let's assume they were host of related room.
                    // A stricter check would be needed if game could be created without room.createdBy.
                    if (gameState.playerIds.includes(userId)) { // Basic check, ideally check if userId was original room creator
                         transaction.delete(gameRef);
                    }
                }
                // console.log(`Room ${roomId} not found, likely already deleted.`);
                return; // Exit if room not found.
            }
            const roomData = roomSnap.data() as Room;

            if (roomData.createdBy !== userId) {
                throw new Error("Only the host can delete the room.");
            }
            // Allow deletion even if IN_GAME, but this means the game is aborted.
            // Or, strictly prevent as before:
            if (roomData.status === "IN_GAME") {
                 throw new Error("Cannot delete a room once the game has started. Abort the game instead if needed.");
            }


            transaction.delete(roomRef);

            // Also delete the associated game document if it exists
            const gameSnap = await transaction.get(gameRef);
            if (gameSnap.exists()) {
                transaction.delete(gameRef);
            }
        });
    } catch (error: any) {
        console.error(`Error deleting room ${roomId} by user ${userId}:`, error);
        throw new Error(error.message || "Could not delete the room.");
    }
}


export async function submitPlayerAction(gameId: string, playerId: string, action: PlayerAction): Promise<void> {
  const gameDocRef = doc(db, GAMES_COLLECTION, gameId);
  try {
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
    });

  } catch (error: any) {
    console.error(`Error submitting action for game ${gameId}, player ${playerId}:`, error);
    throw new Error(error.message || "Failed to submit action.");
  }
}

export async function processTurn(gameId: string): Promise<void> {
  const gameDocRef = doc(db, GAMES_COLLECTION, gameId);

  try {
    await runTransaction(db, async (transaction) => {
      const gameSnap = await transaction.get(gameDocRef);
      if (!gameSnap.exists()) throw new Error("Game not found for processing.");
      let gameState = gameSnap.data() as GameState;

      if (gameState.status !== "CHOOSING_ACTIONS" && gameState.status !== "PROCESSING_TURN") {
          console.warn(`Turn processing called for game ${gameId} but status is ${gameState.status}. Attempting to proceed if actions submitted.`);
      }
      
      const playerIds = gameState.playerIds;
      if (playerIds.length < 2 || !playerIds[0] || !playerIds[1]) {
          throw new Error("Game is missing players for processing.");
      }
      const p1Id = playerIds[0];
      const p2Id = playerIds[1];

      const player1 = gameState.players[p1Id]!;
      const player2 = gameState.players[p2Id]!;

      if (!player1.currentAction || !player2.currentAction || !player1.hasSubmittedAction || !player2.hasSubmittedAction) {
        console.log("Turn processing skipped for game:", gameId, "Not all players have submitted actions.");
        if(gameState.status === "PROCESSING_TURN") {
            transaction.update(gameDocRef, { status: "CHOOSING_ACTIONS", updatedAt: serverTimestamp() });
        }
        return;
      }
      
      if (gameState.status === "CHOOSING_ACTIONS") {
        transaction.update(gameDocRef, { status: "PROCESSING_TURN", updatedAt: serverTimestamp() });
        const updatedGameSnap = await transaction.get(gameDocRef);
        if (!updatedGameSnap.exists()) throw new Error("Game disappeared during processing update.");
        gameState = updatedGameSnap.data() as GameState;
      }


      const p1Action = player1.currentAction!;
      const p2Action = player2.currentAction!;
      
      let p1NewGold = player1.gold;
      let p1NewMilitary = player1.military;
      let p1NewResources = player1.resources;
      
      let p2NewGold = player2.gold;
      let p2NewMilitary = player2.military;
      let p2NewResources = player2.resources;

      const turnEffects: TurnResult['effects'] = [];

      const riskMultipliers = RISK_LEVEL_EFFECTS[gameState.riskLevel];
      const p1AttackUpgradeBonus = (player1.initialAttackLevel - 1) * 0.02;
      const p2AttackUpgradeBonus = (player2.initialAttackLevel - 1) * 0.02;
      const p1DefenseUpgradeBonus = (player1.initialDefenseLevel - 1) * 0.02;
      const p2DefenseUpgradeBonus = (player2.initialDefenseLevel - 1) * 0.02;


      let p1ResourceChangeForTarget = { gold: 0, military: 0, resources: 0 }; // Resource change ON P2 due to P1's attack
      let p1AttackerGain = { gold: 0, military: 0, resources: 0 }; // What P1 gains

      if ( (p1Action.attack === AttackType.RAID_CAMP && p2Action.defense === DefenseType.BARRICADE_TROOPS) ||
           (p1Action.attack === AttackType.RESOURCE_HIJACK && p2Action.defense === DefenseType.SECURE_STORAGE) ||
           (p1Action.attack === AttackType.VAULT_BREAK && p2Action.defense === DefenseType.GOLD_SENTINEL) ) {
        let penalty = 0;
        let message = `${player1.displayName}'s ${p1Action.attack} was blocked by ${player2.displayName}'s ${p2Action.defense}.`;
        const penaltyForAttacker = { gold: 0, military: 0, resources: 0 };
        if (p1Action.attack === AttackType.RAID_CAMP) { penalty = Math.round(player1.military * BLOCKED_ATTACK_PENALTY_PERCENT); p1NewMilitary -= penalty; penaltyForAttacker.military = -penalty; }
        else if (p1Action.attack === AttackType.RESOURCE_HIJACK) { penalty = Math.round(player1.resources * BLOCKED_ATTACK_PENALTY_PERCENT); p1NewResources -= penalty; penaltyForAttacker.resources = -penalty; }
        else if (p1Action.attack === AttackType.VAULT_BREAK) { penalty = Math.round(player1.gold * BLOCKED_ATTACK_PENALTY_PERCENT); p1NewGold -= penalty; penaltyForAttacker.gold = -penalty; }
        message += ` ${player1.displayName} loses ${penalty} of the targeted category.`;
        turnEffects.push({ actingPlayerId: p1Id, targetPlayerId: p2Id, actionType: 'ATTACK', attackType: p1Action.attack, defenseType: p2Action.defense, isBlocked: true, resourceChanges: {}, attackerResourceGains: penaltyForAttacker, message });
      } else { 
        let lossAmount = 0;
        let message = `${player1.displayName}'s ${p1Action.attack} succeeded against ${player2.displayName}!`;
        const baseLossPercent = Math.max(0.01, riskMultipliers.lossPercent + p1AttackUpgradeBonus - p2DefenseUpgradeBonus);
        
        if (p1Action.attack === AttackType.RAID_CAMP) { lossAmount = Math.round(player2.military * baseLossPercent); p2NewMilitary -= lossAmount; p1ResourceChangeForTarget.military = -lossAmount; p1AttackerGain.military = Math.round(lossAmount * SUCCESSFUL_ATTACK_GAIN_SHARE_PERCENT); p1NewMilitary += p1AttackerGain.military; }
        else if (p1Action.attack === AttackType.RESOURCE_HIJACK) { lossAmount = Math.round(player2.resources * baseLossPercent); p2NewResources -= lossAmount; p1ResourceChangeForTarget.resources = -lossAmount; p1AttackerGain.resources = Math.round(lossAmount * SUCCESSFUL_ATTACK_GAIN_SHARE_PERCENT); p1NewResources += p1AttackerGain.resources; }
        else if (p1Action.attack === AttackType.VAULT_BREAK) { lossAmount = Math.round(player2.gold * baseLossPercent); p2NewGold -= lossAmount; p1ResourceChangeForTarget.gold = -lossAmount; p1AttackerGain.gold = Math.round(lossAmount * SUCCESSFUL_ATTACK_GAIN_SHARE_PERCENT); p1NewGold += p1AttackerGain.gold; }
        message += ` ${player2.displayName} loses ${lossAmount}. ${player1.displayName} gains ${p1AttackerGain.gold || p1AttackerGain.military || p1AttackerGain.resources}.`;
        turnEffects.push({ actingPlayerId: p1Id, targetPlayerId: p2Id, actionType: 'ATTACK', attackType: p1Action.attack, defenseType: p2Action.defense, isBlocked: false, resourceChanges: p1ResourceChangeForTarget, attackerResourceGains: p1AttackerGain, message });
      }

      let p2ResourceChangeForTarget = { gold: 0, military: 0, resources: 0 }; // Resource change ON P1 due to P2's attack
      let p2AttackerGain = { gold: 0, military: 0, resources: 0 }; // What P2 gains

      if ( (p2Action.attack === AttackType.RAID_CAMP && p1Action.defense === DefenseType.BARRICADE_TROOPS) ||
           (p2Action.attack === AttackType.RESOURCE_HIJACK && p1Action.defense === DefenseType.SECURE_STORAGE) ||
           (p2Action.attack === AttackType.VAULT_BREAK && p1Action.defense === DefenseType.GOLD_SENTINEL) ) {
        let penalty = 0;
        let message = `${player2.displayName}'s ${p2Action.attack} was blocked by ${player1.displayName}'s ${p1Action.defense}.`;
        const penaltyForAttacker = { gold: 0, military: 0, resources: 0 };
        if (p2Action.attack === AttackType.RAID_CAMP) { penalty = Math.round(player2.military * BLOCKED_ATTACK_PENALTY_PERCENT); p2NewMilitary -= penalty; penaltyForAttacker.military = -penalty; }
        else if (p2Action.attack === AttackType.RESOURCE_HIJACK) { penalty = Math.round(player2.resources * BLOCKED_ATTACK_PENALTY_PERCENT); p2NewResources -= penalty; penaltyForAttacker.resources = -penalty; }
        else if (p2Action.attack === AttackType.VAULT_BREAK) { penalty = Math.round(player2.gold * BLOCKED_ATTACK_PENALTY_PERCENT); p2NewGold -= penalty; penaltyForAttacker.gold = -penalty; }
        message += ` ${player2.displayName} loses ${penalty} of the targeted category.`;
        turnEffects.push({ actingPlayerId: p2Id, targetPlayerId: p1Id, actionType: 'ATTACK', attackType: p2Action.attack, defenseType: p1Action.defense, isBlocked: true, resourceChanges: {}, attackerResourceGains: penaltyForAttacker, message });
      } else { 
        let lossAmount = 0;
        let message = `${player2.displayName}'s ${p2Action.attack} succeeded against ${player1.displayName}!`;
        const baseLossPercent = Math.max(0.01, riskMultipliers.lossPercent + p2AttackUpgradeBonus - p1DefenseUpgradeBonus);

        if (p2Action.attack === AttackType.RAID_CAMP) { lossAmount = Math.round(p1NewMilitary * baseLossPercent); p1NewMilitary -= lossAmount; p2ResourceChangeForTarget.military = -lossAmount; p2AttackerGain.military = Math.round(lossAmount * SUCCESSFUL_ATTACK_GAIN_SHARE_PERCENT); p2NewMilitary += p2AttackerGain.military; }
        else if (p2Action.attack === AttackType.RESOURCE_HIJACK) { lossAmount = Math.round(p1NewResources * baseLossPercent); p1NewResources -= lossAmount; p2ResourceChangeForTarget.resources = -lossAmount; p2AttackerGain.resources = Math.round(lossAmount * SUCCESSFUL_ATTACK_GAIN_SHARE_PERCENT); p2NewResources += p2AttackerGain.resources; }
        else if (p2Action.attack === AttackType.VAULT_BREAK) { lossAmount = Math.round(p1NewGold * baseLossPercent); p1NewGold -= lossAmount; p2ResourceChangeForTarget.gold = -lossAmount; p2AttackerGain.gold = Math.round(lossAmount * SUCCESSFUL_ATTACK_GAIN_SHARE_PERCENT); p2NewGold += p2AttackerGain.gold; }
        message += ` ${player1.displayName} loses ${lossAmount}. ${player2.displayName} gains ${p2AttackerGain.gold || p2AttackerGain.military || p2AttackerGain.resources}.`;
        turnEffects.push({ actingPlayerId: p2Id, targetPlayerId: p1Id, actionType: 'ATTACK', attackType: p2Action.attack, defenseType: p1Action.defense, isBlocked: false, resourceChanges: p2ResourceChangeForTarget, attackerResourceGains: p2AttackerGain, message });
      }
      
      p1NewGold = Math.max(0, p1NewGold); p1NewMilitary = Math.max(0, p1NewMilitary); p1NewResources = Math.max(0, p1NewResources);
      p2NewGold = Math.max(0, p2NewGold); p2NewMilitary = Math.max(0, p2NewMilitary); p2NewResources = Math.max(0, p2NewResources);
      
      const currentTurnResult: TurnResult = {
        turnNumber: gameState.currentTurn,
        playerActions: { [p1Id]: p1Action, [p2Id]: p2Action },
        effects: turnEffects,
        newResourceTotals: {
          [p1Id]: { gold: p1NewGold, military: p1NewMilitary, resources: p1NewResources },
          [p2Id]: { gold: p2NewGold, military: p2NewMilitary, resources: p2NewResources },
        }
      };

      const updates: Partial<GameState> = {
        currentTurn: gameState.currentTurn + 1,
        status: "CHOOSING_ACTIONS",
        turnHistory: [...gameState.turnHistory, currentTurnResult],
        players: {
          [p1Id]: { ...player1, gold: p1NewGold, military: p1NewMilitary, resources: p1NewResources, hasSubmittedAction: false, currentAction: null },
          [p2Id]: { ...player2, gold: p2NewGold, military: p2NewMilitary, resources: p2NewResources, hasSubmittedAction: false, currentAction: null },
        },
        updatedAt: serverTimestamp(),
      };

      const p1Lost = p1NewGold < 50 || p1NewMilitary < 50 || p1NewResources < 50;
      const p2Lost = p2NewGold < 50 || p2NewMilitary < 50 || p2NewResources < 50;
      let gameOver = false;
      let winnerId: string | "DRAW" | null = null;
      let winningCondition: string | undefined = undefined;


      if (p1Lost && p2Lost) {
        winnerId = "DRAW"; winningCondition = "Both players fell below resource threshold."; gameOver = true;
      } else if (p1Lost) {
        winnerId = p2Id; winningCondition = `${player1.displayName} fell below resource threshold.`; gameOver = true;
      } else if (p2Lost) {
        winnerId = p1Id; winningCondition = `${player2.displayName} fell below resource threshold.`; gameOver = true;
      } else if (gameState.currentTurn + 1 > MAX_TURNS) {
         const p1Total = p1NewGold + p1NewMilitary + p1NewResources;
         const p2Total = p2NewGold + p2NewMilitary + p2NewResources;
         if (p1Total > p2Total) winnerId = p1Id;
         else if (p2Total > p1Total) winnerId = p2Id;
         else winnerId = "DRAW";
         winningCondition = "Max turns reached. Highest total resources wins.";
         gameOver = true;
      }
      
      if (gameOver) {
        updates.status = "GAME_OVER";
        updates.winnerId = winnerId;
        updates.winningCondition = winningCondition;
        updates.endedAt = serverTimestamp();
        
        const p1ProfileSnap = await transaction.get(doc(db, USER_COLLECTION, p1Id));
        const p2ProfileSnap = await transaction.get(doc(db, USER_COLLECTION, p2Id));
        if (!p1ProfileSnap.exists() || !p2ProfileSnap.exists()) throw new Error("One or more player profiles not found for game end update.");

        const p1GameUser = buildGameUserFromData(p1Id, p1ProfileSnap.data());
        const p2GameUser = buildGameUserFromData(p2Id, p2ProfileSnap.data());

        const p1ProfileUpdate: Partial<GameUser> & {updatedAt: FieldValue} = { updatedAt: serverTimestamp() };
        const p2ProfileUpdate: Partial<GameUser> & {updatedAt: FieldValue} = { updatedAt: serverTimestamp() };

        if (winnerId === p1Id) {
          p1ProfileUpdate.wins = (p1GameUser.wins || 0) + 1;
          p2ProfileUpdate.losses = (p2GameUser.losses || 0) + 1;
          if (p2Lost) { p2ProfileUpdate.inRecoveryMode = true; p2ProfileUpdate.recoveryProgress = { successfulAttacks: 0, successfulDefenses: 0 }; }
        } else if (winnerId === p2Id) {
          p2ProfileUpdate.wins = (p2GameUser.wins || 0) + 1;
          p1ProfileUpdate.losses = (p1GameUser.losses || 0) + 1;
          if (p1Lost) { p1ProfileUpdate.inRecoveryMode = true; p1ProfileUpdate.recoveryProgress = { successfulAttacks: 0, successfulDefenses: 0 }; }
        }
        
        transaction.update(doc(db, USER_COLLECTION, p1Id), p1ProfileUpdate);
        transaction.update(doc(db, USER_COLLECTION, p2Id), p2ProfileUpdate);
        transaction.update(doc(db, ROOMS_COLLECTION, gameId), { status: "CLOSED", updatedAt: serverTimestamp() });
      }
      transaction.update(gameDocRef, updates);
    });
  } catch (error: any) {
    console.error(`Error processing turn for game ${gameId}:`, error);
    try {
      await updateDoc(gameDocRef, { status: "CHOOSING_ACTIONS", updatedAt: serverTimestamp(), turnProcessingError: error.message });
    } catch (updateError) {
        console.error(`Failed to reset game status after processing error for game ${gameId}:`, updateError)
    }
    throw new Error(error.message || "Failed to process turn.");
  }
}


export async function getGame(gameId: string): Promise<GameState | null> {
    const gameDocRef = doc(db, GAMES_COLLECTION, gameId);
    const gameSnap = await getDoc(gameDocRef);
    if (gameSnap.exists()) {
        const data = gameSnap.data();
        return { id: gameSnap.id, ...data } as GameState;
    }
    return null;
}

export async function getRoom(roomId: string): Promise<Room | null> {
    const roomDocRef = doc(db, ROOMS_COLLECTION, roomId);
    const roomSnap = await getDoc(roomDocRef);
    if (roomSnap.exists()) {
        return { id: roomSnap.id, ...roomSnap.data() } as Room;
    }
    return null;
}


    