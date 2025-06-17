
"use client";

import { useState, useEffect, useCallback } from "react";
import type { GameUser } from "@/types";
import { useAuth } from "./useAuth";
import { getUserProfile } from "@/lib/firestoreActions";

const MAX_RETRIES = 3; // Total attempts (initial + 2 retries)
const RETRY_DELAY_MS = 1500;

export function useUser() {
  const { user: firebaseUser, loading: authLoading } = useAuth();
  const [gameUser, setGameUser] = useState<GameUser | null>(null);
  const [profileFetchingLoading, setProfileFetchingLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAndSetUserProfile = useCallback(async (uid: string): Promise<void> => {
    console.log(`useUser: Starting profile fetch cycle for ${uid}`);
    setProfileFetchingLoading(true);
    setError(null);
    // Do not setGameUser(null) here initially if we want to keep displaying old profile while new one loads on refresh
    // However, for initial load after login, it should be null or reset by useEffect.

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      console.log(`useUser: Attempt ${attempt + 1} to fetch profile for ${uid}`);
      try {
        const profile = await getUserProfile(uid);
        if (profile) {
          console.log("useUser: Profile fetched successfully", profile);
          setGameUser(profile);
          setError(null);
          setProfileFetchingLoading(false);
          return;
        }
        console.log(`useUser: Profile not found on attempt ${attempt + 1} for ${uid}.`);
        if (attempt < MAX_RETRIES - 1) {
          console.log(`useUser: Scheduling retry ${attempt + 1} after ${RETRY_DELAY_MS}ms.`);
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
        }
      } catch (e: unknown) {
        console.error(`useUser: Error fetching profile for ${uid} on attempt ${attempt + 1}`, e);
        const errorMessage = e instanceof Error ? e.message : "An unknown error occurred while fetching your profile.";
        setError(errorMessage);
        setGameUser(null); // Clear gameUser on error
        setProfileFetchingLoading(false);
        return;
      }
    }

    console.log(`useUser: Profile not found for ${uid} after ${MAX_RETRIES} attempts.`);
    setError("Your game profile could not be loaded after multiple attempts. This might happen if you've just signed up. Please try refreshing the page. If the issue persists, contact support.");
    setGameUser(null); // Ensure gameUser is null if not found
    setProfileFetchingLoading(false);

  }, []);

  useEffect(() => {
    console.log("useUser effect (auth state change): authLoading:", authLoading, "firebaseUser:", !!firebaseUser);
    if (authLoading) {
      // If auth is loading, we can't know the user yet.
      // Resetting gameUser might be too aggressive if we want to keep showing old data while auth revalidates.
      // For now, we'll let it be until auth resolves.
      // setGameUser(null); 
      // setError(null);
      // setProfileFetchingLoading(true); // Indicate that we are waiting for auth before we can even attempt profile fetch
      return;
    }

    if (firebaseUser) {
      console.log("useUser effect: User authenticated. Initiating profile fetch for user:", firebaseUser.uid);
      // Reset gameUser and error *before* fetching for a new firebaseUser or re-fetching for the same user.
      setGameUser(null);
      setError(null);
      fetchAndSetUserProfile(firebaseUser.uid);
    } else {
      console.log("useUser effect: User logged out or no user. Resetting all profile state.");
      setGameUser(null);
      setError(null);
      setProfileFetchingLoading(false); // No user, so not fetching.
    }
  }, [firebaseUser, authLoading, fetchAndSetUserProfile]);


  const refreshUserProfile = useCallback(() => {
    if (firebaseUser) {
      console.log("useUser: refreshUserProfile called for user:", firebaseUser.uid);
      // Reset relevant states and start fetching
      setGameUser(null); // Clear current game user to show loading state properly
      setError(null);
      fetchAndSetUserProfile(firebaseUser.uid);
    } else {
      console.log("useUser: refreshUserProfile called but no firebaseUser found.");
    }
  }, [firebaseUser, fetchAndSetUserProfile]);

  const combinedLoading = authLoading || profileFetchingLoading;

  console.log("useUser render state:", { uid: firebaseUser?.uid, authLoading, profileFetchingLoading, combinedLoading, gameUserExists: !!gameUser, error });

  return { gameUser, loading: combinedLoading, error, refreshUserProfile };
}
