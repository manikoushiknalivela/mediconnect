
-- 1. Drop the overly permissive realtime.messages SELECT policy
DROP POLICY IF EXISTS "Authenticated users can read realtime messages" ON realtime.messages;

-- 2. Drop the direct INSERT policy on notifications
-- Triggers (notify_on_appointment, notify_on_prescription, notify_on_appointment_cancel)
-- use SECURITY DEFINER and will continue to work without this policy.
DROP POLICY IF EXISTS "Users can insert own notifications" ON public.notifications;
