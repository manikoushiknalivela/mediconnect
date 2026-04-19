
CREATE OR REPLACE FUNCTION public.notify_on_prescription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, title, message, type)
  VALUES (
    NEW.patient_id,
    'New Prescription',
    'Your doctor has sent you a new prescription for: ' || COALESCE(NEW.diagnosis, 'General'),
    'prescription'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_prescription_created
  AFTER INSERT ON public.prescriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_prescription();
