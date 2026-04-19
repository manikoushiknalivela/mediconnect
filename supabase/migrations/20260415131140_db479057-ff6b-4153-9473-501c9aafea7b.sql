
-- Fix 1: Add status filter to appointment counterparts policy
DROP POLICY IF EXISTS "Users can view appointment counterparts" ON public.profiles;
CREATE POLICY "Users can view appointment counterparts" ON public.profiles
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM appointments
    WHERE ((appointments.doctor_id = auth.uid() AND appointments.patient_id = profiles.user_id)
        OR (appointments.patient_id = auth.uid() AND appointments.doctor_id = profiles.user_id))
      AND appointments.status IN ('scheduled', 'completed')
  )
);

-- Fix 2: Add role check to patient_profiles insert policy
DROP POLICY IF EXISTS "Patients can insert own profile" ON public.patient_profiles;
CREATE POLICY "Patients can insert own profile" ON public.patient_profiles
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid() AND profiles.role = 'patient'::user_role
  )
);
