ALTER TABLE public.profiles
  ADD COLUMN radius integer NOT NULL DEFAULT 25 CHECK (radius IN (10, 25, 50));
