
-- Fix appointments INSERT to verify doctor_id references a real doctor
DROP POLICY IF EXISTS "Patients can create appointments" ON public.appointments;

CREATE POLICY "Patients can create appointments"
  ON public.appointments FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = patient_id
    AND EXISTS (
      SELECT 1 FROM public.doctor_profiles
      WHERE doctor_profiles.user_id = appointments.doctor_id
    )
  );
