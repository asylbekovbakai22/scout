import { Fragment, createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { mergeSavedFromDB, mergeAttendedFromDB } from "./saved-events";
import { writeStoredProfile } from "../hooks/useFeedSync";

import { setStorageUser, getStorageUser, getStorageRevision } from "./user-storage";

type AuthSession = Awaited<ReturnType<typeof supabase.auth.getSession>>["data"]["session"];

// Decide where to send a user right after authentication: existing profiles go
// to the feed, brand-new users go through onboarding first.
export async function resolvePostLoginRoute(userId: string): Promise<"/feed" | "/onboarding"> {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("city, university, major, interests, vibes")
      .eq("id", userId)
      .maybeSingle();
    if (error || !data) return "/onboarding";
    // A profile row may be auto-created empty by the signup trigger; treat an
    // unfilled profile as "not onboarded yet".
    const hasContent =
      !!data.city ||
      !!data.university ||
      !!data.major ||
      (Array.isArray(data.interests) && data.interests.length > 0) ||
      !!data.vibes;
    return hasContent ? "/feed" : "/onboarding";
  } catch (err) {
    console.error("[scout] resolvePostLoginRoute failed:", err);
    return "/onboarding";
  }
}
type AuthUser = NonNullable<AuthSession>["user"];

interface AuthContextValue {
  session: AuthSession;
  user: AuthUser | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  user: null,
  loading: true,
});

// Pull the user's profile from Supabase and write it to localStorage so the
// existing profile-driven logic in onboarding/feed picks it up immediately.
async function syncProfileFromDB(userId: string): Promise<void> {
  const revision = getStorageRevision();
  try {
    const { data } = await supabase
      .from("profiles")
      .select("city, university, major, interests, vibes, radius")
      .eq("id", userId)
      .maybeSingle();
    if (data && getStorageUser() === userId && getStorageRevision() === revision) {
      // writeStoredProfile (vs a bare setItem) notifies mounted feeds, so a
      // fresh login that lands on /feed before this sync finishes re-streams
      // with the real profile instead of staying on the localStorage default.
      writeStoredProfile({
        city: data.city ?? "",
        university: data.university ?? "",
        major: data.major ?? "",
        interests: data.interests ?? [],
        vibes: data.vibes ?? "",
        radius: data.radius ?? 25,
      });
    }
  } catch (err) {
    console.error("[scout] syncProfileFromDB failed:", err);
  }
}

// Run all three sync operations in parallel; fires after login / app startup.
async function syncAllFromDB(userId: string): Promise<void> {
  await Promise.all([
    syncProfileFromDB(userId),
    mergeSavedFromDB(userId),
    mergeAttendedFromDB(userId),
  ]);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    let authVersion = 0;
    const applySession = (next: AuthSession) => {
      if (!alive) return;
      const changed = getStorageUser() !== (next?.user.id ?? null);
      setStorageUser(next?.user.id ?? null);
      setSession(next);
      setLoading(false);
      if (next && changed) void syncAllFromDB(next.user.id);
    };
    const version = authVersion;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (version === authVersion) applySession(data.session);
      })
      .catch(() => {
        if (alive) setLoading(false);
      });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      authVersion++;
      // Defer DB reads outside Supabase's auth callback lock.
      queueMicrotask(() => applySession(next));
    });
    return () => {
      alive = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading }}>
      <Fragment key={session?.user.id ?? "signed-out"}>{children}</Fragment>
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
