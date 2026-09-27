import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Copy, Loader2 } from "lucide-react";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Textarea } from "./ui/textarea";
import { Button } from "./ui/button";
import type { ScoutEvent } from "../data/events";
import type { SurveyAnswers } from "./AttendedSurvey";
import { API_BASE } from "../lib/utils";
import { getAccessToken } from "../lib/supabase";

async function fetchPost(
  event: ScoutEvent,
  platform: "linkedin" | "twitter",
  survey?: SurveyAnswers | null,
): Promise<string> {
  const token = await getAccessToken();
  if (!token) throw new Error("You need to be signed in to generate posts.");

  const res = await fetch(`${API_BASE}/api/generate-post`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      event: {
        name: event.name,
        date: event.date,
        venue: event.venue,
        category: event.category,
        description: event.description,
      },
      platform,
      attended: !!survey,
      ...(survey
        ? {
            rating: survey.rating,
            highlight: survey.highlight,
            recommend: survey.recommend,
            company:
              (
                { Solo: "solo", Friends: "friends", "Work/Networking": "work" } as Record<
                  string,
                  string
                >
              )[survey.companions ?? ""] ?? null,
          }
        : {}),
    }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { detail?: string };
    throw new Error(body.detail ?? `Error ${res.status}`);
  }
  const data = (await res.json()) as { post: string };
  return data.post;
}

interface PostGeneratorProps {
  event: ScoutEvent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  survey?: SurveyAnswers | null;
}

export function PostGenerator({ event, open, onOpenChange, survey }: PostGeneratorProps) {
  const [linkedInText, setLinkedInText] = useState("");
  const [twitterText, setTwitterText] = useState("");
  const [linkedInLoading, setLinkedInLoading] = useState(false);
  const [twitterLoading, setTwitterLoading] = useState(false);
  const [linkedInError, setLinkedInError] = useState<string | null>(null);
  const [twitterError, setTwitterError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"linkedin" | "twitter">("linkedin");

  // Tracks the event+session key for which Twitter has been fetched, preventing
  // duplicate fetches when the user rapidly switches tabs.
  const sessionRef = useRef(0);
  const twitterFetchKeyRef = useRef<string | null>(null);

  // When the dialog opens (or the event changes), reset all state and
  // pre-fetch LinkedIn — the default visible tab. Twitter is fetched lazily
  // when the user first switches to that tab, consuming only 1 rate-limit
  // slot on open instead of 2.
  useEffect(() => {
    const session = ++sessionRef.current;
    if (!event || !open) return;

    setLinkedInText("");
    setTwitterText("");
    setLinkedInError(null);
    setTwitterError(null);
    setLinkedInLoading(true);
    setTwitterLoading(false);
    setActiveTab("linkedin");
    twitterFetchKeyRef.current = null;

    let cancelled = false;
    fetchPost(event, "linkedin", survey)
      .then((text) => {
        if (!cancelled) setLinkedInText(text);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : "Couldn't generate post — try again.";
          setLinkedInError(msg);
          toast.error(msg);
        }
      })
      .finally(() => {
        if (!cancelled) setLinkedInLoading(false);
      });

    return () => {
      cancelled = true;
      if (sessionRef.current === session) sessionRef.current++;
    };
  }, [event, open, survey]);

  // Called when the user clicks a tab. Twitter is fetched the first time
  // the tab becomes active; subsequent switches reuse the already-fetched text.
  const handleTabChange = (tab: string) => {
    setActiveTab(tab as "linkedin" | "twitter");

    if (tab !== "twitter" || !event || twitterLoading || twitterText || twitterError) return;

    // Unique key per event + dialog session prevents duplicate in-flight requests.
    const fetchKey = `${event.id}:${String(open)}`;
    if (twitterFetchKeyRef.current === fetchKey) return;
    twitterFetchKeyRef.current = fetchKey;

    const session = sessionRef.current;
    setTwitterLoading(true);
    fetchPost(event, "twitter", survey)
      .then((text) => {
        if (sessionRef.current === session) setTwitterText(text);
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : "Couldn't generate post — try again.";
        if (sessionRef.current !== session) return;
        setTwitterError(msg);
        toast.error(msg);
      })
      .finally(() => {
        if (sessionRef.current === session) setTwitterLoading(false);
      });
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Couldn't copy — select and copy manually");
    }
  };

  const renderBody = (
    text: string,
    setText: (v: string) => void,
    loading: boolean,
    error: string | null,
    isTwitter: boolean,
  ) => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-10 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Writing your post…
        </div>
      );
    }
    if (error) {
      return (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
          {error}
        </p>
      );
    }
    return (
      <div className="space-y-1.5">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={isTwitter ? 6 : 11}
          className="resize-none text-sm leading-relaxed"
        />
        {isTwitter && (
          <p
            className={`text-right text-xs tabular-nums ${
              text.length > 280 ? "font-semibold text-destructive" : "text-muted-foreground"
            }`}
          >
            {text.length} / 280
          </p>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create a post</DialogTitle>
          <DialogDescription>
            {event ? `Share "${event.name}" with your network.` : ""}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="linkedin">LinkedIn</TabsTrigger>
            <TabsTrigger value="twitter">Twitter / X</TabsTrigger>
          </TabsList>

          <TabsContent value="linkedin" className="space-y-3">
            {renderBody(linkedInText, setLinkedInText, linkedInLoading, linkedInError, false)}
            <Button
              onClick={() => copy(linkedInText)}
              className="w-full"
              disabled={!linkedInText || linkedInLoading}
            >
              <Copy className="mr-2 h-4 w-4" /> Copy
            </Button>
          </TabsContent>

          <TabsContent value="twitter" className="space-y-3">
            {renderBody(twitterText, setTwitterText, twitterLoading, twitterError, true)}
            <Button
              onClick={() => copy(twitterText)}
              className="w-full"
              disabled={!twitterText || twitterLoading}
            >
              <Copy className="mr-2 h-4 w-4" /> Copy
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
