
"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Loader2, ShieldAlert, ShieldCheck, ShieldHalf, Trophy } from "lucide-react";
import type { RiskLevel } from "@/types";
import { createRoom as createRoomAction } from "@/lib/firestoreActions"; // Server Action
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";

interface CreateRoomDialogProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  hostDisplayName: string | null;
}

const riskLevels: { value: RiskLevel; label: string; icon: React.ReactNode, description: string }[] = [
  { value: "LOW", label: "Low Risk", icon: <ShieldCheck className="h-5 w-5 text-green-500" />, description: "Safer battles, smaller resource transfers (6-8%)." },
  { value: "MEDIUM", label: "Medium Risk", icon: <ShieldHalf className="h-5 w-5 text-yellow-500" />, description: "Balanced engagements, moderate transfers (10-12%)." },
  { value: "HIGH", label: "High Risk", icon: <ShieldAlert className="h-5 w-5 text-red-500" />, description: "High stakes, largest transfers (13-16%)." },
];

export default function CreateRoomDialog({ isOpen, onClose, userId, hostDisplayName }: CreateRoomDialogProps) {
  const [roomName, setRoomName] = useState("");
  const [selectedRiskLevel, setSelectedRiskLevel] = useState<RiskLevel>("MEDIUM");
  const [isPublic, setIsPublic] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    // Reset form when dialog opens/closes or user changes
    if (isOpen) {
      setRoomName(hostDisplayName ? `${hostDisplayName}'s Game` : "New Battle Room");
      setSelectedRiskLevel("MEDIUM");
      setIsPublic(true);
    }
  }, [isOpen, hostDisplayName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) {
      toast({ variant: "destructive", title: "Error", description: "User not authenticated." });
      return;
    }
    if (!selectedRiskLevel) {
        toast({ variant: "destructive", title: "Error", description: "Please select a risk level." });
        return;
    }
    if (isPublic && !roomName.trim()) {
        toast({ variant: "destructive", title: "Error", description: "Public rooms require a name." });
        return;
    }
    if (roomName.trim().length > 50) {
        toast({ variant: "destructive", title: "Error", description: "Room name cannot exceed 50 characters." });
        return;
    }


    setIsLoading(true);
    try {
      const finalRoomName = isPublic ? roomName.trim() : `${hostDisplayName || 'Private'}'s Room - ${Date.now().toString().slice(-4)}`;
      const newRoomId = await createRoomAction(
        userId,
        hostDisplayName,
        finalRoomName,
        selectedRiskLevel,
        isPublic
      );
      toast({
        title: "Room Created!",
        description: `Room "${finalRoomName}" is ready.`,
      });
      onClose();
      router.push(`/game/${newRoomId}`); // Navigate to the game/lobby page for the new room
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Failed to Create Room",
        description: error.message || "An unexpected error occurred.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[525px] bg-card">
        <DialogHeader>
          <DialogTitle className="text-2xl text-primary flex items-center">
            <Trophy className="mr-2 h-6 w-6" />
            Create New Game Room
          </DialogTitle>
          <DialogDescription className="text-foreground/80">
            Set up your battlefield and invite a challenger, or make it public.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6 py-2">
          <div>
            <Label htmlFor="roomName" className="text-foreground/90 font-medium">Room Name (for public rooms)</Label>
            <Input
              id="roomName"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              placeholder={isPublic ? "E.g., Tactical Showdown, King's Hill" : "Private Room (auto-named)"}
              disabled={!isPublic || isLoading}
              className="mt-1 bg-background border-input"
              maxLength={50}
            />
            {!isPublic && <p className="text-xs text-muted-foreground mt-1">Private rooms are auto-named.</p>}
          </div>

          <div>
            <Label className="text-foreground/90 font-medium mb-2 block">Risk Level</Label>
            <RadioGroup
              value={selectedRiskLevel}
              onValueChange={(value) => setSelectedRiskLevel(value as RiskLevel)}
              className="grid grid-cols-1 sm:grid-cols-3 gap-2"
              aria-label="Select Risk Level"
            >
              {riskLevels.map((level) => (
                <Label
                  key={level.value}
                  htmlFor={`risk-${level.value}`}
                  className={`flex flex-col items-center justify-center rounded-md border-2 p-3 hover:border-accent cursor-pointer transition-all
                                ${selectedRiskLevel === level.value ? "border-primary bg-primary/10 ring-2 ring-primary" : "border-border bg-background/50"}
                                ${isLoading ? "opacity-50 cursor-not-allowed" : ""}`}
                  aria-label={`${level.label}: ${level.description}`}
                >
                  <RadioGroupItem value={level.value} id={`risk-${level.value}`} className="sr-only" disabled={isLoading}/>
                  {React.cloneElement(level.icon, { "aria-hidden": "true", className: "h-6 w-6 mb-1" })}
                  <span className="font-semibold text-sm text-foreground">{level.label}</span>
                  <span className="text-xs text-center text-muted-foreground mt-0.5 px-1" aria-hidden="true">{level.description.split(',')[1] || level.description.split('.')[0]}</span>
                </Label>
              ))}
            </RadioGroup>
          </div>

          <div className="flex items-center justify-between pt-2">
            <Label htmlFor="isPublic" className="text-foreground/90 font-medium flex flex-col">
              Public Room
              <span className="text-xs text-muted-foreground font-normal">Visible to everyone in the room list.</span>
            </Label>
            <Switch
              id="isPublic"
              checked={isPublic}
              onCheckedChange={setIsPublic}
              disabled={isLoading}
              aria-label={`Room visibility: ${isPublic ? "Public" : "Private"}`}
            />
          </div>
        </form>
        <DialogFooter className="mt-2">
          <DialogClose asChild>
            <Button variant="outline" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
          </DialogClose>
          <Button type="submit" onClick={handleSubmit} disabled={isLoading} className="min-w-[100px]">
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              "Create Room"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
