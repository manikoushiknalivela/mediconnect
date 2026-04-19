
-- 1. Prevent role escalation: add trigger that blocks role changes
CREATE OR REPLACE FUNCTION public.prevent_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.role IS DISTINCT FROM NEW.role THEN
    RAISE EXCEPTION 'Changing your own role is not allowed';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER prevent_role_change_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_role_change();

-- 2. Fix profiles SELECT: replace open policy with scoped ones
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

-- Users can always see their own full profile
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Doctors/patients can see basic info (name, avatar) of other users they have appointments with
CREATE POLICY "Users can view appointment counterparts"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM appointments
      WHERE (appointments.doctor_id = auth.uid() AND appointments.patient_id = profiles.user_id)
         OR (appointments.patient_id = auth.uid() AND appointments.doctor_id = profiles.user_id)
    )
  );

-- 3. Fix storage: restrict medical files reads to file owners
DROP POLICY IF EXISTS "Authenticated users can view files" ON storage.objects;

CREATE POLICY "Users can view own medical files"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'medical-files'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );

-- Also fix upload policy to enforce user folder
DROP POLICY IF EXISTS "Authenticated users can upload files" ON storage.objects;

CREATE POLICY "Users can upload to own folder"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'medical-files'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );

-- 4. Fix reviews: require valid completed appointment
DROP POLICY IF EXISTS "Patients can create reviews" ON public.reviews;

CREATE POLICY "Patients can review after appointment"
  ON public.reviews FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = patient_id
    AND appointment_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM appointments
      WHERE appointments.id = reviews.appointment_id
        AND appointments.patient_id = auth.uid()
        AND appointments.doctor_id = reviews.doctor_id
        AND appointments.status = 'completed'
    )
  );
