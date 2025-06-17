"use client";

import Link from "next/link";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth"; // Corrected path
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetTrigger, SheetClose } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Gamepad2, UserCircle, LogIn, LogOut, Sun, Moon, Menu, Home, User } from "lucide-react"; // Icons
import React from "react";

export default function Navbar() {
  const { user, loading, logout } = useAuth();
  const { setTheme } = useTheme();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  const navLinks = (
    <>
      <Link href="/home" passHref>
        <Button variant="ghost" aria-label="Home" className="w-full justify-start md:w-auto" onClick={() => setIsMobileMenuOpen(false)}>
          <Home className="mr-2 h-4 w-4 md:hidden" /> Home
        </Button>
      </Link>
      <Link href="/profile" passHref>
        <Button variant="ghost" aria-label="Profile" className="w-full justify-start md:w-auto" onClick={() => setIsMobileMenuOpen(false)}>
          <User className="mr-2 h-4 w-4 md:hidden" /> Profile
        </Button>
      </Link>
    </>
  );

  return (
    <nav className="bg-primary/10 shadow-md backdrop-blur-md sticky top-0 z-50">
      <div className="container mx-auto px-4 py-3 flex justify-between items-center">
        <Link href="/" className="flex items-center gap-2 text-primary hover:text-primary/80 transition-colors" onClick={() => setIsMobileMenuOpen(false)}>
          <Gamepad2 className="h-8 w-8" />
          <h1 className="text-2xl font-bold">Tactical Echo</h1>
        </Link>

        {/* Desktop Menu & Auth Actions */}
        <div className="hidden md:flex items-center gap-4">
          {user && navLinks}
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
          <ThemeToggle />
        </div>

        {/* Mobile Menu Trigger & Auth Actions (outside desktop links) */}
        <div className="md:hidden flex items-center gap-2">
          <ThemeToggle />
          {user && (
             <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Open navigation menu">
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[250px] sm:w-[300px]">
                <div className="flex flex-col space-y-4 p-4">
                  <div className="mb-4">
                     <Link href="/" className="flex items-center gap-2 text-primary hover:text-primary/80 transition-colors mb-6" onClick={() => setIsMobileMenuOpen(false)}>
                        <Gamepad2 className="h-7 w-7" />
                        <h1 className="text-xl font-bold">Tactical Echo</h1>
                     </Link>
                  </div>
                  {navLinks}
                  <hr className="my-4"/>
                  <div className="flex items-center gap-2 mb-4">
                     <Avatar className="h-9 w-9">
                        <AvatarImage src={user.photoURL || undefined} alt={user.displayName || "User"} />
                        <AvatarFallback>
                        {user.displayName ? user.displayName.charAt(0).toUpperCase() : <UserCircle />}
                        </AvatarFallback>
                     </Avatar>
                     <span className="font-medium truncate">{user.displayName || user.email}</span>
                  </div>
                  <Button variant="outline" onClick={() => { logout(); setIsMobileMenuOpen(false);}} aria-label="Log Out" className="w-full">
                    <LogOut className="mr-2 h-4 w-4" /> Logout
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          )}
           {!user && !loading && (
             <Link href="/login" passHref>
              <Button variant="default" size="sm" aria-label="Log In">
                <LogIn className="mr-2 h-4 w-4" /> Login
              </Button>
            </Link>
           )}
        </div>
      </div>
    </nav>
  );
}

function ThemeToggle() {
  const { setTheme } = useTheme();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Toggle theme">
          <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")} aria-label="Set light theme">
          Light
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")} aria-label="Set dark theme">
          Dark
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")} aria-label="Set system theme">
          System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
