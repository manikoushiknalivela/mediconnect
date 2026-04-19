import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect } from 'react';
import { Stethoscope, Users, Heart, Shield, Clock, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';

const Home = () => {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user && role) {
      navigate(role === 'doctor' ? '/doctor/dashboard' : '/patient/dashboard');
    }
  }, [user, role, loading, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-pulse-slow text-primary">
          <Stethoscope className="h-12 w-12" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <header className="gradient-hero px-4 py-6">
        <nav className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-2">
            <Stethoscope className="h-8 w-8 text-primary-foreground" />
            <span className="text-2xl font-bold text-primary-foreground">MediConnect</span>
          </div>
        </nav>
      </header>

      <section className="gradient-hero px-4 pb-20 pt-12">
        <div className="mx-auto max-w-6xl text-center">
          <h1 className="animate-slide-up text-4xl font-bold leading-tight text-primary-foreground md:text-6xl">
            Connecting Patients<br />with Trusted Doctors
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-primary-foreground/80">
            Book appointments, manage prescriptions, and access quality healthcare — all in one platform.
          </p>

          <div className="mt-12 flex flex-col items-center justify-center gap-6 sm:flex-row">
            <button
              onClick={() => navigate('/login/doctor')}
              className="group flex w-72 flex-col items-center gap-4 rounded-2xl border-2 border-primary-foreground/20 bg-primary-foreground/10 p-8 backdrop-blur-sm transition-all duration-300 hover:scale-105 hover:border-primary-foreground/40 hover:bg-primary-foreground/20"
            >
              <div className="rounded-full bg-primary-foreground/20 p-4">
                <Stethoscope className="h-10 w-10 text-primary-foreground" />
              </div>
              <span className="text-xl font-semibold text-primary-foreground">I'm a Doctor</span>
              <span className="text-sm text-primary-foreground/70">Manage patients & prescriptions</span>
            </button>

            <button
              onClick={() => navigate('/login/patient')}
              className="group flex w-72 flex-col items-center gap-4 rounded-2xl border-2 border-primary-foreground/20 bg-primary-foreground/10 p-8 backdrop-blur-sm transition-all duration-300 hover:scale-105 hover:border-primary-foreground/40 hover:bg-primary-foreground/20"
            >
              <div className="rounded-full bg-primary-foreground/20 p-4">
                <Users className="h-10 w-10 text-primary-foreground" />
              </div>
              <span className="text-xl font-semibold text-primary-foreground">I'm a Patient</span>
              <span className="text-sm text-primary-foreground/70">Book appointments & find doctors</span>
            </button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-4 py-20">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-3xl font-bold text-foreground">Why MediConnect?</h2>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {[
              { icon: Shield, title: 'Verified Doctors', desc: 'All doctors are verified with medical licenses and credentials.' },
              { icon: Clock, title: 'Easy Scheduling', desc: 'Book appointments with available time slots that fit your schedule.' },
              { icon: Star, title: 'Patient Reviews', desc: 'Read reviews from real patients to find the right doctor.' },
            ].map((f) => (
              <div key={f.title} className="animate-fade-in rounded-xl border border-border bg-card p-6 shadow-elegant transition-all hover:shadow-lg">
                <div className="mb-4 inline-flex rounded-lg bg-accent p-3">
                  <f.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-card-foreground">{f.title}</h3>
                <p className="mt-2 text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-border bg-card px-4 py-8">
        <div className="mx-auto max-w-6xl text-center text-muted-foreground">
          <div className="flex items-center justify-center gap-2">
            <Heart className="h-4 w-4 text-destructive" />
            <span>MediConnect — Your Health, Our Priority</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;
