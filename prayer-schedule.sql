-- Run once in Supabase SQL Editor to enable the shared church prayer clock.
-- Only christianchurchghana@gmail.com can publish or change the schedule.

CREATE TABLE IF NOT EXISTS public.prayer_schedule (
    id boolean PRIMARY KEY DEFAULT true CHECK (id IS TRUE),
    occasion text NOT NULL CHECK (char_length(occasion) BETWEEN 1 AND 80),
    starts_at timestamptz NOT NULL,
    duration_minutes integer NOT NULL CHECK (duration_minutes BETWEEN 1 AND 1440),
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.prayer_schedule ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.prayer_schedule TO anon, authenticated;
GRANT INSERT, UPDATE ON public.prayer_schedule TO authenticated;

DROP POLICY IF EXISTS "Anyone can read the church prayer schedule" ON public.prayer_schedule;
CREATE POLICY "Anyone can read the church prayer schedule"
    ON public.prayer_schedule
    FOR SELECT
    TO anon, authenticated
    USING (true);

DROP POLICY IF EXISTS "Church admin can create the prayer schedule" ON public.prayer_schedule;
CREATE POLICY "Church admin can create the prayer schedule"
    ON public.prayer_schedule
    FOR INSERT
    TO authenticated
    WITH CHECK (lower(coalesce(auth.jwt() ->> 'email', '')) = 'christianchurchghana@gmail.com');

DROP POLICY IF EXISTS "Church admin can update the prayer schedule" ON public.prayer_schedule;
CREATE POLICY "Church admin can update the prayer schedule"
    ON public.prayer_schedule
    FOR UPDATE
    TO authenticated
    USING (lower(coalesce(auth.jwt() ->> 'email', '')) = 'christianchurchghana@gmail.com')
    WITH CHECK (lower(coalesce(auth.jwt() ->> 'email', '')) = 'christianchurchghana@gmail.com');
