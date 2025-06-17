
"use client";

import { useState, useEffect, useCallback } from "react";
import type { GameUser } from "@/types";
import { useAuth } from "./useAuth";
import { getUserProfile } from "@/lib/firestoreActions";

const MAX_RETRIES = 4; // Increased from 2 to 4 (meaning 5 total attempts)
const RETRY_DELAY_MS = 1500; // Delay between retries

export function useUser() {
  const { user: firebaseUser, loading: authLoading } = useAuth();
  const [gameUser, setGameUser] = useState<GameUser | null>(null);
  const [profileFetchingLoading, setProfileFetchingLoading] = useState<boolean>(true); // Start true until first fetch attempt
  const [error, setError] = useState<string | null>(null);

  const fetchUserProfileCallback = useCallback(async (uid: string) => {
    console.log(`useUser: fetchUserProfileCallback initiated for UID: ${uid}`);
    setProfileFetchingLoading(true);
    setError(null); // Clear previous errors before new fetch cycle
    let attempts = 0;

    while (attempts <= MAX_RETRIES) {
      try {
        console.log(`useUser: Attempt ${attempts + 1} to fetch profile for UID: ${uid}`);
        const profile = await getUserProfile(uid);
        if (profile) {
          console.log("useUser: Profile fetched successfully", profile);
          setGameUser(profile);
          setProfileFetchingLoading(false);
          return; // Success, exit loop
        } else {
          console.warn(`useUser: Profile not found for UID: ${uid} on attempt ${attempts + 1}.`);
          if (attempts < MAX_RETRIES) {
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
          }
        }
      } catch (e: unknown) {
        console.error(`useUser: Error fetching profile for UID: ${uid}, attempt ${attempts + 1}`, e);
        const errorMessage = e instanceof Error ? e.message : "An unknown error occurred while fetching your profile.";
        if (attempts >= MAX_RETRIES) {
          setError(errorMessage);
          setGameUser(null);
          setProfileFetchingLoading(false);
          return; // Error after max retries, exit loop
        }
        // For errors before max retries, we can also wait before retrying
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
      }
      attempts++;
    }

    // If loop finishes, means profile not found after all retries
    console.error(`useUser: Profile not found for UID: ${uid} after ${MAX_RETRIES + 1} attempts.`);
    setError("Your game profile could not be loaded. This might happen if setup wasn't completed or if there's a temporary issue. Please try refreshing, or re-verify your profile setup if the problem persists.");
    setGameUser(null);
    setProfileFetchingLoading(false);
  }, []);

  useEffect(() => {
    console.log("useUser Effect (auth state change): authLoading:", authLoading, "firebaseUser ID:", firebaseUser?.uid);

    if (authLoading) {
      // Firebase Auth is still loading, so we wait.
      setProfileFetchingLoading(true);
      setGameUser(null);
      setError(null);
      return;
    }

    if (firebaseUser) {
      // User is authenticated.
      // Only fetch if gameUser isn't already loaded for this firebaseUser OR if there was a previous error
      // This ensures that if an error occurred, we attempt to refetch if firebaseUser changes (e.g. re-login)
      if (!gameUser || gameUser.uid !== firebaseUser.uid || error) {
        console.log("useUser Effect: Firebase user authenticated. Fetching game profile for UID:", firebaseUser.uid);
        setGameUser(null); // Clear stale game user if UID changed or if there was an error
        // setError(null); // Already cleared at the start of fetchUserProfileCallback
        fetchUserProfileCallback(firebaseUser.uid);
      } else {
        // Game user already loaded and matches current firebaseUser, and no previous error. No need to fetch.
        console.log("useUser Effect: Game user already loaded and matches firebaseUser UID.");
        setProfileFetchingLoading(false); // Ensure loading is false if we're not fetching
      }
    } else {
      // No Firebase user authenticated (e.g., logged out). Reset profile state.
      console.log("useUser Effect: No Firebase user authenticated. Resetting profile state.");
      setGameUser(null);
      setError(null);
      setProfileFetchingLoading(false);
    }
  }, [firebaseUser, authLoading, fetchUserProfileCallback]); // Removed 'error' and 'gameUser' to prevent potential loops from self-updates. fetchUserProfileCallback handles error clearing internally.

  const refreshUserProfile = useCallback(() => {
    if (firebaseUser) {
      console.log("useUser: refreshUserProfile called for UID:", firebaseUser.uid);
      // Clear current gameUser and error to force re-fetch by fetchUserProfileCallback
      setGameUser(null); 
      setError(null);
      fetchUserProfileCallback(firebaseUser.uid);
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
