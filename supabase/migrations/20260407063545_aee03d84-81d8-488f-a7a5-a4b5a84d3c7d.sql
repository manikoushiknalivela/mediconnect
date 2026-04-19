
CREATE OR REPLACE FUNCTION public.notify_on_appointment_cancel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    -- Notify patient
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (
      NEW.patient_id,
      'Appointment Cancelled',
      'Your appointment on ' || to_char(NEW.appointment_date, 'DD Mon YYYY HH24:MI') || ' has been cancelled. Reason: ' || COALESCE(NEW.notes, 'No reason provided'),
      'cancellation'
    );
    -- Notify doctor
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (
      NEW.doctor_id,
      'Appointment Cancelled',
      'Appointment on ' || to_char(NEW.appointment_date, 'DD Mon YYYY HH24:MI') || ' has been cancelled. Reason: ' || COALESCE(NEW.notes, 'No reason provided'),
      'cancellation'
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_appointment_cancelled
  AFTER UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_appointment_cancel();
