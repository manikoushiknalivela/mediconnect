
-- Function to recalculate doctor avg_rating and total_reviews after a review is inserted
CREATE OR REPLACE FUNCTION public.update_doctor_rating()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.doctor_profiles
  SET 
    avg_rating = (SELECT ROUND(AVG(rating)::numeric, 1) FROM public.reviews WHERE doctor_id = NEW.doctor_id),
    total_reviews = (SELECT COUNT(*) FROM public.reviews WHERE doctor_id = NEW.doctor_id)
  WHERE user_id = NEW.doctor_id;
  RETURN NEW;
END;
$$;

-- Trigger on reviews insert
CREATE TRIGGER update_doctor_rating_on_review
AFTER INSERT ON public.reviews
FOR EACH ROW
EXECUTE FUNCTION public.update_doctor_rating();
