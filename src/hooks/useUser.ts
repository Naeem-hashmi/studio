
"use client";

import { useState, useEffect, useCallback } from "react";
import type { GameUser } from "@/types";
import { useAuth } from "./useAuth";
import { getUserProfile } from "@/lib/firestoreActions";

const MAX_RETRIES = 2; // Number of retries for fetching profile
const RETRY_DELAY_MS = 1500; // Delay between retries

export function useUser() {
  const { user: firebaseUser, loading: authLoading } = useAuth();
  const [gameUser, setGameUser] = useState<GameUser | null>(null);
  const [profileFetchingLoading, setProfileFetchingLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Define fetchUserProfileCallback using useCallback for stability
  const fetchUserProfileCallback = useCallback(async (uid: string, attempt = 0) => {
    console.log(`useUser: fetchUserProfileCallback - UID: ${uid}, Attempt: ${attempt}`);
    setProfileFetchingLoading(true);
    setError(null); // Clear previous errors on new fetch attempt

    try {
      const profile = await getUserProfile(uid);
      if (profile) {
        console.log("useUser: Profile fetched successfully", profile);
        setGameUser(profile);
        setProfileFetchingLoading(false);
      } else {
        console.warn(`useUser: Profile not found for UID: ${uid} on attempt ${attempt}.`);
        if (attempt < MAX_RETRIES) {
          console.log(`useUser: Retrying fetch for UID: ${uid} in ${RETRY_DELAY_MS}ms.`);
          setTimeout(() => fetchUserProfileCallback(uid, attempt + 1), RETRY_DELAY_MS);
          // Keep profileFetchingLoading true while retrying
        } else {
          console.error(`useUser: Profile not found for UID: ${uid} after ${MAX_RETRIES + 1} attempts.`);
          setError("Your game profile could not be loaded after multiple attempts. This might happen if you've just signed up. Please try refreshing the page. If the issue persists, contact support.");
          setGameUser(null);
          setProfileFetchingLoading(false);
        }
      }
    } catch (e: unknown) {
      console.error(`useUser: Error in fetchUserProfileCallback for UID: ${uid}, attempt ${attempt}`, e);
      const errorMessage = e instanceof Error ? e.message : "An unknown error occurred while fetching your profile.";
      setError(errorMessage);
      setGameUser(null);
      setProfileFetchingLoading(false);
    }
  }, []); // Empty dependency array as getUserProfile is a server action

  useEffect(() => {
    console.log("useUser Effect (auth state change): authLoading:", authLoading, "firebaseUser ID:", firebaseUser?.uid);

    if (authLoading) {
      setProfileFetchingLoading(true); // Overall loading until auth resolves
      setGameUser(null);
      setError(null);
      return;
    }

    if (firebaseUser) {
      // If firebaseUser exists but gameUser doesn't, or if firebaseUser changed, initiate fetch.
      // This logic is crucial: only fetch if `gameUser` is null for the *current* `firebaseUser`.
      if (!gameUser || gameUser.uid !== firebaseUser.uid) {
        console.log("useUser Effect: User authenticated. Fetching profile for UID:", firebaseUser.uid);
        setGameUser(null); // Clear previous game user if UID changed
        fetchUserProfileCallback(firebaseUser.uid, 0); // Start fetch attempts from 0
      } else {
         // Game user already loaded and matches firebaseUser, no need to fetch
         console.log("useUser Effect: Game user already loaded and matches firebaseUser UID.");
         setProfileFetchingLoading(false); // Ensure loading is false if we're not fetching
      }
    } else {
      console.log("useUser Effect: No user authenticated. Resetting profile state.");
      setGameUser(null);
      setError(null);
      setProfileFetchingLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firebaseUser, authLoading, fetchUserProfileCallback]); 
  // gameUser removed from deps to prevent loop if fetchUserProfileCallback updates gameUser

  const refreshUserProfile = useCallback(() => {
    if (firebaseUser) {
      console.log("useUser: refreshUserProfile called for UID:", firebaseUser.uid);
      // Reset gameUser to ensure fetch is triggered, then call the stable callback
      setGameUser(null);
      setError(null);
      fetchUserProfileCallback(firebaseUser.uid, 0); 
    } else {
      console.log("useUser: refreshUserProfile called but no firebaseUser found.");
      setError("Cannot refresh profile: no user is logged in.");
      setGameUser(null);
      setProfileFetchingLoading(false);
    }
  }, [firebaseUser, fetchUserProfileCallback]);

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
