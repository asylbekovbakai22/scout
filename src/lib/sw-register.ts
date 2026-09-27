// Guarded service-worker registration.
// Registers /sw.js only in a real production deployment — never in the Lovable
// editor preview, an iframe, dev, or when ?sw=off is present. In any refused
// context we proactively unregister any stale /sw.js so previews never serve
// cached HTML.

const SW_URL = "/sw.js";

function isRefusedContext(): boolean {
  if (typeof window === "undefined") return true;
  if (!import.meta.env.PROD) return true;

  // Inside an iframe (Lovable preview embeds the app in an iframe).
  if (window.self !== window.top) return true;

  const url = new URL(window.location.href);
  if (url.searchParams.get("sw") === "off") return true;

  const host = window.location.hostname;
  if (host.startsWith("id-preview--") || host.startsWith("preview--")) return true;

  const refusedExact = ["lovableproject.com", "lovableproject-dev.com", "beta.lovable.dev"];
  if (refusedExact.includes(host)) return true;

  const refusedSuffixes = [
    ".lovableproject.com",
    ".lovableproject-dev.com",
    ".beta.lovable.dev",
  ];
  if (refusedSuffixes.some((suffix) => host.endsWith(suffix))) return true;

  return false;
}

async function unregisterExisting(): Promise<void> {
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
      regs
        .filter((reg) => reg.active?.scriptURL.endsWith(SW_URL))
        .map((reg) => reg.unregister()),
    );
  } catch {
    // ignore
  }
}

export function registerServiceWorker(): void {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

  if (isRefusedContext()) {
    void unregisterExisting();
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker.register(SW_URL).catch((err) => {
      console.error("[Scout] Service worker registration failed:", err);
    });
  });
}
