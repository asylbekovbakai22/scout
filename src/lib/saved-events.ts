import { toast } from "sonner";
import type { ScoutEvent } from "../data/events";
import { supabase } from "@/lib/supabase";
import type { Json } from "@/integrations/supabase/types";

import { storageKey, getStorageUser, getStorageRevision } from "./user-storage";
import type { SurveyAnswers } from "../components/AttendedSurvey";

const SAVED_KEY = "scout-saved-events";
const ATTENDED_KEY = "scout-attended-events";
const UPDATE_EVENT = "scout-saved-updated";

function read(key: string): ScoutEvent[] {
  try {
    const raw = JSON.parse(localStorage.getItem(storageKey(key) ?? "") ?? "[]");
    if (!Array.isArray(raw)) return [];
    // Backward compat: older format stored plain id strings — drop those,
    // they can't be rehydrated into full event objects.
    return raw.filter((e): e is ScoutEvent => !!e && typeof e === "object" && "id" in e);
  } catch {
    return [];
  }
}

function write(key: string, events: ScoutEvent[]) {
  const scoped = storageKey(key);
  if (!scoped) return;
  localStorage.setItem(scoped, JSON.stringify(events));
  window.dispatchEvent(new Event(UPDATE_EVENT));
}

export function getSavedEvents(): ScoutEvent[] {
  return read(SAVED_KEY);
}

export function getAttendedEvents(): ScoutEvent[] {
  return read(ATTENDED_KEY);
}

export function isSaved(id: string): boolean {
  return read(SAVED_KEY).some((e) => e.id === id);
}

export function isAttended(id: string): boolean {
  return read(ATTENDED_KEY).some((e) => e.id === id);
}

export function toggleSaved(event: ScoutEvent): boolean {
  const current = read(SAVED_KEY);
  const exists = current.some((e) => e.id === event.id);
  const next = exists ? current.filter((e) => e.id !== event.id) : [...current, event];
  write(SAVED_KEY, next);
  return !exists;
}

export function markAttended(event: ScoutEvent, survey?: SurveyAnswers) {
  const enriched = { ...event, attendance: survey };
  write(ATTENDED_KEY, [...read(ATTENDED_KEY).filter((e) => e.id !== event.id), enriched]);
  write(
    SAVED_KEY,
    read(SAVED_KEY).filter((e) => e.id !== event.id),
  );
}

export function getAttendance(id: string): SurveyAnswers | null {
  const event = read(ATTENDED_KEY).find((e) => e.id === id) as
    | (ScoutEvent & { attendance?: SurveyAnswers })
    | undefined;
  return event
    ? (event.attendance ?? { rating: 0, highlight: "", recommend: null, companions: null })
    : null;
}

export function onSavedUpdated(cb: () => void): () => void {
  window.addEventListener(UPDATE_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(UPDATE_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

// ── Supabase DB helpers ──────────────────────────────────────────────────────
// Database writes must succeed before callers update the account-scoped cache.
// Failures are surfaced and leave the visible state unchanged.

export async function dbSaveEvent(userId: string, event: ScoutEvent): Promise<boolean> {
  try {
    const { error } = await supabase.from("saved_events").upsert(
      {
        user_id: userId,
        event_id: event.id,
        event_data: event as unknown as Json,
      },
      { onConflict: "user_id,event_id" },
    );
    if (error) throw error;
    return true;
  } catch (err) {
    console.error("[scout] dbSaveEvent failed:", err);
    toast.error("Couldn't save this event — try again.");
    return false;
  }
}

export async function dbUnsaveEvent(userId: string, eventId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("saved_events")
      .delete()
      .eq("user_id", userId)
      .eq("event_id", eventId);
    if (error) throw error;
    return true;
  } catch (err) {
    console.error("[scout] dbUnsaveEvent failed:", err);
    toast.error("Couldn't remove this event — try again.");
    return false;
  }
}

export async function dbMarkAttended(
  userId: string,
  event: ScoutEvent,
  rating: number | null,
  highlight: string | null,
  recommend: boolean | null,
  company: string | null,
): Promise<boolean> {
  try {
    const { error } = await supabase.from("attended_events").upsert(
      {
        user_id: userId,
        event_id: event.id,
        event_data: event as unknown as Json,
        rating,
        highlight,
        recommend,
        company,
      },
      { onConflict: "user_id,event_id" },
    );
    if (error) throw error;
    const { error: removeError } = await supabase
      .from("saved_events")
      .delete()
      .eq("user_id", userId)
      .eq("event_id", event.id);
    if (removeError) throw removeError;
    return true;
  } catch (err) {
    console.error("[scout] dbMarkAttended failed:", err);
    toast.error("Couldn't save your feedback — try again.");
    return false;
  }
}

// Hydrate the current account from the database, including an empty result.
// Ignore responses for old sessions or responses overtaken by a local action.
export async function mergeSavedFromDB(userId: string): Promise<void> {
  const revision = getStorageRevision();
  const before = JSON.stringify(read(SAVED_KEY));
  try {
    const { data, error } = await supabase
      .from("saved_events")
      .select("event_data")
      .eq("user_id", userId);
    if (error) throw error;
    if (getStorageUser() !== userId || getStorageRevision() !== revision) return;
    const dbEvents = (data ?? []).map((r) => r.event_data as unknown as ScoutEvent).filter(Boolean);
    if (JSON.stringify(read(SAVED_KEY)) !== before) return;
    write(
      SAVED_KEY,
      dbEvents.filter((e) => !isAttended(e.id)),
    );
  } catch (err) {
    console.error("[scout] mergeSavedFromDB failed:", err);
  }
}

// Fetch attended events from DB and merge into localStorage.
export async function mergeAttendedFromDB(userId: string): Promise<void> {
  const revision = getStorageRevision();
  const before = JSON.stringify(read(ATTENDED_KEY));
  try {
    const { data, error } = await supabase
      .from("attended_events")
      .select("event_data, rating, highlight, recommend, company")
      .eq("user_id", userId);
    if (error) throw error;
    if (getStorageUser() !== userId || getStorageRevision() !== revision) return;
    const dbEvents = (data ?? []).map((r) => r.event_data as unknown as ScoutEvent).filter(Boolean);
    if (JSON.stringify(read(ATTENDED_KEY)) !== before) return;
    write(
      ATTENDED_KEY,
      dbEvents.map((event, i) => ({
        ...event,
        attendance: {
          rating: data![i].rating ?? 0,
          highlight: data![i].highlight ?? "",
          recommend: data![i].recommend,
          companions:
            (
              { solo: "Solo", friends: "Friends", work: "Work/Networking" } as Record<
                string,
                string
              >
            )[data![i].company ?? ""] ?? null,
        },
      })),
    );
    write(
      SAVED_KEY,
      read(SAVED_KEY).filter((e) => !isAttended(e.id)),
    );
  } catch (err) {
    console.error("[scout] mergeAttendedFromDB failed:", err);
  }
}
