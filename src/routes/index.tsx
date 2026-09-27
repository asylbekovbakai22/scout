import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Compass, Sparkles, Share2, Calendar, MapPin, Tag, Users, Loader2 } from "lucide-react";

import { Button } from "../components/ui/button";
import { ScoutLogoLink } from "../components/ScoutLogoLink";
import { supabase } from "@/lib/supabase";
import { resolvePostLoginRoute } from "@/lib/auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Scout — Discover events made for you" },
      {
        name: "description",
        content:
          "Scout helps college students find events by interest — tech, music, sports, networking and more.",
      },
      { property: "og:title", content: "Scout — Discover events made for you" },
      {
        property: "og:description",
        content: "Find the events that matter in your city, personalized to your interests.",
      },
    ],
  }),
  component: Landing,
});

const RED_PILL = {
  backgroundImage: "linear-gradient(135deg, #FF2D2D, #E60000)",
  boxShadow: "0 4px 15px rgba(255, 45, 45, 0.4)",
};

function Landing() {
  const navigate = useNavigate();
  const [processingAuth, setProcessingAuth] = useState(false);

  // Handle the OAuth redirect that lands back on "/" with the session tokens
  // in the URL hash (#access_token=...). Supabase's detectSessionInUrl normally
  // consumes this, but we explicitly set the session as a fallback and then
  // route the authenticated user into the app.
  useEffect(() => {
    let active = true;

    const hash = typeof window !== "undefined" ? window.location.hash : "";
    const hasTokenInHash = hash.includes("access_token");

    async function finishAuth() {
      if (hasTokenInHash) setProcessingAuth(true);
      try {
        if (hasTokenInHash) {
          const params = new URLSearchParams(hash.slice(1));
          const access_token = params.get("access_token");
          const refresh_token = params.get("refresh_token");
          if (access_token && refresh_token) {
            await supabase.auth.setSession({ access_token, refresh_token });
          }
          // Clean the tokens out of the URL.
          window.history.replaceState(null, "", window.location.pathname);
        }

        const { data } = await supabase.auth.getSession();
        if (active && data.session?.user) {
          const dest = await resolvePostLoginRoute(data.session.user.id);
          if (active) navigate({ to: dest });
        }
      } finally {
        if (active) setProcessingAuth(false);
      }
    }

    finishAuth();

    const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        const dest = await resolvePostLoginRoute(session.user.id);
        navigate({ to: dest });
      }
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [navigate]);

  if (processingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <main>
        {/* Dark gradient header + hero zone, fading into the feature cards below */}
        <div className="relative">
          <div
            aria-hidden
            className="feed-header-zone grain-overlay pointer-events-none absolute inset-0"
          >
            {/* Warm amber glow orb for depth */}
            <div
              className="pointer-events-none absolute left-[58%] top-1/2 h-[400px] w-[400px] -translate-x-1/2 -translate-y-1/2"
              style={{
                background:
                  "radial-gradient(circle, rgba(255, 107, 0, 0.1) 0%, rgba(255, 107, 0, 0.05) 40%, transparent 70%)",
                filter: "blur(60px)",
              }}
            />
          </div>

          <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
            <ScoutLogoLink className="text-2xl font-extrabold text-white" />
            <Button
              asChild
              className="rounded-full px-5 py-2 text-sm font-medium text-white hover:opacity-90"
              style={RED_PILL}
            >
              <Link to="/onboarding">Get Started</Link>
            </Button>
          </header>

          {/* Hero */}
          <section className="relative mx-auto max-w-3xl px-6 pb-20 pt-20 text-center sm:pb-28 sm:pt-36">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.15] bg-black/[0.35] px-3 py-1 text-xs font-medium text-white shadow-[var(--shadow-soft)] backdrop-blur">
              <Sparkles className="h-3.5 w-3.5" /> Built for college students everywhere
            </span>
            <h1 className="mt-8 text-4xl font-extrabold leading-[1.05] tracking-tight text-white sm:text-6xl">
              Never miss what matters in your city
            </h1>
            <p className="mx-auto mt-7 max-w-xl text-lg leading-relaxed text-white">
              Scout learns your interests and surfaces the concerts, meetups, games and career
              events worth your time — all in one clean, personalized feed.
            </p>
            <div className="mt-10">
              <Button
                asChild
                size="lg"
                className="rounded-full px-8 text-white hover:opacity-90"
                style={RED_PILL}
              >
                <Link to="/onboarding">Get Started</Link>
              </Button>
              <p className="mt-4 flex items-center justify-center gap-1.5 text-sm text-white">
                <Users className="h-3.5 w-3.5" />
                Already used by students at FIU, UM, and FSU
              </p>
            </div>
          </section>
        </div>

        {/* Feature cards */}
        <section className="mx-auto grid max-w-5xl gap-4 px-6 pb-24 sm:grid-cols-3">
          {[
            {
              icon: Compass,
              title: "Discover by interest",
              body: "Pick what you care about and Scout tailors your feed accordingly.",
            },
            {
              icon: Sparkles,
              title: "Curated for your city",
              body: "Only the events happening near your campus, filtered by what you love.",
            },
            {
              icon: Share2,
              title: "Share in one tap",
              body: "Generate ready-to-post LinkedIn and X content for any event.",
            },
          ].map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="rounded-2xl border border-border bg-card p-6 text-left shadow-[var(--shadow-soft)] transition-transform duration-300 ease-out hover:-translate-y-1 hover:shadow-md"
            >
              <Icon className="h-5 w-5" />
              <h2 className="mt-4 text-base font-bold tracking-tight">{title}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
            </div>
          ))}
        </section>

        {/* Feed mockup preview */}
        <section className="bg-[oklch(0.97_0.005_80)] py-24">
          <div className="mx-auto max-w-5xl px-6">
            <div className="mb-12 text-center">
              <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
                Your personalized feed
              </h2>
              <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
                Once you're set up, Scout surfaces the events that match your major, city, and interests — sorted just for you.
              </p>
            </div>

            {/* Illustrated placeholder cards */}
            <div className="mx-auto max-w-3xl space-y-5">
              {[
                {
                  cat: "Tech & Startups",
                  title: "Startup Pitch Night",
                  when: "Thu, Jun 5 · 6:30 PM",
                  where: "The LAB · Downtown",
                  color: "bg-[#FF2D2D]/10 border-[#FF2D2D]/20",
                  text: "text-[#FF2D2D]",
                },
                {
                  cat: "Concerts & Music",
                  title: "Rooftop Live Sessions",
                  when: "Fri, Jun 6 · 8:00 PM",
                  where: "Kimpton EPIC · Brickell",
                  color: "bg-[#FF2D2D]/10 border-[#FF2D2D]/20",
                  text: "text-[#FF2D2D]",
                },
                {
                  cat: "Career & Jobs",
                  title: "Tech Careers Fair 2026",
                  when: "Jun 11 · 11AM",
                  where: "MDC Auditorium · Downtown",
                  color: "bg-[#FF2D2D]/10 border-[#FF2D2D]/20",
                  text: "text-[#FF2D2D]",
                },
              ].map((item, i) => (
                <div
                  key={i}
                  className="flex flex-col gap-4 rounded-2xl border border-border bg-background p-6 shadow-sm sm:flex-row sm:items-center sm:gap-8"
                >
                  <div className="flex items-center gap-4 sm:w-72">
                    <div className={`rounded-xl border p-3 ${item.color}`}>
                      <Tag className={`h-5 w-5 ${item.text}`} />
                    </div>
                    <div>
                      <p className={`text-sm font-semibold ${item.text}`}>{item.cat}</p>
                      <p className="mt-1 text-base font-medium">{item.title}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6 text-sm text-muted-foreground sm:ml-auto">
                    <span className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      {item.when}
                    </span>
                    <span className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      {item.where}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
