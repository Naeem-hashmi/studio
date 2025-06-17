
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useUser } from "@/hooks/useUser";
import { Swords, Users, Bot, AlertTriangle, Loader2, GraduationCap, Eye, RefreshCw, ArrowUpCircle, Shield, Axe } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { performStatUpgrade } from "@/lib/firestoreActions"; // For upgrades

const ATTACK_UPGRADE_COSTS: Record<number, { gold: number; military: number; resources: number }> = {
  2: { gold: 50, military: 25, resources: 25 }, // Cost to upgrade from level 1 to 2
  3: { gold: 150, military: 75, resources: 75 }, // Cost to upgrade from level 2 to 3
};

const DEFENSE_UPGRADE_COSTS: Record<number, { gold: number; military: number; resources: number }> = {
  2: { gold: 50, military: 25, resources: 25 },
  3: { gold: 150, military: 75, resources: 75 },
};

const MAX_LEVEL = 3;

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

  useEffect(() => {
    if (userError && userError.includes("Your game profile could not be loaded")) {
      // Specific error check to redirect to setup if profile is definitively not found.
      toast({
        title: "Profile Not Found",
        description: "Redirecting to profile setup.",
        variant: "destructive",
      });
      router.replace("/setup-profile");
    }
  }, [userError, router, toast]);


  const handleUpgrade = async (statType: 'attack' | 'defense') => {
    if (!firebaseUser || !gameUser) return;

    if (statType === 'attack') setIsUpgradingAttack(true);
    else setIsUpgradingDefense(true);

    try {
      await performStatUpgrade(firebaseUser.uid, statType);
      toast({
        title: "Upgrade Successful!",
        description: `${statType === 'attack' ? 'Attack' : 'Defense'} level increased.`,
      });
      await refreshUserProfile(); // Refresh user data
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

  if (userError && !userError.includes("Your game profile could not be loaded")) { // Avoid showing buttons if redirecting
     return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-var(--navbar-height,80px))] text-center p-8">
        <AlertTriangle className="h-16 w-16 text-destructive mb-4" />
        <h2 className="text-2xl font-semibold text-destructive mb-2">Error Loading Profile</h2>
        <p className="text-muted-foreground mb-6 text-sm max-w-md">{userError}</p>
        <div className="flex gap-3">
            <Button onClick={() => refreshUserProfile()}>
                <RefreshCw className="mr-2 h-4 w-4" /> Try Again
            </Button>
             <Button variant="outline" onClick={() => router.push("/setup-profile")}>
                Ensure Profile Setup
            </Button>
        </div>
      </div>
    );
  }
  
  if (!gameUser) {
    // This state implies loading has finished, no specific "profile not found" error for redirection,
    // but gameUser is still null. This might be a brief state or an unexpected issue.
    // The useUser hook's error handling should ideally prevent prolonged stays here.
    return (
       <div className="flex flex-col items-center justify-center min-h-[calc(100vh-var(--navbar-height,80px))] text-center p-6">
        <Loader2 className="h-12 w-12 animate-spin text-amber-500 mb-4" />
        <p className="text-lg text-foreground mb-3">Finalizing profile setup...</p>
        <p className="text-sm text-muted-foreground mb-4 max-w-md">
            Please wait a moment. If this persists, try refreshing.
        </p>
        <Button onClick={refreshUserProfile}>
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
        </Button>
      </div>
    );
  }
  
  const isInRecovery = gameUser.inRecoveryMode;

  const canUpgradeAttack = gameUser.attackLevel < MAX_LEVEL;
  const nextAttackLevel = gameUser.attackLevel + 1;
  const attackUpgradeCost = canUpgradeAttack ? ATTACK_UPGRADE_COSTS[nextAttackLevel] : null;
  const đủ_điều_kiện_nâng_cấp_tấn_công = attackUpgradeCost && gameUser.gold >= attackUpgradeCost.gold && gameUser.military >= attackUpgradeCost.military && gameUser.resources >= attackUpgradeCost.resources;

  const canUpgradeDefense = gameUser.defenseLevel < MAX_LEVEL;
  const nextDefenseLevel = gameUser.defenseLevel + 1;
  const defenseUpgradeCost = canUpgradeDefense ? DEFENSE_UPGRADE_COSTS[nextDefenseLevel] : null;
  const canAffordDefenseUpgrade = defenseUpgradeCost && gameUser.gold >= defenseUpgradeCost.gold && gameUser.military >= defenseUpgradeCost.military && gameUser.resources >= defenseUpgradeCost.resources;


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

      <section className="mt-10">
        <h2 className="text-3xl font-bold text-center text-primary mb-6">Upgrade Your Arsenal</h2>
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="bg-card">
            <CardHeader>
              <CardTitle className="flex items-center text-accent">
                <Axe className="mr-2 h-6 w-6" /> Attack Systems
              </CardTitle>
              <CardDescription>Current Level: {gameUser.attackLevel}</CardDescription>
            </CardHeader>
            <CardContent>
              {gameUser.attackLevel < MAX_LEVEL ? (
                <>
                  <p className="text-sm mb-1">Upgrade to Level {nextAttackLevel}:</p>
                  {attackUpgradeCost && (
                    <ul className="text-xs text-muted-foreground list-disc list-inside mb-3">
                      <li>Cost: {attackUpgradeCost.gold} Gold, {attackUpgradeCost.military} Military, {attackUpgradeCost.resources} Resources</li>
                    </ul>
                  )}
                  <Button 
                    onClick={() => handleUpgrade('attack')} 
                    disabled={!canUpgradeAttack || !đủ_điều_kiện_nâng_cấp_tấn_công || isUpgradingAttack}
                    className="w-full"
                  >
                    {isUpgradingAttack ? <Loader2 className="animate-spin" /> : <ArrowUpCircle className="mr-2 h-5 w-5" />}
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
              <CardTitle className="flex items-center text-accent">
                <Shield className="mr-2 h-6 w-6" /> Defense Systems
              </CardTitle>
              <CardDescription>Current Level: {gameUser.defenseLevel}</CardDescription>
            </CardHeader>
            <CardContent>
              {gameUser.defenseLevel < MAX_LEVEL ? (
                <>
                  <p className="text-sm mb-1">Upgrade to Level {nextDefenseLevel}:</p>
                  {defenseUpgradeCost && (
                    <ul className="text-xs text-muted-foreground list-disc list-inside mb-3">
                      <li>Cost: {defenseUpgradeCost.gold} Gold, {defenseUpgradeCost.military} Military, {defenseUpgradeCost.resources} Resources</li>
                    </ul>
                  )}
                  <Button 
                    onClick={() => handleUpgrade('defense')} 
                    disabled={!canUpgradeDefense || !canAffordDefenseUpgrade || isUpgradingDefense}
                    className="w-full"
                  >
                    {isUpgradingDefense ? <Loader2 className="animate-spin" /> : <ArrowUpCircle className="mr-2 h-5 w-5" />}
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

