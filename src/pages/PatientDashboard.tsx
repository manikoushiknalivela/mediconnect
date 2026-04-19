import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Search, Star, Calendar, FileText, AlertTriangle, Edit, Upload, Download, Clock, MapPin, Phone, Stethoscope, Filter, X, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { openSignedFile } from '@/lib/storage';

const PatientDashboard = () => {
  const { user, profile } = useAuth();
  const [patientProfile, setPatientProfile] = useState<any>(null);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [editEmergency, setEditEmergency] = useState(false);
  const [emergencyForm, setEmergencyForm] = useState({ drug_allergies: '', food_allergies: '', emergency_contacts: '', blood_group: '', medical_info: '' });
  const [selectedDoctor, setSelectedDoctor] = useState<any>(null);
  const [selectedSlot, setSelectedSlot] = useState<any>(null);
  const [bookingDate, setBookingDate] = useState('');
  const [reviewDialog, setReviewDialog] = useState<any>(null);
  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: '' });
  const [profileForm, setProfileForm] = useState({ full_name: '', phone: '' });
  const [editBasicProfile, setEditBasicProfile] = useState(false);
  const [viewPrescription, setViewPrescription] = useState<any>(null);
  const [cancelDialog, setCancelDialog] = useState<any>(null);
  const [cancelReason, setCancelReason] = useState('');

  // Advanced filters
  const [showFilters, setShowFilters] = useState(false);
  const [specFilter, setSpecFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('');
  const [maxFee, setMaxFee] = useState([5000]);
  const [minRating, setMinRating] = useState([0]);

  useEffect(() => {
    if (user) {
      fetchPatientProfile();
      fetchDoctors();
      fetchAppointments();
      fetchPrescriptions();
    }
  }, [user]);

  useEffect(() => {
    if (profile) {
      setProfileForm({ full_name: profile.full_name || '', phone: profile.phone || '' });
    }
  }, [profile]);

  // Realtime for appointments and prescriptions
  useEffect(() => {
    if (!user) return;
    const aptChannel = supabase
      .channel('patient-appointments')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments', filter: `patient_id=eq.${user.id}` },
        () => fetchAppointments()
      ).subscribe();
    const rxChannel = supabase
      .channel('patient-prescriptions')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'prescriptions', filter: `patient_id=eq.${user.id}` },
        () => fetchPrescriptions()
      ).subscribe();
    return () => { supabase.removeChannel(aptChannel); supabase.removeChannel(rxChannel); };
  }, [user]);

  const fetchPatientProfile = async () => {
    const { data } = await supabase.from('patient_profiles').select('*').eq('user_id', user!.id).single();
    if (data) {
      setPatientProfile(data);
      setEmergencyForm({
        drug_allergies: data.drug_allergies || '',
        food_allergies: data.food_allergies || '',
        emergency_contacts: data.emergency_contacts || '',
        blood_group: data.blood_group || '',
        medical_info: data.medical_info || '',
      });
    }
  };

  const fetchDoctors = async () => {
    const { data: docProfiles } = await supabase.from('doctor_profiles').select('*');
    if (!docProfiles || docProfiles.length === 0) { setDoctors([]); return; }
    const userIds = docProfiles.map(d => d.user_id);
    const { data: profiles } = await supabase.from('profiles').select('*').in('user_id', userIds);
    const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));
    setDoctors(docProfiles.map(d => ({ ...d, profile: profileMap.get(d.user_id) || null })));
  };

  const fetchAppointments = async () => {
    const { data } = await supabase
      .from('appointments')
      .select('*')
      .eq('patient_id', user!.id)
      .order('appointment_date', { ascending: false });
    if (!data || data.length === 0) { setAppointments([]); return; }
    const doctorIds = [...new Set(data.map(a => a.doctor_id))];
    const { data: profiles } = await supabase.from('profiles').select('*').in('user_id', doctorIds);
    const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));
    setAppointments(data.map(a => ({ ...a, doctor_profile: profileMap.get(a.doctor_id) || null })));
  };

  const fetchPrescriptions = async () => {
    const { data } = await supabase
      .from('prescriptions')
      .select('*')
      .eq('patient_id', user!.id)
      .order('created_at', { ascending: false });
    if (!data || data.length === 0) { setPrescriptions([]); return; }
    const doctorIds = [...new Set(data.map(p => p.doctor_id))];
    const { data: profiles } = await supabase.from('profiles').select('*').in('user_id', doctorIds);
    const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));
    setPrescriptions(data.map(p => ({ ...p, doctor_profile: profileMap.get(p.doctor_id) || null })));
  };

  const updateEmergencyInfo = async () => {
    const { error } = await supabase.from('patient_profiles').update(emergencyForm).eq('user_id', user!.id);
    if (error) toast.error('Failed to update');
    else { toast.success('Emergency info updated!'); setEditEmergency(false); fetchPatientProfile(); }
  };

  const updateBasicProfile = async () => {
    const { error } = await supabase.from('profiles').update(profileForm).eq('user_id', user!.id);
    if (error) toast.error('Failed to update profile');
    else { toast.success('Profile updated!'); setEditBasicProfile(false); }
  };

  const bookAppointment = async () => {
    if (!selectedDoctor) return;
    if (!selectedSlot && !bookingDate) { toast.error('Select a time slot or date'); return; }

    let appointmentDate: string;
    if (selectedSlot) {
      const dayIndex = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].indexOf(selectedSlot.day);
      const today = new Date();
      const todayDay = today.getDay();
      let daysUntil = dayIndex - todayDay;
      if (daysUntil <= 0) daysUntil += 7;
      const nextDate = new Date(today);
      nextDate.setDate(today.getDate() + daysUntil);
      const [hours, minutes] = selectedSlot.start.split(':');
      nextDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      appointmentDate = nextDate.toISOString();
    } else {
      const selected = new Date(bookingDate);
      if (selected <= new Date()) { toast.error('Cannot book appointments in the past. Please select a future date and time.'); return; }
      appointmentDate = selected.toISOString();
    }

    const { error } = await supabase.from('appointments').insert({
      patient_id: user!.id,
      doctor_id: selectedDoctor.user_id,
      appointment_date: appointmentDate,
    });
    if (error) toast.error('Failed to book');
    else { toast.success('Appointment booked!'); setSelectedDoctor(null); setBookingDate(''); setSelectedSlot(null); fetchAppointments(); }
  };

  const submitReview = async () => {
    if (!reviewDialog) return;
    const { error } = await supabase.from('reviews').insert({
      patient_id: user!.id,
      doctor_id: reviewDialog.doctor_id,
      appointment_id: reviewDialog.id,
      rating: reviewForm.rating,
      comment: reviewForm.comment,
    });
    if (error) toast.error('Failed to submit review');
    else { toast.success('Review submitted!'); setReviewDialog(null); setReviewForm({ rating: 5, comment: '' }); }
  };

  const uploadPrescription = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const path = `${user!.id}/prescriptions/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage.from('medical-files').upload(path, file);
    if (uploadError) { toast.error('Upload failed'); return; }
    const { error } = await supabase.from('prescriptions').insert({
      patient_id: user!.id,
      doctor_id: user!.id,
      file_url: path,
      diagnosis: 'Uploaded prescription',
    });
    if (error) toast.error('Failed to save');
    else { toast.success('Prescription uploaded!'); fetchPrescriptions(); }
  };

  // Get unique specializations and locations
  const specializations = [...new Set(doctors.map(d => d.specialization).filter(Boolean))];
  const locations = [...new Set(doctors.map(d => d.hospital_location).filter(Boolean))];

  const filteredDoctors = doctors.filter(d => {
    const name = (d.profile?.full_name || '').toLowerCase();
    const spec = (d.specialization || '').toLowerCase();
    const matchesSearch = name.includes(searchQuery.toLowerCase()) || spec.includes(searchQuery.toLowerCase());
    const matchesSpec = specFilter === 'all' || d.specialization === specFilter;
    const matchesLocation = !locationFilter || (d.hospital_location || '').toLowerCase().includes(locationFilter.toLowerCase());
    const matchesFee = (d.consultation_fee || 0) <= maxFee[0];
    const matchesRating = (d.avg_rating || 0) >= minRating[0];
    return matchesSearch && matchesSpec && matchesLocation && matchesFee && matchesRating;
  });

  const recentAppointments = appointments.slice(0, 5);

  return (
    <DashboardLayout title="Patient Dashboard">
      <div className="space-y-6">
        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            { label: 'Book Appointment', icon: Calendar, action: () => document.getElementById('find-doctors')?.scrollIntoView({ behavior: 'smooth' }) },
            { label: 'Medical Records', icon: FileText, action: () => document.getElementById('prescriptions')?.scrollIntoView({ behavior: 'smooth' }) },
            { label: 'Upload Prescription', icon: Upload, action: () => document.getElementById('upload-rx')?.click() },
            { label: 'Emergency Info', icon: AlertTriangle, action: () => document.getElementById('emergency')?.scrollIntoView({ behavior: 'smooth' }) },
          ].map(q => (
            <Card key={q.label} className="cursor-pointer shadow-elegant transition-all hover:shadow-lg hover:scale-[1.02]" onClick={q.action}>
              <CardContent className="flex flex-col items-center gap-2 p-6">
                <q.icon className="h-8 w-8 text-primary" />
                <span className="text-sm font-medium text-foreground text-center">{q.label}</span>
              </CardContent>
            </Card>
          ))}
        </div>

        <input type="file" id="upload-rx" className="hidden" accept=".pdf,.jpg,.png" onChange={uploadPrescription} />

        {/* Basic Profile */}
        <Card className="shadow-elegant">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Your Profile</span>
              <Button variant="ghost" size="sm" onClick={() => setEditBasicProfile(!editBasicProfile)}>
                <Edit className="h-4 w-4" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {editBasicProfile ? (
              <div className="space-y-3">
                <div><Label>Full Name</Label><Input value={profileForm.full_name} onChange={e => setProfileForm({ ...profileForm, full_name: e.target.value })} /></div>
                <div><Label>Phone</Label><Input value={profileForm.phone} onChange={e => setProfileForm({ ...profileForm, phone: e.target.value })} /></div>
                <Button onClick={updateBasicProfile} variant="hero">Save</Button>
              </div>
            ) : (
              <div className="flex gap-6 text-sm">
                <span className="text-muted-foreground">Name: <strong className="text-foreground">{profile?.full_name || 'Not set'}</strong></span>
                <span className="text-muted-foreground">Phone: <strong className="text-foreground">{profile?.phone || 'Not set'}</strong></span>
                <span className="text-muted-foreground">Patient ID: <strong className="text-foreground">{patientProfile?.patient_id}</strong></span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Find Doctors */}
        <Card id="find-doctors" className="shadow-elegant">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Search className="h-5 w-5 text-primary" /> Find Doctors</CardTitle>
            <div className="mt-3 flex gap-2">
              <Input placeholder="Search by name or specialization..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="flex-1" />
              <Button variant={showFilters ? 'default' : 'outline'} size="icon" onClick={() => setShowFilters(!showFilters)}>
                <Filter className="h-4 w-4" />
              </Button>
            </div>

            {/* Advanced Filters */}
            {showFilters && (
              <div className="mt-4 rounded-lg border border-border p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-foreground">Advanced Filters</h4>
                  <Button variant="ghost" size="sm" onClick={() => { setSpecFilter('all'); setLocationFilter(''); setMaxFee([5000]); setMinRating([0]); }}>
                    <X className="h-3 w-3 mr-1" /> Clear
                  </Button>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label className="text-xs">Specialization</Label>
                    <Select value={specFilter} onValueChange={setSpecFilter}>
                      <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Specializations</SelectItem>
                        {specializations.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Location</Label>
                    <Input placeholder="Filter by location..." value={locationFilter} onChange={e => setLocationFilter(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Max Fee: ₹{maxFee[0]}</Label>
                    <Slider value={maxFee} onValueChange={setMaxFee} min={0} max={10000} step={100} className="mt-2" />
                  </div>
                  <div>
                    <Label className="text-xs">Min Rating: {minRating[0]}★</Label>
                    <Slider value={minRating} onValueChange={setMinRating} min={0} max={5} step={0.5} className="mt-2" />
                  </div>
                </div>
              </div>
            )}
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              {filteredDoctors.map(doc => {
                const slots = Array.isArray(doc.available_slots) ? doc.available_slots : [];
                return (
                  <div key={doc.id} className="rounded-xl border border-border p-5 transition-all hover:shadow-md">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-foreground">{doc.profile?.full_name || 'Doctor'}</h3>
                        <p className="text-sm text-primary">{doc.specialization || 'General'}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Star className="h-4 w-4 fill-warning text-warning" />
                        <span className="text-sm font-medium text-foreground">{doc.avg_rating || '0.0'}</span>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{doc.experience_years || 0} yrs exp</span>
                      <span className="flex items-center gap-1"><Stethoscope className="h-3 w-3" />₹{doc.consultation_fee || 0}</span>
                      <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{doc.hospital_location || 'N/A'}</span>
                      <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{doc.profile?.phone || 'N/A'}</span>
                    </div>
                    <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                      <span>License: {doc.medical_license}</span>
                    </div>
                    {/* Available Slots Preview */}
                    {slots.length > 0 && (
                      <div className="mt-3">
                        <p className="text-xs font-medium text-foreground mb-1">Available Slots:</p>
                        <div className="flex flex-wrap gap-1">
                          {slots.slice(0, 4).map((s: any, i: number) => (
                            <Badge key={i} variant="outline" className="text-[10px]">{s.day} {s.start}-{s.end}</Badge>
                          ))}
                          {slots.length > 4 && <Badge variant="outline" className="text-[10px]">+{slots.length - 4} more</Badge>}
                        </div>
                      </div>
                    )}
                    <Button className="mt-4 w-full" size="sm" variant="hero" onClick={() => { setSelectedDoctor(doc); setSelectedSlot(null); setBookingDate(''); }}>
                      Book Appointment
                    </Button>
                  </div>
                );
              })}
              {filteredDoctors.length === 0 && <p className="col-span-2 text-center text-muted-foreground py-8">No doctors found</p>}
            </div>
          </CardContent>
        </Card>

        {/* Booking Dialog */}
        <Dialog open={!!selectedDoctor} onOpenChange={() => setSelectedDoctor(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Book Appointment with {selectedDoctor?.profile?.full_name}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              {/* Show available slots */}
              {selectedDoctor && Array.isArray(selectedDoctor.available_slots) && selectedDoctor.available_slots.length > 0 && (
                <div>
                  <Label className="text-sm font-medium">Select a Time Slot</Label>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {selectedDoctor.available_slots.map((slot: any, i: number) => (
                      <button
                        key={i}
                        onClick={() => { setSelectedSlot(slot); setBookingDate(''); }}
                        className={`rounded-lg border p-3 text-left text-sm transition-all ${
                          selectedSlot?.day === slot.day && selectedSlot?.start === slot.start
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border text-foreground hover:border-primary/50'
                        }`}
                      >
                        <p className="font-medium">{slot.day}</p>
                        <p className="text-xs text-muted-foreground">{slot.start} - {slot.end}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="relative">
                <div className="absolute inset-x-0 top-1/2 border-t border-border" />
                <p className="relative bg-background px-2 text-center text-xs text-muted-foreground w-fit mx-auto">or choose a custom date</p>
              </div>
              <div>
                <Label>Custom Date & Time</Label>
                <Input type="datetime-local" value={bookingDate} min={new Date().toISOString().slice(0, 16)} onChange={e => { setBookingDate(e.target.value); setSelectedSlot(null); }} />
              </div>
              <Button onClick={bookAppointment} className="w-full" variant="hero" disabled={!selectedSlot && !bookingDate}>
                Confirm Booking
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Emergency Information */}
        <Card id="emergency" className="shadow-elegant">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-destructive" /> Emergency Information</span>
              <Button variant="ghost" size="sm" onClick={() => setEditEmergency(!editEmergency)}>
                <Edit className="h-4 w-4" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {editEmergency ? (
              <div className="space-y-3">
                <div><Label>Blood Group</Label><Input value={emergencyForm.blood_group} onChange={e => setEmergencyForm({ ...emergencyForm, blood_group: e.target.value })} placeholder="e.g. O+" /></div>
                <div><Label>Drug Allergies</Label><Textarea value={emergencyForm.drug_allergies} onChange={e => setEmergencyForm({ ...emergencyForm, drug_allergies: e.target.value })} /></div>
                <div><Label>Food Allergies</Label><Textarea value={emergencyForm.food_allergies} onChange={e => setEmergencyForm({ ...emergencyForm, food_allergies: e.target.value })} /></div>
                <div><Label>Emergency Contacts</Label><Textarea value={emergencyForm.emergency_contacts} onChange={e => setEmergencyForm({ ...emergencyForm, emergency_contacts: e.target.value })} /></div>
                <div><Label>Medical Information</Label><Textarea value={emergencyForm.medical_info} onChange={e => setEmergencyForm({ ...emergencyForm, medical_info: e.target.value })} /></div>
                <Button onClick={updateEmergencyInfo} variant="hero" className="w-full">Save Emergency Info</Button>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg bg-muted p-3"><span className="text-xs text-muted-foreground">Blood Group</span><p className="font-semibold text-foreground">{patientProfile?.blood_group || 'Not set'}</p></div>
                <div className="rounded-lg bg-muted p-3"><span className="text-xs text-muted-foreground">Drug Allergies</span><p className="font-semibold text-foreground">{patientProfile?.drug_allergies || 'None'}</p></div>
                <div className="rounded-lg bg-muted p-3"><span className="text-xs text-muted-foreground">Food Allergies</span><p className="font-semibold text-foreground">{patientProfile?.food_allergies || 'None'}</p></div>
                <div className="rounded-lg bg-muted p-3"><span className="text-xs text-muted-foreground">Emergency Contacts</span><p className="font-semibold text-foreground">{patientProfile?.emergency_contacts || 'Not set'}</p></div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Prescriptions */}
        <Card id="prescriptions" className="shadow-elegant">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2"><FileText className="h-5 w-5 text-primary" /> Prescriptions & Medical Records</span>
              <Button size="sm" variant="outline" onClick={() => document.getElementById('upload-rx')?.click()}>
                <Upload className="h-4 w-4" /> Upload
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {prescriptions.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No prescriptions yet</p>
            ) : (
              <div className="space-y-3">
                {prescriptions.map(p => (
                  <div key={p.id} className="flex items-center justify-between rounded-lg border border-border p-4 cursor-pointer hover:shadow-md transition-all" onClick={() => setViewPrescription(p)}>
                    <div>
                      <p className="font-medium text-foreground">{p.diagnosis || 'Prescription'}</p>
                      <p className="text-sm text-muted-foreground">Dr. {p.doctor_profile?.full_name || 'Unknown'} • {new Date(p.created_at).toLocaleDateString()}</p>
                      {Array.isArray(p.medications) && p.medications.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">Medications: {p.medications.join(', ')}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setViewPrescription(p); }}><Eye className="h-4 w-4" /></Button>
                      {p.file_url && (
                        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openSignedFile(p.file_url!); }}><Download className="h-4 w-4" /></Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Appointments */}
        <Card className="shadow-elegant">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Calendar className="h-5 w-5 text-primary" /> Recent Appointments</CardTitle>
          </CardHeader>
          <CardContent>
            {recentAppointments.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No appointments yet</p>
            ) : (
              <div className="space-y-3">
                {recentAppointments.map(apt => (
                  <div key={apt.id} className="flex items-center justify-between rounded-lg border border-border p-4">
                    <div>
                      <p className="font-medium text-foreground">Dr. {apt.doctor_profile?.full_name || 'Doctor'}</p>
                      <p className="text-sm text-muted-foreground">{new Date(apt.appointment_date).toLocaleString()}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={apt.status === 'completed' ? 'default' : apt.status === 'cancelled' ? 'destructive' : 'secondary'}>{apt.status}</Badge>
                      {apt.status === 'completed' && (
                        <Button size="sm" variant="ghost" onClick={() => { setReviewDialog(apt); setReviewForm({ rating: 5, comment: '' }); }}>
                          <Star className="h-4 w-4" /> Rate
                        </Button>
                      )}
                      {apt.status === 'scheduled' && (
                        <Button size="sm" variant="destructive" onClick={() => { setCancelDialog(apt); setCancelReason(''); }}>
                          <X className="h-4 w-4 mr-1" /> Cancel
                        </Button>
                      )}
                      {apt.status === 'cancelled' && apt.notes && (
                        <span className="text-xs text-muted-foreground">Reason: {apt.notes}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* View Prescription Dialog */}
        <Dialog open={!!viewPrescription} onOpenChange={() => setViewPrescription(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Prescription Details</DialogTitle></DialogHeader>
            {viewPrescription && (
              <div className="space-y-3 text-sm">
                <div><strong className="text-foreground">Doctor:</strong> <span className="text-muted-foreground">Dr. {viewPrescription.doctor_profile?.full_name || 'Unknown'}</span></div>
                <div><strong className="text-foreground">Diagnosis:</strong> <span className="text-muted-foreground">{viewPrescription.diagnosis || 'N/A'}</span></div>
                <div><strong className="text-foreground">Medications:</strong> <span className="text-muted-foreground">{Array.isArray(viewPrescription.medications) ? viewPrescription.medications.join(', ') : 'None'}</span></div>
                <div><strong className="text-foreground">Notes:</strong> <span className="text-muted-foreground">{viewPrescription.notes || 'None'}</span></div>
                <div><strong className="text-foreground">Date:</strong> <span className="text-muted-foreground">{new Date(viewPrescription.created_at).toLocaleString()}</span></div>
                {viewPrescription.file_url && (
                  <Button size="sm" variant="outline" className="mt-2" onClick={() => openSignedFile(viewPrescription.file_url!)}><Download className="h-4 w-4 mr-1" /> Download File</Button>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Cancel Appointment Dialog */}
        <Dialog open={!!cancelDialog} onOpenChange={() => setCancelDialog(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Cancel Appointment</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Are you sure you want to cancel this appointment on {cancelDialog && new Date(cancelDialog.appointment_date).toLocaleString()}?</p>
              <div>
                <Label>Reason for cancellation *</Label>
                <Textarea value={cancelReason} onChange={e => setCancelReason(e.target.value)} placeholder="Please provide a reason..." />
              </div>
              <Button variant="destructive" className="w-full" disabled={!cancelReason.trim()} onClick={async () => {
                const { error } = await supabase.from('appointments').update({ status: 'cancelled', notes: cancelReason }).eq('id', cancelDialog.id);
                if (error) toast.error('Failed to cancel');
                else { toast.success('Appointment cancelled'); setCancelDialog(null); fetchAppointments(); }
              }}>Confirm Cancellation</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Review Dialog */}
        <Dialog open={!!reviewDialog} onOpenChange={() => setReviewDialog(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Rate Your Experience</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Rating</Label>
                <div className="mt-2 flex gap-1">
                  {[1, 2, 3, 4, 5].map(r => (
                    <button key={r} onClick={() => setReviewForm({ ...reviewForm, rating: r })}>
                      <Star className={`h-8 w-8 ${r <= reviewForm.rating ? 'fill-warning text-warning' : 'text-muted-foreground'}`} />
                    </button>
                  ))}
                </div>
              </div>
              <div><Label>Comment</Label><Textarea value={reviewForm.comment} onChange={e => setReviewForm({ ...reviewForm, comment: e.target.value })} placeholder="Share your experience..." /></div>
              <Button onClick={submitReview} className="w-full" variant="hero">Submit Review</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default PatientDashboard;
