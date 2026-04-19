
-- Create roles enum
CREATE TYPE public.user_role AS ENUM ('doctor', 'patient');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL,
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create doctor_profiles table
CREATE TABLE public.doctor_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  doctor_id TEXT NOT NULL UNIQUE,
  medical_license TEXT NOT NULL,
  specialization TEXT,
  experience_years INTEGER DEFAULT 0,
  consultation_fee DECIMAL(10,2) DEFAULT 0,
  hospital_location TEXT,
  certificates_url TEXT,
  available_slots JSONB DEFAULT '[]'::jsonb,
  avg_rating DECIMAL(3,2) DEFAULT 0,
  total_reviews INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create patient_profiles table
CREATE TABLE public.patient_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  patient_id TEXT NOT NULL UNIQUE,
  drug_allergies TEXT,
  food_allergies TEXT,
  emergency_contacts TEXT,
  blood_group TEXT,
  medical_info TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create appointments table
CREATE TABLE public.appointments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  appointment_date TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create prescriptions table
CREATE TABLE public.prescriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES public.appointments(id),
  diagnosis TEXT,
  medications JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  file_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create reviews table
CREATE TABLE public.reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES public.appointments(id),
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctor_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Doctor profiles policies
CREATE POLICY "Anyone can view doctor profiles" ON public.doctor_profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Doctors can update own profile" ON public.doctor_profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Doctors can insert own profile" ON public.doctor_profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Patient profiles policies
CREATE POLICY "Patients can view own profile" ON public.patient_profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Patients can update own profile" ON public.patient_profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Patients can insert own profile" ON public.patient_profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Doctors can view patient profiles for appointments" ON public.patient_profiles FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.appointments WHERE appointments.patient_id = patient_profiles.user_id AND appointments.doctor_id = auth.uid())
);

-- Appointments policies
CREATE POLICY "Users can view own appointments" ON public.appointments FOR SELECT TO authenticated USING (auth.uid() = patient_id OR auth.uid() = doctor_id);
CREATE POLICY "Patients can create appointments" ON public.appointments FOR INSERT TO authenticated WITH CHECK (auth.uid() = patient_id);
CREATE POLICY "Users can update own appointments" ON public.appointments FOR UPDATE TO authenticated USING (auth.uid() = patient_id OR auth.uid() = doctor_id);

-- Prescriptions policies
CREATE POLICY "Users can view own prescriptions" ON public.prescriptions FOR SELECT TO authenticated USING (auth.uid() = patient_id OR auth.uid() = doctor_id);
CREATE POLICY "Doctors can create prescriptions" ON public.prescriptions FOR INSERT TO authenticated WITH CHECK (auth.uid() = doctor_id);
CREATE POLICY "Patients can upload prescriptions" ON public.prescriptions FOR INSERT TO authenticated WITH CHECK (auth.uid() = patient_id);

-- Reviews policies
CREATE POLICY "Anyone can view reviews" ON public.reviews FOR SELECT TO authenticated USING (true);
CREATE POLICY "Patients can create reviews" ON public.reviews FOR INSERT TO authenticated WITH CHECK (auth.uid() = patient_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Add triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_doctor_profiles_updated_at BEFORE UPDATE ON public.doctor_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_patient_profiles_updated_at BEFORE UPDATE ON public.patient_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create auto-profile trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, role, full_name)
  VALUES (
    NEW.id,
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'patient'),
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  
  IF (NEW.raw_user_meta_data->>'role') = 'doctor' THEN
    INSERT INTO public.doctor_profiles (user_id, doctor_id, medical_license)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'doctor_id', 'DOC-' || substr(NEW.id::text, 1, 8)),
      COALESCE(NEW.raw_user_meta_data->>'medical_license', '')
    );
  ELSE
    INSERT INTO public.patient_profiles (user_id, patient_id)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'patient_id', 'PAT-' || substr(NEW.id::text, 1, 8))
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Storage bucket for certificates and prescriptions
INSERT INTO storage.buckets (id, name, public) VALUES ('medical-files', 'medical-files', true);

CREATE POLICY "Authenticated users can upload files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'medical-files');
CREATE POLICY "Authenticated users can view files" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'medical-files');
CREATE POLICY "Users can update own files" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'medical-files' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete own files" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'medical-files' AND auth.uid()::text = (storage.foldername(name))[1]);
