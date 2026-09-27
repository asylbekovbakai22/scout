import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { ScoutLogoLink } from "../components/ScoutLogoLink";

import { Button } from "../components/ui/button";

import { Label } from "../components/ui/label";

import { PlacesAutocomplete } from "../components/PlacesAutocomplete";
import { MajorAutocomplete } from "../components/MajorAutocomplete";
import { cn } from "../lib/utils";
import { supabase } from "@/lib/supabase";
import { writeStoredProfile, readStoredProfile } from "../hooks/useFeedSync";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [
      { title: "Set up your Scout profile" },
      {
        name: "description",
        content: "Tell Scout your major and interests to personalize your event feed.",
      },
    ],
  }),
  component: Onboarding,
});

const RED_PILL = {
  backgroundImage: "linear-gradient(135deg, #FF2D2D, #E60000)",
  boxShadow: "0 4px 15px rgba(255, 45, 45, 0.4)",
};

const DARK_INPUT =
  "bg-white/[0.08] border-white/[0.15] text-white placeholder:text-white/50 focus-visible:ring-white/30";

const CATEGORY_TILES = [
  { emoji: "🏆", name: "Sports" },
  { emoji: "🎵", name: "Music & Entertainment" },
  { emoji: "💻", name: "Tech & Innovation" },
  { emoji: "💼", name: "Career & Education" },
  { emoji: "🎨", name: "Arts & Culture" },
  { emoji: "🍕", name: "Food & Going Out" },
  { emoji: "📈", name: "Business & Finance" },
  { emoji: "🏥", name: "Health & Wellness" },
  { emoji: "🤝", name: "Social & Networking" },
];

function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [major, setMajor] = useState("");
  const [university, setUniversity] = useState("");
  const [city, setCity] = useState("");
  const [citySelected, setCitySelected] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [vibes, setVibes] = useState("");

  // Pre-fill from the existing profile (e.g. when arriving via "Edit interests")
  // so editing doesn't present a blank form that would overwrite saved answers.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = readStoredProfile();
      if (!saved || typeof saved !== "object") return;
      if (saved.major) setMajor(saved.major);
      if (saved.university) setUniversity(saved.university);
      if (saved.city) {
        setCity(saved.city);
        setCitySelected(true);
      }
      if (Array.isArray(saved.interests)) setSelected(saved.interests);
      if (saved.vibes) setVibes(saved.vibes);
    } catch {
      // Ignore malformed localStorage data — user proceeds with a blank form.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = (name: string) =>
    setSelected((prev) => (prev.includes(name) ? prev.filter((i) => i !== name) : [...prev, name]));

  const [saving, setSaving] = useState(false);

  const finish = async () => {
    const profile = { major, university, city, interests: selected, vibes };

    // Keep localStorage as an offline fallback.
    if (typeof window !== "undefined") {
      writeStoredProfile(profile);
    }

    setSaving(true);
    try {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        const { error } = await supabase.from("profiles").upsert({
          id: data.user.id,
          major: major || null,
          university: university || null,
          city: city || null,
          interests: selected,
          vibes: vibes || null,
        });
        if (error) throw error;
      }
    } catch (err) {
      console.error("[scout] onboarding profile upsert failed:", err);
      toast.error("Couldn't save your profile — you can update it later from your profile page.");
    } finally {
      setSaving(false);
      navigate({ to: "/feed" });
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center overflow-hidden bg-[#0a0a14]">
      {/* Subtle ambient gradient */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 30%, rgba(255, 255, 255, 0.04) 0%, transparent 60%)",
        }}
      />
      {/* Grain overlay */}
      <div className="grain-overlay absolute inset-0 pointer-events-none" />
      {/* Warm orange glow orb */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/4 h-[400px] w-[400px] -translate-x-1/2 -translate-y-1/2"
        style={{
          background: "radial-gradient(circle, rgba(255, 107, 0, 0.08) 0%, transparent 70%)",
          filter: "blur(60px)",
        }}
      />

      <header className="relative z-10 mx-auto w-full max-w-6xl px-6 py-5">
        <ScoutLogoLink className="text-2xl font-extrabold text-white" />
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-6 py-16">
        <div className="mb-8 flex items-center gap-2">
          {[1, 2].map((s) => (
            <div
              key={s}
              className={cn(
                "h-1.5 flex-1 rounded-full",
                step >= s ? "bg-[#FF2D2D]" : "bg-white/20",
              )}
            />
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-6">
            <div>
              <p className="text-sm font-medium text-white/60">Step 1 of 2</p>
              <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-white">
                Tell us about you
              </h1>
              <p className="mt-2 text-white/60">
                We use this to tailor events to your campus and field.
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="major" className="text-white">
                  Major <span className="font-normal text-white/60">(optional)</span>
                </Label>
                <MajorAutocomplete
                  id="major"
                  placeholder="e.g. Computer Science"
                  value={major}
                  onChange={setMajor}
                  inputClassName={DARK_INPUT}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="university" className="text-white">
                  University <span className="font-normal text-white/60">(optional)</span>
                </Label>
                <PlacesAutocomplete
                  id="university"
                  variant="university"
                  placeholder="e.g. University of Miami"
                  value={university}
                  onChange={setUniversity}
                  inputClassName={DARK_INPUT}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city" className="text-white">
                  City
                </Label>
                <PlacesAutocomplete
                  id="city"
                  variant="city"
                  placeholder="e.g. Miami"
                  value={city}
                  onChange={(v) => {
                    setCity(v);
                    setCitySelected(false);
                  }}
                  onSelect={(v) => {
                    setCity(v);
                    setCitySelected(true);
                  }}
                  inputClassName={DARK_INPUT}
                />
                {city.trim() && !citySelected && (
                  <p className="text-xs text-white/60">Please select a city from the suggestions</p>
                )}
              </div>
            </div>

            <Button
              size="lg"
              className="w-full rounded-full border-0 font-semibold text-white"
              style={RED_PILL}
              disabled={!city.trim() || !citySelected}
              onClick={() => setStep(2)}
            >
              Continue
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div>
              <p className="text-sm font-medium text-white/60">Step 2 of 2</p>
              <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-white">
                Pick your interests
              </h1>
              <p className="mt-2 text-white/60">
                Choose one or more — we'll start your feed from here.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {CATEGORY_TILES.map((tile) => {
                const active = selected.includes(tile.name);
                return (
                  <button
                    key={tile.name}
                    type="button"
                    onClick={() => toggle(tile.name)}
                    className={cn(
                      "flex flex-col items-center justify-center gap-2 rounded-2xl border p-5 text-center transition-all",
                      active
                        ? "border-[#FF2D2D]/50 bg-[#FF2D2D]/15 text-white shadow-[0_4px_15px_rgba(255,45,45,0.4)] ring-1 ring-[#FF2D2D]/50"
                        : "border-white/[0.15] bg-white/[0.08] text-white hover:bg-white/[0.12]",
                    )}
                  >
                    <span className="text-3xl">{tile.emoji}</span>
                    <span
                      className={cn(
                        "text-xs font-semibold leading-tight",
                        active ? "text-white" : "text-white",
                      )}
                    >
                      {tile.name}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                size="lg"
                onClick={() => setStep(1)}
                className="rounded-full border-white/[0.15] bg-white/[0.08] text-white hover:bg-white/[0.12] hover:text-white"
              >
                Back
              </Button>
              <Button
                size="lg"
                className="flex-1 rounded-full border-0 font-semibold text-white"
                style={RED_PILL}
                disabled={selected.length === 0 || saving}
                onClick={finish}
              >
                {saving ? "Saving…" : "Build My Feed →"}
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
