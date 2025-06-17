
"use server";
import { doc, setDoc, getDoc, updateDoc, serverTimestamp, runTransaction, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { GameUser } from "@/types";
import type { User as FirebaseUserType } from "firebase/auth";

const USER_COLLECTION = "users";
const MAX_LEVEL = 3;

const ATTACK_UPGRADE_COSTS: Record<number, { gold: number; military: number; resources: number }> = {
  2: { gold: 50, military: 25, resources: 25 }, // Cost to upgrade from level 1 to 2
  3: { gold: 150, military: 75, resources: 75 }, // Cost to upgrade from level 2 to 3
};

const DEFENSE_UPGRADE_COSTS: Record<number, { gold: number; military: number; resources: number }> = {
  2: { gold: 50, military: 25, resources: 25 }, // Cost to upgrade from level 1 to 2
  3: { gold: 150, military: 75, resources: 75 }, // Cost to upgrade from level 2 to 3
};


// This helper ensures all fields are present with defaults from Firestore data or initial values.
const buildGameUserFromData = (userId: string, data: any = {}): GameUser => {
  console.log(`firestoreActions: buildGameUserFromData for ${userId}, raw input data:`, JSON.parse(JSON.stringify(data)));
  
  const profile: GameUser = {
    uid: data.uid || userId,
    email: data.email !== undefined ? data.email : null,
    displayName: data.displayName !== undefined ? data.displayName : "Anonymous Warlord",
    photoURL: data.photoURL !== undefined ? data.photoURL : null,
    gold: typeof data.gold === 'number' ? data.gold : 100,
    military: typeof data.military === 'number' ? data.military : 100,
    resources: typeof data.resources === 'number' ? data.resources : 100,
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
    // Timestamps are handled by Firestore serverTimestamp and converted to Date on read if necessary
    // For GameUser type, we might not need them explicitly if not used in client logic directly,
    // or convert Firestore Timestamps to Date objects or ISO strings here if needed.
  };
  console.log(`firestoreActions: Constructed GameUser for ${userId}:`, profile);
  return profile;
};

export async function getUserProfile(userId: string): Promise<GameUser | null> {
  console.log(`firestoreActions: Attempting to get profile for ${userId}`);
  try {
    const userDocRef = doc(db, USER_COLLECTION, userId);
    const userDocSnap = await getDoc(userDocRef);
    if (userDocSnap.exists()) {
      const rawData = userDocSnap.data();
      console.log(`firestoreActions: Profile found for ${userId}`, rawData);
      return buildGameUserFromData(userId, rawData);
    }
    console.log(`firestoreActions: Profile NOT found for ${userId}`);
    return null;
  } catch (error) {
    console.error(`firestoreActions: Error fetching user profile for ${userId}:`, error);
    if (error instanceof Error) {
        throw new Error(`Firestore error getting profile for ${userId}: ${error.message}`);
    }
    throw new Error(`Failed to fetch user profile for ${userId} due to an unknown server error.`);
  }
}

export async function createUserProfile(firebaseUser: FirebaseUserType): Promise<GameUser> {
  console.log(`firestoreActions: createUserProfile initiated for ${firebaseUser.uid} with display name: ${firebaseUser.displayName}`);
  const userProfileRef = doc(db, USER_COLLECTION, firebaseUser.uid);

  try {
    const existingProfileSnap = await getDoc(userProfileRef);
    
    if (existingProfileSnap.exists()) {
      console.log(`firestoreActions: Profile already exists for ${firebaseUser.uid}. Ensuring auth fields are current.`);
      const currentData = existingProfileSnap.data() || {};
      const updates: { [key: string]: any } = {
        updatedAt: serverTimestamp() 
      };
      let changed = false;

      if (firebaseUser.displayName && firebaseUser.displayName !== currentData.displayName) {
        updates.displayName = firebaseUser.displayName;
        changed = true;
      }
      if (firebaseUser.email && firebaseUser.email !== currentData.email) {
        updates.email = firebaseUser.email;
        changed = true;
      }
      const currentPhotoURL = currentData.photoURL === undefined ? null : currentData.photoURL;
      if (firebaseUser.photoURL !== currentPhotoURL) { 
         updates.photoURL = firebaseUser.photoURL || null;
         changed = true;
      }

      if (changed) {
        console.log(`firestoreActions: Auth fields changed for existing profile ${firebaseUser.uid}. Applying updates:`, updates);
        await updateDoc(userProfileRef, updates);
         console.log(`firestoreActions: Successfully updated existing profile for ${firebaseUser.uid}.`);
      } else {
        console.log(`firestoreActions: No auth-related field changes needed for existing profile ${firebaseUser.uid}. Updating timestamp only.`);
        await updateDoc(userProfileRef, { updatedAt: serverTimestamp() }); 
      }
    } else {
      console.log(`firestoreActions: Profile does not exist for ${firebaseUser.uid}. Creating new profile with defaults.`);
      const initialGameUser = buildGameUserFromData(firebaseUser.uid, {
        email: firebaseUser.email || null,
        displayName: firebaseUser.displayName || "Anonymous Warlord",
        photoURL: firebaseUser.photoURL || null,
      });
      
      const dataToSet: any = { ...initialGameUser }; // Use 'any' temporarily for serverTimestamp
      dataToSet.createdAt = serverTimestamp();
      dataToSet.updatedAt = serverTimestamp();

      console.log(`firestoreActions: Data to be set for new profile ${firebaseUser.uid}:`, dataToSet);
      await setDoc(userProfileRef, dataToSet);
      console.log(`firestoreActions: Successfully created new profile for ${firebaseUser.uid}.`);
    }

    console.log(`firestoreActions: Re-fetching profile for ${firebaseUser.uid} after write operation.`);
    const finalProfileSnap = await getDoc(userProfileRef);
    if (!finalProfileSnap.exists()) {
      console.error(`firestoreActions: CRITICAL - Profile for ${firebaseUser.uid} NOT FOUND after write operation.`);
      throw new Error("Profile could not be retrieved after create/update operation.");
    }
    const finalData = finalProfileSnap.data();
    console.log(`firestoreActions: Successfully re-fetched profile for ${firebaseUser.uid}. Data:`, finalData);
    return buildGameUserFromData(firebaseUser.uid, finalData);

  } catch (error: any) {
    console.error(`firestoreActions: Error in createUserProfile for ${firebaseUser.uid}:`, error);
    console.error(`firestoreActions: Error stack:`, error.stack); 
    // Check if the error is due to invalid data (like 'undefined' fields)
    if (error.code === 'invalid-argument' && error.message.includes('Unsupported field value: undefined')) {
        console.error("firestoreActions: Attempted to write 'undefined' to Firestore. This is often due to missing defaults in buildGameUserFromData.");
        throw new Error(`Profile creation failed: Invalid data. Please ensure all fields have valid default values (use null instead of undefined). Original error: ${error.message}`);
    }
    throw new Error(`Failed to create or update user profile for ${firebaseUser.uid}: ${error.message || 'Unknown server error during profile operation.'}`);
  }
}

export async function updateUserProfile(userId: string, data: Partial<GameUser>): Promise<void> {
  console.log(`firestoreActions: Updating profile for ${userId} with data:`, data);
  try {
    const userDocRef = doc(db, USER_COLLECTION, userId);
    const updateData: { [key: string]: any } = { ...data, updatedAt: serverTimestamp() };

    for (const key in updateData) {
        if (updateData[key] === undefined) {
            // Firestore does not allow 'undefined'. If you want to remove a field, use deleteField() from Firestore,
            // or ensure 'undefined' values become 'null' or are simply not included in the update object.
            // For Partial<GameUser>, it's usually fine to not include them.
            // If a field is explicitly set to undefined in 'data', convert to null or remove.
            // For now, assuming 'data' doesn't intentionally pass undefined to remove fields.
            delete updateData[key]; 
        }
    }
    
    await updateDoc(userDocRef, updateData);
    console.log(`firestoreActions: Successfully updated profile for ${userId}`);
  } catch (error) {
    console.error(`firestoreActions: Error updating user profile for ${userId}:`, error);
    if (error instanceof Error) {
       throw new Error(`Failed to update user profile for ${userId}: ${error.message}`);
    }
    throw new Error(`Failed to update user profile for ${userId} due to an unknown server error.`);
  }
}

export async function performStatUpgrade(userId: string, statType: 'attack' | 'defense'): Promise<GameUser> {
  console.log(`firestoreActions: Attempting to upgrade ${statType} for user ${userId}`);
  const userDocRef = doc(db, USER_COLLECTION, userId);

  try {
    const updatedProfile = await runTransaction(db, async (transaction) => {
      const userSnap = await transaction.get(userDocRef);
      if (!userSnap.exists()) {
        throw new Error("User profile not found. Cannot perform upgrade.");
      }

      const gameUser = buildGameUserFromData(userId, userSnap.data());
      let currentLevel: number;
      let costsForNextLevel: { gold: number; military: number; resources: number } | undefined;

      if (statType === 'attack') {
        currentLevel = gameUser.attackLevel;
        costsForNextLevel = ATTACK_UPGRADE_COSTS[currentLevel + 1];
      } else { // defense
        currentLevel = gameUser.defenseLevel;
        costsForNextLevel = DEFENSE_UPGRADE_COSTS[currentLevel + 1];
      }

      if (currentLevel >= MAX_LEVEL) {
        throw new Error(`Already at max ${statType} level.`);
      }
      if (!costsForNextLevel) {
        // Should not happen if MAX_LEVEL and costs are aligned
        throw new Error(`No upgrade cost defined for ${statType} level ${currentLevel + 1}.`);
      }

      if (
        gameUser.gold < costsForNextLevel.gold ||
        gameUser.military < costsForNextLevel.military ||
        gameUser.resources < costsForNextLevel.resources
      ) {
        throw new Error("Insufficient resources for upgrade.");
      }

      const updates: { [key: string]: any } = {
        gold: gameUser.gold - costsForNextLevel.gold,
        military: gameUser.military - costsForNextLevel.military,
        resources: gameUser.resources - costsForNextLevel.resources,
        updatedAt: serverTimestamp(), // Firestore server timestamp
      };

      if (statType === 'attack') {
        updates.attackLevel = currentLevel + 1;
      } else {
        updates.defenseLevel = currentLevel + 1;
      }
      
      transaction.update(userDocRef, updates);
      
      // Return a representation of the updated user for client-side update (optional, client can also re-fetch)
      // For consistency, it's often better to re-fetch or apply updates predictively on client then confirm.
      // Here, we'll return a new object based on the committed changes.
      // Note: serverTimestamp() won't be resolved here, client will get placeholder or re-fetch.
      const newLevel = currentLevel + 1;
      return {
        ...gameUser,
        ...(statType === 'attack' ? { attackLevel: newLevel } : { defenseLevel: newLevel }),
        gold: updates.gold,
        military: updates.military,
        resources: updates.resources,
        // updatedAt will be a server timestamp, client might need to handle this if not re-fetching.
      };
    });
    
    console.log(`firestoreActions: Successfully upgraded ${statType} for user ${userId}. Re-fetching for latest data.`);
    // Re-fetch after transaction to get server-resolved timestamps
    const finalProfileSnap = await getDoc(userDocRef);
    if (!finalProfileSnap.exists()) {
      throw new Error("Profile vanished after upgrade transaction. This is unexpected.");
    }
    return buildGameUserFromData(userId, finalProfileSnap.data());

  } catch (error: any) {
    console.error(`firestoreActions: Error upgrading ${statType} for user ${userId}:`, error);
    throw new Error(error.message || `Failed to upgrade ${statType}.`);
  }
}

