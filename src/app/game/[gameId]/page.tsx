
"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useUser } from "@/hooks/useUser"; // To get current user's full profile for display
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Swords, Shield, AlertTriangle, Info, Hourglass, Users, CheckCircle, Gamepad2, Trophy } from "lucide-react";
import type { GameState, PlayerAction, AttackType, DefenseType, GameUser, GamePlayerState } from "@/types";
import { db } from "@/lib/firebase";
import { doc, onSnapshot, updateDoc, getDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { submitPlayerAction, processTurn as processTurnAction } from "@/lib/firestoreActions"; // Server action

// Define Attack/Defense options based on types/index.ts
const attackOptions = [
  { id: "RAID_CAMP" as AttackType, label: "Raid Camp", description:"Targets Military", icon: <Swords /> },
  { id: "RESOURCE_HIJACK" as AttackType, label: "Resource Hijack", description:"Targets Resources", icon: <Swords /> },
  { id: "VAULT_BREAK" as AttackType, label: "Vault Break", description:"Targets Gold", icon: <Swords /> },
];

const defenseOptions = [
  { id: "BARRICADE_TROOPS" as DefenseType, label: "Barricade Troops", description:"Defends Military", icon: <Shield /> },
  { id: "SECURE_STORAGE" as DefenseType, label: "Secure Storage", description:"Defends Resources", icon: <Shield /> },
  { id: "GOLD_SENTINEL" as DefenseType, label: "Gold Sentinel", description:"Defends Gold", icon: <Shield /> },
];


export default function GamePage() {
  const params = useParams();
  const gameId = params.gameId as string;
  const router = useRouter();
  const { user: firebaseUser, loading: authLoading } = useAuth();
  const { gameUser: currentUserGameProfile, loading: userProfileLoading } = useUser();
  const { toast } = useToast();

  const [gameState, setGameState] = useState<GameState | null>(null);
  const [gameLoading, setGameLoading] = useState(true);
  const [gameError, setGameError] = useState<string | null>(null);

  const [selectedAttack, setSelectedAttack] = useState<AttackType | null>(null);
  const [selectedDefense, setSelectedDefense] = useState<DefenseType | null>(null);
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const [isProcessingTurn, setIsProcessingTurn] = useState(false);


  // Listen to game state changes
  useEffect(() => {
    if (!gameId || !firebaseUser) {
      setGameLoading(firebaseUser ? true : false); // only true if we expect to load game
      return;
    }

    setGameLoading(true);
    const gameDocRef = doc(db, "games", gameId);

    const unsubscribe = onSnapshot(
      gameDocRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = { id: docSnap.id, ...docSnap.data() } as GameState;
          setGameState(data);
          // If status was PROCESSING_TURN and now it's CHOOSING_ACTIONS, turn processing is complete
          if (gameState?.status === "PROCESSING_TURN" && data.status === "CHOOSING_ACTIONS") {
            setIsProcessingTurn(false);
          }
          // Check if current user needs to be re-directed after game over for other player
          if (data.status === "GAME_OVER" && data.winnerId && data.playerIds.includes(firebaseUser.uid) && data.winnerId !== firebaseUser.uid && data.winnerId !== "DRAW") {
             // Could add a small delay here before routing
          }
        } else {
          setGameError("Game not found. It might have been concluded or deleted.");
          setGameState(null);
        }
        setGameLoading(false);
      },
      (error) => {
        console.error("Error fetching game state:", error);
        setGameError("Could not load game data. Please try refreshing.");
        setGameLoading(false);
      }
    );
    return () => unsubscribe();
  }, [gameId, firebaseUser, gameState?.status]); // Added gameState.status to re-evaluate some conditions

  const handleActionSubmit = async () => {
    if (!firebaseUser || !gameId || !gameState || !selectedAttack || !selectedDefense) {
      toast({ variant: "destructive", title: "Invalid Action", description: "Please select both an attack and a defense." });
      return;
    }
    if (gameState.status !== "CHOOSING_ACTIONS") {
      toast({ variant: "destructive", title: "Not Action Phase", description: "Cannot submit actions at this time." });
      return;
    }
    const currentPlayerState = gameState.players[firebaseUser.uid];
    if (currentPlayerState?.hasSubmittedAction) {
       toast({ variant: "default", title: "Already Submitted", description: "You've already submitted actions for this turn." });
      return;
    }

    setIsSubmittingAction(true);
    try {
      const playerAction: PlayerAction = {
        playerId: firebaseUser.uid,
        attack: selectedAttack,
        defense: selectedDefense,
      };
      await submitPlayerAction(gameId, firebaseUser.uid, playerAction);
      
      toast({ title: "Action Submitted", description: "Waiting for opponent..." });
      setSelectedAttack(null); // Reset selections for next turn
      setSelectedDefense(null);

      // After submitting, fetch the latest game state to see if both players have submitted
      // This is a bit of a race condition; ideally a Cloud Function handles this.
      const updatedGameDoc = await getDoc(doc(db, "games", gameId));
      if (updatedGameDoc.exists()) {
        const updatedGameState = {id: updatedGameDoc.id, ...updatedGameDoc.data()} as GameState;
        const allPlayersSubmitted = updatedGameState.playerIds.every(pid => updatedGameState.players[pid]?.hasSubmittedAction);
        
        if (allPlayersSubmitted && updatedGameState.status === "CHOOSING_ACTIONS") { // ensure it's still choosing
          toast({ title: "Opponent Ready!", description: "Processing turn..." });
          setIsProcessingTurn(true);
          // TRIGGER TURN PROCESSING (Placeholder - this should be a Cloud Function)
          // As a temporary measure, one client (e.g., the one who submitted last) could call this.
          // This is NOT robust for production.
          try {
            await processTurnAction(gameId); // Call server action for processing
            // State will update via onSnapshot listener
          } catch (processError: any) {
             toast({ variant: "destructive", title: "Turn Processing Error", description: processError.message || "Could not process the turn."});
             setIsProcessingTurn(false);
             // Potentially reset action submission status or game status via server action if stuck
          }
        }
      }

    } catch (error: any) {
      toast({ variant: "destructive", title: "Submission Failed", description: error.message || "Could not submit your action." });
    } finally {
      setIsSubmittingAction(false);
    }
  };

  if (authLoading || userProfileLoading || (gameLoading && !gameState && !gameError) ) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-var(--navbar-height,80px))] text-center p-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg text-foreground">Loading Battle Arena...</p>
      </div>
    );
  }

  if (!firebaseUser) { // Should be caught by AuthProvider, but as a safeguard
    router.replace(`/login?redirect=/game/${gameId}`);
    return <div className="text-center py-10">Redirecting to login...</div>;
  }

  if (gameError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-var(--navbar-height,80px))] text-center p-4">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-xl font-semibold text-destructive mb-2">Error Loading Game</h2>
        <p className="text-muted-foreground mb-4 max-w-md">{gameError}</p>
        <Button onClick={() => router.push("/home")} aria-label="Return to Home Base">Return to Home</Button>
      </div>
    );
  }
  
  if (!currentUserGameProfile && !userProfileLoading) {
     return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-var(--navbar-height,80px))] text-center p-4">
        <Info className="h-12 w-12 text-yellow-500 mb-4" />
        <h2 className="text-xl font-semibold text-yellow-600 mb-2">Profile Unavailable</h2>
        <p className="text-muted-foreground mb-4 max-w-md">
          Your game profile could not be loaded. Please ensure it's set up and try again.
        </p>
        <Button onClick={() => router.push("/home")} aria-label="Return to Home Base">Return to Home</Button>
      </div>
    );
  }

  if (!gameState) {
     return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-var(--navbar-height,80px))] text-center p-4">
        <Info className="h-12 w-12 text-blue-500 mb-4" />
        <h2 className="text-xl font-semibold text-blue-600 mb-2">Game Not Ready</h2>
        <p className="text-muted-foreground mb-4 max-w-md">
          The game data is not yet available. This might be because the opponent hasn't joined or the game is still being set up.
        </p>
        <Button onClick={() => router.push("/rooms")} aria-label="Back to Rooms">Back to Rooms</Button>
      </div>
    );
  }
  
  // Ensure playerIds has at least one element before trying to find opponent
  const opponentId = gameState.playerIds.length > 1 ? gameState.playerIds.find(id => id !== firebaseUser.uid) : undefined;
  const opponentPlayerState = opponentId ? gameState.players[opponentId] : null;
  const currentPlayerState = gameState.players[firebaseUser.uid];

  if (!currentPlayerState) {
     return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-var(--navbar-height,80px))] text-center p-4">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-xl font-semibold text-destructive mb-2">Error: You Are Not In This Game</h2>
        <p className="text-muted-foreground mb-4 max-w-md">Your profile is not part of this game's active players. This could be due to an error or if you were removed.</p>
        <Button onClick={() => router.push("/home")} aria-label="Return to Home Base">Return to Home</Button>
      </div>
    );
  }
  
  const hasPlayerSubmittedAction = currentPlayerState.hasSubmittedAction;

  return (
    <div className="container mx-auto px-2 py-4 sm:px-4 sm:py-8">
      <Card className="mb-4 sm:mb-6 shadow-lg border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-xl sm:text-2xl text-primary flex flex-col sm:flex-row justify-between items-center gap-2">
            <span className="flex items-center"><Gamepad2 className="mr-2 h-6 w-6" />Turn {gameState.currentTurn} / {gameState.maxTurns}</span>
            <span className={`px-3 py-1.5 text-xs sm:text-sm rounded-full font-semibold ${
                gameState.status === "CHOOSING_ACTIONS" ? "bg-green-100 text-green-700 border border-green-300" :
                gameState.status === "PROCESSING_TURN" ? "bg-yellow-100 text-yellow-700 border border-yellow-300 animate-pulse" :
                gameState.status === "GAME_OVER" ? "bg-red-100 text-red-700 border border-red-300" : 
                gameState.status === "WAITING_FOR_PLAYERS" ? "bg-blue-100 text-blue-700 border border-blue-300" :
                "bg-gray-100 text-gray-700 border border-gray-300"
              }`}
              aria-live="polite"
              aria-atomic="true"
            >
              {gameState.status.replace("_", " ")}
            </span>
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm">Risk Level: <span className="font-semibold">{gameState.riskLevel}</span></CardDescription>
        </CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-3 sm:gap-4">
          <PlayerInfoCard playerGameData={currentPlayerState} userProfile={currentUserGameProfile} isCurrentUser={true} />
          {opponentPlayerState ?
            <PlayerInfoCard playerGameData={opponentPlayerState} isCurrentUser={false} />
             :
            <Card className="flex flex-col items-center justify-center p-4 sm:p-6 border-dashed min-h-[100px] sm:min-h-[120px]">
                <Users className="h-8 w-8 sm:h-10 sm:w-10 text-muted-foreground mb-2"/>
                <p className="text-sm text-muted-foreground">Waiting for opponent...</p>
            </Card>
          }
        </CardContent>
      </Card>

      {isProcessingTurn && (
         <Card className="my-4 sm:my-6 p-4 sm:p-6 text-center bg-yellow-50 border-yellow-300">
          <Loader2 className="h-10 w-10 text-yellow-500 mx-auto mb-3 animate-spin" />
          <CardTitle className="text-lg sm:text-xl text-yellow-700">Processing Turn...</CardTitle>
          <CardDescription className="text-yellow-600">Calculating outcomes. Please wait.</CardDescription>
        </Card>
      )}

      {gameState.status === "CHOOSING_ACTIONS" && !hasPlayerSubmittedAction && !isProcessingTurn && (
        <Card className="mt-4 sm:mt-6 shadow-md border-accent/20">
          <CardHeader>
            <CardTitle className="text-lg sm:text-xl text-accent">Plan Your Move, Commander!</CardTitle>
            <CardDescription className="text-sm">Select one attack and one defense option for this turn.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 sm:space-y-6">
            <div>
              <h3 className="font-semibold mb-2 text-base sm:text-lg">Choose Attack:</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
                {attackOptions.map(opt => (
                  <Button
                    key={opt.id}
                    variant={selectedAttack === opt.id ? "default" : "outline"}
                    onClick={() => setSelectedAttack(opt.id)}
                    className="flex flex-col h-auto p-2.5 sm:p-3 text-center text-xs sm:text-sm justify-between min-h-[70px]"
                    aria-pressed={selectedAttack === opt.id}
                    aria-label={`Attack: ${opt.label}, ${opt.description}`}
                  >
                    {React.cloneElement(opt.icon, { className: "h-5 w-5 sm:h-6 sm:w-6 mb-1", "aria-hidden": "true"})}
                    <span className="font-medium">{opt.label}</span>
                    <span className="text-muted-foreground text-[10px] sm:text-xs leading-tight" aria-hidden="true">{opt.description}</span>
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-2 text-base sm:text-lg">Choose Defense:</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
                {defenseOptions.map(opt => (
                  <Button
                    key={opt.id}
                    variant={selectedDefense === opt.id ? "default" : "outline"}
                    onClick={() => setSelectedDefense(opt.id)}
                    className="flex flex-col h-auto p-2.5 sm:p-3 text-center text-xs sm:text-sm justify-between min-h-[70px]"
                    aria-pressed={selectedDefense === opt.id}
                    aria-label={`Defense: ${opt.label}, ${opt.description}`}
                  >
                     {React.cloneElement(opt.icon, { className: "h-5 w-5 sm:h-6 sm:w-6 mb-1", "aria-hidden": "true"})}
                    <span className="font-medium">{opt.label}</span>
                    <span className="text-muted-foreground text-[10px] sm:text-xs leading-tight" aria-hidden="true">{opt.description}</span>
                  </Button>
                ))}
              </div>
            </div>

            <Button
              onClick={handleActionSubmit}
              disabled={!selectedAttack || !selectedDefense || isSubmittingAction || isProcessingTurn}
              size="lg"
              className="w-full mt-3 sm:mt-4 text-sm sm:text-base"
              aria-label="Confirm selected attack and defense actions and engage"
            >
              {isSubmittingAction ? <Loader2 className="animate-spin mr-2 h-5 w-5" /> : <Swords className="mr-2 h-5 w-5" />}
              Confirm Actions & Engage!
            </Button>
          </CardContent>
        </Card>
      )}

       {gameState.status === "CHOOSING_ACTIONS" && hasPlayerSubmittedAction && !isProcessingTurn && (
        <Card className="mt-4 sm:mt-6 p-4 sm:p-6 text-center bg-muted/50 border-dashed">
          <Hourglass className="h-8 w-8 sm:h-10 sm:w-10 text-primary mx-auto mb-2 sm:mb-3" />
          <CardTitle className="text-lg sm:text-xl">Actions Submitted</CardTitle>
          <CardDescription className="text-sm">Waiting for your opponent to make their move...</CardDescription>
        </Card>
      )}

      {gameState.status === "GAME_OVER" && (
        <Card className="mt-4 sm:mt-6 text-center p-4 sm:p-6 bg-primary/10 border-primary/30">
          <Trophy className={`h-12 w-12 sm:h-16 sm:w-16 mx-auto mb-3 ${gameState.winnerId === firebaseUser.uid ? 'text-yellow-500' : gameState.winnerId === "DRAW" ? 'text-gray-500' : 'text-red-700'}`} />
          <CardTitle className="text-2xl sm:text-3xl text-primary mb-2">
            {gameState.winnerId === firebaseUser.uid ? "Victory!" :
             gameState.winnerId === "DRAW" ? "It's a Draw!" :
             gameState.winnerId ? "Defeat!" : "Game Over"}
          </CardTitle>
          <CardDescription className="mb-3 sm:mb-4 text-sm">{gameState.winningCondition || "The battle has concluded."}</CardDescription>
          <Button onClick={() => router.push("/home")} size="lg" className="text-sm sm:text-base" aria-label="Return to Home Base">
            Return to Home Base
          </Button>
        </Card>
      )}


      {gameState.turnHistory && gameState.turnHistory.length > 0 && (
        <Card className="mt-6 sm:mt-8 shadow-sm">
          <CardHeader><CardTitle className="text-base sm:text-lg">Battle Log</CardTitle></CardHeader>
          <CardContent className="space-y-3 max-h-60 overflow-y-auto px-3 sm:px-4 text-xs sm:text-sm">
            {gameState.turnHistory.slice().reverse().map((turn, index) => (
              <div key={index} className="pb-2 mb-2 border-b border-border last:border-b-0 last:pb-0 last:mb-0"
                   aria-label={`Turn ${turn.turnNumber} results.`}
              >
                <p className="font-semibold text-primary mb-1">Turn {turn.turnNumber}</p>
                {turn.effects.map((effect, effectIndex) => (
                    <p key={effectIndex} className="text-muted-foreground leading-snug">
                        {effect.message}
                        {/* Further details can be added here if needed */}
                    </p>
                ))}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}


interface PlayerInfoCardProps {
  playerGameData: GamePlayerState;
  userProfile?: GameUser | null; // Full user profile (e.g. for current user to show latest total gold)
  isCurrentUser: boolean;
}

function PlayerInfoCard({ playerGameData, userProfile, isCurrentUser }: PlayerInfoCardProps) {
  // Display name from game state player data for consistency during the game
  const displayName = playerGameData.displayName || "Player";

  // Resources are from the GamePlayerState, reflecting current game values
  const goldInGame = playerGameData.gold;
  const militaryInGame = playerGameData.military;
  const resourcesInGame = playerGameData.resources;

  // Levels are from GamePlayerState (snapshot at game start)
  const attackLevel = playerGameData.initialAttackLevel;
  const defenseLevel = playerGameData.initialDefenseLevel;

  return (
    <Card
      className={`${isCurrentUser ? "border-primary bg-primary/5" : "bg-card"} shadow-sm`}
      aria-labelledby={`player-info-title-${playerGameData.uid}`}
    >
      <CardHeader className="pb-2 pt-3 px-3 sm:px-4">
        <CardTitle id={`player-info-title-${playerGameData.uid}`} className="text-base sm:text-lg flex items-center">
          {isCurrentUser ? "Your Forces" : `${displayName}'s Forces`}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 px-3 sm:px-4 pb-3 text-xs sm:text-sm">
        <p aria-label={`Gold: ${goldInGame}`}><strong>Gold:</strong> {goldInGame}</p>
        <p aria-label={`Military: ${militaryInGame}`}><strong>Military:</strong> {militaryInGame}</p>
        <p aria-label={`Resources: ${resourcesInGame}`}><strong>Resources:</strong> {resourcesInGame}</p>
        <p className="text-[10px] sm:text-xs text-muted-foreground pt-1" aria-label={`Attack Level ${attackLevel}, Defense Level ${defenseLevel}`}>
            Attack Lvl: {attackLevel} | Defense Lvl: {defenseLevel}
        </p>
      </CardContent>
    </Card>
  );
}

