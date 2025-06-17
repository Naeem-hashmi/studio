
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { getUserProfile } from "@/lib/firestoreActions"; // Import getUserProfile
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import Image from "next/image";

// Google Icon SVG
const GoogleIcon = () => (
  <svg viewBox="0 0 48 48" width="24px" height="24px" className="mr-2">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
    <path fill="none" d="M0 0h48v48H0z"></path>
  </svg>
);


export default function LoginPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isProcessingLogin, setIsProcessingLogin] = useState(false); // Combined loading state for sign-in and profile check

  useEffect(() => {
    // If user is already authenticated (e.g. session persisted),
    // and not currently processing a new login attempt,
    // redirect them to home. The home page will handle profile state.
    if (!authLoading && user && !isProcessingLogin) {
      router.replace("/home");
    }
  }, [user, authLoading, router, isProcessingLogin]);

  const handleGoogleSignIn = async () => {
    setIsProcessingLogin(true);
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      toast({
        title: "Google Sign-In Successful",
        description: `Welcome, ${result.user.displayName || "Commander"}! Checking your profile...`,
      });

      // Check if profile exists
      const existingProfile = await getUserProfile(result.user.uid);

      if (existingProfile) {
        toast({
          title: "Profile Found!",
          description: "Redirecting to your command center...",
        });
        router.push("/home");
      } else {
        toast({
          title: "New Commander Detected!",
          description: "Let's set up your game profile.",
        });
        router.push("/setup-profile");
      }
    } catch (error: any) {
      console.error("Login Page Error (Google Sign-In or Profile Check):", error);
      toast({
        variant: "destructive",
        title: "Login Process Failed",
        description: error.message || "Could not complete the login process. Please try again.",
      });
    } finally {
      setIsProcessingLogin(false);
    }
  };

  // If auth is loading, or user is already authed (and useEffect is redirecting),
  // or if we are in the middle of processing login, show loader.
  if (authLoading || (!authLoading && user && !isProcessingLogin) || isProcessingLogin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-background to-secondary">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg text-foreground">
          {isProcessingLogin ? "Processing login..." : "Loading authentication..."}
        </p>
      </div>
    );
  }

  // Only render login form if not loading, no user, and not processing login.
  return (
    <div className="flex items-center justify-center min-h-screen p-4 bg-gradient-to-br from-background to-secondary/30">
      <Card className="w-full max-w-md shadow-2xl border-primary/30">
        <CardHeader className="text-center">
          <Image
            src="https://placehold.co/150x75.png"
            alt="Tactical Echo Logo"
            width={150}
            height={75}
            className="mx-auto mb-4 rounded-md"
            data-ai-hint="game logo military"
          />
          <CardTitle className="text-3xl font-bold text-primary">Join the Battle!</CardTitle>
          <CardDescription className="text-foreground/80">
            Sign in to Tactical Echo and lead your forces to victory.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Button
            onClick={handleGoogleSignIn}
            disabled={isProcessingLogin}
            className="w-full text-lg py-6 bg-white text-gray-700 hover:bg-gray-50 border border-gray-300 shadow-md hover:shadow-lg transition-all"
            aria-label="Sign in with Google"
          >
            {isProcessingLogin ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              <GoogleIcon />
            )}
            {isProcessingLogin ? "Processing..." : "Sign in with Google"}
          </Button>
           <p className="text-xs text-muted-foreground text-center px-4">
            By signing in, you agree to our imaginary Terms of Service and Privacy Policy. Your strategic genius is safe with us.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
