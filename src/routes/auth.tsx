import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";

import { ScoutLogoLink } from "../components/ScoutLogoLink";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { supabase } from "@/lib/supabase";
import { resolvePostLoginRoute } from "@/lib/auth";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in to Scout" },
      {
        name: "description",
        content: "Sign in or create your Scout account to get personalized event recommendations.",
      },
    ],
  }),
  component: AuthPage,
});

const RED_PILL = {
  backgroundImage: "linear-gradient(135deg, #FF2D2D, #E60000)",
  boxShadow: "0 4px 15px rgba(255, 45, 45, 0.4)",
};

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.71-1.57 2.68-3.89 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16.365 1.43c0 1.14-.493 2.27-1.177 3.08-.744.9-1.99 1.57-2.987 1.57-.12 0-.23-.02-.3-.03-.01-.06-.04-.22-.04-.39 0-1.15.572-2.27 1.206-2.98.804-.94 2.142-1.64 3.248-1.68.03.13.05.28.05.43zm4.565 15.71c-.03.07-.463 1.58-1.518 3.12-.945 1.34-1.94 2.71-3.43 2.71-1.517 0-1.9-.88-3.63-.88-1.698 0-2.302.91-3.67.91-1.377 0-2.332-1.26-3.428-2.8-1.287-1.82-2.323-4.63-2.323-7.28 0-4.28 2.797-6.55 5.552-6.55 1.448 0 2.675.95 3.6.95.865 0 2.222-1.01 3.902-1.01.613 0 2.886.06 4.374 2.19-.13.09-2.383 1.37-2.383 4.19 0 3.26 2.854 4.42 2.955 4.45z" />
    </svg>
  );
}

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  // Redirect if already logged in.
  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(async ({ data }) => {
      if (!active) return;
      if (data.user) {
        const dest = await resolvePostLoginRoute(data.user.id);
        if (active) navigate({ to: dest });
      } else {
        setChecking(false);
      }
    });
    return () => {
      active = false;
    };
  }, [navigate]);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/feed` },
        });
        if (error) throw error;
        if (data.session?.user) {
          navigate({ to: await resolvePostLoginRoute(data.session.user.id) });
        } else {
          setInfo("Check your email to confirm your account, then sign in.");
          setMode("signin");
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (data.user) navigate({ to: await resolvePostLoginRoute(data.user.id) });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError(null);
    setInfo(null);
    setGoogleLoading(true);
    try {
      // Use the external Supabase project's own Google OAuth so the issued
      // tokens match the project the app connects to (avoids bad_jwt).
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin,
          queryParams: { prompt: "select_account" },
        },
      });
      if (error) {
        setError("Couldn't sign in with Google. Please try again.");
        setGoogleLoading(false);
        return;
      }
      // Browser will redirect to Google.
    } catch {
      setError("Couldn't sign in with Google. Please try again.");
      setGoogleLoading(false);
    }
  };

  const handleApple = async () => {
    setError(null);
    setInfo(null);
    setAppleLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "apple",
        options: { redirectTo: window.location.origin },
      });
      if (error) {
        setError("Couldn't sign in with Apple. Please try again.");
        setAppleLoading(false);
        return;
      }
      // Browser will redirect to Apple.
    } catch {
      setError("Couldn't sign in with Apple. Please try again.");
      setAppleLoading(false);
    }
  };




  if (checking) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0a0a14]">
        <div className="grain-overlay absolute inset-0 pointer-events-none" />
        <Loader2 className="h-6 w-6 animate-spin text-white/70" />
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center overflow-hidden bg-[#0a0a14]">
      {/* Subtle ambient gradient */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 40%, rgba(255, 255, 255, 0.04) 0%, transparent 60%)",
        }}
      />
      {/* Grain overlay */}
      <div className="grain-overlay absolute inset-0 pointer-events-none" />
      {/* Warm orange glow orb */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/3 h-[400px] w-[400px] -translate-x-1/2 -translate-y-1/2"
        style={{
          background:
            "radial-gradient(circle, rgba(255, 107, 0, 0.08) 0%, transparent 70%)",
          filter: "blur(60px)",
        }}
      />

      <header className="relative z-10 mx-auto w-full max-w-6xl px-6 py-5">
        <ScoutLogoLink className="text-2xl font-extrabold text-white" />
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-12">
        <div className="rounded-2xl border border-white/[0.12] bg-white/[0.05] p-8 text-white shadow-[0_8px_32px_rgba(0,0,0,0.3)] backdrop-blur-sm">
          <h1 className="text-2xl font-extrabold tracking-tight">
            {mode === "signin" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="mt-1 text-sm text-white/70">
            {mode === "signin"
              ? "Sign in to see your personalized feed."
              : "Sign up to start discovering events made for you."}
          </p>

          <Button
            type="button"
            variant="outline"
            size="lg"
            className="mt-6 w-full bg-white text-foreground hover:bg-white/90 hover:text-foreground border-transparent"
            onClick={handleGoogle}
            disabled={googleLoading || loading}
          >
            {googleLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <GoogleIcon />
            )}
            Continue with Google
          </Button>

          <Button
            type="button"
            variant="outline"
            size="lg"
            className="mt-3 w-full bg-white text-foreground hover:bg-white/90 hover:text-foreground border-transparent"
            onClick={handleApple}
            disabled={appleLoading || loading}
          >
            {appleLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <AppleIcon />
            )}
            Continue with Apple
          </Button>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-white/20" />
            <span className="text-xs uppercase tracking-wide text-white/50">or</span>
            <div className="h-px flex-1 bg-white/20" />
          </div>

          <form onSubmit={handleEmailSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-white">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-white/[0.08] border-white/[0.15] text-white placeholder:text-white/50 focus-visible:border-white/30 focus-visible:ring-white/20"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-white">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
                className="bg-white/[0.08] border-white/[0.15] text-white placeholder:text-white/50 focus-visible:border-white/30 focus-visible:ring-white/20"
              />
            </div>

            {error && <p className="text-sm font-medium text-destructive">{error}</p>}
            {info && <p className="text-sm font-medium text-white">{info}</p>}

            <Button
              type="submit"
              size="lg"
              className="w-full rounded-full border-0 text-white hover:opacity-90"
              style={RED_PILL}
              disabled={loading || googleLoading}
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "signin" ? "Sign in" : "Create account"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-white/70">
            {mode === "signin" ? "Don't have an account?" : "Already have an account?"}{" "}
            <button
              type="button"
              className="font-semibold text-[#FF2D2D] hover:underline"
              onClick={() => {
                setMode(mode === "signin" ? "signup" : "signin");
                setError(null);
                setInfo(null);
              }}
            >
              {mode === "signin" ? "Sign up" : "Sign in"}
            </button>
          </p>
        </div>
      </main>
    </div>
  );
}
