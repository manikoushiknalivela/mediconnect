
-- Allow authenticated users to view profiles of doctors (needed for doctor search/listing)
CREATE POLICY "Users can view doctor profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM doctor_profiles
      WHERE doctor_profiles.user_id = profiles.user_id
    )
  );
