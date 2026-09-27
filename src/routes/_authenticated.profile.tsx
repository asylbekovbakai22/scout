import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, LogOut, MessageSquarePlus, Pencil } from "lucide-react";
import { toast } from "sonner";

import { ScoutLogoLink } from "../components/ScoutLogoLink";
import { Button } from "../components/ui/button";
import { Label } from "../components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Textarea } from "../components/ui/textarea";
import { Slider } from "../components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { PlacesAutocomplete } from "../components/PlacesAutocomplete";
import { MajorAutocomplete } from "../components/MajorAutocomplete";
import { cn } from "../lib/utils";
import { supabase } from "@/lib/supabase";
import { useAuth } from "../lib/auth";
import { writeStoredProfile, readStoredProfile } from "../hooks/useFeedSync";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Your profile — Scout" },
      {
        name: "description",
        content: "Manage your Scout profile, interests, and account settings.",
      },
    ],
  }),
  component: Profile,
});

const CATEGORY_TILES = [
  {
    emoji: "🏆",
    name: "Sports",
    border: "border-amber-300",
    bg: "bg-amber-50",
    text: "text-amber-700",
  },
  {
    emoji: "🎵",
    name: "Music & Entertainment",
    border: "border-violet-300",
    bg: "bg-violet-50",
    text: "text-violet-700",
  },
  {
    emoji: "💻",
    name: "Tech & Innovation",
    border: "border-sky-300",
    bg: "bg-sky-50",
    text: "text-sky-700",
  },
  {
    emoji: "💼",
    name: "Career & Education",
    border: "border-emerald-300",
    bg: "bg-emerald-50",
    text: "text-emerald-700",
  },
  {
    emoji: "🎨",
    name: "Arts & Culture",
    border: "border-rose-300",
    bg: "bg-rose-50",
    text: "text-rose-700",
  },
  {
    emoji: "🍕",
    name: "Food & Going Out",
    border: "border-orange-300",
    bg: "bg-orange-50",
    text: "text-orange-700",
  },
  {
    emoji: "📈",
    name: "Business & Finance",
    border: "border-indigo-300",
    bg: "bg-indigo-50",
    text: "text-indigo-700",
  },
  {
    emoji: "🏥",
    name: "Health & Wellness",
    border: "border-teal-300",
    bg: "bg-teal-50",
    text: "text-teal-700",
  },
  {
    emoji: "🤝",
    name: "Social & Networking",
    border: "border-cyan-300",
    bg: "bg-cyan-50",
    text: "text-cyan-700",
  },
];

function getInitials(name: string, email: string): string {
  const source = name.trim() || email.split("@")[0] || "";
  const parts = source.split(/[\s._-]+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

interface ProfileData {
  city: string;
  university: string;
  major: string;
  interests: string[];
  vibes: string;
}

const EMPTY_PROFILE: ProfileData = {
  city: "",
  university: "",
  major: "",
  interests: [],
  vibes: "",
};

function SectionHeader({
  title,
  editing,
  onEdit,
}: {
  title: string;
  editing: boolean;
  onEdit: () => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-lg font-bold tracking-tight">{title}</h2>
      {!editing && (
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-muted-foreground"
          onClick={onEdit}
        >
          <Pencil className="h-3.5 w-3.5" />
          Edit
        </Button>
      )}
    </div>
  );
}

function Profile() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const email = user?.email ?? "";
  const name =
    (user?.user_metadata?.full_name as string | undefined)?.trim() ||
    (user?.user_metadata?.name as string | undefined)?.trim() ||
    email.split("@")[0] ||
    "Scout member";
  const avatarUrl = user?.user_metadata?.avatar_url as string | undefined;

  const [profile, setProfile] = useState<ProfileData>(EMPTY_PROFILE);
  const [radius, setRadius] = useState(25);

  // Which section is currently in edit mode (null = all view mode).
  const [editingSection, setEditingSection] = useState<null | "location" | "interests" | "vibe">(
    null,
  );
  const [saving, setSaving] = useState(false);

  // Feedback modal state.
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);

  const submitFeedback = async () => {
    const message = feedbackText.trim();
    if (!message || !user?.id) return;
    setFeedbackSubmitting(true);
    try {
      const { error } = await supabase.from("feedback").insert({ user_id: user.id, message });
      if (error) throw error;
      toast.success("Thanks for your feedback!");
      setFeedbackText("");
      setFeedbackOpen(false);
    } catch (err) {
      console.error("[scout] feedback submit failed:", err);
      toast.error("Couldn't send your feedback — please try again.");
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  // Draft state used while editing each section.
  const [draftCity, setDraftCity] = useState("");
  const [draftCitySelected, setDraftCitySelected] = useState(true);
  const [draftUniversity, setDraftUniversity] = useState("");
  const [draftMajor, setDraftMajor] = useState("");
  const [draftInterests, setDraftInterests] = useState<string[]>([]);
  const [draftVibes, setDraftVibes] = useState("");

  const applyProfile = (p: ProfileData) => {
    setProfile(p);
  };

  // Load profile from localStorage immediately, then refresh from Supabase.
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = readStoredProfile();
        if (saved && typeof saved === "object") {
          applyProfile({
            city: saved.city ?? "",
            university: saved.university ?? "",
            major: saved.major ?? "",
            interests: Array.isArray(saved.interests) ? saved.interests : [],
            vibes: saved.vibes ?? "",
          });
          if (saved.radius) setRadius(saved.radius);
        }
      } catch {
        // ignore malformed cache
      }
    }
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("city, university, major, interests, vibes, radius")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled || !data) return;
      applyProfile({
        city: data.city ?? "",
        university: data.university ?? "",
        major: data.major ?? "",
        interests: Array.isArray(data.interests) ? data.interests : [],
        vibes: data.vibes ?? "",
      });
      if (data.radius) setRadius(data.radius);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const startEdit = (section: "location" | "interests" | "vibe") => {
    setDraftCity(profile.city);
    setDraftCitySelected(true);
    setDraftUniversity(profile.university);
    setDraftMajor(profile.major);
    setDraftInterests(profile.interests);
    setDraftVibes(profile.vibes);
    setEditingSection(section);
  };

  const cancelEdit = () => setEditingSection(null);

  const persist = async (next: ProfileData) => {
    setSaving(true);
    try {
      if (typeof window !== "undefined") {
        // Merge-write: preserves keys not in ProfileData (radius) and
        // notifies any mounted feed so its streams reset to the new profile.
        writeStoredProfile(next);
      }
      if (user?.id) {
        const { error } = await supabase.from("profiles").upsert({
          id: user.id,
          major: next.major || null,
          university: next.university || null,
          city: next.city || null,
          interests: next.interests,
          vibes: next.vibes || null,
        });
        if (error) throw error;
      }
      applyProfile(next);
      setEditingSection(null);
    } catch (err) {
      console.error("[scout] profile save failed:", err);
      toast.error("Couldn't save your profile changes — please try again.");
    } finally {
      setSaving(false);
    }
  };

  const saveLocation = () =>
    persist({
      ...profile,
      city: draftCity,
      university: draftUniversity,
      major: draftMajor,
    });

  const saveInterests = () => persist({ ...profile, interests: draftInterests });

  const saveVibe = () => persist({ ...profile, vibes: draftVibes });

  const toggleInterest = (interestName: string) =>
    setDraftInterests((prev) =>
      prev.includes(interestName)
        ? prev.filter((i) => i !== interestName)
        : [...prev, interestName],
    );

  const handleRadiusChange = async (next: number) => {
    setRadius(next);

    try {
      writeStoredProfile({ radius: next });
    } catch (err) {
      console.error("[scout] failed to update local profile cache:", err);
    }

    if (user) {
      const { error } = await supabase.from("profiles").update({ radius: next }).eq("id", user.id);
      if (error) console.error("[scout] failed to save radius:", error);
    }
  };

  const handleSignOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Dark gradient zone wrapping navbar + avatar/name */}
      <div className="relative">
        <div
          aria-hidden
          className="feed-header-zone grain-overlay pointer-events-none absolute inset-0"
        />
        <header className="relative z-10">
          <div className="flex w-full items-center justify-between px-6 py-5">
            <ScoutLogoLink className="text-2xl font-extrabold text-white" />
            <Link
              to="/feed"
              className="flex items-center gap-1.5 text-sm font-medium text-white hover:opacity-90"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to feed
            </Link>
          </div>
        </header>

        <div className="relative z-10 mx-auto w-full max-w-xl px-6 pb-16 pt-6">
          <div className="flex flex-col items-center text-center">
            <Avatar className="h-24 w-24 text-2xl">
              {avatarUrl && <AvatarImage src={avatarUrl} alt={name} />}
              <AvatarFallback className="bg-[#FF6B6B] text-xl font-semibold text-white">
                {getInitials(name, email)}
              </AvatarFallback>
            </Avatar>
            <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-white">{name}</h1>
            {email && <p className="mt-1 text-white/80">{email}</p>}
          </div>
        </div>
      </div>

      <main className="mx-auto w-full max-w-xl px-6 pb-12">
        <div className="space-y-6">
          {/* Search radius */}
          <section className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold tracking-tight">Search radius</h2>
              <span className="text-sm font-semibold text-primary">{radius} miles</span>
            </div>
            <Slider
              className="mt-5 [&>span>span]:bg-[#FF2D2D] [&_[role=slider]]:border-[#FF2D2D] [&_[role=slider]]:bg-[#FF2D2D]"
              min={1}
              max={50}
              step={1}
              value={[radius]}
              onValueChange={(v) => setRadius(v[0])}
              onValueCommit={(v) => handleRadiusChange(v[0])}
            />
          </section>

          {/* Location */}
          <section className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
            <SectionHeader
              title="Location"
              editing={editingSection === "location"}
              onEdit={() => startEdit("location")}
            />

            {editingSection === "location" ? (
              <div className="mt-4 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <PlacesAutocomplete
                    id="city"
                    variant="city"
                    placeholder="e.g. Miami"
                    value={draftCity}
                    onChange={(v) => {
                      setDraftCity(v);
                      setDraftCitySelected(false);
                    }}
                    onSelect={(v) => {
                      setDraftCity(v);
                      setDraftCitySelected(true);
                    }}
                  />
                  {draftCity.trim() && !draftCitySelected && (
                    <p className="text-xs text-muted-foreground">
                      Please select a city from the suggestions
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="university">University</Label>
                  <PlacesAutocomplete
                    id="university"
                    variant="university"
                    placeholder="e.g. University of Miami"
                    value={draftUniversity}
                    onChange={setDraftUniversity}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="major">Major</Label>
                  <MajorAutocomplete
                    id="major"
                    placeholder="e.g. Computer Science"
                    value={draftMajor}
                    onChange={setDraftMajor}
                  />
                </div>
                <div className="flex gap-3 pt-1">
                  <Button variant="outline" onClick={cancelEdit} disabled={saving}>
                    Cancel
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={saveLocation}
                    disabled={saving || (!!draftCity.trim() && !draftCitySelected)}
                  >
                    {saving ? "Saving…" : "Save"}
                  </Button>
                </div>
              </div>
            ) : (
              <dl className="mt-4 space-y-3">
                <div className="flex justify-between gap-4">
                  <dt className="text-sm text-muted-foreground">City</dt>
                  <dd className="text-sm font-medium">{profile.city || "—"}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-sm text-muted-foreground">University</dt>
                  <dd className="text-sm font-medium">{profile.university || "—"}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-sm text-muted-foreground">Major</dt>
                  <dd className="text-sm font-medium">{profile.major || "—"}</dd>
                </div>
              </dl>
            )}
          </section>

          {/* Interests */}
          <section className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
            <SectionHeader
              title="Interests"
              editing={editingSection === "interests"}
              onEdit={() => startEdit("interests")}
            />

            {editingSection === "interests" ? (
              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {CATEGORY_TILES.map((tile) => {
                    const active = draftInterests.includes(tile.name);
                    return (
                      <button
                        key={tile.name}
                        type="button"
                        onClick={() => toggleInterest(tile.name)}
                        className={cn(
                          "flex flex-col items-center justify-center gap-2 rounded-2xl border p-4 text-center transition-all shadow-[var(--shadow-soft)]",
                          active
                            ? cn(
                                tile.border,
                                tile.bg,
                                "ring-1",
                                tile.border.replace("border-", "ring-"),
                              )
                            : "border-border bg-card hover:border-primary/40",
                        )}
                      >
                        <span className="text-2xl">{tile.emoji}</span>
                        <span
                          className={cn(
                            "text-xs font-semibold leading-tight",
                            active ? tile.text : "text-foreground",
                          )}
                        >
                          {tile.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div className="flex gap-3 pt-1">
                  <Button variant="outline" onClick={cancelEdit} disabled={saving}>
                    Cancel
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={saveInterests}
                    disabled={saving || draftInterests.length === 0}
                  >
                    {saving ? "Saving…" : "Save"}
                  </Button>
                </div>
              </div>
            ) : profile.interests.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {profile.interests.map((interest) => (
                  <span
                    key={interest}
                    className="rounded-full bg-muted px-3 py-1 text-sm font-medium"
                  >
                    {interest}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">No interests selected yet.</p>
            )}
          </section>

          {/* Vibe */}
          <section className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
            <SectionHeader
              title="Vibe"
              editing={editingSection === "vibe"}
              onEdit={() => startEdit("vibe")}
            />

            {editingSection === "vibe" ? (
              <div className="mt-4 space-y-4">
                <Textarea
                  value={draftVibes}
                  onChange={(e) => setDraftVibes(e.target.value)}
                  placeholder="e.g. Inter Miami, Travis Scott, AI startups, rooftop bars, hackathons..."
                  className="min-h-[120px] rounded-2xl p-4 text-base leading-relaxed shadow-[var(--shadow-soft)]"
                />
                <div className="flex gap-3 pt-1">
                  <Button variant="outline" onClick={cancelEdit} disabled={saving}>
                    Cancel
                  </Button>
                  <Button className="flex-1" onClick={saveVibe} disabled={saving}>
                    {saving ? "Saving…" : "Save"}
                  </Button>
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm leading-relaxed text-foreground">
                {profile.vibes || <span className="text-muted-foreground">No vibe added yet.</span>}
              </p>
            )}
          </section>

          <Button
            variant="ghost"
            size="lg"
            className="w-full justify-center text-destructive hover:text-destructive"
            onClick={handleSignOut}
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>

          <Button
            variant="outline"
            size="lg"
            className="w-full justify-center"
            onClick={() => setFeedbackOpen(true)}
          >
            <MessageSquarePlus className="h-4 w-4" />
            Send Feedback
          </Button>

          <Dialog open={feedbackOpen} onOpenChange={setFeedbackOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Send Feedback</DialogTitle>
                <DialogDescription>
                  Got an idea, bug, or request? Let us know what's on your mind.
                </DialogDescription>
              </DialogHeader>
              <Textarea
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                placeholder="Tell us what you think…"
                className="min-h-[140px] rounded-xl p-4 text-base leading-relaxed"
              />
              <DialogFooter>
                <Button
                  onClick={submitFeedback}
                  disabled={feedbackSubmitting || !feedbackText.trim()}
                >
                  {feedbackSubmitting ? "Submitting…" : "Submit"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </main>
    </div>
  );
}
