
-- Fix prescriptions INSERT policies to include role checks
DROP POLICY IF EXISTS "Doctors can create prescriptions" ON public.prescriptions;
DROP POLICY IF EXISTS "Patients can upload prescriptions" ON public.prescriptions;

CREATE POLICY "Doctors can create prescriptions"
  ON public.prescriptions FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = doctor_id
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid() AND profiles.role = 'doctor'
    )
  );

CREATE POLICY "Patients can upload prescriptions"
  ON public.prescriptions FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = patient_id
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid() AND profiles.role = 'patient'
    )
  );
