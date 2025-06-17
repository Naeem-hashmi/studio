
"use client";

import { useState, useEffect, useCallback } from "react";
import type { GameUser } from "@/types";
import { useAuth } from "./useAuth";
import { getUserProfile } from "@/lib/firestoreActions";

export function useUser() {
  const { user: firebaseUser, loading: authLoading } = useAuth();
  const [gameUser, setGameUser] = useState<GameUser | null>(null);
  const [profileFetchingLoading, setProfileFetchingLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUserProfileCallback = useCallback(async (uid: string) => {
    console.log(`useUser: fetchUserProfileCallback invoked for UID: ${uid}`);
    setProfileFetchingLoading(true);
    setError(null);
    // Reset gameUser when starting a fetch for a new UID or a manual refresh
    // This ensures UI shows loading state correctly.
    setGameUser(null);

    try {
      const profile = await getUserProfile(uid);
      if (profile) {
        console.log("useUser: Profile fetched successfully", profile);
        setGameUser(profile);
      } else {
        console.warn(`useUser: Profile not found for UID: ${uid}. This might occur if the profile is new and Firestore propagation is delayed.`);
        setError("Your game profile could not be loaded. If you've just signed up, please try refreshing in a moment.");
      }
    } catch (e: unknown) {
      console.error(`useUser: Error in fetchUserProfileCallback for UID: ${uid}`, e);
      const errorMessage = e instanceof Error ? e.message : "An unknown error occurred while fetching your profile.";
      setError(errorMessage);
      setGameUser(null);
    } finally {
      setProfileFetchingLoading(false);
      console.log(`useUser: fetchUserProfileCallback finished for UID: ${uid}`);
    }
  }, []); // getUserProfile is a server action, so fetchUserProfileCallback is stable.

  useEffect(() => {
    console.log("useUser Effect (auth state change): authLoading:", authLoading, "firebaseUser ID:", firebaseUser?.uid);

    if (authLoading) {
      // Auth state is still being determined.
      setProfileFetchingLoading(true); // Indicate that we can't fetch a profile yet.
      setGameUser(null); // Clear any previous game user.
      setError(null); // Clear any previous error.
      return;
    }

    if (firebaseUser) {
      // User is authenticated.
      console.log("useUser Effect: User authenticated. Fetching profile for UID:", firebaseUser.uid);
      fetchUserProfileCallback(firebaseUser.uid);
    } else {
      // No user is authenticated (logged out).
      console.log("useUser Effect: No user authenticated. Resetting profile state.");
      setGameUser(null);
      setError(null);
      setProfileFetchingLoading(false); // Not fetching as there's no user.
    }
  }, [firebaseUser, authLoading, fetchUserProfileCallback]);

  const refreshUserProfile = useCallback(() => {
    if (firebaseUser) {
      console.log("useUser: refreshUserProfile called for UID:", firebaseUser.uid);
      // fetchUserProfileCallback is stable and will initiate a new fetch.
      fetchUserProfileCallback(firebaseUser.uid);
    } else {
      console.log("useUser: refreshUserProfile called but no firebaseUser found.");
      // Optionally set an error or clear existing profile data.
      setError("Cannot refresh profile: no user is logged in.");
      setGameUser(null);
      setProfileFetchingLoading(false);
    }
  }, [firebaseUser, fetchUserProfileCallback]);

  // authLoading is for Firebase Auth state, profileFetchingLoading is for our Firestore profile.
  const combinedLoading = authLoading || profileFetchingLoading;

  console.log("useUser render state:", {
    firebaseUserId: firebaseUser?.uid,
    authLoading,
    profileFetchingLoading,
    combinedLoading,
    gameUserExists: !!gameUser,
    error,
  });

  return { gameUser, loading: combinedLoading, error, refreshUserProfile };
}
