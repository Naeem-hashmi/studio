
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
  const [fetchAttempt, setFetchAttempt] = useState(0);

  const attemptFetchProfile = useCallback(async (currentAttempt: number) => {
    if (!firebaseUser) {
      setProfileFetchingLoading(false); // Should not happen if called correctly
      return;
    }

    console.log(`useUser: Attempting to fetch profile for ${firebaseUser.uid}, attempt number ${currentAttempt + 1}`);
    setProfileFetchingLoading(true);
    // setError(null); // Clear error only before a new cycle of attempts

    try {
      const profile = await getUserProfile(firebaseUser.uid);

      if (profile) {
        console.log("useUser: Profile fetched successfully", profile);
        setGameUser(profile);
        setError(null); // Clear error on success
        setProfileFetchingLoading(false);
        setFetchAttempt(0); // Reset attempts on success for this user
      } else if (currentAttempt < MAX_RETRIES) {
        console.log(`useUser: Profile not found for ${firebaseUser.uid}, scheduling retry ${currentAttempt + 1} of ${MAX_RETRIES}`);
        // profileFetchingLoading remains true
        setTimeout(() => {
          // Trigger next attempt by advancing fetchAttempt state
          // The useEffect listening to fetchAttempt will call this function again IF other conditions are met
          setFetchAttempt(prev => prev + 1);
        }, RETRY_DELAY_MS * (currentAttempt + 1)); // Basic exponential backoff feel
      } else {
        console.log(`useUser: Profile not found for ${firebaseUser.uid} after max retries.`);
        setError("Your game profile could not be loaded. This might happen if you've just signed up. Please try refreshing the page. If the issue persists, contact support.");
        setGameUser(null);
        setProfileFetchingLoading(false);
        // fetchAttempt is already at MAX_RETRIES or more, no need to reset here unless starting a whole new cycle.
      }
    } catch (e: unknown) {
      console.error(`useUser: Error fetching profile for ${firebaseUser.uid} on attempt ${currentAttempt + 1}`, e);
      if (e instanceof Error) {
        setError(e.message);
      } else {
        setError("An unknown error occurred while fetching your profile.");
      }
      setGameUser(null);
      setProfileFetchingLoading(false);
    }
  }, [firebaseUser]); // Added firebaseUser, as it's used directly.

  // Effect for handling initial fetch and changes in authentication state
  useEffect(() => {
    console.log("useUser effect (auth state change): authLoading:", authLoading, "firebaseUser:", !!firebaseUser);
    if (authLoading) {
      // If auth is loading, reset everything and don't fetch
      setGameUser(null);
      setError(null);
      setProfileFetchingLoading(false);
      setFetchAttempt(0);
      return;
    }

    if (firebaseUser) {
      // User is authenticated
      console.log("useUser effect (auth state change): User authenticated. Resetting profile state for new fetch cycle.");
      setGameUser(null); // Clear previous game user
      setError(null);   // Clear previous errors
      setFetchAttempt(0); // Reset attempts for the new user/login
      setProfileFetchingLoading(true); // Indicate we are about to fetch
      attemptFetchProfile(0); // Start fetching with attempt 0
    } else {
      // No firebaseUser and not authLoading (user is logged out)
      console.log("useUser effect (auth state change): User logged out. Resetting all profile state.");
      setGameUser(null);
      setError(null);
      setProfileFetchingLoading(false);
      setFetchAttempt(0);
    }
  }, [firebaseUser, authLoading, attemptFetchProfile]); // attemptFetchProfile is a dependency

  // Effect for handling retries based on fetchAttempt changing
  useEffect(() => {
    console.log("useUser effect (retry logic): fetchAttempt:", fetchAttempt, "firebaseUser:", !!firebaseUser, "gameUser:", !!gameUser, "error:", !!error);
    if (firebaseUser && !authLoading && fetchAttempt > 0 && fetchAttempt <= MAX_RETRIES && !gameUser && !error) {
      // This condition means:
      // 1. We have a firebase user and auth is not loading.
      // 2. fetchAttempt was incremented (so it's > 0), meaning a retry was scheduled.
      // 3. We haven't exceeded max retries.
      // 4. We still don't have a gameUser.
      // 5. There isn't a persistent error that should stop retries.
      console.log(`useUser effect (retry logic): Conditions met for retry attempt ${fetchAttempt}. Calling attemptFetchProfile(${fetchAttempt}).`);
      attemptFetchProfile(fetchAttempt);
    } else if (fetchAttempt > MAX_RETRIES && !gameUser && !error) {
      // This case handles if somehow fetchAttempt goes beyond MAX_RETRIES without profile or error being set by attemptFetchProfile.
      // This is a safeguard. attemptFetchProfile should handle setting the error.
      console.log("useUser effect (retry logic): Exceeded MAX_RETRIES in retry effect, but no profile/error set. Setting error.");
      setError("Failed to load profile after multiple attempts (retry effect).");
      setProfileFetchingLoading(false);
    }
  }, [fetchAttempt, firebaseUser, authLoading, gameUser, error, attemptFetchProfile]); // attemptFetchProfile is a dependency

  const refreshUserProfile = useCallback(() => {
    if (firebaseUser) {
      console.log("useUser: refreshUserProfile called.");
      // Resetting states to trigger the main useEffect for auth state change
      // This will cause the first useEffect to run, which resets attempt and calls attemptFetchProfile(0)
      setGameUser(null);
      setError(null);
      setFetchAttempt(0); 
      setProfileFetchingLoading(true); // Explicitly set loading true before initiating fetch
      attemptFetchProfile(0); // Directly call to ensure it starts
    }
  }, [firebaseUser, attemptFetchProfile]); // attemptFetchProfile is a dependency

  const combinedLoading = authLoading || profileFetchingLoading;

  console.log("useUser render state:", { uid: firebaseUser?.uid, authLoading, profileFetchingLoading, combinedLoading, gameUserExists: !!gameUser, error, fetchAttempt });

  return { gameUser, loading: combinedLoading, error, refreshUserProfile };
}
