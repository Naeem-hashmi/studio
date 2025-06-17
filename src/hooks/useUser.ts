
"use client";

import { useState, useEffect, useCallback } from "react";
import type { GameUser } from "@/types";
import { useAuth } from "./useAuth";
import { getUserProfile } from "@/lib/firestoreActions";

export function useUser() {
  const { user: firebaseUser, loading: authLoading } = useAuth();
  const [gameUser, setGameUser] = useState<GameUser | null>(null);
  // Local loading state specifically for the profile fetching process
  const [profileFetchingLoading, setProfileFetchingLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchAttempt, setFetchAttempt] = useState(0);

  const fetchProfile = useCallback(async (currentAttempt: number) => {
    if (!firebaseUser) {
      setProfileFetchingLoading(false); 
      // This case should ideally be handled by the useEffect, 
      // but as a safeguard if fetchProfile is somehow called without firebaseUser.
      return;
    }

    setProfileFetchingLoading(true);
    // setError(null); // Clear previous errors only when starting a new sequence (fetchAttempt === 0 in useEffect)

    try {
      const profile = await getUserProfile(firebaseUser.uid);
      if (profile) {
        setGameUser(profile);
        setProfileFetchingLoading(false);
        setFetchAttempt(0); // Reset on success
      } else if (currentAttempt < 2) { // Max 2 retries (total 3 attempts: 0, 1, 2)
        // Profile not found, schedule retry. profileFetchingLoading remains true.
        setTimeout(() => {
          setFetchAttempt(prev => prev + 1);
        }, 1500 * (currentAttempt + 1)); // Wait 1.5s, then 3s
      } else {
        // Exhausted retries
        setError("Your profile is taking a bit longer to finalize than usual. This can happen with new accounts. Please try refreshing the page. If the issue continues, please contact support.");
        setGameUser(null);
        setProfileFetchingLoading(false);
      }
    } catch (e: unknown) {
      if (e instanceof Error) {
        setError(e.message);
      } else {
        setError("An unknown error occurred while fetching your profile.");
      }
      console.error("fetchUserProfile error (attempt " + currentAttempt + "):", e);
      setGameUser(null);
      setProfileFetchingLoading(false);
    }
  }, [firebaseUser]); // firebaseUser is the main dependency

  useEffect(() => {
    if (firebaseUser) {
      // User is authenticated
      if (fetchAttempt === 0 && !gameUser) { 
        // Initial fetch for this firebaseUser, or after a refresh triggered by setFetchAttempt(0)
        setGameUser(null); // Clear stale data if any
        setError(null);   // Clear stale error
        fetchProfile(0);  // fetchProfile will setProfileFetchingLoading(true)
      } else if (fetchAttempt > 0 && fetchAttempt < 3 && !gameUser) { 
        // This is a retry attempt
        fetchProfile(fetchAttempt); // fetchProfile will setProfileFetchingLoading(true)
      }
      // If gameUser is already set, or fetchAttempt >= 3 (meaning retries exhausted), 
      // fetchProfile would have set profileFetchingLoading to false.
      // The hook will re-render with the new gameUser or error.
    } else if (!authLoading) {
      // No firebaseUser and auth is not loading (e.g., logged out, or initial load before auth state known)
      setGameUser(null);
      setProfileFetchingLoading(false);
      setError(null);
      setFetchAttempt(0);
    }
    // If authLoading is true, we are waiting for Firebase Auth to settle.
    // The combinedLoading state below will handle this.
  }, [firebaseUser, authLoading, fetchAttempt, fetchProfile, gameUser]);

  const refreshUserProfile = useCallback(() => {
    if (firebaseUser) { 
      // By setting fetchAttempt to 0, the useEffect will clear gameUser/error 
      // and start a fresh fetch sequence for the current firebaseUser.
      setFetchAttempt(0); 
    }
  }, [firebaseUser]);

  // Combined loading state: true if Firebase auth is loading OR our profile fetching is in progress.
  const combinedLoading = authLoading || profileFetchingLoading;

  return { gameUser, loading: combinedLoading, error, refreshUserProfile };
}
