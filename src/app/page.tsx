"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import Image from "next/image";

export default function LandingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace("/home");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center bg-gradient-to-br from-background to-secondary">
        <Loader2 className="h-16 w-16 animate-spin text-primary mb-6" />
        <p className="text-xl font-semibold text-foreground">Loading Tactical Echo...</p>
      </div>
    );
  }

  if (user) {
    // This case should ideally be handled by the useEffect redirect,
    // but as a fallback or if redirection is slow:
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center bg-gradient-to-br from-background to-secondary">
        <Loader2 className="h-16 w-16 animate-spin text-primary mb-6" />
        <p className="text-xl font-semibold text-foreground">Redirecting to your dashboard...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-var(--navbar-height,80px))] p-6 text-center bg-gradient-to-br from-background to-secondary/50">
      <header className="mb-12">
        <Image 
            src="https://placehold.co/300x150.png" 
            alt="Tactical Echo Game Banner" 
            width={300} 
            height={150} 
            className="rounded-lg shadow-xl mb-6"
            data-ai-hint="war game strategy"
            priority
        />
        <h1 className="text-5xl font-bold text-primary mb-4">Welcome to Tactical Echo</h1>
        <p className="text-xl text-foreground/80 max-w-2xl mx-auto">
          A turn-based strategic war game where logic and foresight lead to victory. Accessible for all commanders.
        </p>
      </header>

      <section className="mb-12">
        <h2 className="text-3xl font-semibold text-primary mb-6">Ready to Command?</h2>
        <Link href="/login" passHref>
          <Button size="lg" className="bg-accent hover:bg-accent/90 text-accent-foreground shadow-lg transform hover:scale-105 transition-transform duration-150">
            Begin Your Conquest
          </Button>
        </Link>
      </section>

      <section className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
        <div className="bg-card p-6 rounded-lg shadow-lg border border-primary/20">
          <h3 className="text-2xl font-semibold text-primary mb-2">Strategic Depth</h3>
          <p className="text-foreground/70">Engage in battles of wits. Every decision matters in this purely skill-based contest.</p>
        </div>
        <div className="bg-card p-6 rounded-lg shadow-lg border border-primary/20">
          <h3 className="text-2xl font-semibold text-primary mb-2">Fair & Balanced</h3>
          <p className="text-foreground/70">No random chances. Predictable outcomes based on chosen tactics and upgrades.</p>
        </div>
        <div className="bg-card p-6 rounded-lg shadow-lg border border-primary/20">
          <h3 className="text-2xl font-semibold text-primary mb-2">Always Recover</h3>
          <p className="text-foreground/70">Never truly defeated. Our Recovery Mode ensures you can always return to the fight.</p>
        </div>
      </section>
      
      <footer className="mt-16 text-foreground/60">
        <p>&copy; {new Date().getFullYear()} Tactical Echo. All rights reserved.</p>
      </footer>
    </div>
  );
}
