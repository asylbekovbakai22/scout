-- profiles, saved_events, and attended_events ended up without SELECT/INSERT/UPDATE/DELETE
-- grants for authenticated/service_role, causing "permission denied for table ..." on every
-- REST request even though RLS policies were correct. Restore the grants.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_events TO authenticated;
GRANT ALL ON public.saved_events TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.attended_events TO authenticated;
GRANT ALL ON public.attended_events TO service_role;
