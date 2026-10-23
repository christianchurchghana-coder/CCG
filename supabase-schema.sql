-- Run in the Supabase SQL Editor as the project owner.
-- Tables and RLS for profiles, RSVPs, friendships, direct messages, and reports.

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT '' CHECK (char_length(display_name) <= 40),
  interests text NOT NULL DEFAULT '' CHECK (char_length(interests) <= 120),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.event_rsvps (
  event_key text NOT NULL CHECK (char_length(event_key) BETWEEN 1 AND 200),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_key, user_id)
);

CREATE TABLE IF NOT EXISTS public.friendships (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  requester uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  addressee uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (requester <> addressee),
  UNIQUE (requester, addressee)
);
-- A friendship pair can have only one request, regardless of direction.
CREATE UNIQUE INDEX IF NOT EXISTS friendships_unique_pair_idx
  ON public.friendships (LEAST(requester, addressee), GREATEST(requester, addressee));
CREATE INDEX IF NOT EXISTS friendships_addressee_status_idx ON public.friendships (addressee, status);

CREATE TABLE IF NOT EXISTS public.messages (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sender uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  recipient uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (sender <> recipient)
);
CREATE INDEX IF NOT EXISTS messages_pair_created_at_idx ON public.messages (sender, recipient, created_at);
CREATE INDEX IF NOT EXISTS messages_recipient_created_at_idx ON public.messages (recipient, sender, created_at);

CREATE TABLE IF NOT EXISTS public.reports (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  reporter uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  reported uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (char_length(reason) BETWEEN 1 AND 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (reporter <> reported)
);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, left(coalesce(NEW.raw_user_meta_data ->> 'display_name', NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', split_part(NEW.email, '@', 1), ''), 40));
  RETURN NEW;
END;
$function$;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Prevent clients from rewriting immutable identifiers or timestamps during updates.
CREATE OR REPLACE FUNCTION public.guard_profile_update()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $function$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'profile id and creation time are immutable' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;
DROP TRIGGER IF EXISTS guard_profile_update ON public.profiles;
CREATE TRIGGER guard_profile_update BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.guard_profile_update();

CREATE OR REPLACE FUNCTION public.guard_friendship_update()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $function$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.requester IS DISTINCT FROM OLD.requester
     OR NEW.addressee IS DISTINCT FROM OLD.addressee
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR OLD.status <> 'pending'
     OR NEW.status <> 'accepted'
     OR NEW.addressee IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'friendship updates may only accept a pending request addressed to the current user'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;
DROP TRIGGER IF EXISTS guard_friendship_update ON public.friendships;
CREATE TRIGGER guard_friendship_update BEFORE UPDATE ON public.friendships
FOR EACH ROW EXECUTE FUNCTION public.guard_friendship_update();

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_rsvps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "edit own profile" ON public.profiles;
DROP POLICY IF EXISTS "view rsvps" ON public.event_rsvps;
DROP POLICY IF EXISTS "add own rsvp" ON public.event_rsvps;
DROP POLICY IF EXISTS "remove own rsvp" ON public.event_rsvps;
DROP POLICY IF EXISTS "view own friendships" ON public.friendships;
DROP POLICY IF EXISTS "send friend request" ON public.friendships;
DROP POLICY IF EXISTS "accept friend request" ON public.friendships;
DROP POLICY IF EXISTS "remove friendship" ON public.friendships;
DROP POLICY IF EXISTS "read own messages" ON public.messages;
DROP POLICY IF EXISTS "send to friends only" ON public.messages;
DROP POLICY IF EXISTS "file a report" ON public.reports;

CREATE POLICY "members can view profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "edit own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (id = (SELECT auth.uid())) WITH CHECK (id = (SELECT auth.uid()));
CREATE POLICY "view rsvps" ON public.event_rsvps FOR SELECT TO authenticated USING (true);
CREATE POLICY "add own rsvp" ON public.event_rsvps FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "remove own rsvp" ON public.event_rsvps FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY "view own friendships" ON public.friendships FOR SELECT TO authenticated
  USING (requester = (SELECT auth.uid()) OR addressee = (SELECT auth.uid()));
CREATE POLICY "send friend request" ON public.friendships FOR INSERT TO authenticated
  WITH CHECK (requester = (SELECT auth.uid()) AND status = 'pending');
CREATE POLICY "accept friend request" ON public.friendships FOR UPDATE TO authenticated
  USING (addressee = (SELECT auth.uid()) AND status = 'pending')
  WITH CHECK (addressee = (SELECT auth.uid()) AND status = 'accepted');
CREATE POLICY "remove friendship" ON public.friendships FOR DELETE TO authenticated
  USING (requester = (SELECT auth.uid()) OR addressee = (SELECT auth.uid()));
CREATE POLICY "read own messages" ON public.messages FOR SELECT TO authenticated
  USING (sender = (SELECT auth.uid()) OR recipient = (SELECT auth.uid()));
CREATE POLICY "send to friends only" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (sender = (SELECT auth.uid()) AND EXISTS (
    SELECT 1 FROM public.friendships AS f WHERE f.status = 'accepted' AND
    ((f.requester = (SELECT auth.uid()) AND f.addressee = recipient) OR
     (f.addressee = (SELECT auth.uid()) AND f.requester = recipient))
  ));
CREATE POLICY "file a report" ON public.reports FOR INSERT TO authenticated
  WITH CHECK (reporter = (SELECT auth.uid()));

DO $block$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['messages', 'friendships', 'event_rsvps'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public' AND tablename = table_name) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', table_name);
    END IF;
  END LOOP;
END;
$block$;


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

