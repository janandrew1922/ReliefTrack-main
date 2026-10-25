
import { useState } from 'react';
import { CalendarIcon, MapPinIcon, PencilIcon, Trash2Icon, UsersIcon } from 'lucide-react';
import { deleteOperation, getOperations } from '../services/reliefService';
import { useResource } from '../hooks/useResource';
import { EditOperationModal } from './EditOperationModal';
import { EmptyBlock, ErrorBlock, LoadingBlock } from './StateViews';
import type { Operation } from '../types/domain';

const statusStyle: Record<Operation['status'], {dot: string;chip: string;label: string;}> = {
  active: { dot: 'bg-brand-500', chip: 'text-brand-700 bg-brand-50', label: 'Active' },
  planned: { dot: 'bg-amber-500', chip: 'text-amber-600 bg-amber-50', label: 'Planned' },
  completed: { dot: 'bg-slate-400', chip: 'text-slate-600 bg-slate-100', label: 'Completed' },
  cancelled: { dot: 'bg-rose-500', chip: 'text-rose-600 bg-rose-50', label: 'Cancelled' }
};

export function OperationsPanel({ onChanged }: { onChanged?: () => void }) {
  const { data, loading, error, reload } = useResource(getOperations);
  const [editing, setEditing] = useState<Operation | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Operation | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const remove = async (operation: Operation) => {
    setBusyId(operation.id);
    setActionError(null);
    try {
      await deleteOperation(operation.id);
      setDeleteTarget(null);
      reload();
      onChanged?.();
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Could not delete the operation.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="rounded-2xl border border-line bg-white">
      <div className="border-b border-line px-5 py-4">
        <h2 className="text-sm font-bold text-ink">Relief operations</h2>
        <p className="mt-0.5 text-xs text-muted">Every response currently recorded in the system</p>
      </div>

      <div className="p-5">
        {loading && <LoadingBlock label="Loading operations" rows={3} />}
        {error && <ErrorBlock message={error} onRetry={reload} />}
        {data && data.length === 0 && <EmptyBlock message="No operations have been created yet." />}
      </div>

      {data && data.length > 0 &&
      <ul className="divide-y divide-line border-t border-line">
          {data.map((operation) => {
          const style = statusStyle[operation.status];
          return (
            <li key={operation.id} className="px-5 py-4 transition-colors hover:bg-gray-50/60">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${style.dot}`} />
                      <p className="truncate text-sm font-semibold text-ink">{operation.name}</p>
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${style.chip}`}>
                        {style.label}
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-muted">{operation.description}</p>
                  </div>
                  <div className="flex shrink-0 items-start gap-2">
                    <span className="pt-1 text-[11px] font-medium uppercase tracking-wide text-muted">{operation.type.replace(/_/g, ' ')}</span>
                    <button type="button" aria-label={`Edit ${operation.name}`} title="Edit operation" onClick={() => { setEditing(operation); setActionError(null); }} className="grid h-8 w-8 place-items-center rounded-lg border border-line text-muted hover:bg-brand-50 hover:text-brand-800"><PencilIcon className="h-3.5 w-3.5" /></button>
                    <button type="button" aria-label={`Delete ${operation.name}`} title="Delete operation" onClick={() => { setDeleteTarget(operation); setActionError(null); }} className="grid h-8 w-8 place-items-center rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50"><Trash2Icon className="h-3.5 w-3.5" /></button>
                  </div>
                </div>

                <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-muted">
                  <div className="inline-flex items-center gap-1.5">
                    <CalendarIcon className="h-3.5 w-3.5" />
                    {operation.startDate} → {operation.endDate}
                  </div>
                  <div className="inline-flex items-center gap-1.5">
                    <MapPinIcon className="h-3.5 w-3.5" />
                    {operation.locationCount} location{operation.locationCount === 1 ? '' : 's'}
                  </div>
                  <div className="inline-flex items-center gap-1.5">
                    <UsersIcon className="h-3.5 w-3.5" />
                    {operation.volunteersNeeded} volunteer target
                    {operation.volunteerShortfall !== undefined && ` · ${operation.volunteerShortfall} shift slots unfilled`}
                  </div>
                </dl>
                {deleteTarget?.id === operation.id && <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3">
                  <p className="text-xs font-bold text-rose-900">Delete {operation.name}?</p>
                  <p className="mt-1 text-xs leading-relaxed text-rose-800">Its volunteer shifts and sign-ups will also be deleted. Donation history will remain, but will no longer be linked to this operation.</p>
                  <div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={busyId === operation.id} onClick={() => void remove(operation)} className="rounded-lg bg-rose-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-60">{busyId === operation.id ? 'Deleting…' : 'Delete operation'}</button><button type="button" disabled={busyId === operation.id} onClick={() => setDeleteTarget(null)} className="rounded-lg border border-line bg-white px-3 py-2 text-xs font-bold text-ink">Cancel</button></div>
                </div>}
              </li>);

        })}
        </ul>
      }
      {actionError && <p role="alert" className="mx-5 mb-4 rounded-lg bg-rose-50 px-3 py-2.5 text-xs font-medium text-rose-700">{actionError}</p>}
      {editing && <EditOperationModal operation={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); onChanged?.(); }} />}
    </section>);

}
