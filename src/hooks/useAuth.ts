"use client";
// This hook now simply consumes the AuthContext.
// The actual auth logic (onAuthStateChanged, signOut) is centralized in AuthContext.tsx.
import { useAuthContext } from "@/context/AuthContext";

export function useAuth() {
  return useAuthContext();
}
