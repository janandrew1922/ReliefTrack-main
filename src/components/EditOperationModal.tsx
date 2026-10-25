import { useState, type FormEvent } from 'react';
import { PencilIcon, XIcon } from 'lucide-react';
import { updateOperation } from '../services/reliefService';
import type { Operation, OperationStatus } from '../types/domain';

export function EditOperationModal({ operation, onClose, onSaved }: { operation: Operation; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(operation.name);
  const [description, setDescription] = useState(operation.description);
  const [type, setType] = useState(operation.type);
  const [status, setStatus] = useState<OperationStatus>(operation.status);
  const [startDate, setStartDate] = useState(operation.startDate);
  const [endDate, setEndDate] = useState(operation.endDate);
  const [volunteersNeeded, setVolunteersNeeded] = useState(String(operation.volunteersNeeded));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (endDate < startDate) {
      setError('The end date must be on or after the start date.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await updateOperation(operation.id, { name: name.trim(), description: description.trim(), type, status, startDate, endDate, volunteersNeeded: Number(volunteersNeeded) });
      onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update the operation.');
    } finally {
      setBusy(false);
    }
  };

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" role="dialog" aria-modal="true" aria-labelledby="edit-operation-title">
    <section className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-line bg-white shadow-xl">
      <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
        <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-700">Operations portal</p><h2 id="edit-operation-title" className="mt-1 text-xl font-extrabold text-ink">Edit operation</h2><p className="mt-1 text-sm text-muted">Update the operation details shown to staff and donors.</p></div>
        <button type="button" onClick={onClose} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-gray-100"><XIcon className="h-4 w-4" /></button>
      </div>
      <form onSubmit={(event) => void submit(event)} className="space-y-4 px-6 py-5">
        <label className="block"><span className="text-xs font-bold text-ink">Operation name</span><input required maxLength={150} value={name} onChange={(event) => setName(event.target.value)} className="mt-1.5 w-full rounded-lg border border-line px-3 py-2.5 text-sm" /></label>
        <label className="block"><span className="text-xs font-bold text-ink">Description</span><textarea required value={description} onChange={(event) => setDescription(event.target.value)} rows={3} className="mt-1.5 w-full resize-y rounded-lg border border-line px-3 py-2.5 text-sm" /></label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block"><span className="text-xs font-bold text-ink">Operation type</span><select value={type} onChange={(event) => setType(event.target.value)} className="mt-1.5 w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm"><option value="disaster_response">Disaster response</option><option value="relief_distribution">Relief distribution</option><option value="rescue">Rescue</option><option value="donation_drive">Donation drive</option><option value="other">Other</option></select></label>
          <label className="block"><span className="text-xs font-bold text-ink">Status</span><select value={status} onChange={(event) => setStatus(event.target.value)} className="mt-1.5 w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm"><option value="planned">Planned</option><option value="active">Active</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></label>
        </div>
        <label className="block"><span className="text-xs font-bold text-ink">Operation-wide volunteer target</span><input required min="0" type="number" value={volunteersNeeded} onChange={(event) => setVolunteersNeeded(event.target.value)} className="mt-1.5 w-full rounded-lg border border-line px-3 py-2.5 text-sm" /><span className="mt-1 block text-xs text-muted">This updates the operation target; individual shift slot counts stay the same.</span></label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block"><span className="text-xs font-bold text-ink">Start date</span><input required type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="mt-1.5 w-full rounded-lg border border-line px-3 py-2.5 text-sm" /></label>
          <label className="block"><span className="text-xs font-bold text-ink">End date</span><input required type="date" min={startDate} value={endDate} onChange={(event) => setEndDate(event.target.value)} className="mt-1.5 w-full rounded-lg border border-line px-3 py-2.5 text-sm" /></label>
        </div>
        {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2.5 text-xs font-medium text-rose-700">{error}</p>}
        <div className="flex justify-end gap-2 border-t border-line pt-4"><button type="button" onClick={onClose} disabled={busy} className="rounded-lg border border-line px-4 py-2.5 text-xs font-bold text-ink">Cancel</button><button type="submit" disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-brand-700 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-60"><PencilIcon className="h-3.5 w-3.5" />{busy ? 'Saving…' : 'Save changes'}</button></div>
      </form>
    </section>
  </div>;
}
