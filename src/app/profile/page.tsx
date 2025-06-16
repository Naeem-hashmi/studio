"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useUser } from "@/hooks/useUser";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ShieldCheck, Sword, DollarSign, Package, TrendingUp, TrendingDown, BarChart3, Loader2, AlertTriangle, RefreshCw, UserCircle } from "lucide-react";
import { Separator } from "@/components/ui/separator";

export default function ProfilePage() {
  const { user: firebaseUser, loading: authLoading } = useAuth();
  const { gameUser, loading: userLoading, error, refreshUserProfile } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !firebaseUser) {
      router.replace("/login");
    }
  }, [firebaseUser, authLoading, router]);

  if (authLoading || userLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-var(--navbar-height,80px))]">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <AlertTriangle className="h-16 w-16 text-destructive mb-4" />
        <h2 className="text-2xl font-semibold text-destructive mb-2">Error Loading Profile</h2>
        <p className="text-muted-foreground mb-4">{error}</p>
        <Button onClick={refreshUserProfile}>
          <RefreshCw className="mr-2 h-4 w-4" /> Try Again
        </Button>
      </div>
    );
  }

  if (!gameUser) {
    return (
      <div className="text-center py-10">
        <p>User profile not found. This shouldn't happen.</p>
        <p>If you've just signed up, try refreshing. If the problem persists, please contact support.</p>
         <Button onClick={refreshUserProfile} className="mt-4">
          <RefreshCw className="mr-2 h-4 w-4" /> Refresh
        </Button>
      </div>
    );
  }

  const totalGames = gameUser.wins + gameUser.losses;
  const winRate = totalGames > 0 ? Math.round((gameUser.wins / totalGames) * 100) : 0;

  return (
    <div className="container mx-auto px-4 py-12">
      <Card className="w-full max-w-3xl mx-auto shadow-xl border-primary/20 overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-primary/20 to-accent/20 p-8">
          <div className="flex items-center space-x-6">
            <Avatar className="h-24 w-24 border-4 border-background shadow-lg">
              <AvatarImage src={firebaseUser?.photoURL || undefined} alt={gameUser.displayName || "User"} />
              <AvatarFallback className="text-4xl bg-primary/30 text-primary-foreground">
                {gameUser.displayName ? gameUser.displayName.charAt(0).toUpperCase() : <UserCircle size={48}/>}
              </AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-4xl font-bold text-primary">{gameUser.displayName}</CardTitle>
              <CardDescription className="text-lg text-foreground/80">{firebaseUser?.email}</CardDescription>
              {gameUser.inRecoveryMode && (
                <p className="text-sm font-semibold text-destructive mt-1 p-1 px-2 bg-destructive/10 rounded-md inline-block">
                  <AlertTriangle className="inline h-4 w-4 mr-1" /> In Recovery Mode
                </p>
              )}
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="p-8 space-y-8">
          <section>
            <h3 className="text-2xl font-semibold text-primary mb-4 flex items-center">
              <BarChart3 className="mr-3 h-6 w-6" />
              Battle Statistics
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <StatCard icon={<TrendingUp className="text-green-500" />} label="Wins" value={gameUser.wins} />
              <StatCard icon={<TrendingDown className="text-red-500" />} label="Losses" value={gameUser.losses} />
              <StatCard icon={<BarChart3 className="text-blue-500" />} label="Win Rate" value={`${winRate}%`} />
            </div>
            {totalGames > 0 && (
                 <div className="mt-4">
                    <Label htmlFor="win-loss-progress" className="text-sm font-medium text-muted-foreground">Overall Performance</Label>
                    <Progress id="win-loss-progress" value={winRate} className="w-full h-3 mt-1 [&>div]:bg-gradient-to-r [&>div]:from-green-500 [&>div]:to-blue-500" aria-label={`Win rate ${winRate} percent`}/>
                 </div>
            )}
          </section>

          <Separator />

          <section>
            <h3 className="text-2xl font-semibold text-primary mb-6 flex items-center">
              <Package className="mr-3 h-6 w-6" />
              Current Resources
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <ResourceCard icon={<DollarSign className="text-yellow-500" />} label="Gold" value={gameUser.gold} maxValue={100} />
              <ResourceCard icon={<ShieldCheck className="text-red-500" />} label="Military" value={gameUser.military} maxValue={100} />
              <ResourceCard icon={<Package className="text-green-500" />} label="Supplies" value={gameUser.resources} maxValue={100} />
            </div>
          </section>
          
          <Separator />

          <section>
            <h3 className="text-2xl font-semibold text-primary mb-6 flex items-center">
              <Sword className="mr-3 h-6 w-6" />
              Arsenal Levels
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <LevelCard icon={<Sword className="text-orange-500" />} label="Attack Level" value={gameUser.attackLevel} maxLevel={3} />
              <LevelCard icon={<Shield className="text-teal-500" />} label="Defense Level" value={gameUser.defenseLevel} maxLevel={3} />
            </div>
            {/* Add upgrade buttons here when functionality is ready */}
             <div className="mt-6 text-center">
                <Button variant="outline" disabled className="bg-primary/10 hover:bg-primary/20">
                    Upgrade Arsenal (Coming Soon)
                </Button>
             </div>
          </section>

          {gameUser.inRecoveryMode && (
            <>
            <Separator/>
            <section>
                <h3 className="text-2xl font-semibold text-destructive mb-4 flex items-center">
                <AlertTriangle className="mr-3 h-6 w-6" />
                Recovery Progress
                </h3>
                <div className="space-y-3">
                    <div>
                        <p className="text-sm font-medium text-muted-foreground">Successful Attacks: {gameUser.recoveryProgress.successfulAttacks} / 10</p>
                        <Progress value={(gameUser.recoveryProgress.successfulAttacks / 10) * 100} className="h-2 mt-1" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-muted-foreground">Successful Defenses: {gameUser.recoveryProgress.successfulDefenses} / 10</p>
                        <Progress value={(gameUser.recoveryProgress.successfulDefenses / 10) * 100} className="h-2 mt-1" />
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
  <div className="bg-card p-4 rounded-lg shadow-md flex items-center space-x-3 border border-border hover:border-primary/50 transition-colors">
    <div className="p-2 bg-primary/10 rounded-full">{icon}</div>
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold text-foreground">{value}</p>
    </div>
  </div>
);

interface ResourceCardProps { icon: React.ReactNode; label: string; value: number; maxValue: number; }
const ResourceCard: React.FC<ResourceCardProps> = ({ icon, label, value, maxValue }) => (
  <div className="bg-card p-4 rounded-lg shadow-md border border-border hover:border-primary/50 transition-colors">
    <div className="flex items-center justify-between mb-1">
        <div className="flex items-center space-x-2">
            {icon}
            <p className="text-lg font-medium text-foreground">{label}</p>
        </div>
        <p className="text-xl font-bold text-primary">{value}</p>
    </div>
    <Progress value={(value / maxValue) * 100} className="h-2 w-full" aria-label={`${label} resource level: ${value} out of ${maxValue}`} />
    <p className="text-xs text-muted-foreground text-right mt-1">{value} / {maxValue}</p>
  </div>
);

interface LevelCardProps { icon: React.ReactNode; label: string; value: number; maxLevel: number; }
const LevelCard: React.FC<LevelCardProps> = ({ icon, label, value, maxLevel }) => (
  <div className="bg-card p-4 rounded-lg shadow-md border border-border hover:border-primary/50 transition-colors">
    <div className="flex items-center space-x-3 mb-2">
       <div className="p-2 bg-accent/10 rounded-full">{icon}</div>
      <div>
        <p className="text-lg font-medium text-foreground">{label}</p>
        <p className="text-2xl font-semibold text-accent">Level {value}</p>
      </div>
    </div>
    <Progress value={(value / maxLevel) * 100} className="h-2 w-full [&>div]:bg-accent" aria-label={`${label}: Level ${value} out of ${maxLevel}`} />
     <p className="text-xs text-muted-foreground text-right mt-1">Next Lvl: {value < maxLevel ? value + 1 : "MAX"}</p>
  </div>
);

// Dummy Label component if not imported from shadcn/ui or similar
const Label = React.forwardRef<
  HTMLLabelElement,
  React.LabelHTMLAttributes<HTMLLabelElement>
>(({ className, ...props }, ref) => (
  <label
    ref={ref}
    className={`block text-sm font-medium text-gray-700 ${className}`}
    {...props}
  />
));
Label.displayName = "Label";

