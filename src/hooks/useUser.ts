
"use client";

import { useState, useEffect, useCallback } from "react";
import type { GameUser } from "@/types";
import { useAuth } from "./useAuth";
import { getUserProfile } from "@/lib/firestoreActions";

export function useUser() {
  const { user: firebaseUser, loading: authLoading } = useAuth();
  const [gameUser, setGameUser] = useState<GameUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUserProfile = useCallback(async () => {
    if (firebaseUser) {
      setLoading(true);
      setError(null);
      try {
        const profile = await getUserProfile(firebaseUser.uid);
        setGameUser(profile);
      } catch (e: unknown) {
        if (e instanceof Error) {
          setError(e.message);
        } else {
          setError("An unknown error occurred while fetching user profile.");
        }
        console.error("fetchUserProfile error:", e);
        setGameUser(null); // Ensure gameUser is null on error
      } finally {
        setLoading(false);
      }
    } else if (!authLoading) {
      setGameUser(null);
      setLoading(false);
      setError(null); // Clear error if auth state changes to no user
    }
  }, [firebaseUser, authLoading]);

  useEffect(() => {
    fetchUserProfile();
  }, [fetchUserProfile]);

  return { gameUser, loading: loading || authLoading, error, refreshUserProfile: fetchUserProfile };
}
