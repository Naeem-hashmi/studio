"use server";
import { doc, setDoc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { GameUser } from "@/types";
import type { User as FirebaseUser } from "firebase/auth";

const USER_COLLECTION = "users";

export async function getUserProfile(userId: string): Promise<GameUser | null> {
  try {
    const userDocRef = doc(db, USER_COLLECTION, userId);
    const userDocSnap = await getDoc(userDocRef);
    if (userDocSnap.exists()) {
      return userDocSnap.data() as GameUser;
    }
    return null;
  } catch (error) {
    console.error("Error fetching user profile:", error);
    throw new Error("Failed to fetch user profile.");
  }
}

export async function createUserProfile(firebaseUser: FirebaseUser): Promise<GameUser> {
  try {
    const userProfileRef = doc(db, USER_COLLECTION, firebaseUser.uid);
    const existingProfile = await getDoc(userProfileRef);

    if (existingProfile.exists()) {
      // Potentially update existing fields if needed, or just return existing
      // For now, if it exists, we assume it's correctly set up.
      // Or update specific fields like displayName or photoURL if they can change.
      const updatedData: Partial<GameUser> = {
        displayName: firebaseUser.displayName || "Anonymous Warlord",
        email: firebaseUser.email,
        // photoURL: firebaseUser.photoURL, // If you store photoURL
      };
      await updateDoc(userProfileRef, updatedData);
      const updatedSnap = await getDoc(userProfileRef);
      return updatedSnap.data() as GameUser;
    }

    const newUserProfile: GameUser = {
      uid: firebaseUser.uid,
      email: firebaseUser.email || "",
      displayName: firebaseUser.displayName || "Anonymous Warlord",
      photoURL: firebaseUser.photoURL || undefined,
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
      // rank and xp can be initialized later or if not used, removed.
    };
    await setDoc(userProfileRef, newUserProfile);
    return newUserProfile;
  } catch (error) {
    console.error("Error creating user profile:", error);
    throw new Error("Failed to create user profile.");
  }
}

export async function updateUserProfile(userId: string, data: Partial<GameUser>): Promise<void> {
  try {
    const userDocRef = doc(db, USER_COLLECTION, userId);
    // Add an 'updatedAt' timestamp if you have such a field in GameUser
    // const dataWithTimestamp = { ...data, updatedAt: serverTimestamp() };
    await updateDoc(userDocRef, data);
  } catch (error) {
    console.error("Error updating user profile:", error);
    throw new Error("Failed to update user profile.");
  }
}
