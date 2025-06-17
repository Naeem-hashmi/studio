
"use client";

import { useState, useEffect, useCallback } from "react";
import type { GameUser } from "@/types";
import { useAuth } from "./useAuth";
import { getUserProfile } from "@/lib/firestoreActions";

const MAX_RETRIES = 2; // Total 3 attempts (initial + 2 retries)
const RETRY_DELAY_MS = 1500;

export function useUser() {
  const { user: firebaseUser, loading: authLoading } = useAuth();
  const [gameUser, setGameUser] = useState<GameUser | null>(null);
  const [profileFetchingLoading, setProfileFetchingLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAndSetUserProfile = useCallback(async (uid: string, attempt = 0): Promise<void> => {
    console.log(`useUser: Attempting to fetch profile for ${uid}, attempt number ${attempt + 1}`);
    if (attempt === 0) { // Only set loading to true on the first attempt of a cycle
      setProfileFetchingLoading(true);
      setError(null); // Clear previous error at the start of a new fetch cycle
    }

    try {
      const profile = await getUserProfile(uid);

      if (profile) {
        console.log("useUser: Profile fetched successfully", profile);
        setGameUser(profile);
        setError(null); // Clear error on success
        setProfileFetchingLoading(false);
      } else if (attempt < MAX_RETRIES) {
        console.log(`useUser: Profile not found for ${uid}, scheduling retry ${attempt + 1} of ${MAX_RETRIES}. ProfileFetchingLoading remains true.`);
        // profileFetchingLoading remains true
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * (attempt + 1) ));
        await fetchAndSetUserProfile(uid, attempt + 1); // Recursive call for retry
      } else {
        console.log(`useUser: Profile not found for ${uid} after max retries.`);
        setError("Your game profile could not be loaded after multiple attempts. This might happen if you've just signed up. Please try refreshing the page. If the issue persists, contact support.");
        setGameUser(null);
        setProfileFetchingLoading(false);
      }
    } catch (e: unknown) {
      console.error(`useUser: Error fetching profile for ${uid} on attempt ${attempt + 1}`, e);
      const errorMessage = e instanceof Error ? e.message : "An unknown error occurred while fetching your profile.";
      setError(errorMessage);
      setGameUser(null);
      setProfileFetchingLoading(false);
    }
  }, []); // Empty dependency array: fetchAndSetUserProfile is self-contained regarding its own retry logic.

  useEffect(() => {
    console.log("useUser effect (auth state change): authLoading:", authLoading, "firebaseUser:", !!firebaseUser);
    if (authLoading) {
      // If auth is loading, ensure profile states are reset and don't fetch
      setGameUser(null);
      setError(null);
      setProfileFetchingLoading(false); // Explicitly set loading to false if auth is still in progress
      return;
    }

    if (firebaseUser) {
      // User is authenticated, and auth is not loading
      console.log("useUser effect: User authenticated. Initiating profile fetch cycle.");
      setGameUser(null); // Clear previous game user to ensure fresh fetch
      // setError(null); // setError is handled by fetchAndSetUserProfile at the start of its cycle
      // setProfileFetchingLoading(true); // fetchAndSetUserProfile will set this on its first attempt
      fetchAndSetUserProfile(firebaseUser.uid, 0); // Start fetching with attempt 0
    } else {
      // No firebaseUser and not authLoading (user is logged out)
      console.log("useUser effect: User logged out. Resetting all profile state.");
      setGameUser(null);
      setError(null);
      setProfileFetchingLoading(false);
    }
  }, [firebaseUser, authLoading, fetchAndSetUserProfile]);

  const refreshUserProfile = useCallback(() => {
    if (firebaseUser) {
      console.log("useUser: refreshUserProfile called for user:", firebaseUser.uid);
      setGameUser(null); // Clear current game user
      // setError(null); // Will be cleared by fetchAndSetUserProfile's first attempt logic
      // setProfileFetchingLoading(true); // Will be set by fetchAndSetUserProfile's first attempt logic
      fetchAndSetUserProfile(firebaseUser.uid, 0); // Initiate a fresh fetch cycle
    } else {
      console.log("useUser: refreshUserProfile called but no firebaseUser found.");
    }
  }, [firebaseUser, fetchAndSetUserProfile]);

  const combinedLoading = authLoading || profileFetchingLoading;

  console.log("useUser render state:", { uid: firebaseUser?.uid, authLoading, profileFetchingLoading, combinedLoading, gameUserExists: !!gameUser, error });

  return { gameUser, loading: combinedLoading, error, refreshUserProfile };
}
