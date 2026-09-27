import { useEffect, useRef, useState } from "react";

import { Input } from "./ui/input";
import { cn } from "../lib/utils";

const COMMON_MAJORS = [
  "Accounting",
  "Aerospace Engineering",
  "Agricultural Science",
  "Anthropology",
  "Architecture",
  "Art History",
  "Biochemistry",
  "Biology",
  "Biomedical Engineering",
  "Business Administration",
  "Chemical Engineering",
  "Chemistry",
  "Civil Engineering",
  "Communications",
  "Computer Engineering",
  "Computer Science",
  "Criminal Justice",
  "Data Science",
  "Economics",
  "Education",
  "Electrical Engineering",
  "English",
  "Environmental Science",
  "Fashion Design",
  "Finance",
  "Graphic Design",
  "History",
  "Hospitality Management",
  "Human Resources",
  "Information Technology",
  "International Relations",
  "Journalism",
  "Kinesiology",
  "Marketing",
  "Mathematics",
  "Mechanical Engineering",
  "Media Studies",
  "Music",
  "Nursing",
  "Nutrition",
  "Philosophy",
  "Physics",
  "Political Science",
  "Psychology",
  "Public Health",
  "Public Relations",
  "Real Estate",
  "Social Work",
  "Sociology",
  "Software Engineering",
  "Spanish",
  "Statistics",
  "Supply Chain Management",
  "Theater",
  "Urban Planning",
];

interface MajorAutocompleteProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  inputClassName?: string;
}

export function MajorAutocomplete({
  id,
  value,
  onChange,
  placeholder,
  inputClassName,
}: MajorAutocompleteProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const filtered = value.trim()
    ? COMMON_MAJORS.filter((m) =>
        m.toLowerCase().includes(value.toLowerCase())
      ).slice(0, 5)
    : [];

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const select = (major: string) => {
    onChange(major);
    setOpen(false);
    setActive(-1);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open || filtered.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % filtered.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a - 1 + filtered.length) % filtered.length);
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      select(filtered[active]);
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
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => value.trim() && filtered.length > 0 && setOpen(true)}
        onKeyDown={onKeyDown}
      />

      {open && filtered.length > 0 && (
        <ul
          className="absolute left-0 right-0 top-full z-[60] mt-2 w-full overflow-hidden rounded-md border border-white/[0.15] bg-[#1a1a2a]/95 py-1 shadow-[0_8px_32px_rgba(0,0,0,0.3)]"
          role="listbox"
        >
          {filtered.map((m, i) => (
            <li key={m} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  select(m);
                }}
                onMouseEnter={() => setActive(i)}
                className={cn(
                  "block w-full px-4 py-2.5 text-left text-sm transition-colors",
                  i === active
                    ? "bg-[#FF2D2D]/15 text-white"
                    : "text-white/80",
                )}
              >
                <span className="font-medium">{m}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
