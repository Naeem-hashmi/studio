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
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to fetch user profile");
        console.error(e);
      } finally {
        setLoading(false);
      }
    } else if (!authLoading) {
      // No firebaseUser and auth is not loading anymore
      setGameUser(null);
      setLoading(false);
    }
  }, [firebaseUser, authLoading]);

  useEffect(() => {
    fetchUserProfile();
  }, [fetchUserProfile]);

  return { gameUser, loading: loading || authLoading, error, refreshUserProfile: fetchUserProfile };
}
