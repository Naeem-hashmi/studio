
"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useUser } from "@/hooks/useUser";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ShieldCheck, Sword, DollarSign, Package, TrendingUp, TrendingDown, BarChart3, Loader2, AlertTriangle, RefreshCw, UserCircle, Shield as ShieldIcon, Pencil } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { updateUserProfile } from "@/lib/firestoreActions";
import { MAX_LEVEL } from "@/lib/gameConfig";


export default function ProfilePage() {
  const { user: firebaseUser, loading: authLoading } = useAuth();
  const { gameUser, loading: userLoading, error, refreshUserProfile } = useUser();
  const router = useRouter();
  const { toast } = useToast();

  const [isEditNameDialogOpen, setIsEditNameDialogOpen] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState("");
  const [editNameLoading, setEditNameLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && !firebaseUser) {
      router.replace("/login");
    }
  }, [firebaseUser, authLoading, router]);

  useEffect(() => {
    if (gameUser?.displayName) {
      setNewDisplayName(gameUser.displayName);
    }
  }, [gameUser?.displayName]);

  const handleSaveDisplayName = async () => {
    if (!firebaseUser || !newDisplayName.trim()) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Display name cannot be empty.",
      });
      return;
    }
    if (newDisplayName.trim().length > 30) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Display name cannot exceed 30 characters.",
      });
      return;
    }


    setEditNameLoading(true);
    try {
      await updateUserProfile(firebaseUser.uid, { displayName: newDisplayName.trim() });
      await refreshUserProfile();
      toast({
        title: "Success",
        description: "Display name updated successfully.",
      });
      setIsEditNameDialogOpen(false);
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: err.message || "Could not update display name.",
      });
    } finally {
      setEditNameLoading(false);
    }
  };


  if (authLoading || userLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-var(--navbar-height,80px))]">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-var(--navbar-height,80px))] text-center p-4 md:p-8">
        <AlertTriangle className="h-16 w-16 text-destructive mb-4" aria-hidden="true" />
        <h2 className="text-2xl font-semibold text-destructive mb-2">Error Loading Profile</h2>
        <p className="text-muted-foreground mb-4">{error}</p>
        <Button onClick={refreshUserProfile}>
          <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" /> Try Again
        </Button>
      </div>
    );
  }

  if (!gameUser) {
    return (
      <div className="text-center py-10 min-h-[calc(100vh-var(--navbar-height,80px))] flex flex-col items-center justify-center p-4">
        <p className="mb-2">User profile not found.</p>
        <p className="text-sm text-muted-foreground mb-4">You might need to complete the setup process.</p>
        <div className="flex gap-2">
          <Button onClick={() => router.push('/setup-profile')} className="mt-4 mr-2">Go to Setup</Button>
          <Button onClick={refreshUserProfile} className="mt-4">
            <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" /> Refresh Profile
          </Button>
        </div>
      </div>
    );
  }

  const totalGames = gameUser.wins + gameUser.losses;
  const winRate = totalGames > 0 ? Math.round((gameUser.wins / totalGames) * 100) : 0;
  const avatarLabel = gameUser.displayName ? `${gameUser.displayName}'s avatar` : "User avatar";


  return (
    <div className="container mx-auto px-2 py-6 sm:px-4 sm:py-8">
      <Card className="w-full max-w-3xl mx-auto shadow-xl border-primary/20 overflow-hidden bg-card">
        <CardHeader className="bg-primary/10 p-4 md:p-6">
          <div className="flex flex-col items-center text-center sm:flex-row sm:items-start sm:text-left sm:space-x-4 space-y-3 sm:space-y-0">
            <Avatar className="h-20 w-20 md:h-24 md:w-24 border-4 border-background shadow-lg" aria-label={avatarLabel}>
              <AvatarImage src={firebaseUser?.photoURL || undefined} alt={avatarLabel} />
              <AvatarFallback className="text-3xl md:text-4xl bg-primary/30 text-primary-foreground">
                {gameUser.displayName ? gameUser.displayName.charAt(0).toUpperCase() : <UserCircle size={48} aria-label="Default user icon"/>}
              </AvatarFallback>
            </Avatar>
            <div className="flex-grow">
              <div className="flex items-center justify-center sm:justify-start gap-1">
                <CardTitle className="text-2xl md:text-3xl font-bold text-primary">{gameUser.displayName}</CardTitle>
                <Dialog open={isEditNameDialogOpen} onOpenChange={setIsEditNameDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label="Edit display name">
                      <Pencil className="h-4 w-4 md:h-5 md:w-5 text-primary/70 hover:text-primary" aria-hidden="true" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                      <DialogTitle>Edit Display Name</DialogTitle>
                      <DialogDescription>
                        Choose a new display name (max 30 characters). Click save when you&apos;re done.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="displayNameEditInput" className="text-right col-span-1">
                          Name
                        </Label>
                        <Input
                          id="displayNameEditInput"
                          value={newDisplayName}
                          onChange={(e) => setNewDisplayName(e.target.value)}
                          className="col-span-3"
                          aria-label="New display name input"
                          maxLength={30}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <DialogClose asChild>
                         <Button variant="outline">Cancel</Button>
                      </DialogClose>
                      <Button type="submit" onClick={handleSaveDisplayName} disabled={editNameLoading || !newDisplayName.trim() || newDisplayName.trim().length > 30}>
                        {editNameLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save Changes
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
              <CardDescription className="text-sm md:text-base text-foreground/80">{firebaseUser?.email}</CardDescription>
              {gameUser.inRecoveryMode && (
                <p className="text-xs md:text-sm font-semibold text-destructive mt-1 p-1 px-2 bg-destructive/10 rounded-md inline-block" aria-label="Account status: In Recovery Mode">
                  <AlertTriangle className="inline h-4 w-4 mr-1" aria-hidden="true" /> In Recovery Mode
                </p>
              )}
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="p-4 md:p-6 space-y-6">
          <section aria-labelledby="battle-stats-heading">
            <h3 id="battle-stats-heading" className="text-lg md:text-xl font-semibold text-primary mb-3 flex items-center">
              <BarChart3 className="mr-2 h-5 w-5" aria-hidden="true" />
              Battle Statistics
            </h3>
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <StatCard icon={<TrendingUp className="text-green-500" />} label="Wins" value={gameUser.wins} />
              <StatCard icon={<TrendingDown className="text-red-500" />} label="Losses" value={gameUser.losses} />
              <StatCard icon={<BarChart3 className="text-blue-500" />} label="Win Rate" value={`${winRate}%`} />
            </div>
            {totalGames > 0 && (
                 <div className="mt-3">
                    <Label htmlFor="win-loss-progress" className="text-xs font-medium text-muted-foreground sr-only">Overall Performance Progress: {winRate}%</Label>
                    <Progress id="win-loss-progress" value={winRate} className="w-full h-2.5 mt-1 [&>div]:bg-gradient-to-r [&>div]:from-green-500 [&>div]:to-blue-500" aria-label={`Overall win rate: ${winRate} percent`}/>
                 </div>
            )}
          </section>

          <Separator />

          <section aria-labelledby="current-resources-heading">
            <h3 id="current-resources-heading" className="text-lg md:text-xl font-semibold text-primary mb-3 flex items-center">
              <Package className="mr-2 h-5 w-5" aria-hidden="true" />
              Current Resources
            </h3>
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <ResourceItem icon={<DollarSign className="text-yellow-500" />} label="Gold" value={gameUser.gold} />
              <ResourceItem icon={<ShieldCheck className="text-red-500" />} label="Military" value={gameUser.military} />
              <ResourceItem icon={<Package className="text-green-500" />} label="Supplies" value={gameUser.resources} />
            </div>
          </section>
          
          <Separator />

          <section aria-labelledby="arsenal-levels-heading">
            <h3 id="arsenal-levels-heading" className="text-lg md:text-xl font-semibold text-primary mb-3 flex items-center">
              <Sword className="mr-2 h-5 w-5" aria-hidden="true" />
              Arsenal Levels
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
              <LevelCard icon={<Sword className="text-orange-500" />} label="Attack Level" value={gameUser.attackLevel} maxLevel={MAX_LEVEL} />
              <LevelCard icon={<ShieldIcon className="text-teal-500" />} label="Defense Level" value={gameUser.defenseLevel} maxLevel={MAX_LEVEL} />
            </div>
          </section>

          {gameUser.inRecoveryMode && (
            <>
            <Separator/>
            <section aria-labelledby="recovery-progress-heading">
                <h3 id="recovery-progress-heading" className="text-lg md:text-xl font-semibold text-destructive mb-3 flex items-center">
                <AlertTriangle className="mr-2 h-5 w-5" aria-hidden="true" />
                Recovery Progress
                </h3>
                <div className="space-y-2.5">
                    <div>
                        <p className="text-xs font-medium text-muted-foreground">Successful Attacks: {gameUser.recoveryProgress.successfulAttacks} / 10</p>
                        <Progress value={(gameUser.recoveryProgress.successfulAttacks / 10) * 100} className="h-2 mt-1" aria-label={`Successful attacks progress: ${gameUser.recoveryProgress.successfulAttacks} out of 10`} />
                    </div>
                    <div>
                        <p className="text-xs font-medium text-muted-foreground">Successful Defenses: {gameUser.recoveryProgress.successfulDefenses} / 10</p>
                        <Progress value={(gameUser.recoveryProgress.successfulDefenses / 10) * 100} className="h-2 mt-1" aria-label={`Successful defenses progress: ${gameUser.recoveryProgress.successfulDefenses} out of 10`} />
                    </div>
                </div>
            </section>
            </>
          )}

        </CardContent>
      </Card>
    </div>
  );
}

interface StatCardProps { icon: React.ReactNode; label: string; value: string | number; }
const StatCard: React.FC<StatCardProps> = ({ icon, label, value }) => (
  <div
    className="bg-background p-3 rounded-lg shadow-sm flex flex-col items-center text-center space-y-1 border border-border hover:border-primary/50 transition-colors"
    role="group" 
    aria-label={`${label}: ${value}`} 
  >
    {React.cloneElement(icon as React.ReactElement, { 
      className: ((icon as React.ReactElement).props.className || "") + " h-6 w-6 mb-1", 
      "aria-hidden": "true" 
    })}
    <p className="text-sm text-muted-foreground">{label}</p>
    <p className="text-lg md:text-xl font-semibold text-foreground">{value}</p>
  </div>
);

interface ResourceItemProps {
  icon: React.ReactNode;
  label: string;
  value: number;
}
const ResourceItem: React.FC<ResourceItemProps> = ({ icon, label, value }) => (
  <div
    className="bg-background p-2 sm:p-3 rounded-lg shadow-sm flex flex-col items-center text-center space-y-1 border border-border"
    role="group"
    aria-label={`${label}: ${value}`}
  >
    {React.cloneElement(icon as React.ReactElement, { 
      className: ((icon as React.ReactElement).props.className || "") + " h-5 w-5 sm:h-6 sm:w-6", 
      "aria-hidden": "true" 
    })}
    <p className="text-base sm:text-lg font-bold text-primary">{value}</p>
    <p className="text-xs text-muted-foreground">{label}</p>
  </div>
);

interface LevelCardProps { icon: React.ReactNode; label: string; value: number; maxLevel: number; }
const LevelCard: React.FC<LevelCardProps> = ({ icon, label, value, maxLevel }) => (
  <div
    className="bg-background p-3 rounded-lg shadow-sm border border-border hover:border-primary/50 transition-colors"
    role="group"
    aria-label={`${label}: Level ${value} out of ${maxLevel}.${value < maxLevel ? ` Upgrade costs available on Home screen.` : ' Maximum Level Reached.'}`}
  >
    <div className="flex items-center space-x-2.5 mb-1.5">
       <div className="p-1.5 bg-accent/10 rounded-full" aria-hidden="true">
         {React.cloneElement(icon as React.ReactElement, { 
           className: ((icon as React.ReactElement).props.className || "") + " h-4 w-4", 
           "aria-hidden": "true" 
         })}
       </div>
      <div>
        <p className="text-sm md:text-base font-medium text-foreground">{label}</p>
        <p className="text-lg md:text-xl font-semibold text-accent">Level {value}</p>
      </div>
    </div>
    <Progress
        value={(value / maxLevel) * 100}
        className="h-1.5 w-full [&>div]:bg-accent"
        aria-label={`Level ${value} of ${maxLevel} progress bar`}
    />
     <p className="text-xs text-muted-foreground text-right mt-0.5">
       {value < maxLevel ? `Lvl ${value} / ${maxLevel}` : "MAX Level"}
     </p>
  </div>
);
    

    

