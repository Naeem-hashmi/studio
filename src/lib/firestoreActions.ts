
"use server";
import { doc, setDoc, getDoc, updateDoc, serverTimestamp, runTransaction, Timestamp, FieldValue } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { GameUser } from "@/types";
import type { User as FirebaseUserType } from "firebase/auth";

const USER_COLLECTION = "users";
export const MAX_LEVEL = 3; // Exporting for use in home page display if needed

// Updated costs
export const ATTACK_UPGRADE_COSTS: Record<number, { gold: number; military: number; resources: number }> = {
  2: { gold: 2000, military: 5000, resources: 4000 }, // Cost to upgrade from level 1 to 2
  3: { gold: 5000, military: 10000, resources: 8000 }, // Cost to upgrade from level 2 to 3
};

export const DEFENSE_UPGRADE_COSTS: Record<number, { gold: number; military: number; resources: number }> = {
  2: { gold: 2000, military: 5000, resources: 4000 }, 
  3: { gold: 5000, military: 10000, resources: 8000 },
};


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
    rank: data.rank !== undefined ? data.rank : null, // Default to null if undefined
    xp: typeof data.xp === 'number' ? data.xp : 0,    // Default to 0 if undefined or not a number
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
    let dataToSet: GameUser | Partial<GameUser>;
    let operationType: 'create' | 'update-auth' = 'create';

    if (existingProfileSnap.exists()) {
      console.log(`firestoreActions: Profile already exists for ${firebaseUser.uid}. Ensuring auth fields are current.`);
      operationType = 'update-auth';
      const currentData = buildGameUserFromData(firebaseUser.uid, existingProfileSnap.data());
      const updates: Partial<GameUser> = {};
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
      
      if (changed) {
        console.log(`firestoreActions: Auth fields changed for existing profile ${firebaseUser.uid}. Applying updates:`, updates);
        dataToSet = updates;
      } else {
        console.log(`firestoreActions: No auth-related field changes needed for existing profile ${firebaseUser.uid}. No data write, only timestamp update if forced.`);
         // To ensure updatedAt is modified, we'll fetch and return.
         // No explicit data write needed if only timestamps are the concern,
         // but we need to return the existing profile.
         // The re-fetch below will handle returning the latest data.
         // Forcing an update just for timestamp might be too much if nothing else changed.
         // We'll rely on the final getDoc to return the current state.
         // If we MUST update timestamp, we'd do: await updateDoc(userProfileRef, { updatedAt: serverTimestamp() });
         const finalProfileSnap = await getDoc(userProfileRef);
         if (!finalProfileSnap.exists()) {
            console.error(`firestoreActions: CRITICAL - Profile for ${firebaseUser.uid} NOT FOUND after an intended no-op for auth fields.`);
            throw new Error("Profile could not be retrieved after checking existing profile.");
         }
         return buildGameUserFromData(firebaseUser.uid, finalProfileSnap.data());
      }
    } else {
      console.log(`firestoreActions: Profile does not exist for ${firebaseUser.uid}. Creating new profile with defaults.`);
      dataToSet = buildGameUserFromData(firebaseUser.uid, {
        email: firebaseUser.email || null,
        displayName: firebaseUser.displayName || "Anonymous Warlord",
        photoURL: firebaseUser.photoURL || null,
        // buildGameUserFromData will apply other game defaults (gold, levels, etc.)
      });
    }
    
    // Prepare data for Firestore, ensuring server timestamps are used
    const finalDataForFirestore: { [key: string]: any } = { ...dataToSet };
    if (operationType === 'create') {
        finalDataForFirestore.createdAt = serverTimestamp();
    }
    finalDataForFirestore.updatedAt = serverTimestamp();

    console.log(`firestoreActions: Data to be written for profile ${firebaseUser.uid} (operation: ${operationType}):`, finalDataForFirestore);
    if (operationType === 'create') {
        await setDoc(userProfileRef, finalDataForFirestore);
    } else { // 'update-auth' and dataToSet contains changes
        await updateDoc(userProfileRef, finalDataForFirestore);
    }
    console.log(`firestoreActions: Successfully wrote profile data for ${firebaseUser.uid}.`);
    
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
    if (error.code === 'invalid-argument' && error.message.includes('Unsupported field value: undefined')) {
        console.error("firestoreActions: Attempted to write 'undefined' to Firestore. This is often due to missing defaults in buildGameUserFromData. Ensure 'rank' and 'xp' have null/0 defaults if not provided.");
        throw new Error(`Profile creation failed: Invalid data. Please ensure all fields have valid default values (use null instead of undefined for optional fields like rank, or 0 for xp). Original error: ${error.message}`);
    }
    throw new Error(`Failed to create or update user profile for ${firebaseUser.uid}: ${error.message || 'Unknown server error during profile operation.'}`);
  }
}

export async function updateUserProfile(userId: string, data: Partial<GameUser>): Promise<void> {
  console.log(`firestoreActions: Updating profile for ${userId} with data:`, data);
  try {
    const userDocRef = doc(db, USER_COLLECTION, userId);
    // Ensure serverTimestamp is of type FieldValue for updates
    const updateData: { [key: string]: any | FieldValue } = { ...data, updatedAt: serverTimestamp() };

    // Remove any 'undefined' fields from the update data, as Firestore doesn't support them.
    // Null is acceptable for clearing a field.
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });
    
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
        throw new Error(`No upgrade cost defined for ${statType} level ${currentLevel + 1}. Please ensure MAX_LEVEL and cost definitions are aligned.`);
      }

      if (
        gameUser.gold < costsForNextLevel.gold ||
        gameUser.military < costsForNextLevel.military ||
        gameUser.resources < costsForNextLevel.resources
      ) {
        throw new Error("Insufficient resources for upgrade.");
      }

      const updates: { [key: string]: any | FieldValue } = {
        gold: gameUser.gold - costsForNextLevel.gold,
        military: gameUser.military - costsForNextLevel.military,
        resources: gameUser.resources - costsForNextLevel.resources,
        updatedAt: serverTimestamp(),
      };

      if (statType === 'attack') {
        updates.attackLevel = currentLevel + 1;
      } else {
        updates.defenseLevel = currentLevel + 1;
      }
      
      transaction.update(userDocRef, updates);
      
      // The transaction function should return the value that the runTransaction call will resolve to.
      // We'll re-fetch outside the transaction to get server-resolved timestamps.
      return; // Indicate success to proceed to re-fetch.
    });
    
    console.log(`firestoreActions: Successfully upgraded ${statType} for user ${userId}. Re-fetching for latest data.`);
    const finalProfileSnap = await getDoc(userDocRef);
    if (!finalProfileSnap.exists()) {
      throw new Error("Profile vanished after upgrade transaction. This is unexpected.");
    }
    return buildGameUserFromData(userId, finalProfileSnap.data());

  } catch (error: any) {
    console.error(`firestoreActions: Error upgrading ${statType} for user ${userId}:`, error);
    // Rethrow specific, user-friendly messages if possible
    if (error.message === "User profile not found. Cannot perform upgrade." ||
        error.message.startsWith("Already at max") ||
        error.message.startsWith("No upgrade cost defined") ||
        error.message === "Insufficient resources for upgrade.") {
        throw error;
    }
    throw new Error(`Failed to upgrade ${statType}. Please try again.`);
  }
}

