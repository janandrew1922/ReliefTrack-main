import React, { useEffect, useRef, useState } from 'react';
import { CalendarDaysIcon, MapPinIcon, UsersIcon, XIcon } from 'lucide-react';
import { createOperation, getSkills } from '../services/reliefService';
import { useResource } from '../hooks/useResource';
import { LocationPicker } from './LocationPicker';
import type { Coordinates, OperationStatus } from '../types/domain';

const localDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
const today = localDate(new Date());

interface NewOperationModalProps {
  onClose: () => void;
  onCreated: () => void;
}

export function NewOperationModal({ onClose, onCreated }: NewOperationModalProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const skills = useResource(getSkills);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('disaster_response');
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [volunteersNeeded, setVolunteersNeeded] = useState('20');
  const [status, setStatus] = useState<OperationStatus>('planned');
  const [shiftDate, setShiftDate] = useState(today);
  const [shiftStart, setShiftStart] = useState('09:00');
  const [shiftEnd, setShiftEnd] = useState('13:00');
  const [requiredSkillIds, setRequiredSkillIds] = useState<string[]>([]);
  const [address, setAddress] = useState('');
  const [coordinates, setCoordinates] = useState<Coordinates>([14.6547, 120.9830]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const focusable = Array.from(dialog.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'));
    focusable[0]?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      } else if (event.key === 'Tab' && focusable.length > 0) {
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!address.toLowerCase().includes('caloocan')) {
      setError('The checkpoint address must be in Caloocan.');
      return;
    }
    if (endDate < startDate) {
      setError('The operation end date must be on or after its start date.');
      return;
    }
    if (shiftDate < startDate || shiftDate > endDate) {
      setError('The first volunteer shift must fall within the operation dates.');
      return;
    }
    if (shiftEnd <= shiftStart) {
      setError('The shift end time must be later than its start time.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await createOperation({
        name: name.trim(),
        description: description.trim(),
        type,
        status,
        startDate,
        endDate,
        volunteersNeeded: Number(volunteersNeeded),
        locationCount: 1,
        locationName: `${name.trim()} checkpoint`,
        address: address.trim(),
        city: 'Caloocan',
        province: 'Metro Manila',
        coordinates,
        shiftName: `${name.trim()} volunteer shift`,
        shiftDate,
        shiftStart,
        shiftEnd,
        requiredSkillIds
      });
      onCreated();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create the operation.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" role="dialog" aria-modal="true" aria-labelledby="new-operation-title">
      <section ref={dialogRef} tabIndex={-1} className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-line bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-700">Operations portal</p>
            <h2 id="new-operation-title" className="mt-1 text-xl font-extrabold text-ink">Create new operation</h2>
            <p className="mt-1 text-sm text-muted">Set up the response, its checkpoint, and its first volunteer shift.</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-gray-100">
            <XIcon className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4 px-6 py-5">
          <label className="block">
            <span className="text-xs font-bold text-ink">Operation name</span>
            <input required value={name} onChange={(event) => setName(event.target.value)} placeholder="Central Luzon Relief Response" className="mt-1.5 w-full rounded-lg border border-line px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-600" />
          </label>

          <div className="rounded-xl border border-line bg-gray-50 p-4">
            <div className="flex items-start gap-2">
              <MapPinIcon className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" />
              <div>
                <p className="text-xs font-bold text-ink">Operation checkpoint</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted">Pin the exact Caloocan location where volunteers will work or donations will be received.</p>
              </div>
            </div>
            <div className="mt-3">
              <LocationPicker coordinates={coordinates} onChange={setCoordinates} onAddressResolved={setAddress} />
            </div>
            <label className="mt-3 block">
              <span className="text-xs font-bold text-ink">Exact address</span>
              <input required value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Street, barangay, Caloocan" className="mt-1.5 w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-600" />
            </label>
          </div>

          <label className="block">
            <span className="text-xs font-bold text-ink">Description</span>
            <textarea required value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What this operation will support" rows={3} className="mt-1.5 w-full resize-none rounded-lg border border-line px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-600" />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-bold text-ink">Operation type</span>
              <select value={type} onChange={(event) => setType(event.target.value)} className="mt-1.5 w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-600">
                <option value="disaster_response">Disaster response</option>
                <option value="relief_distribution">Relief distribution</option>
                <option value="rescue">Rescue</option>
                <option value="donation_drive">Donation drive</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-bold text-ink">Status</span>
              <select value={status} onChange={(event) => setStatus(event.target.value as OperationStatus)} className="mt-1.5 w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-600">
                <option value="planned">Planned</option>
                <option value="active">Active</option>
              </select>
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-bold text-ink">Start date</span>
              <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-line px-3 focus-within:ring-2 focus-within:ring-brand-600">
                <CalendarDaysIcon className="h-4 w-4 shrink-0 text-muted" />
                <input required type="date" min={today} value={startDate} onChange={(event) => { setStartDate(event.target.value); if (endDate < event.target.value) setEndDate(event.target.value); if (shiftDate < event.target.value) setShiftDate(event.target.value); }} className="w-full bg-transparent py-2.5 text-sm outline-none" />
              </div>
            </label>
            <label className="block">
              <span className="text-xs font-bold text-ink">End date</span>
              <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-line px-3 focus-within:ring-2 focus-within:ring-brand-600">
                <CalendarDaysIcon className="h-4 w-4 shrink-0 text-muted" />
                <input required type="date" min={startDate} value={endDate} onChange={(event) => setEndDate(event.target.value)} className="w-full bg-transparent py-2.5 text-sm outline-none" />
              </div>
            </label>
          </div>

          <label className="block">
            <span className="text-xs font-bold text-ink">First shift volunteer slots</span>
            <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-line px-3 focus-within:ring-2 focus-within:ring-brand-600">
              <UsersIcon className="h-4 w-4 shrink-0 text-muted" />
              <input required min="1" type="number" value={volunteersNeeded} onChange={(event) => setVolunteersNeeded(event.target.value)} className="w-full bg-transparent py-2.5 text-sm outline-none" />
            </div>
            <span className="mt-1 block text-xs text-muted">This creates an open volunteer shift at the checkpoint when you create the operation.</span>
          </label>

          <div className="rounded-xl border border-line p-4">
            <div className="flex items-center gap-2">
              <CalendarDaysIcon className="h-4 w-4 text-brand-700" />
              <div>
                <p className="text-sm font-bold text-ink">First volunteer shift</p>
                <p className="mt-0.5 text-xs text-muted">Volunteers can see the shift dates and hours before joining.</p>
              </div>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <label className="block sm:col-span-3">
                <span className="text-xs font-bold text-ink">Shift date</span>
                <input required type="date" min={startDate} max={endDate} value={shiftDate} onChange={(event) => setShiftDate(event.target.value)} className="mt-1.5 w-full rounded-lg border border-line px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-600" />
              </label>
              <label className="block">
                <span className="text-xs font-bold text-ink">Starts</span>
                <input required type="time" value={shiftStart} onChange={(event) => setShiftStart(event.target.value)} className="mt-1.5 w-full rounded-lg border border-line px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-600" />
              </label>
              <label className="block">
                <span className="text-xs font-bold text-ink">Ends</span>
                <input required type="time" value={shiftEnd} onChange={(event) => setShiftEnd(event.target.value)} className="mt-1.5 w-full rounded-lg border border-line px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-600" />
              </label>
            </div>
            <fieldset className="mt-4">
              <legend className="text-xs font-bold text-ink">Skills needed <span className="font-normal text-muted">(optional)</span></legend>
              {skills.loading && <p className="mt-2 text-xs text-muted">Loading available skills…</p>}
              {skills.error && <p className="mt-2 text-xs text-amber-700">Skills could not be loaded. You can still create the shift and add skill requirements later.</p>}
              <div className="mt-2 flex flex-wrap gap-2">
                {(skills.data ?? []).map((skill) => {
                  const checked = requiredSkillIds.includes(skill.id);
                  return <label key={skill.id} className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${checked ? 'border-brand-700 bg-brand-50 text-brand-800' : 'border-line text-ink'}`}>
                    <input type="checkbox" checked={checked} onChange={() => setRequiredSkillIds((current) => checked ? current.filter((id) => id !== skill.id) : [...current, skill.id])} className="accent-brand-700" />
                    {skill.name}
                  </label>;
                })}
              </div>
            </fieldset>
          </div>

          {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2.5 text-xs font-medium text-rose-700">{error}</p>}

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} className="rounded-xl border border-line px-4 py-3 text-sm font-bold text-ink hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={busy} className="rounded-xl bg-brand-700 px-4 py-3 text-sm font-bold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-60">{busy ? 'Creating...' : 'Create operation'}</button>
          </div>
        </form>
      </section>
    </div>
  );
}
