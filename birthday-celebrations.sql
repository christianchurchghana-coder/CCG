-- Run once in the Supabase SQL Editor to enable opt-in church birthdays.
-- Only month/day are stored; no birth year is collected.
CREATE TABLE IF NOT EXISTS public.birthday_celebrations (
  user_id uuid PRIMARY KEY REFERENCES public.profiles (id) ON DELETE CASCADE,
  display_name text NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 40),
  birth_month smallint NOT NULL CHECK (birth_month BETWEEN 1 AND 12),
  birth_day smallint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (birth_month IN (1,3,5,7,8,10,12) AND birth_day BETWEEN 1 AND 31) OR
    (birth_month IN (4,6,9,11) AND birth_day BETWEEN 1 AND 30) OR
    (birth_month = 2 AND birth_day BETWEEN 1 AND 29)
  )
);

ALTER TABLE public.birthday_celebrations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "members view shared birthdays" ON public.birthday_celebrations;
DROP POLICY IF EXISTS "members add own birthday" ON public.birthday_celebrations;
DROP POLICY IF EXISTS "members update own birthday" ON public.birthday_celebrations;
DROP POLICY IF EXISTS "members remove own birthday" ON public.birthday_celebrations;
CREATE POLICY "members view shared birthdays" ON public.birthday_celebrations
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "members add own birthday" ON public.birthday_celebrations
  FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "members update own birthday" ON public.birthday_celebrations
  FOR UPDATE TO authenticated USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "members remove own birthday" ON public.birthday_celebrations
  FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.birthday_celebrations TO authenticated;
REVOKE ALL ON public.birthday_celebrations FROM anon;
