import { useEffect, useState } from "react";
import { Star, Sparkles } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import type { ScoutEvent } from "../data/events";

export interface SurveyAnswers {
  rating: number;
  highlight: string;
  recommend: boolean | null;
  companions: string | null;
}

const CORAL = "#FF6B6B";
const COMPANIONS = ["Solo", "Friends", "Work/Networking"];

interface AttendedSurveyProps {
  event: ScoutEvent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (answers: SurveyAnswers) => void;
}

export function AttendedSurvey({ event, open, onOpenChange, onSubmit }: AttendedSurveyProps) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [highlight, setHighlight] = useState("");
  const [recommend, setRecommend] = useState<boolean | null>(null);
  const [companions, setCompanions] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setRating(0);
      setHover(0);
      setHighlight("");
      setRecommend(null);
      setCompanions(null);
    }
  }, [open, event?.id]);

  const handleSubmit = () => {
    if (rating === 0) return;
    onSubmit({ rating, highlight: highlight.trim(), recommend, companions });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>How was it?</DialogTitle>
          <DialogDescription>
            {event ? `A few quick taps about "${event.name}".` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-1">
          {/* 1. Overall rating */}
          <div className="space-y-2">
            <p className="text-sm font-medium">
              How was it overall? <span className="text-muted-foreground">(required)</span>
            </p>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => {
                const active = (hover || rating) >= n;
                return (
                  <button
                    key={n}
                    type="button"
                    aria-label={`${n} star${n > 1 ? "s" : ""}`}
                    onMouseEnter={() => setHover(n)}
                    onMouseLeave={() => setHover(0)}
                    onClick={() => setRating(n)}
                    className="rounded-full p-1 transition-transform hover:scale-110"
                  >
                    <Star
                      className="h-7 w-7 transition-colors"
                      style={
                        active
                          ? { fill: CORAL, color: CORAL }
                          : { color: "hsl(var(--muted-foreground))" }
                      }
                    />
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Highlight */}
          <div className="space-y-2">
            <p className="text-sm font-medium">
              What stood out? <span className="text-muted-foreground">(optional)</span>
            </p>
            <Input
              value={highlight}
              onChange={(e) => setHighlight(e.target.value)}
              placeholder="Amazing speakers, great vibes..."
            />
          </div>

          {/* 3. Recommend */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Would you recommend it?</p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={recommend === true ? "default" : "outline"}
                className="flex-1"
                style={recommend === true ? { backgroundColor: CORAL } : undefined}
                onClick={() => setRecommend(true)}
              >
                Yes!
              </Button>
              <Button
                type="button"
                variant={recommend === false ? "default" : "outline"}
                className="flex-1"
                style={recommend === false ? { backgroundColor: CORAL } : undefined}
                onClick={() => setRecommend(false)}
              >
                Not really
              </Button>
            </div>
          </div>

          {/* 4. Companions */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Who did you go with?</p>
            <div className="flex flex-wrap gap-2">
              {COMPANIONS.map((c) => {
                const active = companions === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCompanions(active ? null : c)}
                    className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                      active ? "text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                    style={active ? { backgroundColor: CORAL } : undefined}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
          </div>

          <Button className="w-full" disabled={rating === 0} onClick={handleSubmit}>
            <Sparkles className="mr-2 h-4 w-4" />
            Create My Post
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
