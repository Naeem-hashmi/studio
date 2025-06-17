
"use client";

import Link from "next/link";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth"; 
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Gamepad2, UserCircle, LogIn, LogOut, Sun, Moon, Menu, Home, User } from "lucide-react"; 
import React from "react";

export default function Navbar() {
  const { user, loading, logout } = useAuth();
  const { setTheme } = useTheme();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  const createNavLink = (href: string, label: string, icon: React.ReactNode, srLabel: string, isMobileOnly: boolean = false) => {
    const commonClasses = "w-full justify-start md:w-auto";
    const mobileOnlyClasses = isMobileOnly ? "" : "md:flex"; // Desktop links are flex
    
    return (
      <Link href={href} passHref legacyBehavior>
        <a onClick={() => setIsMobileMenuOpen(false)} className={`${isMobileOnly ? 'md:hidden' : ''} block`}> {/* Ensure link behavior and closing */}
          <Button variant="ghost" aria-label={srLabel} className={`${commonClasses} ${mobileOnlyClasses}`}>
            {icon} {label}
          </Button>
        </a>
      </Link>
    );
  };
  
  const desktopNavLinks = user ? (
    <>
      <Link href="/home" passHref legacyBehavior>
        <a onClick={() => setIsMobileMenuOpen(false)}>
          <Button variant="ghost" aria-label="Home"> Home </Button>
        </a>
      </Link>
      <Link href="/profile" passHref legacyBehavior>
        <a onClick={() => setIsMobileMenuOpen(false)}>
         <Button variant="ghost" aria-label="Profile"> Profile </Button>
        </a>
      </Link>
    </>
  ) : null;


  return (
    <nav className="bg-card shadow-md backdrop-blur-md sticky top-0 z-50 border-b">
      <div className="container mx-auto px-4 py-3 flex justify-between items-center">
        <Link href="/" className="flex items-center gap-2 text-primary hover:text-primary/80 transition-colors" onClick={() => setIsMobileMenuOpen(false)}>
          <Gamepad2 className="h-8 w-8" />
          <h1 className="text-2xl font-bold">Tactical Echo</h1>
        </Link>

        {/* Desktop Menu & Auth Actions */}
        <div className="hidden md:flex items-center gap-2"> {/* Reduced gap */}
          {desktopNavLinks}
          {loading ? (
            <Button variant="ghost" disabled>Loading...</Button>
          ) : user ? (
            <div className="flex items-center gap-2">
              {/* Avatar and Logout are part of user actions, not primary nav */}
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

        {/* Mobile Menu Trigger & Auth Actions */}
        <div className="md:hidden flex items-center gap-2">
          <ThemeToggle />
          {user && (
             <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Open navigation menu">
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[280px] sm:w-[320px] bg-card p-0">
                <div className="flex flex-col h-full">
                  <div className="p-4 border-b">
                     <Link href="/" className="flex items-center gap-2 text-primary hover:text-primary/80 transition-colors mb-2" onClick={() => setIsMobileMenuOpen(false)}>
                        <Gamepad2 className="h-7 w-7" />
                        <h1 className="text-xl font-bold">Tactical Echo</h1>
                     </Link>
                  </div>
                  
                  <div className="flex-grow p-4 space-y-2">
                    {/* User Profile Link Block */}
                    <Link href="/profile" passHref legacyBehavior>
                      <a onClick={() => setIsMobileMenuOpen(false)} className="block p-3 rounded-lg hover:bg-muted transition-colors -mx-1">
                        <div className="flex items-center gap-3">
                           <Avatar className="h-11 w-11">
                              <AvatarImage src={user.photoURL || undefined} alt={user.displayName || "User"} />
                              <AvatarFallback className="text-lg">
                              {user.displayName ? user.displayName.charAt(0).toUpperCase() : <UserCircle />}
                              </AvatarFallback>
                           </Avatar>
                           <div>
                              <span className="font-semibold block truncate text-sm">{user.displayName || "Your Profile"}</span>
                              {user.email && <span className="text-xs text-muted-foreground block truncate">{user.email}</span>}
                           </div>
                        </div>
                      </a>
                    </Link>
                    
                    <hr className="my-3"/>

                    {/* Navigation Links for Mobile */}
                    {createNavLink("/home", "Home", <Home className="mr-3 h-5 w-5" />, "Home", true)}
                    {/* Profile link is now above, integrated with avatar */}
                  </div>
                  
                  <div className="p-4 border-t mt-auto">
                    <Button variant="outline" onClick={() => { logout(); setIsMobileMenuOpen(false);}} aria-label="Log Out" className="w-full">
                      <LogOut className="mr-2 h-4 w-4" /> Logout
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          )}
           {!user && !loading && (
             <Link href="/login" passHref>
              <Button variant="default" size="sm" aria-label="Log In">
                <LogIn className="mr-1 h-4 w-4" /> Login
              </Button>
            </Link>
           )}
        </div>
      </div>
    </nav>
  );
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme(); // Get current theme for ARIA label
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Toggle theme. Current theme: ${theme || 'system'}`}>
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
