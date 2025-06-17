
"use server";
import { doc, setDoc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { GameUser } from "@/types";
import type { User as FirebaseUserType } from "firebase/auth";

const USER_COLLECTION = "users";

// This helper ensures all fields are present with defaults.
const buildGameUserFromData = (userId: string, data: any = {}): GameUser => {
  console.log(`firestoreActions: buildGameUserFromData for ${userId}, raw data:`, data);
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
                      ? data.recoveryProgress
                      : { successfulAttacks: 0, successfulDefenses: 0 },
    rank: typeof data.rank === 'string' ? data.rank : undefined,
    xp: typeof data.xp === 'number' ? data.xp : undefined,
    // Timestamps like createdAt/updatedAt can be added here if using serverTimestamp(),
    // or managed directly in setDoc/updateDoc calls.
    // For example, if they are part of GameUser type:
    // createdAt: data.createdAt || serverTimestamp(), // Only on new creation
    // updatedAt: serverTimestamp(), // Always on update/create
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
  console.log(`firestoreActions: Creating/Updating profile for ${firebaseUser.uid}`);
  const userProfileRef = doc(db, USER_COLLECTION, firebaseUser.uid);

  try {
    const existingProfileSnap = await getDoc(userProfileRef);
    let gameUserData: Partial<GameUser> = {}; // Use Partial for constructing data

    if (existingProfileSnap.exists()) {
      console.log(`firestoreActions: Profile exists for ${firebaseUser.uid}. Updating auth-related fields if changed.`);
      const currentData = existingProfileSnap.data() || {};
      
      // Prepare update object, start with existing data to carry over game stats
      gameUserData = { ...currentData }; 
      let changed = false;

      if (firebaseUser.displayName && firebaseUser.displayName !== currentData.displayName) {
        gameUserData.displayName = firebaseUser.displayName;
        changed = true;
      }
      if (firebaseUser.email && firebaseUser.email !== currentData.email) {
        gameUserData.email = firebaseUser.email;
        changed = true;
      }
      if (firebaseUser.photoURL !== currentData.photoURL) { // photoURL can be null
         gameUserData.photoURL = firebaseUser.photoURL;
         changed = true;
      }

      if (changed) {
        console.log(`firestoreActions: Auth fields changed for ${firebaseUser.uid}. Updating with:`, gameUserData);
        // Add updatedAt timestamp if you manage it
        // gameUserData.updatedAt = serverTimestamp(); 
        await updateDoc(userProfileRef, {
            displayName: gameUserData.displayName,
            email: gameUserData.email,
            photoURL: gameUserData.photoURL,
            // updatedAt: serverTimestamp(), // Example
        });
      } else {
        console.log(`firestoreActions: No auth-related field changes needed for ${firebaseUser.uid}.`);
      }
    } else {
      console.log(`firestoreActions: Profile does not exist for ${firebaseUser.uid}. Creating new profile.`);
      // For a new user, construct with Firebase Auth info and defaults for game stats.
      const initialProfileData = {
        uid: firebaseUser.uid,
        email: firebaseUser.email || null,
        displayName: firebaseUser.displayName || "Anonymous Warlord",
        photoURL: firebaseUser.photoURL || null,
        // Game stats will be filled by buildGameUserFromData defaults if not specified here
      };
      // This ensures all game stats get their defaults
      gameUserData = buildGameUserFromData(firebaseUser.uid, initialProfileData); 
      // Add timestamps if you manage them:
      // (gameUserData as GameUser).createdAt = serverTimestamp(); 
      // (gameUserData as GameUser).updatedAt = serverTimestamp();
      await setDoc(userProfileRef, gameUserData); // gameUserData is now a complete GameUser
      console.log(`firestoreActions: Created new profile for ${firebaseUser.uid} with data:`, gameUserData);
    }

    // Always re-fetch the profile after any write to ensure consistency and return the latest state
    const updatedSnap = await getDoc(userProfileRef);
    if (!updatedSnap.exists()) {
      console.error(`firestoreActions: CRITICAL - Profile for ${firebaseUser.uid} disappeared after write operation.`);
      throw new Error("Failed to retrieve profile after create/update operation.");
    }
    console.log(`firestoreActions: Returning fresh profile for ${firebaseUser.uid} after write.`);
    return buildGameUserFromData(firebaseUser.uid, updatedSnap.data()); // Ensure it's fully typed

  } catch (error) {
    console.error(`firestoreActions: Error creating/updating user profile for ${firebaseUser.uid}:`, error);
    if (error instanceof Error) {
      throw new Error(`Failed to create or update user profile for ${firebaseUser.uid}: ${error.message}`);
    }
    throw new Error(`Failed to create or update user profile for ${firebaseUser.uid} due to an unknown server error.`);
  }
}

export async function updateUserProfile(userId: string, data: Partial<GameUser>): Promise<void> {
  console.log(`firestoreActions: Updating profile for ${userId} with data:`, data);
  try {
    const userDocRef = doc(db, USER_COLLECTION, userId);
    const updateData = {
        ...data,
        // updatedAt: serverTimestamp() // Add if managing timestamps
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
