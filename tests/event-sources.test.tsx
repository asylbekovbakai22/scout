import { act, renderHook } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
const { token } = vi.hoisted(() => ({ token: vi.fn() }));
vi.mock("../src/lib/supabase", () => ({ getAccessToken: token }));
vi.mock("../src/lib/utils", () => ({ API_BASE: "https://api.example.test" }));
import { useEventSources } from "../src/hooks/useEventSources";
class Stream {
  static all: Stream[] = [];
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  close = vi.fn();
  constructor(public url: string) {
    Stream.all.push(this);
  }
}
beforeEach(() => {
  Stream.all = [];
  token.mockReset().mockResolvedValue("test-token");
  vi.stubGlobal("EventSource", Stream);
});
test("rapid picks clicks open a single stream", async () => {
  const profile = { city: "Miami", vibes: "music" };
  const { result, unmount } = renderHook(() => useEventSources(profile));
  await act(async () => {
    await Promise.all([result.current.loadPicks(), result.current.loadPicks()]);
  });
  expect(Stream.all).toHaveLength(1);
  unmount();
  expect(Stream.all[0].close).toHaveBeenCalled();
});
test("a late auth lookup cannot start a stream for an old profile", async () => {
  let resolve!: (value: string) => void;
  token.mockReturnValue(
    new Promise((r) => {
      resolve = r;
    }),
  );
  const { result, rerender, unmount } = renderHook(({ city }) => useEventSources({ city }), {
    initialProps: { city: "Miami" },
  });
  let pending!: Promise<void>;
  act(() => {
    pending = result.current.loadPicks();
  });
  rerender({ city: "Boston" });
  await act(async () => {
    resolve("test-token");
    await pending;
  });
  expect(Stream.all).toHaveLength(0);
  unmount();
});
test("partial results survive a stream error and show the failure", async () => {
  const profile = { city: "Miami" };
  const { result, unmount } = renderHook(() => useEventSources(profile));
  await act(async () => {
    await result.current.loadPicks();
  });
  act(() => {
    Stream.all[0].onmessage?.({
      data: JSON.stringify({ events: [{ id: "one" }], status: "searching" }),
    });
    Stream.all[0].onerror?.();
  });
  expect(result.current.picks.events).toHaveLength(1);
  expect(result.current.picks.error).toBeTruthy();
  expect(result.current.picks.loading).toBe(false);
  unmount();
});
test("rejected auth does not leave search permanently locked", async () => {
  const profile = { city: "Miami" };
  const { result, unmount } = renderHook(() => useEventSources(profile));
  token.mockRejectedValueOnce(new Error("offline"));
  await act(async () => {
    await result.current.runSearch("music");
  });
  expect(result.current.search.error).toContain("sign in");
  await act(async () => {
    await result.current.runSearch("music");
  });
  expect(Stream.all).toHaveLength(1);
  unmount();
});
