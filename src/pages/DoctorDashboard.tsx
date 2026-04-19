import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/DashboardLayout';
import TimeSlotManager from '@/components/doctor/TimeSlotManager';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Calendar, Star, Users, FileText, Clock, Edit, Eye, Pill, AlertTriangle, Download, X, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { openSignedFile } from '@/lib/storage';

const DoctorDashboard = () => {
  const { user, profile } = useAuth();
  const [doctorProfile, setDoctorProfile] = useState<any>(null);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [editProfile, setEditProfile] = useState(false);
  const [form, setForm] = useState({
    specialization: '', experience_years: 0, consultation_fee: 0,
    hospital_location: '', available_slots: '',
  });
  const [prescForm, setPrescForm] = useState({ patientId: '', diagnosis: '', medications: '', notes: '' });
  const [prescDialog, setPrescDialog] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [viewPrescription, setViewPrescription] = useState<any>(null);
  const [patientProfile, setPatientProfile] = useState<any>(null);
  const [cancelDialog, setCancelDialog] = useState<any>(null);
  const [cancelReason, setCancelReason] = useState('');

  useEffect(() => {
    if (user) {
      fetchDoctorProfile();
      fetchAppointments();
      fetchReviews();
      fetchPrescriptions();
    }
  }, [user]);

  // Realtime for doctor appointments
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('doctor-appointments')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments', filter: `doctor_id=eq.${user.id}` },
        () => fetchAppointments()
      ).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const fetchDoctorProfile = async () => {
    const { data } = await supabase.from('doctor_profiles').select('*').eq('user_id', user!.id).single();
    if (data) {
      setDoctorProfile(data);
      setForm({
        specialization: data.specialization || '',
        experience_years: data.experience_years || 0,
        consultation_fee: data.consultation_fee || 0,
        hospital_location: data.hospital_location || '',
        available_slots: JSON.stringify(data.available_slots || []),
      });
    }
  };

  const fetchAppointments = async () => {
    const { data } = await supabase
      .from('appointments')
      .select('*')
      .eq('doctor_id', user!.id)
      .order('appointment_date', { ascending: true });
    if (!data || data.length === 0) { setAppointments([]); return; }
    const patientIds = [...new Set(data.map(a => a.patient_id))];
    const { data: profiles } = await supabase.from('profiles').select('*').in('user_id', patientIds);
    const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));
    setAppointments(data.map(a => ({ ...a, patient_profile: profileMap.get(a.patient_id) || null })));
  };

  const fetchReviews = async () => {
    const { data } = await supabase
      .from('reviews')
      .select('*')
      .eq('doctor_id', user!.id)
      .order('created_at', { ascending: false })
      .limit(5);
    if (!data || data.length === 0) { setReviews([]); return; }
    const patientIds = [...new Set(data.map(r => r.patient_id))];
    const { data: profiles } = await supabase.from('profiles').select('*').in('user_id', patientIds);
    const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));
    setReviews(data.map(r => ({ ...r, patient_profile: profileMap.get(r.patient_id) || null })));
  };

  const fetchPrescriptions = async () => {
    const { data } = await supabase
      .from('prescriptions')
      .select('*')
      .eq('doctor_id', user!.id)
      .order('created_at', { ascending: false })
      .limit(10);
    if (!data || data.length === 0) { setPrescriptions([]); return; }
    const patientIds = [...new Set(data.map(p => p.patient_id))];
    const { data: profiles } = await supabase.from('profiles').select('*').in('user_id', patientIds);
    const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));
    setPrescriptions(data.map(p => ({ ...p, patient_profile: profileMap.get(p.patient_id) || null })));
  };

  const updateProfile = async () => {
    const { error } = await supabase.from('doctor_profiles').update({
      specialization: form.specialization,
      experience_years: form.experience_years,
      consultation_fee: form.consultation_fee,
      hospital_location: form.hospital_location,
    }).eq('user_id', user!.id);

    // Also update full_name and phone in profiles
    await supabase.from('profiles').update({
      full_name: profile?.full_name,
      phone: profile?.phone,
    }).eq('user_id', user!.id);

    if (error) toast.error('Failed to update profile');
    else { toast.success('Profile updated!'); setEditProfile(false); fetchDoctorProfile(); }
  };

  const updateMainProfile = async (name: string, phone: string) => {
    await supabase.from('profiles').update({ full_name: name, phone }).eq('user_id', user!.id);
  };

  const createPrescription = async () => {
    if (!prescForm.patientId || !prescForm.diagnosis) {
      toast.error('Patient and diagnosis are required');
      return;
    }
    const { error } = await supabase.from('prescriptions').insert({
      doctor_id: user!.id,
      patient_id: prescForm.patientId,
      diagnosis: prescForm.diagnosis,
      medications: prescForm.medications ? JSON.parse(`[${prescForm.medications.split(',').map(m => `"${m.trim()}"`).join(',')}]`) : [],
      notes: prescForm.notes,
    });
    if (error) toast.error('Failed to create prescription');
    else { toast.success('Prescription created!'); setPrescDialog(false); setPrescForm({ patientId: '', diagnosis: '', medications: '', notes: '' }); fetchPrescriptions(); }
  };

  const completeAppointment = async (aptId: string) => {
    const { error } = await supabase.from('appointments').update({ status: 'completed' }).eq('id', aptId);
    if (error) toast.error('Failed to complete appointment');
    else { toast.success('Appointment marked as completed!'); fetchAppointments(); }
  };

  const viewPatientEmergency = async (patientId: string) => {
    const { data } = await supabase.from('patient_profiles').select('*').eq('user_id', patientId).single();
    setPatientProfile(data);
    setSelectedPatient(patientId);
  };

  const todayAppointments = appointments.filter(a => {
    const d = new Date(a.appointment_date).toDateString();
    return d === new Date().toDateString();
  });

  const upcomingAppointments = appointments.filter(a => {
    const d = new Date(a.appointment_date);
    const today = new Date();
    return d.toDateString() !== today.toDateString() && d > today;
  });

  return (
    <DashboardLayout title="Doctor Dashboard">
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Profile Card */}
        <Card className="lg:col-span-1 shadow-elegant">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Profile & Credentials
              <Button variant="ghost" size="icon" onClick={() => setEditProfile(!editProfile)}>
                <Edit className="h-4 w-4" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {editProfile ? (
              <div className="space-y-3">
                <div>
                  <Label>Full Name</Label>
                  <Input defaultValue={profile?.full_name} onChange={e => updateMainProfile(e.target.value, profile?.phone)} />
                </div>
                <div>
                  <Label>Specialization</Label>
                  <Input value={form.specialization} onChange={e => setForm({ ...form, specialization: e.target.value })} />
                </div>
                <div>
                  <Label>Experience (Years)</Label>
                  <Input type="number" value={form.experience_years} onChange={e => setForm({ ...form, experience_years: parseInt(e.target.value) })} />
                </div>
                <div>
                  <Label>Consultation Fee (₹)</Label>
                  <Input type="number" value={form.consultation_fee} onChange={e => setForm({ ...form, consultation_fee: parseFloat(e.target.value) })} />
                </div>
                <div>
                  <Label>Hospital Location</Label>
                  <Input value={form.hospital_location} onChange={e => setForm({ ...form, hospital_location: e.target.value })} />
                </div>
                <Button onClick={updateProfile} className="w-full" variant="hero">Save Profile</Button>
              </div>
            ) : (
              <>
                <div className="text-center">
                  <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-accent">
                    <span className="text-2xl font-bold text-primary">{profile?.full_name?.charAt(0) || 'D'}</span>
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">{profile?.full_name || 'Doctor'}</h3>
                  <p className="text-sm text-muted-foreground">{doctorProfile?.specialization || 'Not set'}</p>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Doctor ID</span><span className="font-medium text-foreground">{doctorProfile?.doctor_id}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">License</span><span className="font-medium text-foreground">{doctorProfile?.medical_license}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Experience</span><span className="font-medium text-foreground">{doctorProfile?.experience_years || 0} years</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Fee</span><span className="font-medium text-foreground">₹{doctorProfile?.consultation_fee || 0}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Location</span><span className="font-medium text-foreground">{doctorProfile?.hospital_location || 'Not set'}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Rating</span><span className="font-medium text-foreground flex items-center gap-1"><Star className="h-3 w-3 text-warning" />{doctorProfile?.avg_rating || 0}</span></div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Main content */}
        <div className="space-y-6 lg:col-span-2">
          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {[
              { label: "Today's Patients", value: todayAppointments.length, icon: Users, color: 'text-primary' },
              { label: 'Total Reviews', value: doctorProfile?.total_reviews || 0, icon: Star, color: 'text-warning' },
              { label: 'Prescriptions', value: prescriptions.length, icon: FileText, color: 'text-secondary' },
              { label: 'Rating', value: doctorProfile?.avg_rating || '0.0', icon: Star, color: 'text-warning' },
            ].map(s => (
              <Card key={s.label} className="shadow-elegant">
                <CardContent className="flex items-center gap-3 p-4">
                  <s.icon className={`h-8 w-8 ${s.color}`} />
                  <div>
                    <p className="text-2xl font-bold text-foreground">{s.value}</p>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Today's Appointments */}
          <Card className="shadow-elegant">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" /> Today's Appointments
              </CardTitle>
            </CardHeader>
            <CardContent>
              {todayAppointments.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No appointments today</p>
              ) : (
                <div className="space-y-3">
                  {todayAppointments.map(apt => (
                    <div key={apt.id} className="flex items-center justify-between rounded-lg border border-border p-4">
                      <div>
                        <p className="font-medium text-foreground">{apt.patient_profile?.full_name || 'Patient'}</p>
                        <p className="text-sm text-muted-foreground">{new Date(apt.appointment_date).toLocaleTimeString()}</p>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <Badge variant={apt.status === 'completed' ? 'default' : apt.status === 'cancelled' ? 'destructive' : 'secondary'}>{apt.status}</Badge>
                        {apt.status === 'scheduled' && (
                          <>
                            <Button size="sm" variant="default" onClick={() => completeAppointment(apt.id)}>
                              <CheckCircle className="h-4 w-4 mr-1" /> Complete
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => viewPatientEmergency(apt.patient_id)}>
                              <AlertTriangle className="h-4 w-4" /> Emergency Info
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => { setPrescForm({ ...prescForm, patientId: apt.patient_id }); setPrescDialog(true); }}>
                              <Pill className="h-4 w-4" /> Prescribe
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => { setCancelDialog(apt); setCancelReason(''); }}>
                              <X className="h-4 w-4 mr-1" /> Cancel
                            </Button>
                          </>
                        )}
                        {apt.status === 'completed' && (
                          <Button size="sm" variant="ghost" onClick={() => { setPrescForm({ ...prescForm, patientId: apt.patient_id }); setPrescDialog(true); }}>
                            <Pill className="h-4 w-4" /> Prescribe
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

          {/* Upcoming Appointments */}
          <Card className="shadow-elegant">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" /> Upcoming Appointments
              </CardTitle>
            </CardHeader>
            <CardContent>
              {upcomingAppointments.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No upcoming appointments</p>
              ) : (
                <div className="space-y-3">
                  {upcomingAppointments.map(apt => (
                    <div key={apt.id} className="flex items-center justify-between rounded-lg border border-border p-4">
                      <div>
                        <p className="font-medium text-foreground">{apt.patient_profile?.full_name || 'Patient'}</p>
                        <p className="text-sm text-muted-foreground">{new Date(apt.appointment_date).toLocaleString()}</p>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <Badge variant={apt.status === 'cancelled' ? 'destructive' : apt.status === 'completed' ? 'default' : 'secondary'}>{apt.status}</Badge>
                        {apt.status === 'scheduled' && (
                          <>
                            <Button size="sm" variant="default" onClick={() => completeAppointment(apt.id)}>
                              <CheckCircle className="h-4 w-4 mr-1" /> Complete
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => viewPatientEmergency(apt.patient_id)}>
                              <AlertTriangle className="h-4 w-4" /> Emergency Info
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => { setPrescForm({ ...prescForm, patientId: apt.patient_id }); setPrescDialog(true); }}>
                              <Pill className="h-4 w-4" /> Prescribe
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => { setCancelDialog(apt); setCancelReason(''); }}>
                              <X className="h-4 w-4 mr-1" /> Cancel
                            </Button>
                          </>
                        )}
                        {apt.status === 'completed' && (
                          <Button size="sm" variant="ghost" onClick={() => { setPrescForm({ ...prescForm, patientId: apt.patient_id }); setPrescDialog(true); }}>
                            <Pill className="h-4 w-4" /> Prescribe
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

          {patientProfile && (
            <Dialog open={!!selectedPatient} onOpenChange={() => setSelectedPatient(null)}>
              <DialogContent>
                <DialogHeader><DialogTitle>Patient Emergency Information</DialogTitle></DialogHeader>
                <div className="space-y-3 text-sm">
                  <div><strong className="text-foreground">Blood Group:</strong> <span className="text-muted-foreground">{patientProfile.blood_group || 'N/A'}</span></div>
                  <div><strong className="text-foreground">Drug Allergies:</strong> <span className="text-muted-foreground">{patientProfile.drug_allergies || 'None'}</span></div>
                  <div><strong className="text-foreground">Food Allergies:</strong> <span className="text-muted-foreground">{patientProfile.food_allergies || 'None'}</span></div>
                  <div><strong className="text-foreground">Emergency Contacts:</strong> <span className="text-muted-foreground">{patientProfile.emergency_contacts || 'N/A'}</span></div>
                  <div><strong className="text-foreground">Medical Info:</strong> <span className="text-muted-foreground">{patientProfile.medical_info || 'N/A'}</span></div>
                </div>
              </DialogContent>
            </Dialog>
          )}

          {/* Time Slot Management */}
          <TimeSlotManager
            slots={Array.isArray(doctorProfile?.available_slots) ? doctorProfile.available_slots : []}
            onUpdate={fetchDoctorProfile}
          />

          {/* Prescription Management */}
          <Card className="shadow-elegant">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2"><FileText className="h-5 w-5 text-primary" /> Prescription Management</span>
                <Button size="sm" variant="hero" onClick={() => setPrescDialog(true)}>
                  <Pill className="h-4 w-4" /> New Prescription
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {prescriptions.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">No prescriptions yet</p>
              ) : (
                <div className="space-y-3">
                  {prescriptions.map(p => (
                    <div key={p.id} className="rounded-lg border border-border p-4 cursor-pointer hover:shadow-md transition-all" onClick={() => setViewPrescription(p)}>
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-medium text-foreground">{p.patient_profile?.full_name || 'Patient'}</p>
                          <p className="text-sm text-muted-foreground">Diagnosis: {p.diagnosis}</p>
                          {Array.isArray(p.medications) && p.medications.length > 0 && (
                            <p className="text-xs text-muted-foreground mt-1">Medications: {p.medications.join(', ')}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</span>
                          <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setViewPrescription(p); }}><Eye className="h-4 w-4" /></Button>
                        </div>
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
                  <div><strong className="text-foreground">Patient:</strong> <span className="text-muted-foreground">{viewPrescription.patient_profile?.full_name || 'Patient'}</span></div>
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

          {/* Create Prescription Dialog */}
          <Dialog open={prescDialog} onOpenChange={setPrescDialog}>
            <DialogContent>
              <DialogHeader><DialogTitle>Create Prescription</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Patient ID (UUID)</Label><Input value={prescForm.patientId} onChange={e => setPrescForm({ ...prescForm, patientId: e.target.value })} /></div>
                <div><Label>Diagnosis</Label><Textarea value={prescForm.diagnosis} onChange={e => setPrescForm({ ...prescForm, diagnosis: e.target.value })} /></div>
                <div><Label>Medications (comma-separated)</Label><Input value={prescForm.medications} onChange={e => setPrescForm({ ...prescForm, medications: e.target.value })} /></div>
                <div><Label>Notes</Label><Textarea value={prescForm.notes} onChange={e => setPrescForm({ ...prescForm, notes: e.target.value })} /></div>
                <Button onClick={createPrescription} className="w-full" variant="hero">Create Prescription</Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Cancel Appointment Dialog */}
          <Dialog open={!!cancelDialog} onOpenChange={() => setCancelDialog(null)}>
            <DialogContent>
              <DialogHeader><DialogTitle>Cancel Appointment</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">Cancel appointment on {cancelDialog && new Date(cancelDialog.appointment_date).toLocaleString()} with {cancelDialog?.patient_profile?.full_name || 'Patient'}?</p>
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

          {/* Recent Reviews */}
          <Card className="shadow-elegant">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Star className="h-5 w-5 text-warning" /> Recent Reviews</CardTitle>
            </CardHeader>
            <CardContent>
              {reviews.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">No reviews yet</p>
              ) : (
                <div className="space-y-3">
                  {reviews.map(r => (
                    <div key={r.id} className="rounded-lg border border-border p-4">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">{r.patient_profile?.full_name || 'Patient'}</span>
                        <div className="flex">{[...Array(r.rating)].map((_, i) => <Star key={i} className="h-3 w-3 fill-warning text-warning" />)}</div>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{r.comment}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default DoctorDashboard;
