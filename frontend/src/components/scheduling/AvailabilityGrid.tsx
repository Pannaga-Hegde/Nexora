import { useEffect, useState } from 'react';
import { Calendar, Clock, Save, Trash2, CheckCircle2, Loader2 } from 'lucide-react';
import { useSchedulingStore } from '../../store/useSchedulingStore';
import type { AvailabilityBlock } from '../../services/schedulingApi';

const DAYS = [
  { id: 0, name: 'Monday', short: 'Mon' },
  { id: 1, name: 'Tuesday', short: 'Tue' },
  { id: 2, name: 'Wednesday', short: 'Wed' },
  { id: 3, name: 'Thursday', short: 'Thu' },
  { id: 4, name: 'Friday', short: 'Fri' },
  { id: 5, name: 'Saturday', short: 'Sat' },
  { id: 6, name: 'Sunday', short: 'Sun' },
];

// 8 AM to 10 PM (8..21) in 30-min increments
const TIME_SLOTS: { hour: number; minute: number; label: string; key: string }[] = [];
for (let hour = 8; hour < 22; hour++) {
  for (const minute of [0, 30]) {
    const hour12 = hour % 12 === 0 ? 12 : hour % 12;
    const ampm = hour < 12 ? 'AM' : 'PM';
    const label = `${hour12}:${minute === 0 ? '00' : '30'} ${ampm}`;
    const key = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    TIME_SLOTS.push({ hour, minute, label, key });
  }
}

export default function AvailabilityGrid() {
  const { myAvailability, loadMyAvailability, saveMyAvailability } = useSchedulingStore();
  
  const [busySlots, setBusySlots] = useState<Set<string>>(new Set());
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [paintMode, setPaintMode] = useState<boolean>(true); // true = mark busy, false = clear
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadMyAvailability();
  }, []);

  useEffect(() => {
    if (!myAvailability) return;
    const slotSet = new Set<string>();
    myAvailability.forEach((block) => {
      const [startH, startM] = block.start_time.split(':').map(Number);
      const [endH, endM] = block.end_time.split(':').map(Number);
      
      const startMin = startH * 60 + startM;
      const endMin = endH * 60 + endM;

      TIME_SLOTS.forEach((slot) => {
        const slotStartMin = slot.hour * 60 + slot.minute;
        const slotEndMin = slotStartMin + 30;
        if (slotStartMin >= startMin && slotEndMin <= endMin) {
          slotSet.add(`${block.day_of_week}-${slot.key}`);
        }
      });
    });
    setBusySlots(slotSet);
  }, [myAvailability]);

  const toggleSlot = (dayId: number, slotKey: string, forceMode?: boolean) => {
    const id = `${dayId}-${slotKey}`;
    setBusySlots((prev) => {
      const next = new Set(prev);
      const targetMode = forceMode !== undefined ? forceMode : !next.has(id);
      if (targetMode) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const handleMouseDown = (dayId: number, slotKey: string) => {
    setIsMouseDown(true);
    const id = `${dayId}-${slotKey}`;
    const willBeBusy = !busySlots.has(id);
    setPaintMode(willBeBusy);
    toggleSlot(dayId, slotKey, willBeBusy);
  };

  const handleMouseEnter = (dayId: number, slotKey: string) => {
    if (isMouseDown) {
      toggleSlot(dayId, slotKey, paintMode);
    }
  };

  const handleMouseUp = () => {
    setIsMouseDown(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveSuccess(false);

    // Group busy 30-min slots into contiguous AvailabilityBlock objects per day
    const newBlocks: AvailabilityBlock[] = [];

    DAYS.forEach((day) => {
      const activeSlotTimes = TIME_SLOTS.filter((slot) => busySlots.has(`${day.id}-${slot.key}`))
        .map((s) => s.hour * 60 + s.minute)
        .sort((a, b) => a - b);

      if (activeSlotTimes.length === 0) return;

      let rangeStart = activeSlotTimes[0];
      let rangeEnd = activeSlotTimes[0] + 30;

      for (let i = 1; i < activeSlotTimes.length; i++) {
        if (activeSlotTimes[i] === rangeEnd) {
          rangeEnd += 30;
        } else {
          // Push finished range
          newBlocks.push({
            day_of_week: day.id,
            start_time: `${Math.floor(rangeStart / 60).toString().padStart(2, '0')}:${(rangeStart % 60).toString().padStart(2, '0')}`,
            end_time: `${Math.floor(rangeEnd / 60).toString().padStart(2, '0')}:${(rangeEnd % 60).toString().padStart(2, '0')}`,
            is_recurring: true,
          });
          rangeStart = activeSlotTimes[i];
          rangeEnd = activeSlotTimes[i] + 30;
        }
      }
      // Push final range
      newBlocks.push({
        day_of_week: day.id,
        start_time: `${Math.floor(rangeStart / 60).toString().padStart(2, '0')}:${(rangeStart % 60).toString().padStart(2, '0')}`,
        end_time: `${Math.floor(rangeEnd / 60).toString().padStart(2, '0')}:${(rangeEnd % 60).toString().padStart(2, '0')}`,
        is_recurring: true,
      });
    });

    try {
      await saveMyAvailability(newBlocks);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const clearAll = () => {
    setBusySlots(new Set());
  };

  const applyPresetMorning = () => {
    setBusySlots((prev) => {
      const next = new Set(prev);
      // Mon-Fri 8 AM - 11:30 AM
      [0, 1, 2, 3, 4].forEach((d) => {
        TIME_SLOTS.forEach((s) => {
          if (s.hour >= 8 && s.hour < 11.5) {
            next.add(`${d}-${s.key}`);
          }
        });
      });
      return next;
    });
  };

  return (
    <div
      onMouseUp={handleMouseUp}
      className="rounded-xl border border-nx-border bg-nx-card p-6 shadow-xs flex flex-col gap-5 select-none transition-colors"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-nx-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600">
              <Calendar className="h-4 w-4" />
            </div>
            <h2 className="text-base font-bold text-nx-primary">Weekly Class & Unavailability Painter</h2>
          </div>
          <p className="mt-1 text-xs text-nx-muted">
            Click & drag to paint your recurring schedule. Colored slots mark when you are busy.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={clearAll}
            className="flex items-center gap-1.5 rounded-lg border border-nx-border bg-nx-elevated px-3 py-1.5 text-xs font-medium text-nx-secondary hover:bg-nx-hover"
          >
            <Trash2 className="h-3.5 w-3.5 text-nx-muted" />
            <span>Clear Grid</span>
          </button>
          <button
            type="button"
            onClick={applyPresetMorning}
            className="flex items-center gap-1.5 rounded-lg border border-indigo-500/20 bg-indigo-500/10 px-3 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-500/20"
          >
            <Clock className="h-3.5 w-3.5 text-indigo-500" />
            <span>Preset Mon-Fri Mornings</span>
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50 transition-all"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : saveSuccess ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            <span>{saving ? 'Saving...' : saveSuccess ? 'Saved Schedule!' : 'Save Schedule'}</span>
          </button>
        </div>
      </div>

      {/* Grid Legend & Status */}
      <div className="flex items-center justify-between text-xs text-nx-secondary bg-nx-elevated p-3 rounded-lg border border-nx-border">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="h-3.5 w-3.5 rounded border border-nx-border bg-nx-card" />
            <span>Available (Free for team meeting)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-3.5 w-3.5 rounded bg-indigo-600" />
            <span className="font-semibold text-indigo-600">Busy (Classes / Work)</span>
          </div>
        </div>
        <div className="text-nx-muted text-[11px] font-mono">
          {busySlots.size} half-hour blocks marked busy
        </div>
      </div>

      {/* Visual Interactive Painter Grid */}
      <div className="overflow-x-auto border border-nx-border rounded-lg">
        <table className="w-full min-w-[700px] border-collapse text-center">
          <thead>
            <tr className="bg-nx-elevated border-b border-nx-border text-xs font-bold text-nx-primary">
              <th className="py-2.5 px-3 border-r border-nx-border w-24 text-left font-medium text-nx-muted">
                Time
              </th>
              {DAYS.map((day) => (
                <th key={day.id} className="py-2.5 px-2 border-r border-nx-border last:border-r-0">
                  <div className="font-bold text-nx-primary">{day.name}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TIME_SLOTS.map((slot) => (
              <tr key={slot.key} className="border-b border-nx-border hover:bg-nx-hover/40">
                <td className="py-1 px-3 border-r border-nx-border text-[11px] font-mono text-nx-muted text-left bg-nx-elevated">
                  {slot.minute === 0 ? slot.label : ''}
                </td>
                {DAYS.map((day) => {
                  const slotId = `${day.id}-${slot.key}`;
                  const isBusy = busySlots.has(slotId);
                  return (
                    <td
                      key={day.id}
                      onMouseDown={() => handleMouseDown(day.id, slot.key)}
                      onMouseEnter={() => handleMouseEnter(day.id, slot.key)}
                      className={`h-7 border-r border-nx-border last:border-r-0 cursor-pointer transition-colors ${
                        isBusy
                          ? 'bg-indigo-600 border-indigo-700 text-white'
                          : 'bg-nx-card hover:bg-nx-hover'
                      }`}
                      title={`${day.name} @ ${slot.label}: ${isBusy ? 'Busy (Class)' : 'Free'}`}
                    />
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
