
"use client";

import { useState, useEffect, useCallback } from "react";
import type { GameUser } from "@/types";
import { useAuth } from "./useAuth";
import { getUserProfile } from "@/lib/firestoreActions";

export function useUser() {
  const { user: firebaseUser, loading: authLoading } = useAuth();
  const [gameUser, setGameUser] = useState<GameUser | null>(null);
  const [loading, setLoading] = useState(true); // Start as true
  const [error, setError] = useState<string | null>(null);
  const [fetchAttempt, setFetchAttempt] = useState(0);

  const performFetch = useCallback(async (attempt: number) => {
    if (firebaseUser) {
      setLoading(true); // Ensure loading is true at the start of an attempt
      setError(null);
      try {
        const profile = await getUserProfile(firebaseUser.uid);
        if (profile) {
          setGameUser(profile);
          setLoading(false); // Successfully fetched
          setFetchAttempt(0); // Reset attempts on success
        } else if (attempt < 2) { // Retry up to 2 times (total 3 attempts: 0, 1, 2)
          // Profile not found, but user is authenticated and we haven't exhausted retries
          setTimeout(() => setFetchAttempt(prev => prev + 1), 1000 * (attempt + 1)); // Wait 1s, then 2s
        } else {
          // Exhausted retries, profile still not found.
          setError("Failed to load your profile after initial setup. This can sometimes happen with new accounts if there's a slight delay. Please try refreshing the page. If the problem persists, please contact support.");
          setGameUser(null);
          setLoading(false);
        }
      } catch (e: unknown) {
        if (e instanceof Error) {
          setError(e.message);
        } else {
          setError("An unknown error occurred while fetching user profile.");
        }
        console.error("fetchUserProfile error (attempt " + attempt + "):", e);
        setGameUser(null);
        setLoading(false);
      }
    } else if (!authLoading) {
      // No firebaseUser and auth is not loading, so clear gameUser and stop loading
      setGameUser(null);
      setLoading(false);
      setError(null);
      setFetchAttempt(0); // Reset attempts
    }
    // If authLoading is true, we wait for it to resolve.
  }, [firebaseUser, authLoading]); // `performFetch` depends on these

  useEffect(() => {
    // This effect triggers when firebaseUser or authLoading changes, or when fetchAttempt changes for retries.
    if (firebaseUser) {
      if (fetchAttempt === 0) { // Initial fetch for a new/changed firebaseUser
        performFetch(0);
      } else if (fetchAttempt > 0 && fetchAttempt < 3) { // Subsequent retries
         performFetch(fetchAttempt);
      }
    } else if (!authLoading) {
      // Auth is done, no user. Reset everything.
      setGameUser(null);
      setLoading(false);
      setError(null);
      setFetchAttempt(0);
    }
  }, [firebaseUser, authLoading, fetchAttempt, performFetch]);


  const refreshUserProfile = useCallback(() => {
    setFetchAttempt(0); // Reset attempts
    if (firebaseUser) {
      // Directly call performFetch instead of just changing fetchAttempt to ensure it runs if it was already 0
      performFetch(0); 
    }
  }, [firebaseUser, performFetch]);

  return { gameUser, loading: loading || authLoading, error, refreshUserProfile };
}
