// Dynamically loads the Google Maps JS API (Places library) a single time
// and resolves once `google.maps.places` is available.
//
// The browser API key is resolved at RUNTIME from a server config endpoint
// (/api/public/maps-config), with the build-time `import.meta.env` value as a
// fallback. This means a published bundle works even if the key was not baked
// in at build time — the key/tracking id can change without rebuilding.

let loaderPromise: Promise<any> | null = null;
let configPromise: Promise<MapsRuntimeConfig> | null = null;
const CALLBACK_NAME = "__lovableGoogleMapsReady";

interface MapsRuntimeConfig {
  browserKey?: string;
  trackingId?: string;
}

const BUILD_TIME_KEY = (import.meta.env.VITE_GOOGLE_MAPS_BROWSER_KEY || import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY) as
  | string
  | undefined;
const BUILD_TIME_TRACKING_ID = import.meta.env
  .VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID as string | undefined;

async function fetchRuntimeConfig(): Promise<MapsRuntimeConfig> {
  if (configPromise) return configPromise;

  configPromise = (async () => {
    // Start from build-time values so we always have a fallback.
    const config: MapsRuntimeConfig = {
      browserKey: BUILD_TIME_KEY,
      trackingId: BUILD_TIME_TRACKING_ID,
    };

    try {
      const res = await fetch("/api/public/maps-config", {
        headers: { Accept: "application/json" },
      });
      if (res.ok) {
        const data = (await res.json()) as MapsRuntimeConfig;
        if (data.browserKey) config.browserKey = data.browserKey;
        if (data.trackingId) config.trackingId = data.trackingId;
      }
    } catch {
      // Network/route failure — keep build-time fallback values.
    }

    return config;
  })();

  return configPromise;
}

export async function hasGoogleMapsKey(): Promise<boolean> {
  if (BUILD_TIME_KEY) return true;
  const config = await fetchRuntimeConfig();
  return Boolean(config.browserKey);
}

export function loadGoogleMaps(): Promise<any> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Maps can only load in the browser"));
  }

  const w = window as any;
  if (w.google?.maps?.places) {
    return Promise.resolve(w.google);
  }

  if (loaderPromise) {
    return loaderPromise;
  }

  loaderPromise = new Promise(async (resolve, reject) => {
    // Reset the singleton on any failure so the next call retries from scratch
    // rather than returning the same permanently-rejected promise.
    const rejectAndReset = (err: unknown): void => {
      loaderPromise = null;
      reject(err);
    };

    const config = await fetchRuntimeConfig();
    const browserKey = config.browserKey;
    const trackingId = config.trackingId;

    if (!browserKey) {
      rejectAndReset(new Error("Missing Google Maps Platform browser key"));
      return;
    }

    const resolveWhenReady = async () => {
      try {
        if (w.google?.maps?.importLibrary) {
          await w.google.maps.importLibrary("places");
        }
        if (!w.google?.maps?.places) {
          throw new Error("Google Maps Places library did not initialize");
        }
        resolve(w.google);
      } catch (err) {
        rejectAndReset(err);
      }
    };

    const existing = document.getElementById("google-maps-js") as HTMLScriptElement | null;
    if (existing) {
      if (w.google?.maps?.importLibrary) {
        void resolveWhenReady();
        return;
      }
      existing.addEventListener("load", () => void resolveWhenReady());
      existing.addEventListener("error", rejectAndReset);
      return;
    }

    const params = new URLSearchParams({
      key: browserKey,
      libraries: "places",
      loading: "async",
      callback: CALLBACK_NAME,
      v: "weekly",
    });
    if (trackingId) params.set("channel", trackingId);

    const previousCallback = w[CALLBACK_NAME];
    w[CALLBACK_NAME] = () => {
      if (typeof previousCallback === "function") previousCallback();
      void resolveWhenReady();
    };

    const script = document.createElement("script");
    script.id = "google-maps-js";
    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      rejectAndReset(new Error("Failed to load Google Maps JS API"));
    };
    document.head.appendChild(script);
  });

  return loaderPromise;
}
