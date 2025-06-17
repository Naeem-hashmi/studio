
"use server";
import { doc, setDoc, getDoc, updateDoc, serverTimestamp, FieldValue } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { GameUser } from "@/types";
import type { User as FirebaseUserType } from "firebase/auth";

const USER_COLLECTION = "users";

// This helper ensures all fields are present with defaults from Firestore data or initial values.
const buildGameUserFromData = (userId: string, data: any = {}): GameUser => {
  console.log(`firestoreActions: buildGameUserFromData for ${userId}, raw input data:`, JSON.parse(JSON.stringify(data))); // Log a deep copy
  
  // Firestore Timestamps will be objects. We'll convert them to ISO strings or keep as null/undefined for the GameUser type if needed.
  // For now, GameUser doesn't have explicit createdAt/updatedAt fields, so we don't need to map them here.
  // If they were part of GameUser as Date objects, you'd convert data.createdAt.toDate() etc.

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
    rank: typeof data.rank === 'string' ? data.rank : undefined, // Keep as undefined if not present
    xp: typeof data.xp === 'number' ? data.xp : undefined, // Keep as undefined if not present
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
        updatedAt: serverTimestamp() // Always update 'updatedAt'
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
      // photoURL can be null, check for strict inequality
      // Ensure currentData.photoURL is not undefined before comparison if firebaseUser.photoURL is null
      if (firebaseUser.photoURL !== (currentData.photoURL === undefined ? null : currentData.photoURL)) { 
         updates.photoURL = firebaseUser.photoURL; // This can be null
         changed = true;
      }

      if (changed) {
        console.log(`firestoreActions: Auth fields changed for existing profile ${firebaseUser.uid}. Applying updates:`, updates);
        await updateDoc(userProfileRef, updates);
         console.log(`firestoreActions: Successfully updated existing profile for ${firebaseUser.uid}.`);
      } else {
        console.log(`firestoreActions: No auth-related field changes needed for existing profile ${firebaseUser.uid}. Only 'updatedAt' touched if it's the only change.`);
        // If only updatedAt is in updates, still perform the update to refresh the timestamp
        if (Object.keys(updates).length === 1 && 'updatedAt' in updates) {
            await updateDoc(userProfileRef, updates); // Update timestamp
            console.log(`firestoreActions: Refreshed 'updatedAt' for existing profile ${firebaseUser.uid}.`);
        }
      }
    } else {
      console.log(`firestoreActions: Profile does not exist for ${firebaseUser.uid}. Creating new profile with defaults.`);
      const initialProfileData = buildGameUserFromData(firebaseUser.uid, {
        email: firebaseUser.email || null,
        displayName: firebaseUser.displayName || "Anonymous Warlord",
        photoURL: firebaseUser.photoURL || null,
        // buildGameUserFromData provides other game defaults (gold, military, etc.)
      });
      
      const dataToSet = {
        ...initialProfileData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      console.log(`firestoreActions: Data to be set for new profile ${firebaseUser.uid}:`, dataToSet);
      await setDoc(userProfileRef, dataToSet);
      console.log(`firestoreActions: Successfully created new profile for ${firebaseUser.uid}.`);
    }

    // ALWAYS re-fetch the profile after any write to ensure consistency and get resolved timestamps.
    console.log(`firestoreActions: Re-fetching profile for ${firebaseUser.uid} after write operation.`);
    const finalProfileSnap = await getDoc(userProfileRef);
    if (!finalProfileSnap.exists()) {
      console.error(`firestoreActions: CRITICAL - Profile for ${firebaseUser.uid} NOT FOUND after write operation.`);
      throw new Error("Profile could not be retrieved after create/update operation. This indicates a severe issue.");
    }
    const finalData = finalProfileSnap.data();
    console.log(`firestoreActions: Successfully re-fetched profile for ${firebaseUser.uid}. Data:`, finalData);
    return buildGameUserFromData(firebaseUser.uid, finalData);

  } catch (error: any) {
    console.error(`firestoreActions: Error in createUserProfile for ${firebaseUser.uid}:`, error);
    console.error(`firestoreActions: Error stack:`, error.stack); // Log stack for more details
    // Rethrow a more generic error or the specific one if needed by client
    throw new Error(`Failed to create or update user profile for ${firebaseUser.uid}: ${error.message || 'Unknown server error during profile operation.'}`);
  }
}

export async function updateUserProfile(userId: string, data: Partial<GameUser>): Promise<void> {
  console.log(`firestoreActions: Updating profile for ${userId} with data:`, data);
  try {
    const userDocRef = doc(db, USER_COLLECTION, userId);
    const updateData = {
        ...data,
        updatedAt: serverTimestamp()
    };
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
