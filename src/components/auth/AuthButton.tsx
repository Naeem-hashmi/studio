"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuthContext } from "@/context/AuthContext"; // Using context here
import { LogIn, LogOut, UserCircle } from "lucide-react";

export default function AuthButton() {
  const { user, loading, logout } = useAuthContext();

  if (loading) {
    return <Button variant="outline" disabled>Loading...</Button>;
  }

  if (user) {
    return (
      <div className="flex items-center gap-2">
        <Avatar className="h-9 w-9">
          <AvatarImage src={user.photoURL || undefined} alt={user.displayName || "User"} />
          <AvatarFallback>
            {user.displayName ? user.displayName.charAt(0).toUpperCase() : <UserCircle />}
          </AvatarFallback>
        </Avatar>
        <Button variant="outline" onClick={logout} aria-label="Log Out">
          <LogOut className="mr-2 h-4 w-4" /> Logout
        </Button>
      </div>
    );
  }

  return (
    <Link href="/login" passHref>
      <Button variant="default" aria-label="Log In">
        <LogIn className="mr-2 h-4 w-4" /> Login
      </Button>
    </Link>
  );
}
