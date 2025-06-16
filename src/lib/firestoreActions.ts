"use server";
import { doc, setDoc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { GameUser } from "@/types";
import type { User as FirebaseUserType } from "firebase/auth"; // Renamed to avoid conflict if GameUser was named User

const USER_COLLECTION = "users";

export async function getUserProfile(userId: string): Promise<GameUser | null> {
  try {
    const userDocRef = doc(db, USER_COLLECTION, userId);
    const userDocSnap = await getDoc(userDocRef);
    if (userDocSnap.exists()) {
      return userDocSnap.data() as GameUser; // Assumes data in Firestore matches GameUser structure
    }
    return null;
  } catch (error) {
    console.error("Error fetching user profile:", error);
    // Consider not throwing a generic error here, or making it more specific,
    // so UI can distinguish between "not found" and "failed to fetch"
    throw new Error("Failed to fetch user profile due to a server error.");
  }
}

export async function createUserProfile(firebaseUser: FirebaseUserType): Promise<GameUser> {
  try {
    const userProfileRef = doc(db, USER_COLLECTION, firebaseUser.uid);
    const existingProfileSnap = await getDoc(userProfileRef);

    if (existingProfileSnap.exists()) {
      // Profile exists, update relevant fields from FirebaseUser if they can change
      const updatedData: Partial<GameUser> = {
        displayName: firebaseUser.displayName || "Anonymous Warlord",
        email: firebaseUser.email || null, // Ensure email matches GameUser type (string | null)
        photoURL: firebaseUser.photoURL || null, // Ensure photoURL matches GameUser type (string | undefined | null)
        // Do not update game-specific stats like gold, wins etc. here unless intended
      };
      await updateDoc(userProfileRef, updatedData);
      const updatedSnap = await getDoc(userProfileRef);
      // Ensure the returned object conforms to GameUser, merging existing game data with updated auth data
      return { ...existingProfileSnap.data(), ...updatedData } as GameUser;
    }

    // Profile doesn't exist, create a new one
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
      // rank and xp can be initialized if/when needed
    };
    await setDoc(userProfileRef, newUserProfile);
    return newUserProfile;
  } catch (error) {
    console.error("Error creating or updating user profile:", error);
    throw new Error("Failed to create or update user profile.");
  }
}

export async function updateUserProfile(userId: string, data: Partial<GameUser>): Promise<void> {
  try {
    const userDocRef = doc(db, USER_COLLECTION, userId);
    // Example: add an 'updatedAt' timestamp if your GameUser type has it
    // const dataWithTimestamp = { ...data, updatedAt: serverTimestamp() };
    // await updateDoc(userDocRef, dataWithTimestamp);
    await updateDoc(userDocRef, data); // Pass only the partial data to update
  } catch (error) {
    console.error("Error updating user profile:", error);
    throw new Error("Failed to update user profile.");
  }
}
