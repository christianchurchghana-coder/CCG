-- Run once in the Supabase SQL Editor as the project owner.
-- Adds admin-managed live prayer schedules and private authenticated prayer rooms.

CREATE TABLE IF NOT EXISTS public.prayer_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 100),
    session_type text NOT NULL CHECK (session_type IN ('morning-devotion', 'prayer', 'fasting-prayer')),
    starts_at timestamptz NOT NULL,
    duration_minutes integer NOT NULL CHECK (duration_minutes BETWEEN 5 AND 1440),
    stream_url text CHECK (stream_url IS NULL OR (char_length(stream_url) <= 500 AND stream_url ~* '^https://')),
    created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.prayer_sessions ADD COLUMN IF NOT EXISTS stream_url text
    CHECK (stream_url IS NULL OR (char_length(stream_url) <= 500 AND stream_url ~* '^https://'));

CREATE INDEX IF NOT EXISTS prayer_sessions_starts_at_idx ON public.prayer_sessions(starts_at);
ALTER TABLE public.prayer_sessions ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.prayer_sessions TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.prayer_sessions TO authenticated;

DROP POLICY IF EXISTS "Anyone can view scheduled prayer sessions" ON public.prayer_sessions;
CREATE POLICY "Anyone can view scheduled prayer sessions" ON public.prayer_sessions
    FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Church admin can create prayer sessions" ON public.prayer_sessions;
CREATE POLICY "Church admin can create prayer sessions" ON public.prayer_sessions
    FOR INSERT TO authenticated
    WITH CHECK (lower(coalesce(auth.jwt() ->> 'email', '')) = 'christianchurchghana@gmail.com');
DROP POLICY IF EXISTS "Church admin can update prayer sessions" ON public.prayer_sessions;
CREATE POLICY "Church admin can update prayer sessions" ON public.prayer_sessions
    FOR UPDATE TO authenticated
    USING (lower(coalesce(auth.jwt() ->> 'email', '')) = 'christianchurchghana@gmail.com')
    WITH CHECK (lower(coalesce(auth.jwt() ->> 'email', '')) = 'christianchurchghana@gmail.com');
DROP POLICY IF EXISTS "Church admin can delete prayer sessions" ON public.prayer_sessions;
CREATE POLICY "Church admin can delete prayer sessions" ON public.prayer_sessions
    FOR DELETE TO authenticated
    USING (lower(coalesce(auth.jwt() ->> 'email', '')) = 'christianchurchghana@gmail.com');

-- Private Realtime topics prevent unauthenticated visitors from joining rooms or presence.
DROP POLICY IF EXISTS "Authenticated members can join prayer and presence topics" ON realtime.messages;
CREATE POLICY "Authenticated members can join prayer and presence topics" ON realtime.messages
    FOR SELECT TO authenticated
    USING ((select auth.uid()) IS NOT NULL AND (topic = 'ccg-online-members' OR topic LIKE 'ccg-prayer-%'));
DROP POLICY IF EXISTS "Authenticated members can publish prayer and presence" ON realtime.messages;
CREATE POLICY "Authenticated members can publish prayer and presence" ON realtime.messages
    FOR INSERT TO authenticated
    WITH CHECK ((select auth.uid()) IS NOT NULL AND (topic = 'ccg-online-members' OR topic LIKE 'ccg-prayer-%'));

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'prayer_sessions') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.prayer_sessions;
    END IF;
END $$;

-- Private per-account Bible reading streak. Activity is recorded only after a Bible chapter loads.
CREATE TABLE IF NOT EXISTS public.bible_reading_streaks (
    user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    current_days integer NOT NULL DEFAULT 0 CHECK (current_days >= 0),
    best_days integer NOT NULL DEFAULT 0 CHECK (best_days >= current_days),
    last_read_on date
);
ALTER TABLE public.bible_reading_streaks ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.bible_reading_streaks TO authenticated;
DROP POLICY IF EXISTS "Members can read their own Bible streak" ON public.bible_reading_streaks;
CREATE POLICY "Members can read their own Bible streak" ON public.bible_reading_streaks
    FOR SELECT TO authenticated USING (user_id = (select auth.uid()));

CREATE OR REPLACE FUNCTION public.record_bible_reading()
RETURNS TABLE(current_days integer, best_days integer, last_read_on date)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE
    today_utc date := (now() AT TIME ZONE 'UTC')::date;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Sign in to save a Bible reading streak.' USING ERRCODE = '42501';
    END IF;
    RETURN QUERY
    INSERT INTO public.bible_reading_streaks AS streak (user_id, current_days, best_days, last_read_on)
    VALUES (auth.uid(), 1, 1, today_utc)
    ON CONFLICT (user_id) DO UPDATE SET
        current_days = CASE
            WHEN streak.last_read_on = today_utc THEN streak.current_days
            WHEN streak.last_read_on = today_utc - 1 THEN streak.current_days + 1
            ELSE 1
        END,
        best_days = GREATEST(streak.best_days, CASE
            WHEN streak.last_read_on = today_utc THEN streak.current_days
            WHEN streak.last_read_on = today_utc - 1 THEN streak.current_days + 1
            ELSE 1
        END),
        last_read_on = today_utc
    RETURNING streak.current_days, streak.best_days, streak.last_read_on;
END;
$function$;
REVOKE ALL ON FUNCTION public.record_bible_reading() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_bible_reading() TO authenticated;
