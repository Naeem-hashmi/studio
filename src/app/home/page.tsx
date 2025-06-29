
"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useUser } from "@/hooks/useUser";
import { Swords, Users, Bot, AlertTriangle, Loader2, GraduationCap, Eye, RefreshCw, ArrowUpCircle, Shield, Axe, UserPlus, HelpCircle, DollarSign, ToyBrick } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { performStatUpgrade } from "@/lib/firestoreActions";
import { MAX_LEVEL, ATTACK_UPGRADE_COSTS, DEFENSE_UPGRADE_COSTS } from "@/lib/gameConfig";


const PROFILE_NOT_FOUND_ERROR_SUBSTRING = "Your game profile could not be loaded";

export default function HomePage() {
  const { user: firebaseUser, loading: authLoading } = useAuth();
  const { gameUser, loading: userCombinedLoading, error: userError, refreshUserProfile } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  const [isUpgradingAttack, setIsUpgradingAttack] = useState(false);
  const [isUpgradingDefense, setIsUpgradingDefense] = useState(false);

  useEffect(() => {
    if (!authLoading && !firebaseUser) {
      router.replace("/login");
    }
  }, [firebaseUser, authLoading, router]);


  const handleUpgrade = async (statType: 'attack' | 'defense') => {
    if (!firebaseUser || !gameUser) return;

    if (statType === 'attack') setIsUpgradingAttack(true);
    else setIsUpgradingDefense(true);

    try {
      await performStatUpgrade(firebaseUser.uid, statType);
      toast({
        title: "Upgrade Successful!",
        description: `${statType === 'attack' ? 'Attack' : 'Defense'} level increased. Your resources have been updated.`,
      });
      await refreshUserProfile(); 
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Upgrade Failed",
        description: error.message || "Could not complete upgrade.",
      });
    } finally {
      if (statType === 'attack') setIsUpgradingAttack(false);
      else setIsUpgradingDefense(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-var(--navbar-height,80px))] text-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg text-foreground">Authenticating...</p>
      </div>
    );
  }
  
  if (!firebaseUser && !authLoading) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-var(--navbar-height,80px))] text-center">
          <p className="text-lg text-foreground">Redirecting to login...</p>
        </div>
      );
  }
  
  if (userCombinedLoading) { 
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-var(--navbar-height,80px))] text-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg text-foreground">Loading your command center...</p>
      </div>
    );
  }

  if (userError && userError.includes(PROFILE_NOT_FOUND_ERROR_SUBSTRING)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-var(--navbar-height,80px))] text-center p-6">
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl text-primary flex items-center justify-center">
              <HelpCircle className="mr-2 h-8 w-8" aria-hidden="true" /> Profile Assistance
            </CardTitle>
            <CardDescription className="text-muted-foreground pt-2">
              We couldn&apos;t load your game profile. This can happen if you&apos;re new or due to a temporary connection issue.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-foreground">
              Are you new to Tactical Echo? Or do you already have a profile?
            </p>
            <Button onClick={() => router.push('/setup-profile')} className="w-full">
              <UserPlus className="mr-2 h-4 w-4" aria-hidden="true" /> I&apos;m New / Create Profile
            </Button>
            <Button variant="outline" onClick={refreshUserProfile} className="w-full">
              <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" /> Retry / Load Existing Profile
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (userError) { 
     return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-var(--navbar-height,80px))] text-center p-4 md:p-8">
        <AlertTriangle className="h-16 w-16 text-destructive mb-4" aria-hidden="true" />
        <h2 className="text-2xl font-semibold text-destructive mb-2">Error Loading Profile</h2>
        <p className="text-muted-foreground mb-6 text-sm max-w-md">{userError}</p>
        <div className="flex gap-3">
            <Button onClick={refreshUserProfile}>
                <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" /> Try Again
            </Button>
             <Button variant="outline" onClick={() => router.push("/setup-profile")}>
                Set Up Profile
            </Button>
        </div>
      </div>
    );
  }
  
  if (!gameUser) {
    return (
       <div className="flex flex-col items-center justify-center min-h-[calc(100vh-var(--navbar-height,80px))] text-center p-6">
        <Loader2 className="h-12 w-12 animate-spin text-amber-500 mb-4" />
        <p className="text-lg text-foreground mb-3">Finalizing profile...</p>
        <p className="text-sm text-muted-foreground mb-4 max-w-md">
            Please wait a moment. If this persists, try refreshing or ensure your profile setup is complete.
        </p>
        <div className="flex gap-2">
          <Button onClick={refreshUserProfile} className="mr-2">
              <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" /> Refresh
          </Button>
          <Button variant="outline" onClick={() => router.push("/setup-profile")}>
              Go to Setup
          </Button>
        </div>
      </div>
    );
  }
  
  const isInRecovery = gameUser.inRecoveryMode;

  const canUpgradeAttack = gameUser.attackLevel < MAX_LEVEL;
  const nextAttackLevel = gameUser.attackLevel + 1;
  const attackUpgradeCost = canUpgradeAttack ? ATTACK_UPGRADE_COSTS[nextAttackLevel] : null;
  const canAffordAttackUpgrade = attackUpgradeCost && gameUser.gold >= attackUpgradeCost.gold && gameUser.resources >= attackUpgradeCost.resources;

  const canUpgradeDefense = gameUser.defenseLevel < MAX_LEVEL;
  const nextDefenseLevel = gameUser.defenseLevel + 1;
  const defenseUpgradeCost = canUpgradeDefense ? DEFENSE_UPGRADE_COSTS[nextDefenseLevel] : null;
  const canAffordDefenseUpgrade = defenseUpgradeCost && gameUser.gold >= defenseUpgradeCost.gold && gameUser.resources >= defenseUpgradeCost.resources;


  return (
    <div className="container mx-auto px-2 sm:px-4 py-6 sm:py-8">
      <header className="mb-8 text-center">
        <h1 className="text-3xl sm:text-4xl font-bold text-primary mb-2">
          Welcome, Commander {gameUser.displayName || "Valued Player"}!
        </h1>
        <p className="text-base sm:text-lg text-foreground/80">
          Your forces await your command. Choose your path to victory.
        </p>
      </header>

      {isInRecovery && (
        <Card className="mb-6 border-destructive bg-destructive/10">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center text-lg sm:text-xl">
              <AlertTriangle className="mr-2 h-5 w-5 sm:h-6 sm:w-6" aria-hidden="true" />
              Recovery Mode Active
            </CardTitle>
            <CardDescription className="text-destructive/80 text-xs sm:text-sm"
             aria-label={`Recovery Progress: ${gameUser.recoveryProgress.successfulAttacks} out of 10 attacks, ${gameUser.recoveryProgress.successfulDefenses} out of 10 defenses.`}
            >
              You must complete Training Mode objectives to participate in other battles.
              Win 10 successful attacks and 10 successful defenses.
              Progress: {gameUser.recoveryProgress.successfulAttacks}/10 Attacks, {gameUser.recoveryProgress.successfulDefenses}/10 Defenses.
            </CardDescription>
          </CardHeader>
          <CardContent>
             <Link href="/training" passHref>
              <Button className="w-full bg-destructive hover:bg-destructive/90 text-destructive-foreground text-sm sm:text-base">
                <GraduationCap className="mr-2 h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true"/> Go to Training Mode
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-3 gap-4 sm:gap-6">
        <GameModeCard
          title="Training Mode"
          description="Hone your skills against an AI opponent. Essential for recovery."
          icon={<Bot className="h-8 w-8 sm:h-10 sm:w-10 text-accent" />}
          link="/training"
          actionText="Start Training"
          disabled={false} 
          ariaLabel="Start Training Mode against AI"
        />
        <GameModeCard
          title="Quick War"
          description="Instantly match with another online commander for a swift battle."
          icon={<Swords className="h-8 w-8 sm:h-10 sm:w-10 text-accent" />}
          link="/quick-war"
          actionText="Find Match"
          disabled={isInRecovery}
          ariaLabel="Find a Quick War match against another player"
        />
        <GameModeCard
          title="Room Match"
          description="Create or join custom rooms with specific risk levels."
          icon={<Users className="h-8 w-8 sm:h-10 sm:w-10 text-accent" />}
          link="/rooms"
          actionText="Browse Rooms"
          disabled={isInRecovery}
          ariaLabel="Browse or create a custom Room Match"
        />
      </div>

      <Card className="mt-8 bg-primary/5 border-primary/20" 
            aria-labelledby="empire-summary-title">
        <CardHeader>
          <CardTitle id="empire-summary-title" className="text-xl sm:text-2xl text-primary flex items-center">
             <Eye className="mr-2 h-5 w-5 sm:h-6 sm:w-6" aria-hidden="true" /> At a Glance: Your Empire
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-2 sm:gap-4 text-center">
            <div aria-label={`Gold: ${gameUser.gold}`}>
                <p className="text-xl sm:text-3xl font-bold text-yellow-500" aria-hidden="true">{gameUser.gold}</p>
                <p className="text-xs sm:text-sm text-muted-foreground" aria-hidden="true">Gold</p>
            </div>
            <div aria-label={`Military Units: ${gameUser.military}`}>
                <p className="text-xl sm:text-3xl font-bold text-red-500" aria-hidden="true">{gameUser.military}</p>
                <p className="text-xs sm:text-sm text-muted-foreground" aria-hidden="true">Military</p>
            </div>
            <div aria-label={`Resources: ${gameUser.resources}`}>
                <p className="text-xl sm:text-3xl font-bold text-green-500" aria-hidden="true">{gameUser.resources}</p>
                <p className="text-xs sm:text-sm text-muted-foreground" aria-hidden="true">Resources</p>
            </div>
        </CardContent>
      </Card>

      <section className="mt-8">
        <h2 className="text-2xl sm:text-3xl font-bold text-center text-primary mb-4 sm:mb-6">Upgrade Your Arsenal</h2>
        <div className="grid md:grid-cols-2 gap-4 sm:gap-6">
          <Card className="bg-card">
            <CardHeader>
              <CardTitle className="flex items-center text-accent text-lg sm:text-xl">
                <Axe className="mr-2 h-5 w-5 sm:h-6 sm:w-6" aria-hidden="true" /> Attack Systems
              </CardTitle>
              <CardDescription aria-label={`Current Attack Level: ${gameUser.attackLevel}`}>
                Current Level: <span className="font-semibold" aria-hidden="true">{gameUser.attackLevel}</span>
              </CardDescription>
            </CardHeader>
            <CardContent>
              {gameUser.attackLevel < MAX_LEVEL ? (
                <>
                  <p className="text-xs sm:text-sm mb-1">Upgrade to Level {nextAttackLevel}:</p>
                  {attackUpgradeCost && (
                    <ul className="text-xs text-muted-foreground list-disc list-inside mb-2 sm:mb-3" 
                        aria-label={`Cost to upgrade attack to level ${nextAttackLevel}: ${attackUpgradeCost.gold} Gold, ${attackUpgradeCost.resources} Resources.`}>
                      <li aria-hidden="true"><DollarSign className="inline h-3 w-3 mr-1 text-yellow-500" /> Gold: {attackUpgradeCost.gold}</li>
                      <li aria-hidden="true"><ToyBrick className="inline h-3 w-3 mr-1 text-green-500" /> Resources: {attackUpgradeCost.resources}</li>
                    </ul>
                  )}
                  <Button 
                    onClick={() => handleUpgrade('attack')} 
                    disabled={!canUpgradeAttack || !canAffordAttackUpgrade || isUpgradingAttack}
                    className="w-full text-sm sm:text-base"
                    aria-label={`Upgrade Attack to Level ${nextAttackLevel}. Cost: ${attackUpgradeCost?.gold || 0} gold, ${attackUpgradeCost?.resources || 0} resources.`}
                  >
                    {isUpgradingAttack ? <Loader2 className="animate-spin" /> : <ArrowUpCircle className="mr-2 h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />}
                    Upgrade Attack to Lvl {nextAttackLevel}
                  </Button>
                </>
              ) : (
                <p className="font-semibold text-green-600">Max Attack Level Reached!</p>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card">
            <CardHeader>
              <CardTitle className="flex items-center text-accent text-lg sm:text-xl">
                <Shield className="mr-2 h-5 w-5 sm:h-6 sm:w-6" aria-hidden="true" /> Defense Systems
              </CardTitle>
               <CardDescription aria-label={`Current Defense Level: ${gameUser.defenseLevel}`}>
                Current Level: <span className="font-semibold" aria-hidden="true">{gameUser.defenseLevel}</span>
              </CardDescription>
            </CardHeader>
            <CardContent>
              {gameUser.defenseLevel < MAX_LEVEL ? (
                <>
                  <p className="text-xs sm:text-sm mb-1">Upgrade to Level {nextDefenseLevel}:</p>
                  {defenseUpgradeCost && (
                     <ul className="text-xs text-muted-foreground list-disc list-inside mb-2 sm:mb-3"
                         aria-label={`Cost to upgrade defense to level ${nextDefenseLevel}: ${defenseUpgradeCost.gold} Gold, ${defenseUpgradeCost.resources} Resources.`}>
                      <li aria-hidden="true"><DollarSign className="inline h-3 w-3 mr-1 text-yellow-500" /> Gold: {defenseUpgradeCost.gold}</li>
                      <li aria-hidden="true"><ToyBrick className="inline h-3 w-3 mr-1 text-green-500" /> Resources: {defenseUpgradeCost.resources}</li>
                    </ul>
                  )}
                  <Button 
                    onClick={() => handleUpgrade('defense')} 
                    disabled={!canUpgradeDefense || !canAffordDefenseUpgrade || isUpgradingDefense}
                    className="w-full text-sm sm:text-base"
                    aria-label={`Upgrade Defense to Level ${nextDefenseLevel}. Cost: ${defenseUpgradeCost?.gold || 0} gold, ${defenseUpgradeCost?.resources || 0} resources.`}
                  >
                    {isUpgradingDefense ? <Loader2 className="animate-spin" /> : <ArrowUpCircle className="mr-2 h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />}
                    Upgrade Defense to Lvl {nextDefenseLevel}
                  </Button>
                </>
              ) : (
                <p className="font-semibold text-green-600">Max Defense Level Reached!</p>
              )}
            </CardContent>
          </Card>
        </div>
      </section>
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
      <CardHeader className="items-center text-center pt-4 sm:pt-6">
        {React.cloneElement(icon as React.ReactElement, { "aria-hidden": "true" })}
        <CardTitle className="mt-3 text-xl sm:text-2xl">{title}</CardTitle>
      </CardHeader>
      <CardContent className="text-center pb-4 sm:pb-6">
        <CardDescription className="mb-4 sm:mb-6 min-h-[30px] sm:min-h-[40px] text-xs sm:text-sm">{description}</CardDescription>
        <Link href={disabled ? "#" : link} passHref legacyBehavior={disabled ? true : false}>
          <Button 
            asChild={!disabled} 
            className="w-full text-sm sm:text-base" 
            disabled={disabled} 
            aria-label={ariaLabel}
            tabIndex={disabled ? -1 : 0}
            onClick={(e) => { if (disabled) e.preventDefault(); }}
          >
            {disabled ? actionText : <a>{actionText}</a>}
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
