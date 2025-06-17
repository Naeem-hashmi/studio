
"use server";
import { doc, setDoc, getDoc, updateDoc, serverTimestamp, runTransaction, Timestamp, FieldValue, collection, addDoc, query, where, getDocs, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { GameUser, Room, RiskLevel } from "@/types";
import type { User as FirebaseUserType } from "firebase/auth";
import { MAX_LEVEL, ATTACK_UPGRADE_COSTS, DEFENSE_UPGRADE_COSTS, RECOVERY_BASE_STATS } from "./gameConfig";

const USER_COLLECTION = "users";
const ROOMS_COLLECTION = "rooms";

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
    await runTransaction(db, async (transaction) => {
      const userSnap = await transaction.get(userDocRef);
      if (!userSnap.exists()) throw new Error("User profile not found. Cannot perform upgrade.");

      const gameUser = buildGameUserFromData(userId, userSnap.data());
      let currentLevel: number;
      let costsForNextLevel: { gold: number; resources: number; } | undefined; // Removed military cost

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

// Room Actions
export async function createRoom(
  userId: string,
  hostDisplayName: string | null,
  roomName: string,
  riskLevel: RiskLevel,
  isPublic: boolean
): Promise<string> {
  try {
    const newRoomRef = await addDoc(collection(db, ROOMS_COLLECTION), {
      name: roomName,
      riskLevel,
      isPublic,
      createdBy: userId,
      hostDisplayName: hostDisplayName || "Anonymous Host",
      status: "WAITING", // Initial status
      playerIds: [userId], // Host is the first player
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    } as Omit<Room, 'id'>);
    return newRoomRef.id;
  } catch (error: any) {
    console.error("Error creating room:", error);
    throw new Error(error.message || "Could not create the room on the server.");
  }
}

export async function getPublicRooms(): Promise<Room[]> {
  // This is a one-time fetch. For real-time, use onSnapshot on the client.
  try {
    const q = query(
      collection(db, ROOMS_COLLECTION),
      where("isPublic", "==", true),
      where("status", "==", "WAITING"),
      orderBy("createdAt", "desc")
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Room));
  } catch (error: any) {
    console.error("Error fetching public rooms:", error);
    throw new Error(error.message || "Could not fetch public rooms.");
  }
}


export async function joinRoom(roomId: string, userId: string, userDisplayName: string): Promise<void> {
  const roomRef = doc(db, ROOMS_COLLECTION, roomId);
  try {
    await runTransaction(db, async (transaction) => {
      const roomSnap = await transaction.get(roomRef);
      if (!roomSnap.exists()) {
        throw new Error("Room not found or has been closed.");
      }
      const roomData = roomSnap.data() as Room;

      if (roomData.playerIds.includes(userId)) {
        // User is already in the room (e.g., host rejoining somehow)
        console.warn(`User ${userId} is already in room ${roomId}. No action taken for join.`);
        return; // Or throw specific error if this shouldn't happen
      }

      if (roomData.playerIds.length >= 2) {
        throw new Error("Room is already full.");
      }
      if (roomData.status !== "WAITING") {
        throw new Error("Room is not available for joining (either full or in-game).");
      }

      const updatedPlayerIds = [...roomData.playerIds, userId];
      const newStatus = updatedPlayerIds.length >= 2 ? "FULL" : "WAITING"; // Or "IN_GAME" if auto-starting

      transaction.update(roomRef, {
        playerIds: updatedPlayerIds,
        status: newStatus,
        updatedAt: serverTimestamp(),
      });

      // If room becomes full, potentially create a game state document here.
      // For now, we just update the room. Game creation logic will be separate.
      if (newStatus === "FULL") {
        console.log(`Room ${roomId} is now full. Trigger game creation or set to IN_GAME if applicable.`);
        // Placeholder: updateDoc(roomRef, { status: "IN_GAME" }); // if game starts automatically
      }
    });
  } catch (error: any) {
    console.error(`Error joining room ${roomId} for user ${userId}:`, error);
    throw new Error(error.message || "Could not join the room due to a server error.");
  }
}
