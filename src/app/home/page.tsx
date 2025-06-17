
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useUser } from "@/hooks/useUser";
import { Swords, Users, Bot, AlertTriangle, Loader2, GraduationCap, Eye } from "lucide-react";
// Removed Shield from lucide-react imports as it's used in setup-profile page

export default function HomePage() {
  const { user: firebaseUser, loading: authLoading } = useAuth();
  const { gameUser, loading: userCombinedLoading, error: userError, refreshUserProfile } = useUser();
  const router = useRouter();

  useEffect(() => {
    // If auth is not loading and there's no firebaseUser, redirect to login.
    // This handles cases where user logs out or session expires.
    if (!authLoading && !firebaseUser) {
      router.replace("/login");
    }
  }, [firebaseUser, authLoading, router]);

  // Handles initial Firebase Auth loading
  if (authLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-var(--navbar-height,80px))] text-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg text-foreground">Authenticating...</p>
      </div>
    );
  }

  // If auth is resolved, but no firebaseUser (e.g., after logout or if directly navigating here unauthenticated)
  // The useEffect above should catch this, but this is a fallback.
  if (!firebaseUser) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-var(--navbar-height,80px))] text-center">
        <p className="text-lg text-foreground">Redirecting to login...</p>
      </div>
    );
  }
  
  // At this point, firebaseUser is confirmed. Now check gameUser states from useUser.
  // userCombinedLoading reflects both auth state and profile fetching state.
  if (userCombinedLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-var(--navbar-height,80px))] text-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg text-foreground">Loading your command center...</p>
      </div>
    );
  }

  if (userError) {
     return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-var(--navbar-height,80px))] text-center p-8">
        <AlertTriangle className="h-16 w-16 text-destructive mb-4" />
        <h2 className="text-2xl font-semibold text-destructive mb-2">Error Accessing Profile</h2>
        <p className="text-muted-foreground mb-4">{userError}</p>
        <Button onClick={() => refreshUserProfile()} className="mr-2">Try Again</Button>
        <Button variant="outline" onClick={() => router.push("/setup-profile")}>Re-Setup Profile</Button>
      </div>
    );
  }

  // Fallback: If firebaseUser exists, not loading, no error, but gameUser is still null.
  // This indicates profile fetch completed but found no profile, or user somehow skipped setup.
  if (!gameUser) {
    return (
       <div className="flex flex-col items-center justify-center min-h-[calc(100vh-var(--navbar-height,80px))] text-center p-6">
        <AlertTriangle className="h-12 w-12 text-amber-500 mb-4" />
        <p className="text-lg text-foreground mb-3">Your game profile isn't fully set up or couldn't be loaded.</p>
        <p className="text-sm text-muted-foreground mb-4">This can sometimes happen for new accounts.</p>
        <div className="flex gap-2">
            <Button onClick={refreshUserProfile}>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Retry Loading Profile
            </Button>
             <Button variant="outline" onClick={() => router.push("/setup-profile")}>
                Go to Profile Setup
            </Button>
        </div>
      </div>
    );
  }
  
  // If we reach here, gameUser is successfully loaded.
  const isInRecovery = gameUser.inRecoveryMode;

  return (
    <div className="container mx-auto px-4 py-8">
      <header className="mb-10 text-center">
        <h1 className="text-4xl font-bold text-primary mb-2">
          Welcome, Commander {gameUser.displayName || "Valued Player"}!
        </h1>
        <p className="text-lg text-foreground/80">
          Your forces await your command. Choose your path to victory.
        </p>
      </header>

      {isInRecovery && (
        <Card className="mb-8 border-destructive bg-destructive/10">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center">
              <AlertTriangle className="mr-2 h-6 w-6" />
              Recovery Mode Active
            </CardTitle>
            <CardDescription className="text-destructive/80">
              You must complete Training Mode objectives to participate in other battles.
              Win 10 successful attacks and 10 successful defenses.
              Progress: {gameUser.recoveryProgress.successfulAttacks}/10 Attacks, {gameUser.recoveryProgress.successfulDefenses}/10 Defenses.
            </CardDescription>
          </CardHeader>
          <CardContent>
             <Link href="/training" passHref>
              <Button className="w-full bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                <GraduationCap className="mr-2 h-5 w-5" /> Go to Training Mode
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-3 gap-6">
        <GameModeCard
          title="Training Mode"
          description="Hone your skills against an AI opponent. Essential for recovery."
          icon={<Bot className="h-10 w-10 text-accent" />}
          link="/training"
          actionText="Start Training"
          disabled={false} 
          ariaLabel="Start Training Mode against AI"
        />
        <GameModeCard
          title="Quick War"
          description="Instantly match with another online commander for a swift battle."
          icon={<Swords className="h-10 w-10 text-accent" />}
          link="/quick-war"
          actionText="Find Match"
          disabled={isInRecovery}
          ariaLabel="Find a Quick War match against another player"
        />
        <GameModeCard
          title="Room Match"
          description="Create or join custom rooms with specific risk levels."
          icon={<Users className="h-10 w-10 text-accent" />}
          link="/rooms"
          actionText="Browse Rooms"
          disabled={isInRecovery}
          ariaLabel="Browse or create a custom Room Match"
        />
      </div>

      <Card className="mt-10 bg-primary/5 border-primary/20">
        <CardHeader>
          <CardTitle className="text-2xl text-primary flex items-center">
             <Eye className="mr-2 h-6 w-6" /> At a Glance: Your Empire
          </CardTitle>
        </CardHeader>
        <CardContent className="grid md:grid-cols-3 gap-4 text-center">
            <div>
                <p className="text-3xl font-bold text-yellow-500">{gameUser.gold}</p>
                <p className="text-sm text-muted-foreground">Gold</p>
            </div>
            <div>
                <p className="text-3xl font-bold text-red-500">{gameUser.military}</p>
                <p className="text-sm text-muted-foreground">Military Units</p>
            </div>
            <div>
                <p className="text-3xl font-bold text-green-500">{gameUser.resources}</p>
                <p className="text-sm text-muted-foreground">Resources</p>
            </div>
        </CardContent>
      </Card>

    </div>
  );
}

interface GameModeCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  link: string;
  actionText: string;
  disabled?: boolean;
  ariaLabel: string;
}

function GameModeCard({ title, description, icon, link, actionText, disabled, ariaLabel }: GameModeCardProps) {
  return (
    <Card className={`hover:shadow-xl transition-shadow duration-300 ${disabled ? 'opacity-60 bg-muted/50' : 'bg-card'}`}>
      <CardHeader className="items-center text-center">
        {icon}
        <CardTitle className="mt-4 text-2xl">{title}</CardTitle>
      </CardHeader>
      <CardContent className="text-center">
        <CardDescription className="mb-6 min-h-[40px]">{description}</CardDescription>
        <Link href={disabled ? "#" : link} passHref>
          <Button className="w-full" disabled={disabled} aria-label={ariaLabel}>
            {actionText}
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
