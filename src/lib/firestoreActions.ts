
"use server";
import { doc, setDoc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { GameUser } from "@/types";
import type { User as FirebaseUserType } from "firebase/auth";

const USER_COLLECTION = "users";

// Helper to build a full GameUser object with defaults
const buildGameUserFromData = (userId: string, data: any = {}): GameUser => {
  return {
    uid: data.uid || userId,
    email: data.email !== undefined ? data.email : null,
    displayName: data.displayName !== undefined ? data.displayName : "Anonymous Warlord",
    photoURL: data.photoURL !== undefined ? data.photoURL : null,
    gold: typeof data.gold === 'number' ? data.gold : 0,
    military: typeof data.military === 'number' ? data.military : 0,
    resources: typeof data.resources === 'number' ? data.resources : 0,
    attackLevel: typeof data.attackLevel === 'number' ? data.attackLevel : 1,
    defenseLevel: typeof data.defenseLevel === 'number' ? data.defenseLevel : 1,
    wins: typeof data.wins === 'number' ? data.wins : 0,
    losses: typeof data.losses === 'number' ? data.losses : 0,
    inRecoveryMode: typeof data.inRecoveryMode === 'boolean' ? data.inRecoveryMode : false,
    recoveryProgress: (data.recoveryProgress && typeof data.recoveryProgress.successfulAttacks === 'number' && typeof data.recoveryProgress.successfulDefenses === 'number') 
                      ? data.recoveryProgress 
                      : { successfulAttacks: 0, successfulDefenses: 0 },
    rank: typeof data.rank === 'string' ? data.rank : undefined,
    xp: typeof data.xp === 'number' ? data.xp : undefined,
  };
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
        // Rethrow Firestore-specific errors to be handled by the caller
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

    if (existingProfileSnap.exists()) {
      console.log(`firestoreActions: Profile exists for ${firebaseUser.uid}. Updating auth-related fields.`);
      const currentData = existingProfileSnap.data() || {};
      const updatedAuthFields: { [key: string]: any } = {};

      // Only include field if it's different or needs to be set
      if (firebaseUser.displayName !== currentData.displayName) {
        updatedAuthFields.displayName = firebaseUser.displayName || "Anonymous Warlord";
      }
      if (firebaseUser.email !== currentData.email) {
        updatedAuthFields.email = firebaseUser.email || null;
      }
      if (firebaseUser.photoURL !== currentData.photoURL) {
        updatedAuthFields.photoURL = firebaseUser.photoURL || null;
      }
      
      if (Object.keys(updatedAuthFields).length > 0) {
        await updateDoc(userProfileRef, updatedAuthFields);
        console.log(`firestoreActions: Updated auth fields for ${firebaseUser.uid}`, updatedAuthFields);
      } else {
        console.log(`firestoreActions: No auth-related field changes needed for ${firebaseUser.uid}.`);
      }
      
      const updatedSnap = await getDoc(userProfileRef); // Re-fetch for consistency
      if (!updatedSnap.exists()) {
        console.error(`firestoreActions: CRITICAL - Profile for ${firebaseUser.uid} disappeared after update attempt.`);
        throw new Error("Failed to retrieve profile after update.");
      }
      console.log(`firestoreActions: Returning updated profile for ${firebaseUser.uid}`);
      return buildGameUserFromData(firebaseUser.uid, updatedSnap.data());

    } else {
      console.log(`firestoreActions: Profile does not exist for ${firebaseUser.uid}. Creating new profile.`);
      const newProfileData = {
        email: firebaseUser.email || null,
        displayName: firebaseUser.displayName || "Anonymous Warlord",
        photoURL: firebaseUser.photoURL || null,
        gold: 100,
        military: 100,
        resources: 100,
        attackLevel: 1,
        defenseLevel: 1,
        wins: 0,
        losses: 0,
        inRecoveryMode: false,
        recoveryProgress: { successfulAttacks: 0, successfulDefenses: 0 },
      };
      const newUserProfile = buildGameUserFromData(firebaseUser.uid, newProfileData);
      await setDoc(userProfileRef, newUserProfile);
      console.log(`firestoreActions: Created new profile for ${firebaseUser.uid}`);
      return newUserProfile;
    }
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
    await updateDoc(userDocRef, data);
    console.log(`firestoreActions: Successfully updated profile for ${userId}`);
  } catch (error) {
    console.error(`firestoreActions: Error updating user profile for ${userId}:`, error);
    if (error instanceof Error) {
       throw new Error(`Failed to update user profile for ${userId}: ${error.message}`);
    }
    throw new Error(`Failed to update user profile for ${userId} due to an unknown server error.`);
  }
}
