-- Run once in the Supabase SQL Editor to add community statuses and mutual
-- messaging streaks to an existing church site database.

CREATE TABLE IF NOT EXISTS public.statuses (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 280),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS statuses_created_at_idx ON public.statuses (created_at DESC);
ALTER TABLE public.statuses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "members can view statuses" ON public.statuses;
DROP POLICY IF EXISTS "members can post own status" ON public.statuses;
DROP POLICY IF EXISTS "members can delete own status" ON public.statuses;
CREATE POLICY "members can view statuses" ON public.statuses FOR SELECT TO authenticated USING (true);
CREATE POLICY "members can post own status" ON public.statuses FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "members can delete own status" ON public.statuses FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));
GRANT SELECT, INSERT, DELETE ON public.statuses TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.statuses_id_seq TO authenticated;

-- A streak day counts only after both accepted friends send at least one
-- message to each other during the same UTC calendar day.
CREATE TABLE IF NOT EXISTS public.friend_streaks (
  user_low uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  user_high uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  current_days integer NOT NULL DEFAULT 0 CHECK (current_days >= 0),
  best_days integer NOT NULL DEFAULT 0 CHECK (best_days >= current_days),
  last_completed_on date,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_low, user_high),
  CHECK (user_low < user_high)
);
ALTER TABLE public.friend_streaks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "friends can view their streaks" ON public.friend_streaks;
CREATE POLICY "friends can view their streaks" ON public.friend_streaks FOR SELECT TO authenticated
  USING (user_low = (SELECT auth.uid()) OR user_high = (SELECT auth.uid()));
GRANT SELECT ON public.friend_streaks TO authenticated;

-- Private per-day activity flags are written only by the message trigger.
CREATE TABLE IF NOT EXISTS public.friend_streak_activity (
  user_low uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  user_high uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  activity_on date NOT NULL,
  low_sent boolean NOT NULL DEFAULT false,
  high_sent boolean NOT NULL DEFAULT false,
  PRIMARY KEY (user_low, user_high, activity_on),
  CHECK (user_low < user_high)
);
ALTER TABLE public.friend_streak_activity ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.friend_streak_activity FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.record_friend_streak_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  low_id uuid;
  high_id uuid;
  sent_by_low boolean;
  today_utc date := (now() AT TIME ZONE 'UTC')::date;
  both_sent boolean;
BEGIN
  IF NEW.sender < NEW.recipient THEN
    low_id := NEW.sender;
    high_id := NEW.recipient;
    sent_by_low := true;
  ELSE
    low_id := NEW.recipient;
    high_id := NEW.sender;
    sent_by_low := false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.friendships AS f
    WHERE f.status = 'accepted'
      AND f.requester = low_id AND f.addressee = high_id
  ) AND NOT EXISTS (
    SELECT 1 FROM public.friendships AS f
    WHERE f.status = 'accepted'
      AND f.requester = high_id AND f.addressee = low_id
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.friend_streak_activity (user_low, user_high, activity_on, low_sent, high_sent)
  VALUES (low_id, high_id, today_utc, sent_by_low, NOT sent_by_low)
  ON CONFLICT (user_low, user_high, activity_on) DO UPDATE
    SET low_sent = public.friend_streak_activity.low_sent OR EXCLUDED.low_sent,
        high_sent = public.friend_streak_activity.high_sent OR EXCLUDED.high_sent
  RETURNING (low_sent AND high_sent) INTO both_sent;

  IF both_sent THEN
    INSERT INTO public.friend_streaks (user_low, user_high, current_days, best_days, last_completed_on)
    VALUES (low_id, high_id, 1, 1, today_utc)
    ON CONFLICT (user_low, user_high) DO UPDATE SET
      current_days = CASE
        WHEN public.friend_streaks.last_completed_on = EXCLUDED.last_completed_on THEN public.friend_streaks.current_days
        WHEN public.friend_streaks.last_completed_on = EXCLUDED.last_completed_on - 1 THEN public.friend_streaks.current_days + 1
        ELSE 1
      END,
      best_days = GREATEST(public.friend_streaks.best_days, CASE
        WHEN public.friend_streaks.last_completed_on = EXCLUDED.last_completed_on THEN public.friend_streaks.current_days
        WHEN public.friend_streaks.last_completed_on = EXCLUDED.last_completed_on - 1 THEN public.friend_streaks.current_days + 1
        ELSE 1
      END),
      last_completed_on = GREATEST(public.friend_streaks.last_completed_on, EXCLUDED.last_completed_on),
      updated_at = now();
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS record_friend_streak_after_message ON public.messages;
CREATE TRIGGER record_friend_streak_after_message
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.record_friend_streak_message();

DO $block$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime'
    AND schemaname = 'public' AND tablename = 'statuses') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.statuses;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime'
    AND schemaname = 'public' AND tablename = 'friend_streaks') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.friend_streaks;
  END IF;
END;
$block$;

-- Member profile details and backend-reviewed display nicknames.
-- Re-run safely after the original schema and this social upgrade.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS nickname text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS bio text NOT NULL DEFAULT '';

DO $block$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_nickname_length_check') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_nickname_length_check
      CHECK (char_length(nickname) <= 24);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_bio_length_check') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_bio_length_check
      CHECK (char_length(bio) <= 280);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_nickname_format_check') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_nickname_format_check
      CHECK (nickname = '' OR (char_length(btrim(nickname)) BETWEEN 2 AND 24
        AND nickname = btrim(nickname) AND nickname !~ '[[:cntrl:]]'));
  END IF;
END;
$block$;

-- Signed-in members can edit only these self-owned fields through the browser.
-- Approved nicknames can be changed only by the project owner/backend via SQL.
REVOKE UPDATE ON TABLE public.profiles FROM PUBLIC, anon, authenticated;
REVOKE UPDATE (nickname) ON TABLE public.profiles FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.profiles TO authenticated;
GRANT UPDATE (display_name, interests, bio) ON TABLE public.profiles TO authenticated;

CREATE TABLE IF NOT EXISTS public.nickname_change_requests (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  requested_nickname text NOT NULL CHECK (
    char_length(btrim(requested_nickname)) BETWEEN 2 AND 24
    AND requested_nickname = btrim(requested_nickname)
    AND requested_nickname !~ '[[:cntrl:]]'
  ),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewer_note text NOT NULL DEFAULT '' CHECK (char_length(reviewer_note) <= 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS nickname_one_pending_request_per_member
  ON public.nickname_change_requests (user_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS nickname_requests_created_at_idx
  ON public.nickname_change_requests (created_at DESC);
ALTER TABLE public.nickname_change_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "members can read own nickname requests" ON public.nickname_change_requests;
DROP POLICY IF EXISTS "members can submit own nickname requests" ON public.nickname_change_requests;
CREATE POLICY "members can read own nickname requests" ON public.nickname_change_requests
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY "members can submit own nickname requests" ON public.nickname_change_requests
  FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()) AND status = 'pending');
REVOKE ALL ON TABLE public.nickname_change_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.nickname_change_requests TO authenticated;
GRANT INSERT (user_id, requested_nickname) ON TABLE public.nickname_change_requests TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.nickname_change_requests_id_seq TO authenticated;

-- Approval is a backend-owner action in the Supabase SQL Editor. Example:
-- First view the pending queue:
-- SELECT id, user_id, requested_nickname, created_at
--   FROM public.nickname_change_requests WHERE status = 'pending' ORDER BY created_at;
-- BEGIN;
-- UPDATE public.profiles SET nickname = 'Approved Name' WHERE id = '<member-user-uuid>';
-- UPDATE public.nickname_change_requests SET status = 'approved', reviewed_at = now()
--   WHERE id = <request-id> AND user_id = '<member-user-uuid>' AND status = 'pending';
-- COMMIT;
