
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
  const [fetchAttempt, setFetchAttempt] = useState(0);

  const fetchProfile = useCallback(async (currentAttempt: number) => {
    if (!firebaseUser) {
      setProfileFetchingLoading(false);
      return;
    }

    setProfileFetchingLoading(true);
    // setError(null); // Error is cleared by refreshUserProfile or when firebaseUser changes

    try {
      const profile = await getUserProfile(firebaseUser.uid);
      if (profile) {
        setGameUser(profile);
        setError(null); // Clear error on successful fetch
        setFetchAttempt(0); // Reset on success
      } else if (currentAttempt < 2) { // Max 2 retries (total 3 attempts: 0, 1, 2)
        setTimeout(() => {
          setFetchAttempt(prev => prev + 1);
        }, 1500 * (currentAttempt + 1));
      } else {
        setError("Your profile is taking a bit longer to finalize. Please try refreshing. If the issue persists, contact support.");
        setGameUser(null);
      }
    } catch (e: unknown) {
      if (e instanceof Error) {
        setError(e.message);
      } else {
        setError("An unknown error occurred while fetching your profile.");
      }
      console.error("fetchUserProfile error (attempt " + currentAttempt + "):", e);
      setGameUser(null);
    } finally {
      // Only set loading to false if not scheduling a retry or if an error/success occurred
      if (currentAttempt >= 2 || gameUser || error) {
         // Check gameUser and error again because they might have been set in the try block
         const latestProfile = await getUserProfile(firebaseUser.uid).catch(() => null);
         if(latestProfile) {
            setGameUser(latestProfile);
            setError(null);
            setProfileFetchingLoading(false);
         } else if (currentAttempt >=2 ) {
            // If still no profile after max retries, then stop loading
            setProfileFetchingLoading(false);
         }
         // If retrying, profileFetchingLoading remains true
      }
       if (error || (currentAttempt >=2 && !gameUser)) {
        setProfileFetchingLoading(false);
      }
      const finalProfile = await getUserProfile(firebaseUser.uid).catch(() => null);
      if (finalProfile) {
        setGameUser(finalProfile);
        setError(null);
        setProfileFetchingLoading(false);
      } else if (currentAttempt >=2) {
         setError("Your profile is taking a bit longer to finalize. Please try refreshing. If the issue persists, contact support.");
         setProfileFetchingLoading(false);
      }
      // If currentAttempt < 2 and no profile yet, a retry is scheduled, so profileFetchingLoading remains true.
    }
  }, [firebaseUser]); // Removed gameUser, error from deps as they are managed inside or by other state setters

  useEffect(() => {
    if (firebaseUser) {
      // If firebaseUser changes, reset attempts and errors to ensure a fresh fetch sequence.
      if (fetchAttempt > 0 || error) { // Indicates a previous attempt for a (possibly different) user or an error state
         setGameUser(null); // Clear potentially stale gameUser
         setError(null);   // Clear error
         setFetchAttempt(0); // Reset fetch attempts for the new/current firebaseUser
         // The effect will re-run with fetchAttempt = 0.
      } else if (!gameUser && !error && fetchAttempt < 3) { // Initial fetch or retry for the current firebaseUser
        fetchProfile(fetchAttempt);
      }
      // If gameUser is loaded, or error is set for current fetch cycle, or retries exhausted, do nothing.
      // profileFetchingLoading is managed by fetchProfile.
    } else if (!authLoading) {
      // No firebaseUser and auth is not loading (e.g., logged out)
      setGameUser(null);
      setProfileFetchingLoading(false);
      setError(null);
      setFetchAttempt(0);
    }
    // If authLoading is true, we wait.
  }, [firebaseUser, authLoading, fetchAttempt, error, fetchProfile]); // Removed gameUser from dependencies


  const refreshUserProfile = useCallback(() => {
    if (firebaseUser) {
      setGameUser(null); // Clear current profile immediately
      setError(null);   // Clear current error immediately
      setProfileFetchingLoading(true); // Indicate loading has started
      setFetchAttempt(0); // Resetting fetchAttempt will trigger the useEffect to call fetchProfile(0)
    }
  }, [firebaseUser]); // firebaseUser is the key dependency here

  const combinedLoading = authLoading || profileFetchingLoading;

  return { gameUser, loading: combinedLoading, error, refreshUserProfile };
}
