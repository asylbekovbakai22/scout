import { useEffect, useMemo, useState } from "react";
import { API_BASE } from "../lib/utils";
import { getSavedEvents, getAttendedEvents, onSavedUpdated } from "../lib/saved-events";
import type { ScoutEvent } from "../data/events";

import { storageKey } from "../lib/user-storage";

export interface Profile {
  major?: string;
  university?: string;
  city?: string;
  interests?: string[];
  vibes?: string;
  radius?: number;
}

const PROFILE_KEY = "scout-profile";
const PROFILE_UPDATE_EVENT = "scout-profile-updated";

export function readStoredProfile(): Profile | null {
  try {
    const raw = JSON.parse(localStorage.getItem(storageKey(PROFILE_KEY) ?? "") ?? "null");
    return raw && typeof raw === "object" ? (raw as Profile) : null;
  } catch {
    return null;
  }
}

// Merge-write the stored profile and notify every useFeedSync instance in this
// tab (other tabs get the native `storage` event). Merging preserves keys the
// caller doesn't touch — e.g. `radius` when the profile page saves the
// city/interests form. ALL writes to scout-profile must go through here;
// a bare localStorage.setItem leaves mounted feeds streaming stale data.
export function writeStoredProfile(patch: Partial<Profile>): void {
  const next = { ...(readStoredProfile() ?? {}), ...patch };
  const key = storageKey(PROFILE_KEY);
  if (!key) return;
  localStorage.setItem(key, JSON.stringify(next));
  window.dispatchEvent(new Event(PROFILE_UPDATE_EVENT));
}

// Order- and identity-insensitive content check, so redundant writes (e.g. the
// auth DB sync re-writing an identical profile on every app load) don't
// produce a new profile object and needlessly reset active event streams.
function profileFingerprint(p: Profile | null): string {
  if (!p) return "null";
  return JSON.stringify([p.city, p.university, p.major, p.interests, p.vibes, p.radius]);
}

// Onboarding interest names → backend event category names, and major
// keyword → onboarding interest names. Fetched once from the backend (the
// source of truth) and cached at module scope so every component instance
// reuses the same request.
export type ConfigMappings = {
  interestToCategory: Record<string, string>;
  majorKeywordToInterests: Record<string, string[]>;
};

const EMPTY_MAPPINGS: ConfigMappings = { interestToCategory: {}, majorKeywordToInterests: {} };

let mappingsCache: ConfigMappings | null = null;
let mappingsPromise: Promise<ConfigMappings> | null = null;

function fetchConfigMappings(): Promise<ConfigMappings> {
  if (mappingsCache) return Promise.resolve(mappingsCache);
  if (!mappingsPromise) {
    mappingsPromise = fetch(`${API_BASE}/api/config/mappings`)
      .then((res) => res.json())
      .then((data) => {
        mappingsCache = {
          interestToCategory: data.interest_to_category ?? {},
          majorKeywordToInterests: data.major_keyword_to_interests ?? {},
        };
        return mappingsCache;
      })
      .catch(() => {
        mappingsCache = EMPTY_MAPPINGS;
        return mappingsCache;
      });
  }
  return mappingsPromise;
}

// Resolve a major string into the set of relevant backend categories.
function getMajorCategories(major: string | undefined, mappings: ConfigMappings): Set<string> {
  const result = new Set<string>();
  if (!major) return result;
  const { interestToCategory, majorKeywordToInterests } = mappings;
  const lower = major.toLowerCase();
  for (const [keyword, interests] of Object.entries(majorKeywordToInterests)) {
    if (lower.includes(keyword)) {
      for (const i of interests) result.add(interestToCategory[i] ?? i);
    }
  }
  // Fallback: every major benefits from career & networking events.
  if (result.size === 0) {
    result.add(interestToCategory["Career & Education"] ?? "Career & Education");
    result.add(interestToCategory["Social & Networking"] ?? "Social & Networking");
  }
  return result;
}

// Loads the user's profile, the backend config mappings, and the
// saved/attended events lists, and derives the major → category set.
export function useFeedSync() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [mappings, setMappings] = useState<ConfigMappings>(mappingsCache ?? EMPTY_MAPPINGS);
  const [savedEvents, setSavedEvents] = useState<ScoutEvent[]>([]);
  const [attendedEvents, setAttendedEvents] = useState<ScoutEvent[]>([]);

  // Read the stored profile on mount and re-read on every profile write
  // (vibe save, profile edits, auth DB sync) plus cross-tab storage events —
  // the feed must never keep streaming against a stale snapshot.
  useEffect(() => {
    const sync = () =>
      setProfile((prev) => {
        const next = readStoredProfile();
        return profileFingerprint(prev) === profileFingerprint(next) ? prev : next;
      });
    sync();
    window.addEventListener(PROFILE_UPDATE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(PROFILE_UPDATE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  useEffect(() => {
    if (mappingsCache) return;
    fetchConfigMappings().then(setMappings);
  }, []);

  useEffect(() => {
    const sync = () => {
      setSavedEvents(getSavedEvents());
      setAttendedEvents(getAttendedEvents());
    };
    sync();
    return onSavedUpdated(sync);
  }, []);

  const majorCategories = useMemo(
    () => getMajorCategories(profile?.major, mappings),
    [profile?.major, mappings],
  );

  return { profile, mappings, majorCategories, savedEvents, attendedEvents };
}
