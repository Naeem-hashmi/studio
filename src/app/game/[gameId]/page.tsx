
"use client";

// Placeholder for the actual game interface page
// This page will be responsible for displaying the game state,
// allowing players to choose actions, and showing turn results.

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useUser } from "@/hooks/useUser";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Swords, Shield, AlertTriangle, Info, Hourglass, Users } from "lucide-react";
import type { GameState, PlayerAction, AttackType, DefenseType, GameUser } from "@/types";
import { db } from "@/lib/firebase";
import { doc, onSnapshot, updateDoc, arrayUnion, serverTimestamp } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
// import { processTurn } from "@/lib/gameLogic"; // This will be created later

// Placeholder for Attack/Defense options
const attackOptions = [
  { id: "RAID_CAMP" as AttackType, label: "Raid Camp (Targets Military)", icon: <Swords /> },
  { id: "RESOURCE_HIJACK" as AttackType, label: "Resource Hijack (Targets Resources)", icon: <Swords /> },
  { id: "VAULT_BREAK" as AttackType, label: "Vault Break (Targets Gold)", icon: <Swords /> },
];

const defenseOptions = [
  { id: "BARRICADE_TROOPS" as DefenseType, label: "Barricade Troops (Defends Military)", icon: <Shield /> },
  { id: "SECURE_STORAGE" as DefenseType, label: "Secure Storage (Defends Resources)", icon: <Shield /> },
  { id: "GOLD_SENTINEL" as DefenseType, label: "Gold Sentinel (Defends Gold)", icon: <Shield /> },
];


export default function GamePage() {
  const params = useParams();
  const gameId = params.gameId as string;
  const router = useRouter();
  const { user: firebaseUser, loading: authLoading } = useAuth();
  // We need to fetch game user profiles for both players in the game.
  // This might require a new hook or direct fetches if useUser is only for the current user.
  const { gameUser: currentUserGameProfile, loading: userLoading } = useUser(); 
  const { toast } = useToast();

  const [gameState, setGameState] = useState<GameState | null>(null);
  const [gameLoading, setGameLoading] = useState(true);
  const [gameError, setGameError] = useState<string | null>(null);

  const [selectedAttack, setSelectedAttack] = useState<AttackType | null>(null);
  const [selectedDefense, setSelectedDefense] = useState<DefenseType | null>(null);
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);

  // Listen to game state changes
  useEffect(() => {
    if (!gameId || !firebaseUser) return;

    setGameLoading(true);
    const gameDocRef = doc(db, "games", gameId); // Assuming "games" collection

    const unsubscribe = onSnapshot(
      gameDocRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as GameState;
          setGameState(data);
          setGameLoading(false);
          setGameError(null);

          // If game is over, show result and option to go home
          if (data.status === "GAME_OVER") {
            // Logic to display winner, etc.
          }
        } else {
          setGameError("Game not found or has been deleted.");
          setGameState(null);
          setGameLoading(false);
        }
      },
      (error) => {
        console.error("Error fetching game state:", error);
        setGameError("Could not load game data. Please try refreshing.");
        setGameLoading(false);
      }
    );
    return () => unsubscribe();
  }, [gameId, firebaseUser]);

  const handleSubmitAction = async () => {
    if (!firebaseUser || !gameId || !gameState || !selectedAttack || !selectedDefense) {
      toast({ variant: "destructive", title: "Invalid Action", description: "Please select both an attack and a defense." });
      return;
    }
    if (gameState.status !== "CHOOSING_ACTIONS") {
      toast({ variant: "destructive", title: "Not Action Phase", description: "Cannot submit actions at this time." });
      return;
    }
    // Check if user has already submitted for this turn
    // This logic needs to be more robust, likely checking a field within gameState.players[userId]
    // For now, this is a simplified check.

    setIsSubmittingAction(true);
    try {
      const playerAction: PlayerAction = {
        playerId: firebaseUser.uid,
        attack: selectedAttack,
        defense: selectedDefense,
      };
      
      // Update Firestore: Add action to a subcollection or an array in the game doc.
      // This is a simplified example. A more robust solution might involve a "turns" subcollection
      // or updating player-specific fields within the gameState.
      const gameDocRef = doc(db, "games", gameId);

      // This is a conceptual update. The actual structure for storing actions needs to be defined
      // in GameState and handled by a server-side function (or transaction) to process turns
      // once both players have submitted.
      
      // Example: update a player's current action in the GameState
      const playerUpdatePath = `players.${firebaseUser.uid}.currentAction`;
      const playerHasSubmittedPath = `players.${firebaseUser.uid}.hasSubmittedAction`;
      await updateDoc(gameDocRef, {
        [playerUpdatePath]: playerAction,
        [playerHasSubmittedPath]: true,
        updatedAt: serverTimestamp(),
      });


      toast({ title: "Action Submitted", description: "Waiting for opponent..." });
      setSelectedAttack(null);
      setSelectedDefense(null);

      // After submitting, check if both players submitted. If so, trigger turn processing.
      // This check and trigger should ideally be a Cloud Function or handled by one player's client
      // if a Cloud Function is not used.
      // const updatedGameState = (await getDoc(gameDocRef)).data() as GameState; // get fresh state
      // let allSubmitted = true;
      // for (const pid of updatedGameState.playerIds) {
      //   if (!updatedGameState.players[pid]?.hasSubmittedAction) {
      //     allSubmitted = false;
      //     break;
      //   }
      // }
      // if (allSubmitted) {
      //   // await processTurn(gameId); // This would be a server action or cloud function
      // }

    } catch (error: any) {
      toast({ variant: "destructive", title: "Submission Failed", description: error.message || "Could not submit your action." });
    } finally {
      setIsSubmittingAction(false);
    }
  };


  if (authLoading || userLoading || gameLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-var(--navbar-height,80px))]">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg text-foreground">Loading Battle Arena...</p>
      </div>
    );
  }

  if (gameError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-var(--navbar-height,80px))] text-center p-4">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-xl font-semibold text-destructive mb-2">Error Loading Game</h2>
        <p className="text-muted-foreground mb-4 max-w-md">{gameError}</p>
        <Button onClick={() => router.push("/home")}>Return to Home</Button>
      </div>
    );
  }

  if (!gameState || !currentUserGameProfile || !firebaseUser) {
     return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-var(--navbar-height,80px))] text-center p-4">
        <Info className="h-12 w-12 text-yellow-500 mb-4" />
        <h2 className="text-xl font-semibold text-yellow-600 mb-2">Game Information Unavailable</h2>
        <p className="text-muted-foreground mb-4 max-w-md">
          There was an issue preparing the game. Please try rejoining or returning home.
        </p>
        <Button onClick={() => router.push("/rooms")}>Back to Rooms</Button>
      </div>
    );
  }

  const opponentId = gameState.playerIds.find(id => id !== firebaseUser.uid);
  const opponentProfile = opponentId ? gameState.players[opponentId] : null;
  const currentPlayerGameState = gameState.players[firebaseUser.uid];

  if (!currentPlayerGameState) {
     return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-var(--navbar-height,80px))] text-center p-4">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-xl font-semibold text-destructive mb-2">Error: Player Not in Game</h2>
        <p className="text-muted-foreground mb-4 max-w-md">Your profile is not part of this game's active players.</p>
        <Button onClick={() => router.push("/home")}>Return to Home</Button>
      </div>
    );
  }
  
  const alreadySubmittedThisTurn = currentPlayerGameState.hasSubmittedAction && gameState.status === "CHOOSING_ACTIONS";


  // Simplified UI - to be expanded significantly
  return (
    <div className="container mx-auto p-4">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-2xl text-primary flex justify-between items-center">
            <span>Turn {gameState.currentTurn} / {gameState.maxTurns}</span>
            <span className={`px-3 py-1 text-sm rounded-full ${
                gameState.status === "CHOOSING_ACTIONS" ? "bg-green-500/20 text-green-700" :
                gameState.status === "PROCESSING_TURN" ? "bg-yellow-500/20 text-yellow-700" :
                gameState.status === "GAME_OVER" ? "bg-red-500/20 text-red-700" : "bg-gray-500/20 text-gray-700"
              }`}>
              {gameState.status.replace("_", " ")}
            </span>
          </CardTitle>
          <CardDescription>Risk Level: {gameState.riskLevel}</CardDescription>
        </CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-6">
          {/* Current Player Info */}
          <PlayerInfoCard playerGameData={currentPlayerGameState} userProfile={currentUserGameProfile} isCurrentUser={true} />
          {/* Opponent Info */}
          {opponentProfile ? 
            <PlayerInfoCard playerGameData={opponentProfile} isCurrentUser={false} />
             : 
            <Card className="flex flex-col items-center justify-center p-6 border-dashed">
                <Users className="h-10 w-10 text-muted-foreground mb-2"/>
                <p className="text-muted-foreground">Waiting for opponent...</p>
            </Card>
          }
        </CardContent>
      </Card>

      {gameState.status === "GAME_OVER" && (
        <Card className="text-center p-6 bg-primary/10">
          <CardTitle className="text-3xl text-primary mb-3">
            {gameState.winnerId === firebaseUser.uid ? "Victory!" : 
             gameState.winnerId === "DRAW" ? "It's a Draw!" :
             gameState.winnerId ? "Defeat!" : "Game Over"}
          </CardTitle>
          <CardDescription className="mb-4">{gameState.winningCondition || "The battle has concluded."}</CardDescription>
          <Button onClick={() => router.push("/home")} size="lg">Return to Home Base</Button>
        </Card>
      )}

      {gameState.status === "CHOOSING_ACTIONS" && !alreadySubmittedThisTurn && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-xl text-accent">Plan Your Move, Commander!</CardTitle>
            <CardDescription>Select one attack and one defense option for this turn.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Attack Selection */}
            <div>
              <h3 className="font-semibold mb-2 text-lg">Choose Attack:</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {attackOptions.map(opt => (
                  <Button
                    key={opt.id}
                    variant={selectedAttack === opt.id ? "default" : "outline"}
                    onClick={() => setSelectedAttack(opt.id)}
                    className="flex flex-col h-auto p-3 text-center"
                    aria-pressed={selectedAttack === opt.id}
                  >
                    {React.cloneElement(opt.icon, { className: "h-6 w-6 mb-1"})}
                    {opt.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Defense Selection */}
            <div>
              <h3 className="font-semibold mb-2 text-lg">Choose Defense:</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {defenseOptions.map(opt => (
                  <Button
                    key={opt.id}
                    variant={selectedDefense === opt.id ? "default" : "outline"}
                    onClick={() => setSelectedDefense(opt.id)}
                    className="flex flex-col h-auto p-3 text-center"
                    aria-pressed={selectedDefense === opt.id}
                  >
                     {React.cloneElement(opt.icon, { className: "h-6 w-6 mb-1"})}
                    {opt.label}
                  </Button>
                ))}
              </div>
            </div>

            <Button
              onClick={handleSubmitAction}
              disabled={!selectedAttack || !selectedDefense || isSubmittingAction}
              size="lg"
              className="w-full mt-4"
            >
              {isSubmittingAction ? <Loader2 className="animate-spin mr-2" /> : <Swords className="mr-2" />}
              Confirm Actions & Engage!
            </Button>
          </CardContent>
        </Card>
      )}
       {alreadySubmittedThisTurn && gameState.status === "CHOOSING_ACTIONS" && (
        <Card className="mt-6 p-6 text-center bg-muted/50">
          <Hourglass className="h-10 w-10 text-primary mx-auto mb-3" />
          <CardTitle className="text-xl">Actions Submitted</CardTitle>
          <CardDescription>Waiting for your opponent to make their move...</CardDescription>
        </Card>
      )}

      {/* Turn History (Simplified) */}
      {gameState.turnHistory && gameState.turnHistory.length > 0 && (
        <Card className="mt-8">
          <CardHeader><CardTitle>Battle Log</CardTitle></CardHeader>
          <CardContent>
            {gameState.turnHistory.slice().reverse().map(turn => (
              <div key={turn.turnNumber} className="mb-2 p-2 border-b">
                <p className="font-semibold">Turn {turn.turnNumber}</p>
                {/* Display turn outcomes here */}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}


interface PlayerInfoCardProps {
  playerGameData: GameState['players'][string];
  userProfile?: GameUser | null; // Optional full user profile for current user
  isCurrentUser: boolean;
}

function PlayerInfoCard({ playerGameData, userProfile, isCurrentUser }: PlayerInfoCardProps) {
  const displayName = userProfile?.displayName || playerGameData.displayName || "Player";
  const gold = userProfile && isCurrentUser ? userProfile.gold : playerGameData.gold;
  const military = userProfile && isCurrentUser ? userProfile.military : playerGameData.military;
  const resources = userProfile && isCurrentUser ? userProfile.resources : playerGameData.resources;
  const attackLevel = userProfile && isCurrentUser ? userProfile.attackLevel : playerGameData.initialAttackLevel;
  const defenseLevel = userProfile && isCurrentUser ? userProfile.defenseLevel : playerGameData.initialDefenseLevel;
  
  return (
    <Card className={isCurrentUser ? "border-primary bg-primary/5" : "bg-card"}>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center">
          {isCurrentUser ? "Your Forces" : `${displayName}'s Forces`}
        </CardTitle>
         {/* <CardDescription>Attack: Lvl {attackLevel} | Defense: Lvl {defenseLevel}</CardDescription> */}
      </CardHeader>
      <CardContent className="space-y-1 text-sm">
        <p><strong>Gold:</strong> {gold}</p>
        <p><strong>Military:</strong> {military}</p>
        <p><strong>Resources:</strong> {resources}</p>
        <p className="text-xs text-muted-foreground pt-1">
            Attack Lvl: {attackLevel} | Defense Lvl: {defenseLevel}
        </p>
      </CardContent>
    </Card>
  );
}
