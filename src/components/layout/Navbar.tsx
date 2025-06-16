"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth"; // Corrected path
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Gamepad2, UserCircle, LogIn, LogOut } from "lucide-react"; // Icons

export default function Navbar() {
  const { user, loading, logout } = useAuth();

  return (
    <nav className="bg-primary/10 shadow-md backdrop-blur-md">
      <div className="container mx-auto px-4 py-3 flex justify-between items-center">
        <Link href="/" className="flex items-center gap-2 text-primary hover:text-primary/80 transition-colors">
          <Gamepad2 className="h-8 w-8" />
          <h1 className="text-2xl font-bold">Tactical Echo</h1>
        </Link>
        <div className="flex items-center gap-4">
          {user && (
            <>
              <Link href="/home" passHref>
                <Button variant="ghost" aria-label="Home">Home</Button>
              </Link>
              <Link href="/profile" passHref>
                <Button variant="ghost" aria-label="Profile">Profile</Button>
              </Link>
            </>
          )}
          {loading ? (
            <Button variant="outline" disabled>Loading...</Button>
          ) : user ? (
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
          ) : (
            <Link href="/login" passHref>
              <Button variant="default" aria-label="Log In">
                <LogIn className="mr-2 h-4 w-4" /> Login
              </Button>
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
