
"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, ShieldCheck, ShieldHalf, ShieldAlert, UserCircle, Loader2, DoorOpen } from "lucide-react";
import type { Room, RiskLevel } from "@/types";

interface RoomListItemProps {
  room: Room;
  onJoin: () => void;
  currentUserId: string;
  isJoining: boolean;
  disabled?: boolean;
}

const riskLevelIcons: Record<RiskLevel, React.ReactNode> = {
  LOW: <ShieldCheck className="h-5 w-5 text-green-500" aria-hidden="true" />,
  MEDIUM: <ShieldHalf className="h-5 w-5 text-yellow-500" aria-hidden="true" />,
  HIGH: <ShieldAlert className="h-5 w-5 text-red-500" aria-hidden="true" />,
};

const riskLevelText: Record<RiskLevel, string> = {
  LOW: "Low Risk",
  MEDIUM: "Medium Risk",
  HIGH: "High Risk",
};

export default function RoomListItem({ room, onJoin, currentUserId, isJoining, disabled }: RoomListItemProps) {
  const isHost = room.createdBy === currentUserId;
  const canJoin = !isHost && room.playerIds.length < 2 && room.status === "WAITING";
  const playersInRoom = room.playerIds?.length || 0;

  const getJoinButtonText = () => {
    if (isJoining) return "Joining...";
    if (isHost) return "You are Host";
    if (!canJoin && playersInRoom >=2) return "Room Full";
    return "Join Battle";
  };
  
  const getAriaLabelForJoinButton = () => {
    if (isHost) return `You are the host of room ${room.name || 'Unnamed Room'}.`;
    if (!canJoin && playersInRoom >=2) return `Room ${room.name || 'Unnamed Room'} is full. Cannot join.`;
    return `Join room ${room.name || 'Unnamed Room'}, hosted by ${room.hostDisplayName || 'Unknown'}, Risk Level: ${riskLevelText[room.riskLevel]}, Players: ${playersInRoom} of 2.`;
  };


  return (
    <Card 
      className="bg-card hover:shadow-lg transition-shadow duration-200 flex flex-col"
      aria-labelledby={`room-title-${room.id}`}
      aria-describedby={`room-details-${room.id}`}
    >
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
            <CardTitle id={`room-title-${room.id}`} className="text-lg sm:text-xl text-primary truncate pr-2" title={room.name || "Unnamed Public Room"}>
            {room.name || "Unnamed Public Room"}
            </CardTitle>
            <div className="flex items-center gap-1 px-2 py-1 bg-muted rounded-full text-xs text-muted-foreground" aria-label={`Risk Level: ${riskLevelText[room.riskLevel]}`}>
                {riskLevelIcons[room.riskLevel]}
                <span aria-hidden="true">{riskLevelText[room.riskLevel]}</span>
            </div>
        </div>
        <CardDescription id={`room-details-${room.id}`} className="text-xs text-muted-foreground flex items-center pt-1">
          <UserCircle className="h-4 w-4 mr-1.5 shrink-0" aria-hidden="true" /> 
          Host: <span className="font-medium ml-1 truncate">{room.hostDisplayName || "Unknown Commander"}</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-grow pb-4">
        <div className="flex items-center justify-between text-sm text-foreground/80">
          <div className="flex items-center" aria-label={`Players: ${playersInRoom} of 2.`}>
            <Users className="h-4 w-4 mr-1.5 text-accent" aria-hidden="true" />
            <span aria-hidden="true">Players: {playersInRoom} / 2</span>
          </div>
          {/* Can add created time here: <p>Created: {new Date(room.createdAt.toDate()).toLocaleTimeString()}</p> */}
        </div>
      </CardContent>
      <CardFooter className="border-t pt-4">
        <Button
          onClick={onJoin}
          disabled={!canJoin || disabled || isJoining}
          className="w-full"
          aria-label={getAriaLabelForJoinButton()}
          variant={canJoin ? "default" : "secondary"}
        >
          {isJoining ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <DoorOpen className="mr-2 h-4 w-4" />
          )}
          {getJoinButtonText()}
        </Button>
      </CardFooter>
    </Card>
  );
}

