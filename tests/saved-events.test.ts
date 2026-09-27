import { beforeEach, expect, test, vi } from "vitest";
const { query } = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ supabase: { from: query } }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
import { setStorageUser } from "../src/lib/user-storage";
import {
  toggleSaved,
  getSavedEvents,
  getAttendedEvents,
  markAttended,
  getAttendance,
  mergeSavedFromDB,
  mergeAttendedFromDB,
  dbMarkAttended,
} from "../src/lib/saved-events";
import type { ScoutEvent } from "../src/data/events";
const event = { id: "event-1", name: "Test event" } as ScoutEvent;
beforeEach(() => {
  localStorage.clear();
  setStorageUser(null);
  query.mockReset();
});
function response(data: unknown[]) {
  return { select: () => ({ eq: async () => ({ data, error: null }) }) };
}
test("switching accounts never imports another user's saved events", () => {
  setStorageUser("a");
  toggleSaved(event);
  setStorageUser("b");
  expect(getSavedEvents()).toEqual([]);
  setStorageUser(null);
  expect(getSavedEvents()).toEqual([]);
  setStorageUser("a");
  expect(getSavedEvents()).toEqual([event]);
});
test("legacy unscoped cache is not assigned to an arbitrary account", () => {
  localStorage.setItem("scout-saved-events", JSON.stringify([event]));
  setStorageUser("b");
  expect(getSavedEvents()).toEqual([]);
});
test("an empty database clears stale account cache", async () => {
  setStorageUser("a");
  toggleSaved(event);
  query.mockReturnValue(response([]));
  await mergeSavedFromDB("a");
  expect(getSavedEvents()).toEqual([]);
});
test("late database results cannot cross an account switch", async () => {
  let resolve!: (v: unknown) => void;
  query.mockReturnValue({
    select: () => ({
      eq: () =>
        new Promise((r) => {
          resolve = r;
        }),
    }),
  });
  setStorageUser("a");
  const pending = mergeSavedFromDB("a");
  setStorageUser("b");
  resolve({ data: [{ event_data: event }], error: null });
  await pending;
  expect(getSavedEvents()).toEqual([]);
});
test("a save during hydration is not overwritten", async () => {
  let resolve!: (v: unknown) => void;
  query.mockReturnValue({
    select: () => ({
      eq: () =>
        new Promise((r) => {
          resolve = r;
        }),
    }),
  });
  setStorageUser("a");
  const pending = mergeSavedFromDB("a");
  toggleSaved(event);
  resolve({ data: [], error: null });
  await pending;
  expect(getSavedEvents()).toEqual([event]);
});
test("attendance retains survey and excludes saved event after hydration", async () => {
  setStorageUser("a");
  toggleSaved(event);
  const survey = { rating: 5, highlight: "Great speakers", recommend: true, companions: "Friends" };
  markAttended(event, survey);
  expect(getAttendance(event.id)).toEqual(survey);
  query.mockReturnValue(response([{ event_data: event }]));
  await mergeSavedFromDB("a");
  expect(getSavedEvents()).toEqual([]);
  query.mockReturnValue(
    response([
      { event_data: event, rating: 4, highlight: "Good", recommend: true, company: "solo" },
    ]),
  );
  await mergeAttendedFromDB("a");
  expect(getAttendance(event.id)?.companions).toBe("Solo");
  expect(getAttendedEvents()).toHaveLength(1);
});
test("database attendance is idempotent and removes saved row only after success", async () => {
  const upsert = vi.fn().mockResolvedValue({ error: null });
  const remove = vi.fn(() => ({ eq: () => ({ eq: async () => ({ error: null }) }) }));
  query.mockImplementation((table) =>
    table === "attended_events" ? { upsert } : { delete: remove },
  );
  await dbMarkAttended("a", event, 5, "Good", true, "solo");
  expect(upsert).toHaveBeenCalledWith(expect.anything(), { onConflict: "user_id,event_id" });
  expect(remove).toHaveBeenCalledOnce();
  upsert.mockResolvedValue({ error: new Error("offline") });
  remove.mockClear();
  await dbMarkAttended("a", event, 5, "Good", true, "solo");
  expect(remove).not.toHaveBeenCalled();
});
