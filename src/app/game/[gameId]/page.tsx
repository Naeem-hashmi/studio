
"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useUser } from "@/hooks/useUser";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Swords, Shield, AlertTriangle, Info, Hourglass, Users, CheckCircle, Gamepad2, Trophy, Copy, LogOut, Trash2, ArrowLeft, UserCircle } from "lucide-react"; // Added UserCircle
import type { GameState, PlayerAction, AttackType, DefenseType, GameUser, GamePlayerState, Room } from "@/types";
import { db } from "@/lib/firebase";
import { doc, onSnapshot, updateDoc, getDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { submitPlayerAction, processTurn as processTurnAction, deleteRoom as deleteRoomAction, getRoom } from "@/lib/firestoreActions";

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
  const gameIdFromUrl = params.gameId as string; // This is effectively the roomId
  const router = useRouter();
  const { user: firebaseUser, loading: authLoading } = useAuth();
  const { gameUser: currentUserGameProfile, loading: userProfileLoading } = useUser();
  const { toast } = useToast();

  const [roomData, setRoomData] = useState<Room | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedAttack, setSelectedAttack] = useState<AttackType | null>(null);
  const [selectedDefense, setSelectedDefense] = useState<DefenseType | null>(null);
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const [isProcessingTurn, setIsProcessingTurn] = useState(false); // For client-side indication

  // Listen to Room changes to manage lobby state
  useEffect(() => {
    if (!gameIdFromUrl || !firebaseUser) {
      setLoading(firebaseUser ? true : false);
      return;
    }
    setLoading(true);
    const roomDocRef = doc(db, "rooms", gameIdFromUrl);
    const unsubscribeRoom = onSnapshot(roomDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = { id: docSnap.id, ...docSnap.data() } as Room;
        setRoomData(data);
        setError(null);
        if (data.status === "CLOSED" || data.status === "ABORTED") {
            toast({title: "Room Closed", description: "This room is no longer active."});
            router.replace("/rooms");
        }
      } else {
        setError("Room not found. It might have been deleted or does not exist.");
        setRoomData(null);
        setGameState(null); // If room doesn't exist, game can't exist
      }
      // setLoading(false) will be handled by gameState listener or if room not found
    }, (err) => {
      console.error("Error fetching room data:", err);
      setError("Could not load room information. Please try refreshing.");
      setLoading(false);
    });
    return () => unsubscribeRoom();
  }, [gameIdFromUrl, firebaseUser, router, toast]);


  // Listen to GameState changes once room is IN_GAME and gameId is known
  useEffect(() => {
    if (!roomData || roomData.status !== "IN_GAME" || !roomData.gameId || !firebaseUser) {
      if (roomData && roomData.status !== "IN_GAME") setLoading(false); // If room is waiting, not loading game state
      if (!roomData && !error) setLoading(true) // Still waiting for room data
      setGameState(null); // No active game if room not IN_GAME
      return;
    }

    setLoading(true); // Loading game state
    const gameDocRef = doc(db, "games", roomData.gameId);
    const unsubscribeGame = onSnapshot(gameDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = { id: docSnap.id, ...docSnap.data() } as GameState;
        setGameState(data);
        if (gameState?.status === "PROCESSING_TURN" && data.status === "CHOOSING_ACTIONS") {
          setIsProcessingTurn(false); // Turn processing done
        }
      } else {
        // This might happen briefly if game is being created
        // setError("Game data not found. It might be initializing or an error occurred.");
        setGameState(null);
      }
      setLoading(false);
    }, (err) => {
      console.error("Error fetching game state:", err);
      setError("Could not load game data. Please try refreshing.");
      setLoading(false);
    });
    return () => unsubscribeGame();
  }, [roomData, firebaseUser, error, gameState?.status]); // gameState.status to help re-evaluate processing state

  const handleActionSubmit = async () => {
    if (!firebaseUser || !gameState || !gameState.id || !selectedAttack || !selectedDefense) {
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
      const playerAction: PlayerAction = { playerId: firebaseUser.uid, attack: selectedAttack, defense: selectedDefense };
      await submitPlayerAction(gameState.id, firebaseUser.uid, playerAction);
      toast({ title: "Action Submitted", description: "Waiting for opponent..." });
      setSelectedAttack(null);
      setSelectedDefense(null);

      // Check if both players have submitted to trigger processing (client-side trigger for now)
      const updatedGameDoc = await getDoc(doc(db, "games", gameState.id));
      if (updatedGameDoc.exists()) {
        const updatedGameState = {id: updatedGameDoc.id, ...updatedGameDoc.data()} as GameState;
        const allPlayersSubmitted = updatedGameState.playerIds.every(pid => updatedGameState.players[pid]?.hasSubmittedAction);
        
        if (allPlayersSubmitted && updatedGameState.status === "CHOOSING_ACTIONS") {
          setIsProcessingTurn(true); // Indicate processing started
          toast({ title: "Opponent Ready!", description: "Processing turn..." });
          try {
            await processTurnAction(gameState.id); // Server action call
          } catch (processError: any) {
             toast({ variant: "destructive", title: "Turn Processing Error", description: processError.message || "Could not process the turn."});
             setIsProcessingTurn(false); // Reset if processing fails
          }
        }
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Submission Failed", description: error.message || "Could not submit your action." });
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const handleDeleteRoom = async () => {
    if (!roomData || !firebaseUser || roomData.createdBy !== firebaseUser.uid) {
        toast({variant: "destructive", title: "Error", description: "You are not authorized to delete this room."});
        return;
    }
    if (roomData.status === "IN_GAME") {
        toast({variant: "destructive", title: "Error", description: "Cannot delete a room once the game has started."});
        return;
    }
    const confirmDelete = window.confirm("Are you sure you want to delete this room? This action cannot be undone.");
    if (!confirmDelete) return;

    try {
        await deleteRoomAction(roomData.id, firebaseUser.uid);
        toast({title: "Room Deleted", description: "The room has been successfully deleted."});
        router.replace("/rooms");
    } catch (err: any) {
        toast({variant: "destructive", title: "Deletion Failed", description: err.message || "Could not delete the room."});
    }
  };

  const handleShareRoom = () => {
    const url = `${window.location.origin}/game/${gameIdFromUrl}`;
    navigator.clipboard.writeText(url).then(() => {
        toast({title: "Link Copied!", description: "Room link copied to clipboard."});
    }).catch(err => {
        toast({variant: "destructive", title: "Copy Failed", description: "Could not copy link."});
    });
  };


  if (authLoading || userProfileLoading || loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-var(--navbar-height,80px))] text-center p-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg text-foreground">Loading Battle Arena...</p>
      </div>
    );
  }

  if (!firebaseUser) {
    router.replace(`/login?redirect=/game/${gameIdFromUrl}`);
    return <div className="text-center py-10">Redirecting to login...</div>;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-var(--navbar-height,80px))] text-center p-4">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-xl font-semibold text-destructive mb-2">Error Loading Arena</h2>
        <p className="text-muted-foreground mb-4 max-w-md">{error}</p>
        <Button onClick={() => router.push("/rooms")} aria-label="Back to Rooms">Back to Rooms</Button>
      </div>
    );
  }
  
  if (!currentUserGameProfile && !userProfileLoading) {
     return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-var(--navbar-height,80px))] text-center p-4">
        <Info className="h-12 w-12 text-yellow-500 mb-4" />
        <h2 className="text-xl font-semibold text-yellow-600 mb-2">Profile Unavailable</h2>
        <p className="text-muted-foreground mb-4 max-w-md">Your game profile could not be loaded. Please ensure it's set up.</p>
        <Button onClick={() => router.push("/home")} aria-label="Return to Home Base">Return to Home</Button>
      </div>
    );
  }

  // --- Lobby State ---
  if (!gameState || gameState.status === "WAITING_FOR_PLAYERS" || (roomData && roomData.status === "WAITING")) {
    const isHost = roomData?.createdBy === firebaseUser.uid;
    const hostDisplayName = roomData?.playerDisplayNames?.[roomData.createdBy] || "Host";
    const opponentId = roomData?.playerIds.find(id => id !== roomData.createdBy);
    const opponentDisplayName = opponentId ? roomData?.playerDisplayNames?.[opponentId] : null;

    return (
        <div className="container mx-auto px-2 py-4 sm:px-4 sm:py-8 text-center">
            <Card className="max-w-lg mx-auto shadow-lg">
                <CardHeader>
                    <CardTitle className="text-2xl text-primary">
                        {roomData?.name || "Game Lobby"}
                    </CardTitle>
                    <CardDescription>Risk Level: {roomData?.riskLevel || "N/A"}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p className="text-lg font-semibold">Players:</p>
                    <div className="space-y-2">
                        <div className="flex items-center justify-center gap-2 p-2 bg-muted/50 rounded-md">
                            <UserCircle className="h-6 w-6 text-primary" aria-hidden="true"/>
                            <span>{hostDisplayName} (Host)</span>
                        </div>
                        {opponentDisplayName ? (
                             <div className="flex items-center justify-center gap-2 p-2 bg-muted/50 rounded-md">
                                <UserCircle className="h-6 w-6 text-accent" aria-hidden="true"/>
                                <span>{opponentDisplayName}</span>
                            </div>
                        ) : (
                            <div className="flex items-center justify-center gap-2 p-2 border-dashed border rounded-md">
                                <Hourglass className="h-6 w-6 text-muted-foreground animate-spin" aria-hidden="true"/>
                                <span>Waiting for opponent...</span>
                            </div>
                        )}
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 pt-4">
                        <Button onClick={handleShareRoom} variant="outline" className="w-full sm:w-auto">
                            <Copy className="mr-2 h-4 w-4" /> Share Room Link
                        </Button>
                        {isHost && (
                            <Button onClick={handleDeleteRoom} variant="destructive" className="w-full sm:w-auto">
                                <Trash2 className="mr-2 h-4 w-4" /> Delete Room
                            </Button>
                        )}
                         <Button onClick={() => router.push("/rooms")} variant="secondary" className="w-full sm:w-auto">
                            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Rooms
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
  }
  
  // --- Active Game State ---
  const opponentId = gameState.playerIds.find(id => id !== firebaseUser.uid);
  const opponentPlayerState = opponentId ? gameState.players[opponentId] : null;
  const currentPlayerState = gameState.players[firebaseUser.uid];

  if (!currentPlayerState) {
     return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-var(--navbar-height,80px))] text-center p-4">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-xl font-semibold text-destructive mb-2">Error: You Are Not In This Game</h2>
        <p className="text-muted-foreground mb-4 max-w-md">Your profile is not part of this game's active players.</p>
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
              {gameState.status.replace(/_/g, " ")}
            </span>
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm">Risk Level: <span className="font-semibold">{gameState.riskLevel}</span></CardDescription>
        </CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-3 sm:gap-4">
          <PlayerInfoCard playerGameData={currentPlayerState} userProfile={currentUserGameProfile} isCurrentUser={true} />
          {opponentPlayerState ?
            <PlayerInfoCard playerGameData={opponentPlayerState} isCurrentUser={false} opponentUserProfile={opponentId ? (gameState.players[opponentId] ? gameState.players[opponentId] : null) : null} />
             :
            <Card className="flex flex-col items-center justify-center p-4 sm:p-6 border-dashed min-h-[100px] sm:min-h-[120px]">
                <Users className="h-8 w-8 sm:h-10 sm:w-10 text-muted-foreground mb-2"/>
                <p className="text-sm text-muted-foreground">Waiting for opponent data...</p>
            </Card>
          }
        </CardContent>
      </Card>

      {isProcessingTurn && gameState.status !== "CHOOSING_ACTIONS" && ( // Show only if actually processing, not just submitted
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
  userProfile?: GameUser | null; 
  opponentUserProfile?: GamePlayerState | null; // Pass full opponent GamePlayerState if available
  isCurrentUser: boolean;
}

function PlayerInfoCard({ playerGameData, userProfile, opponentUserProfile, isCurrentUser }: PlayerInfoCardProps) {
  const displayName = playerGameData.displayName || "Player";
  const goldInGame = playerGameData.gold;
  const militaryInGame = playerGameData.military;
  const resourcesInGame = playerGameData.resources;
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


    