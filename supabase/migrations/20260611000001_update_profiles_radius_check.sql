ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_radius_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_radius_check CHECK (radius >= 0 AND radius <= 100);
