
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { createUserProfile, getUserProfile } from "@/lib/firestoreActions"; // Server Action
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, AlertTriangle, CheckCircle, User, Landmark, Shield, ToyBrick } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Define default stats for display
const DEFAULT_GOLD = 100;
const DEFAULT_MILITARY = 100;
const DEFAULT_RESOURCES = 100;
const DEFAULT_ATTACK_LEVEL = 1;
const DEFAULT_DEFENSE_LEVEL = 1;

export default function SetupProfilePage() {
  const { user: firebaseUser, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialCheckLoading, setInitialCheckLoading] = useState(true);

  useEffect(() => {
    // This effect handles initial page load:
    // 1. Redirect to /login if not authenticated.
    // 2. If authenticated, check if a profile ALREADY exists. If so, redirect to /home.
    //    This prevents users from landing here if they already have a profile.
    console.log("SetupProfilePage: useEffect triggered. authLoading:", authLoading, "firebaseUser:", !!firebaseUser);

    if (!authLoading && !firebaseUser) {
      console.log("SetupProfilePage: Not authenticated, redirecting to /login.");
      router.replace("/login");
      return;
    }
    
    if (firebaseUser && !authLoading) {
      console.log(`SetupProfilePage: Authenticated as ${firebaseUser.uid}. Checking for existing profile.`);
      const checkExistingProfile = async () => {
        setInitialCheckLoading(true); // Explicitly set loading for this check
        setError(null); // Clear previous errors
        try {
          const existingProfile = await getUserProfile(firebaseUser.uid);
          if (existingProfile) {
            console.log("SetupProfilePage: Profile already exists. Redirecting to /home.");
            toast({
              title: "Profile Already Exists",
              description: "Redirecting you to the command center.",
            });
            router.replace("/home");
          } else {
            console.log("SetupProfilePage: No existing profile found. User can proceed with setup.");
            // No profile, so stay on this page.
          }
        } catch (e: any) {
          console.error("SetupProfilePage: Error checking for existing profile:", e);
          setError("Could not verify existing profile. Please try refreshing. " + e.message);
          // Potentially allow setup anyway, or guide user. For now, we let them stay.
        } finally {
          setInitialCheckLoading(false);
        }
      };
      checkExistingProfile();
    }
  }, [firebaseUser, authLoading, router, toast]);

  const handleCompleteSetup = async () => {
    if (!firebaseUser) {
      setError("Authentication error. Please try logging in again.");
      console.error("SetupProfilePage: handleCompleteSetup called without firebaseUser.");
      return;
    }

    setIsSettingUp(true);
    setError(null);
    console.log(`SetupProfilePage: handleCompleteSetup initiated for ${firebaseUser.uid}.`);

    try {
      // Call the server action to create the profile
      const gameProfile = await createUserProfile(firebaseUser); 
      
      if (!gameProfile) {
        // This case should ideally be caught by an error thrown from createUserProfile
        console.error("SetupProfilePage: createUserProfile returned undefined/null, which is unexpected.");
        throw new Error("Profile could not be created or retrieved. Please try again.");
      }

      console.log(`SetupProfilePage: Profile setup successful for ${firebaseUser.uid}. Profile:`, gameProfile);
      toast({
        title: "Profile Setup Complete!",
        description: "Welcome to Tactical Echo, Commander! Redirecting...",
        className: "bg-green-500 text-white dark:bg-green-700",
        duration: 3000,
      });
      router.push("/home"); // Redirect to home page on success
    } catch (e: any) {
      console.error("SetupProfilePage: Profile Setup Error in handleCompleteSetup:", e);
      const errorMessage = e.message || "An unexpected error occurred during profile setup.";
      setError(errorMessage);
      toast({
        variant: "destructive",
        title: "Profile Setup Failed",
        description: errorMessage + " Please try again.",
      });
    } finally {
      setIsSettingUp(false);
    }
  };

  // Loading state for the page
  if (authLoading || initialCheckLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg text-foreground">
          {authLoading ? "Loading authentication..." : 
           initialCheckLoading ? "Verifying profile status..." : 
           "Preparing setup..."}
        </p>
      </div>
    );
  }

  // If not authenticated (and not loading auth), useEffect should have redirected.
  // This is a fallback.
  if (!firebaseUser) {
     return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <p className="text-lg text-foreground">Authentication required. Redirecting to login...</p>
      </div>
    );
  }


  // Render the setup form
  return (
    <div className="flex items-center justify-center min-h-screen p-4 bg-gradient-to-br from-background to-secondary/30">
      <Card className="w-full max-w-lg shadow-2xl border-primary/30">
        <CardHeader className="text-center">
          <CheckCircle className="mx-auto h-16 w-16 text-primary mb-4" />
          <CardTitle className="text-3xl font-bold text-primary">Finalize Your Profile</CardTitle>
          <CardDescription className="text-foreground/80">
            Welcome, Commander {firebaseUser.displayName || firebaseUser.email}! Confirm your starting assets.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4 p-4 border rounded-md bg-card/50">
            <h3 className="text-lg font-semibold text-accent flex items-center"><User className="mr-2 h-5 w-5"/>Your Identity</h3>
            <p><strong className="text-muted-foreground">Name:</strong> {firebaseUser.displayName || "N/A"}</p>
            <p><strong className="text-muted-foreground">Email:</strong> {firebaseUser.email || "N/A"}</p>
          </div>
          
          <div className="space-y-4 p-4 border rounded-md bg-card/50">
            <h3 className="text-lg font-semibold text-accent flex items-center"><ToyBrick className="mr-2 h-5 w-5"/>Starting Resources</h3>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <Landmark className="h-8 w-8 mx-auto text-yellow-500 mb-1" />
                <p className="text-xl font-bold">{DEFAULT_GOLD}</p>
                <p className="text-xs text-muted-foreground">Gold</p>
              </div>
              <div>
                <Shield className="h-8 w-8 mx-auto text-red-500 mb-1" />
                <p className="text-xl font-bold">{DEFAULT_MILITARY}</p>
                <p className="text-xs text-muted-foreground">Military</p>
              </div>
              <div>
                <ToyBrick className="h-8 w-8 mx-auto text-green-500 mb-1" />
                <p className="text-xl font-bold">{DEFAULT_RESOURCES}</p>
                <p className="text-xs text-muted-foreground">Supplies</p>
              </div>
            </div>
             <p className="text-xs text-muted-foreground text-center pt-2">Your Attack & Defense will start at Level {DEFAULT_ATTACK_LEVEL}.</p>
          </div>

          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive text-destructive text-sm rounded-md flex items-start">
              <AlertTriangle className="h-5 w-5 mr-2 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          <Button
            onClick={handleCompleteSetup}
            disabled={isSettingUp}
            className="w-full text-lg py-3 bg-primary hover:bg-primary/90"
            aria-label="Complete profile setup and enter command"
          >
            {isSettingUp ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              <CheckCircle className="mr-2 h-5 w-5" />
            )}
            {isSettingUp ? "Setting Up Profile..." : "Complete Setup & Enter Command"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
