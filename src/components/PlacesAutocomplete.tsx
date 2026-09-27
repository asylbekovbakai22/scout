import { useEffect, useRef, useState } from "react";

import { Input } from "./ui/input";
import { cn } from "../lib/utils";
import { loadGoogleMaps, hasGoogleMapsKey } from "../lib/google-maps";

// ── Fallback data ─────────────────────────────────────────────────────────────

const US_UNIVERSITIES = [
  "Harvard University",
  "Massachusetts Institute of Technology",
  "Stanford University",
  "University of Chicago",
  "Columbia University",
  "Yale University",
  "Princeton University",
  "University of Pennsylvania",
  "Duke University",
  "Johns Hopkins University",
  "Northwestern University",
  "Dartmouth College",
  "Brown University",
  "Vanderbilt University",
  "Rice University",
  "Washington University in St. Louis",
  "Cornell University",
  "University of Notre Dame",
  "Georgetown University",
  "University of California, Berkeley",
  "University of California, Los Angeles",
  "University of Michigan",
  "Carnegie Mellon University",
  "University of Virginia",
  "University of Southern California",
  "New York University",
  "Wake Forest University",
  "Tufts University",
  "University of Florida",
  "University of Texas at Austin",
  "Georgia Institute of Technology",
  "University of North Carolina at Chapel Hill",
  "Boston University",
  "Purdue University",
  "University of Washington",
  "Ohio State University",
  "Penn State University",
  "University of Wisconsin-Madison",
  "University of Illinois Urbana-Champaign",
  "Michigan State University",
  "University of Minnesota",
  "Rutgers University",
  "University of Colorado Boulder",
  "University of Arizona",
  "Arizona State University",
  "Florida State University",
  "Florida International University",
  "University of Miami",
  "University of South Florida",
  "University of Central Florida",
  "University of Georgia",
  "Emory University",
  "Georgia State University",
  "University of Maryland",
  "American University",
  "George Washington University",
  "Howard University",
  "University of Pittsburgh",
  "Temple University",
  "Drexel University",
  "Northeastern University",
  "Boston College",
  "Fordham University",
  "Syracuse University",
  "University of Rochester",
  "Rensselaer Polytechnic Institute",
  "Case Western Reserve University",
  "Indiana University Bloomington",
  "University of Iowa",
  "Iowa State University",
  "University of Nebraska-Lincoln",
  "University of Kansas",
  "University of Missouri",
  "Saint Louis University",
  "Tulane University",
  "Louisiana State University",
  "University of Tennessee",
  "University of Alabama",
  "Auburn University",
  "University of Mississippi",
  "University of Arkansas",
  "University of Oklahoma",
  "Texas A&M University",
  "University of Houston",
  "Southern Methodist University",
  "Texas Christian University",
  "Baylor University",
  "University of Utah",
  "Brigham Young University",
  "University of Nevada, Las Vegas",
  "University of New Mexico",
  "University of Oregon",
  "Oregon State University",
  "University of California, San Diego",
  "University of California, Davis",
  "University of California, Santa Barbara",
  "University of California, Irvine",
  "San Diego State University",
  "San Jose State University",
  "California State University, Los Angeles",
  "University of Hawaii at Manoa",
];

// ── Types ─────────────────────────────────────────────────────────────────────

type Prediction = {
  description: string;
  primaryText: string;
  secondaryText?: string;
  types: string[];
};

interface PlacesAutocompleteProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  onSelect?: (value: string) => void;
  placeholder?: string;
  inputClassName?: string;
  /** "city" restricts to US cities and shows only the city name. "university" shows full name. */
  variant: "city" | "university";
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PlacesAutocomplete({
  id,
  value,
  onChange,
  onSelect,
  placeholder,
  variant,
  inputClassName,
}: PlacesAutocompleteProps) {
  const suggestionApiRef = useRef<any>(null);
  const tokenRef = useRef<any>(null);
  const sessionCtorRef = useRef<any>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const reqIdRef = useRef(0);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [apiReady, setApiReady] = useState(false);
  // Resolved at runtime; assume available until the key check / load resolves.
  const [apiError, setApiError] = useState(false);

  useEffect(() => {
    let mounted = true;
    hasGoogleMapsKey().then((hasKey) => {
      if (!mounted) return;
      if (!hasKey) {
        setApiError(true);
        return;
      }
      loadGoogleMaps()
      .then(async (google) => {
        if (!mounted) return;
        const { AutocompleteSuggestion, AutocompleteSessionToken } =
          await google.maps.importLibrary("places");
        suggestionApiRef.current = AutocompleteSuggestion;
        sessionCtorRef.current = AutocompleteSessionToken;
        tokenRef.current = new AutocompleteSessionToken();
        setApiError(false);
        setApiReady(true);
      })
      .catch(() => {
        if (mounted) setApiError(true);
      });
    });
    return () => {
      mounted = false;
    };

  }, []);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const filterLocalUniversities = (input: string): Prediction[] => {
    return US_UNIVERSITIES
      .filter((item) => item.toLowerCase().includes(input.toLowerCase()))
      .slice(0, 5)
      .map((item) => ({ description: item, primaryText: item, types: [] }));
  };

  const showLocalUniversities = (input: string) => {
    const results = filterLocalUniversities(input);
    setPredictions(results);
    setOpen(results.length > 0);
    setActive(-1);
  };

  const clearPredictions = () => {
    setPredictions([]);
    setOpen(false);
    setActive(-1);
  };

  const fetchPredictions = async (input: string) => {
    if (!input.trim()) {
      setPredictions([]);
      setOpen(false);
      return;
    }

    // City autocomplete must use Google Places only; never show the local list.
    if (apiError || !suggestionApiRef.current) {
      if (variant === "university") {
        showLocalUniversities(input);
      } else {
        clearPredictions();
      }
      return;
    }

    const reqId = ++reqIdRef.current;

    const baseRequest: any = {
      input,
      sessionToken: tokenRef.current,
      includedRegionCodes: ["us"],
    };
    const includedPrimaryTypes =
      variant === "city"
        ? ["(cities)"]
        : ["university", "school", "primary_school", "secondary_school"];

    const runFetch = async (withTypes: boolean) => {
      const request = withTypes
        ? { ...baseRequest, includedPrimaryTypes }
        : baseRequest;
      const { suggestions } =
        await suggestionApiRef.current.fetchAutocompleteSuggestions(request);
      return suggestions ?? [];
    };

    try {
      let suggestions: any[];
      try {
        suggestions = await runFetch(true);
      } catch {
        // Some inputs/types can be rejected — retry once without type filtering
        // rather than permanently dropping to the local fallback.
        suggestions = await runFetch(false);
      }

      // Ignore stale responses from earlier keystrokes
      if (reqId !== reqIdRef.current) return;

      const placePreds = suggestions
        .map((s: any) => s.placePrediction)
        .filter(Boolean);

      let mapped: Prediction[] = placePreds.map((p: any) => {
        const description = p.text?.text ?? "";
        const main = p.mainText?.text ?? description;
        const secondary = p.secondaryText?.text ?? "";
        let primaryText = main;

        if (variant === "city") {
          const stateMatch = secondary.match(/^([A-Z]{1,2})(,\s*USA)?$/i);
          if (stateMatch) {
            primaryText = `${main}, ${stateMatch[1].toUpperCase()}`;
          } else {
            const parts = description.split(", ");
            if (parts.length >= 2) {
              const maybeState = parts[parts.length - 2];
              if (/^[A-Za-z]{1,2}$/.test(maybeState)) {
                primaryText = `${main}, ${maybeState.toUpperCase()}`;
              }
            }
          }
        }

        return {
          description,
          primaryText,
          secondaryText: secondary,
          types: p.types ?? [],
        };
      });

      mapped = mapped.slice(0, 5);

      if (mapped.length === 0) {
        if (variant === "university") {
          showLocalUniversities(input);
        } else {
          clearPredictions();
        }
      } else {
        setPredictions(mapped);
        setOpen(true);
        setActive(-1);
      }
    } catch (err) {
      if (reqId !== reqIdRef.current) return;
      setApiError(true);
      if (variant === "university") {
        showLocalUniversities(input);
      } else {
        clearPredictions();
      }
    }
  };

  useEffect(() => {
    if (variant === "city" && apiReady && value.trim()) {
      void fetchPredictions(value);
    }
    // Intentionally omitting `value` and `fetchPredictions`: this effect only
    // fires when the API becomes ready after the user has already typed text.
    // `value` is read correctly from the current render's closure at that point,
    // and `fetchPredictions` is stable within the component's lifecycle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiReady, variant]);


  const select = (p: Prediction) => {
    onChange(p.primaryText);
    onSelect?.(p.primaryText);
    setOpen(false);
    setPredictions([]);
    if (sessionCtorRef.current) tokenRef.current = new sessionCtorRef.current();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open || predictions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % predictions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a - 1 + predictions.length) % predictions.length);
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      select(predictions[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={wrapperRef} className="relative">
      <Input
        id={id}
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        className={inputClassName}
        onChange={(e) => {
          onChange(e.target.value);
          fetchPredictions(e.target.value);
        }}
        onFocus={() => predictions.length > 0 && setOpen(true)}
        onKeyDown={onKeyDown}
      />

      {open && predictions.length > 0 && (
        <ul
          className="absolute left-0 right-0 top-full z-[60] mt-2 w-full overflow-hidden rounded-md border border-white/[0.15] bg-[#1a1a2a]/95 py-1 shadow-[0_8px_32px_rgba(0,0,0,0.3)]"
          role="listbox"
        >
          {predictions.map((p, i) => (
            <li key={p.description} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  select(p);
                }}
                onMouseEnter={() => setActive(i)}
                className={cn(
                  "block w-full px-4 py-2.5 text-left text-sm transition-colors",
                  i === active ? "bg-[#FF2D2D]/15 text-white" : "text-white/80",
                )}
              >
                <span className="font-medium">
                  {p.primaryText}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
