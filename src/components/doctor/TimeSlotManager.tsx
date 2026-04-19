import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Clock, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface TimeSlot {
  day: string;
  start: string;
  end: string;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

interface Props {
  slots: TimeSlot[];
  onUpdate: () => void;
}

const TimeSlotManager = ({ slots, onUpdate }: Props) => {
  const { user } = useAuth();
  const [localSlots, setLocalSlots] = useState<TimeSlot[]>(slots || []);
  const [newSlot, setNewSlot] = useState<TimeSlot>({ day: 'Monday', start: '09:00', end: '10:00' });

  const addSlot = () => {
    if (!newSlot.start || !newSlot.end) { toast.error('Set start and end time'); return; }
    if (newSlot.start >= newSlot.end) { toast.error('End time must be after start time'); return; }
    const duplicate = localSlots.some(s => s.day === newSlot.day && s.start === newSlot.start && s.end === newSlot.end);
    if (duplicate) { toast.error('Slot already exists'); return; }
    setLocalSlots([...localSlots, { ...newSlot }]);
  };

  const removeSlot = (index: number) => {
    setLocalSlots(localSlots.filter((_, i) => i !== index));
  };

  const saveSlots = async () => {
    const { error } = await supabase
      .from('doctor_profiles')
      .update({ available_slots: localSlots as any })
      .eq('user_id', user!.id);
    if (error) toast.error('Failed to save slots');
    else { toast.success('Time slots updated!'); onUpdate(); }
  };

  const groupedSlots = DAYS.reduce((acc, day) => {
    const daySlots = localSlots.filter(s => s.day === day);
    if (daySlots.length > 0) acc[day] = daySlots;
    return acc;
  }, {} as Record<string, TimeSlot[]>);

  return (
    <Card className="shadow-elegant">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" /> Available Time Slots
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add new slot */}
        <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border p-4">
          <div>
            <Label className="text-xs">Day</Label>
            <Select value={newSlot.day} onValueChange={v => setNewSlot({ ...newSlot, day: v })}>
              <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {DAYS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Start</Label>
            <Input type="time" value={newSlot.start} onChange={e => setNewSlot({ ...newSlot, start: e.target.value })} className="w-[120px]" />
          </div>
          <div>
            <Label className="text-xs">End</Label>
            <Input type="time" value={newSlot.end} onChange={e => setNewSlot({ ...newSlot, end: e.target.value })} className="w-[120px]" />
          </div>
          <Button size="sm" onClick={addSlot}><Plus className="h-4 w-4 mr-1" /> Add</Button>
        </div>

        {/* Display slots grouped by day */}
        {Object.keys(groupedSlots).length === 0 ? (
          <p className="text-center text-muted-foreground py-4">No time slots set. Add your availability above.</p>
        ) : (
          <div className="space-y-3">
            {Object.entries(groupedSlots).map(([day, daySlots]) => (
              <div key={day} className="rounded-lg border border-border p-3">
                <p className="text-sm font-semibold text-foreground mb-2">{day}</p>
                <div className="flex flex-wrap gap-2">
                  {daySlots.map((slot, idx) => {
                    const globalIdx = localSlots.findIndex(s => s.day === slot.day && s.start === slot.start && s.end === slot.end);
                    return (
                      <Badge key={idx} variant="secondary" className="flex items-center gap-1 px-3 py-1">
                        {slot.start} - {slot.end}
                        <button onClick={() => removeSlot(globalIdx)} className="ml-1 hover:text-destructive">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </Badge>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        <Button onClick={saveSlots} className="w-full" variant="hero">Save Time Slots</Button>
      </CardContent>
    </Card>
  );
};

export default TimeSlotManager;
