
-- 1. Make medical-files bucket private
UPDATE storage.buckets SET public = false WHERE id = 'medical-files';

-- 2. Fix notifications INSERT policy: only allow server-side triggers (revoke direct insert from authenticated users)
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;

-- Allow inserts only for own notifications (fallback if needed)
CREATE POLICY "Users can insert own notifications"
  ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
