
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
      setProfileFetchingLoading(false);
      return;
    }

    console.log(`useUser: Attempting to fetch profile for ${firebaseUser.uid}, attempt number ${currentAttempt + 1}`);
    setProfileFetchingLoading(true);
    // Don't clear error here, allow it to persist until success or explicit reset by refresh/new user

    try {
      const profile = await getUserProfile(firebaseUser.uid);

      if (profile) {
        console.log("useUser: Profile fetched successfully", profile);
        setGameUser(profile);
        setError(null); // Clear error on success
        setProfileFetchingLoading(false);
        // setFetchAttempt(0); // Reset attempts on success - useEffect will handle this better on firebaseUser change
      } else if (currentAttempt < MAX_RETRIES) {
        console.log(`useUser: Profile not found for ${firebaseUser.uid}, scheduling retry ${currentAttempt + 1} of ${MAX_RETRIES}`);
        setTimeout(() => {
          // Trigger next attempt by advancing fetchAttempt state
          // The useEffect listening to fetchAttempt will call this function again
          setFetchAttempt(prev => prev + 1);
        }, RETRY_DELAY_MS * (currentAttempt + 1));
        // profileFetchingLoading remains true
      } else {
        console.log(`useUser: Profile not found for ${firebaseUser.uid} after max retries.`);
        setError("Your game profile could not be loaded. This might happen if you've just signed up. Please try refreshing the page. If the issue persists, contact support.");
        setGameUser(null);
        setProfileFetchingLoading(false);
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
  }, [firebaseUser]); // Depends on firebaseUser to ensure it has the correct uid

  useEffect(() => {
    // Effect for initiating or resetting fetch logic when auth state changes
    if (authLoading) {
      // console.log("useUser effect (auth): Auth is loading. Resetting related state.");
      // If auth is loading, we shouldn't be fetching. Reset dependent states.
      setGameUser(null);
      setError(null);
      setProfileFetchingLoading(false); // Not fetching profile if auth is not ready
      setFetchAttempt(0);
      return;
    }

    if (firebaseUser) {
      // console.log("useUser effect (auth): firebaseUser present. Current fetchAttempt:", fetchAttempt, "gameUser:", !!gameUser, "error:", error);
      // If firebaseUser exists, and we haven't started fetching yet for this user (fetchAttempt is 0)
      // or if a previous fetch for this user resulted in an error and we want to allow a manual refresh to retry.
      // This block primarily handles the *initial* fetch or reset for a new/changed firebaseUser.
      if (fetchAttempt === 0 && !gameUser && !error) { // Only start if no gameUser and no error from previous attempt for this user
        console.log("useUser effect (auth): Conditions met for initial profile fetch. Calling attemptFetchProfile(0).");
        attemptFetchProfile(0);
      } else if (fetchAttempt === 0 && error) {
        // User is logged in, but there was a previous error, and fetchAttempt has been reset (e.g. by refresh)
        // This allows a refresh to clear an error and try again.
        console.log("useUser effect (auth): Error exists but fetchAttempt is 0 (likely after refresh). Calling attemptFetchProfile(0).");
        setError(null); // Clear the error before retrying
        attemptFetchProfile(0);
      }
    } else {
      // No firebaseUser and not authLoading (user is logged out)
      // console.log("useUser effect (auth): No firebaseUser. Resetting all profile state.");
      setGameUser(null);
      setError(null);
      setProfileFetchingLoading(false);
      setFetchAttempt(0);
    }
  }, [firebaseUser, authLoading, attemptFetchProfile]); // gameUser and error removed from here as they might cause loops.
                                                       // attemptFetchProfile is added as it's used.

  useEffect(() => {
    // Effect specifically for handling retries based on fetchAttempt changing
    if (firebaseUser && !authLoading && fetchAttempt > 0 && fetchAttempt <= MAX_RETRIES && !gameUser && !error) {
      console.log(`useUser effect (retry): fetchAttempt is ${fetchAttempt}. Calling attemptFetchProfile(${fetchAttempt}).`);
      // The actual call to fetch again is triggered here, after setTimeout in attemptFetchProfile updates fetchAttempt
      // No, this is wrong. setTimeout directly updates fetchAttempt.
      // The call to attemptFetchProfile for retries should happen when fetchAttempt changes AFTER the initial call.
      // The previous effect handles attempt 0. This handles > 0.
      // Let's rethink: attemptFetchProfile itself schedules the *next* attempt by setting fetchAttempt.
      // So this effect becomes simpler: if fetchAttempt > 0 and conditions met, call attemptFetchProfile.
      // The setTimeout IS the delay, then it setsFetchAttempt, then THIS effect runs.
      attemptFetchProfile(fetchAttempt);
    }
  }, [fetchAttempt, firebaseUser, authLoading, gameUser, error, attemptFetchProfile]);


  const refreshUserProfile = useCallback(() => {
    if (firebaseUser) {
      console.log("useUser: refreshUserProfile called.");
      setGameUser(null);
      setError(null);
      // setProfileFetchingLoading(true); // Set to true to indicate refresh is starting
      setFetchAttempt(0); // This will trigger the main useEffect to re-initiate fetch with attempt 0
                        // which in turn calls attemptFetchProfile(0) which sets profileFetchingLoading to true.
    }
  }, [firebaseUser]);

  const combinedLoading = authLoading || profileFetchingLoading;

  // console.log("useUser return state:", { uid: firebaseUser?.uid, authLoading, profileFetchingLoading, combinedLoading, gameUserExists: !!gameUser, error, fetchAttempt });

  return { gameUser, loading: combinedLoading, error, refreshUserProfile };
}
