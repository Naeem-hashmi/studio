
"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useUser } from "@/hooks/useUser";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, PlusCircle, Users, AlertTriangle, ListChecks, WifiOff, DoorOpen, ShieldQuestion } from "lucide-react";
import CreateRoomDialog from "@/components/rooms/CreateRoomDialog";
import RoomListItem from "@/components/rooms/RoomListItem";
import type { Room } from "@/types";
import { db } from "@/lib/firebase"; // Direct import for onSnapshot
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { joinRoom as joinRoomAction } from "@/lib/firestoreActions";

export default function RoomsPage() {
  const { user: firebaseUser, loading: authLoading } = useAuth();
  const { gameUser, loading: userLoading } = useUser();
  const router = useRouter();
  const { toast } = useToast();

  const [isCreateRoomOpen, setIsCreateRoomOpen] = useState(false);
  const [publicRooms, setPublicRooms] = useState<Room[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [roomsError, setRoomsError] = useState<string | null>(null);
  const [joiningRoomId, setJoiningRoomId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !firebaseUser) {
      router.replace("/login?redirect=/rooms");
    }
  }, [firebaseUser, authLoading, router]);

  useEffect(() => {
    if (!firebaseUser) return; // Don't try to fetch rooms if user is not authenticated

    setRoomsLoading(true);
    const roomsCollectionRef = collection(db, "rooms");
    const q = query(
      roomsCollectionRef,
      where("isPublic", "==", true),
      where("status", "==", "WAITING"), // Only show rooms waiting for players
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        const roomsData = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        } as Room));
        setPublicRooms(roomsData);
        setRoomsLoading(false);
        setRoomsError(null);
      },
      (error) => {
        console.error("Error fetching public rooms:", error);
        setRoomsError("Could not load public rooms. Please try again later.");
        setRoomsLoading(false);
      }
    );

    return () => unsubscribe(); // Cleanup listener on component unmount
  }, [firebaseUser]);

  const handleJoinRoom = async (roomId: string) => {
    if (!firebaseUser || !gameUser) {
      toast({ variant: "destructive", title: "Authentication Error", description: "You must be logged in to join a room." });
      return;
    }
    if (gameUser.inRecoveryMode) {
      toast({ variant: "destructive", title: "Recovery Mode", description: "You cannot join rooms while in recovery mode. Please complete training." });
      return;
    }

    setJoiningRoomId(roomId);
    try {
      await joinRoomAction(roomId, firebaseUser.uid, gameUser.displayName || firebaseUser.email || "Anonymous");
      toast({ title: "Joined Room!", description: "Successfully joined the room. Waiting for game to start..." });
      // Future: Navigate to game waiting page or game page itself
      // For now, the room list will update, and the joined room might disappear if it becomes full or changes status.
      // Or, we might navigate to /rooms/[roomId]
      router.push(`/game/${roomId}`); // Let's assume game starts immediately or room becomes a lobby.
    } catch (error: any) {
      toast({ variant: "destructive", title: "Failed to Join Room", description: error.message || "Could not join the room." });
    } finally {
      setJoiningRoomId(null);
    }
  };

  if (authLoading || userLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-var(--navbar-height,80px))]">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg text-foreground">Loading your tactical console...</p>
      </div>
    );
  }

  if (!firebaseUser) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-var(--navbar-height,80px))]">
        <p className="text-lg text-foreground">Redirecting to login...</p>
      </div>
    );
  }
  
  if (!gameUser && !userLoading) {
     // This state might occur if profile setup is needed or if there's a delay.
     // useUser hook handles profile not found errors on home page, redirecting to setup.
     // If user navigates here directly and has no profile, they should complete setup first.
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-var(--navbar-height,80px))] text-center p-4">
        <ShieldQuestion className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-xl font-semibold text-destructive mb-2">Profile Incomplete</h2>
        <p className="text-muted-foreground mb-4 max-w-md">
          Your game profile needs to be set up before you can access game rooms.
        </p>
        <Button onClick={() => router.push("/setup-profile")}>Go to Profile Setup</Button>
      </div>
    );
  }


  return (
    <div className="container mx-auto px-2 sm:px-4 py-6 sm:py-8">
      <header className="flex flex-col sm:flex-row justify-between items-center mb-6 sm:mb-8 gap-3">
        <div className="text-center sm:text-left">
          <h1 className="text-3xl sm:text-4xl font-bold text-primary">Game Rooms</h1>
          <p className="text-base sm:text-lg text-foreground/80">
            Join an existing battle or create your own.
          </p>
        </div>
        <Button
          onClick={() => setIsCreateRoomOpen(true)}
          disabled={gameUser?.inRecoveryMode}
          aria-label="Create New Game Room"
          className="w-full sm:w-auto"
        >
          <PlusCircle className="mr-2 h-5 w-5" /> Create New Room
        </Button>
      </header>

      {gameUser?.inRecoveryMode && (
        <Card className="mb-6 border-destructive bg-destructive/10">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center text-lg sm:text-xl">
              <AlertTriangle className="mr-2 h-5 w-5 sm:h-6 sm:w-6" />
              Recovery Mode Active
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-destructive/90 text-sm">
              You must exit Recovery Mode by completing Training Mode objectives before creating or joining rooms.
            </p>
          </CardContent>
        </Card>
      )}

      <CreateRoomDialog
        isOpen={isCreateRoomOpen}
        onClose={() => setIsCreateRoomOpen(false)}
        userId={firebaseUser.uid}
        hostDisplayName={gameUser?.displayName || firebaseUser.email}
      />

      <section aria-labelledby="public-rooms-heading">
        <h2 id="public-rooms-heading" className="text-2xl font-semibold text-accent mb-4 flex items-center">
          <ListChecks className="mr-3 h-7 w-7" /> Public Rooms Waiting
        </h2>
        {roomsLoading ? (
          <div className="flex justify-center items-center py-10">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="ml-3 text-muted-foreground">Scanning for available war rooms...</p>
          </div>
        ) : roomsError ? (
          <Card className="bg-destructive/10 border-destructive text-center py-10">
            <CardContent className="flex flex-col items-center">
              <WifiOff className="h-12 w-12 text-destructive mb-3" />
              <p className="text-destructive font-semibold text-lg">Error Loading Rooms</p>
              <p className="text-destructive/80 text-sm">{roomsError}</p>
            </CardContent>
          </Card>
        ) : publicRooms.length === 0 ? (
          <Card className="text-center py-10 bg-card/70 border-dashed">
            <CardContent className="flex flex-col items-center">
              <DoorOpen className="h-12 w-12 text-muted-foreground mb-3" />
              <p className="text-muted-foreground font-semibold text-lg">No Public Rooms Available</p>
              <p className="text-muted-foreground/80 text-sm">
                Why not be the first to start a new battle?
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {publicRooms.map((room) => (
              <RoomListItem
                key={room.id}
                room={room}
                onJoin={() => handleJoinRoom(room.id)}
                currentUserId={firebaseUser.uid}
                isJoining={joiningRoomId === room.id}
                disabled={gameUser?.inRecoveryMode || joiningRoomId !== null}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
