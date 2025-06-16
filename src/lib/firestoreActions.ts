
"use server";
import { doc, setDoc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { GameUser } from "@/types";
import type { User as FirebaseUserType } from "firebase/auth";

const USER_COLLECTION = "users";

export async function getUserProfile(userId: string): Promise<GameUser | null> {
  try {
    const userDocRef = doc(db, USER_COLLECTION, userId);
    const userDocSnap = await getDoc(userDocRef);
    if (userDocSnap.exists()) {
      // Ensure data conforms to GameUser, especially if there's old data
      const data = userDocSnap.data();
      return {
        uid: data.uid || userId,
        email: data.email || null,
        displayName: data.displayName || "Anonymous Warlord",
        photoURL: data.photoURL || null,
        gold: data.gold || 0, // Provide defaults for crucial fields
        military: data.military || 0,
        resources: data.resources || 0,
        attackLevel: data.attackLevel || 1,
        defenseLevel: data.defenseLevel || 1,
        wins: data.wins || 0,
        losses: data.losses || 0,
        inRecoveryMode: data.inRecoveryMode || false,
        recoveryProgress: data.recoveryProgress || { successfulAttacks: 0, successfulDefenses: 0 },
        rank: data.rank || undefined,
        xp: data.xp || undefined,
        ...data // Spread last to overwrite defaults with actual data if present
      } as GameUser;
    }
    return null;
  } catch (error) {
    console.error("Error fetching user profile:", error);
    throw new Error("Failed to fetch user profile due to a server error.");
  }
}

export async function createUserProfile(firebaseUser: FirebaseUserType): Promise<GameUser> {
  try {
    const userProfileRef = doc(db, USER_COLLECTION, firebaseUser.uid);
    const existingProfileSnap = await getDoc(userProfileRef);

    if (existingProfileSnap.exists()) {
      const updatedData: Partial<GameUser> = {
        displayName: firebaseUser.displayName || existingProfileSnap.data()?.displayName || "Anonymous Warlord",
        email: firebaseUser.email || existingProfileSnap.data()?.email || null,
        photoURL: firebaseUser.photoURL || existingProfileSnap.data()?.photoURL || null,
        // Do not reset game-specific stats here, only update auth-related fields
      };
      await updateDoc(userProfileRef, updatedData);
      const updatedSnap = await getDoc(userProfileRef); // Re-fetch the document after update
      if (!updatedSnap.exists()) { // Should not happen, but good to check
        throw new Error("Failed to retrieve profile after update.");
      }
      return updatedSnap.data() as GameUser; // Return the fresh data
    }

    const newUserProfile: GameUser = {
      uid: firebaseUser.uid,
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
      recoveryProgress: {
        successfulAttacks: 0,
        successfulDefenses: 0,
      },
    };
    await setDoc(userProfileRef, newUserProfile);
    return newUserProfile;
  } catch (error) {
    console.error("Error creating or updating user profile:", error);
    if (error instanceof Error) {
      throw new Error(`Failed to create or update user profile: ${error.message}`);
    }
    throw new Error("Failed to create or update user profile due to an unknown server error.");
  }
}

export async function updateUserProfile(userId: string, data: Partial<GameUser>): Promise<void> {
  try {
    const userDocRef = doc(db, USER_COLLECTION, userId);
    await updateDoc(userDocRef, data);
  } catch (error) {
    console.error("Error updating user profile:", error);
    throw new Error("Failed to update user profile.");
  }
}
