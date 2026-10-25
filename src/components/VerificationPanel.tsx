import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeftIcon, CheckCircle2Icon, ImageIcon, XCircleIcon, XIcon } from 'lucide-react';
import { API_BASE_URL } from '../services/http';
import { adminSkillVerify, getAdminSkillVerifications } from '../services/reliefService';

interface SkillVerificationItem {
  verification_id: string | number;
  photo_filename: string;
  photo_data?: string;
  full_name: string;
  email: string;
  skill_name: string;
  status: 'pending' | 'approved' | 'rejected';
  submitted_at?: string;
  notes?: string | null;
}

type VerificationStatus = SkillVerificationItem['status'];
const statuses: VerificationStatus[] = ['pending', 'approved', 'rejected'];

const photoSource = (item: SkillVerificationItem) =>
  item.photo_data || `${API_BASE_URL.replace(/\/$/, '')}/serve_file.php?type=skill&file=${encodeURIComponent(item.photo_filename)}`;

export function VerificationPanel() {
  const [items, setItems] = useState<SkillVerificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<VerificationStatus>('pending');
  const [error, setError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<SkillVerificationItem | null>(null);
  const [photoZoom, setPhotoZoom] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await getAdminSkillVerifications() as SkillVerificationItem[]);
    } catch (cause) {
      setItems([]);
      setError(cause instanceof Error ? cause.message : 'Could not load skill verifications.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!selectedPhoto) return;
    setPhotoZoom(1);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedPhoto(null);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [selectedPhoto]);

  const counts = useMemo(() => ({
    pending: items.filter((item) => item.status === 'pending').length,
    approved: items.filter((item) => item.status === 'approved').length,
    rejected: items.filter((item) => item.status === 'rejected').length
  }), [items]);
  const visibleItems = items.filter((item) => item.status === status);

  const decide = async (id: string, decision: 'approve' | 'reject') => {
    setActionId(id);
    setError(null);
    try {
      await adminSkillVerify(id, decision);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update this verification.');
    } finally {
      setActionId(null);
    }
  };

  return (
    <section className="space-y-5">
      <header className="rounded-2xl border border-line bg-white p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-700">Volunteer credentials</p>
            <h2 className="mt-1 text-xl font-extrabold tracking-tight text-ink">Skill proof reviews</h2>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted">Review each submitted photo, then approve or reject the volunteer’s proof. Open a photo to inspect it at full size.</p>
          </div>
          <button type="button" onClick={() => void load()} disabled={loading} className="shrink-0 rounded-lg border border-line px-3 py-2 text-xs font-bold text-ink hover:bg-gray-50 disabled:opacity-50">
            {loading ? 'Refreshing…' : 'Refresh reviews'}
          </button>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-2 sm:max-w-md sm:gap-3">
          {statuses.map((entry) => (
            <div key={entry} className="rounded-xl bg-gray-50 px-3 py-2.5">
              <p className="text-lg font-extrabold leading-none text-ink">{counts[entry]}</p>
              <p className="mt-1 text-[11px] font-semibold capitalize text-muted">{entry}</p>
            </div>
          ))}
        </div>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter skill proof reviews">
          {statuses.map((entry) => (
            <button
              key={entry}
              type="button"
              role="tab"
              aria-selected={status === entry}
              onClick={() => setStatus(entry)}
              className={`rounded-full border px-4 py-2 text-sm font-bold capitalize transition-colors ${status === entry ? 'border-brand-700 bg-brand-700 text-white' : 'border-line bg-white text-ink hover:bg-gray-50'}`}>
              {entry}<span className={`ml-2 rounded-full px-1.5 py-0.5 text-[11px] ${status === entry ? 'bg-white/20' : 'bg-gray-100'}`}>{counts[entry]}</span>
            </button>
          ))}
        </div>
        {!loading && <p className="text-xs text-muted">{visibleItems.length} {status} submission{visibleItems.length === 1 ? '' : 's'}</p>}
      </div>

      {error && <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
        <span>{error}</span>
        <button type="button" onClick={() => void load()} className="shrink-0 font-bold underline">Retry</button>
      </div>}
      {loading && <div className="rounded-2xl border border-line bg-white p-8 text-center text-sm text-muted" role="status">Loading skill proof submissions…</div>}
      {!loading && !error && visibleItems.length === 0 && <div className="rounded-2xl border border-dashed border-line bg-white p-10 text-center">
        <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-gray-100 text-muted"><ImageIcon className="h-5 w-5" /></span>
        <p className="mt-3 text-sm font-bold text-ink">No {status} reviews</p>
        <p className="mt-1 text-xs text-muted">Skill proof submissions in this status will appear here.</p>
      </div>}

      {!loading && visibleItems.length > 0 && <div className="overflow-hidden rounded-2xl border border-line bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left">
            <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-muted">
              <tr>
                <th scope="col" className="px-5 py-3 font-bold">Volunteer</th>
                <th scope="col" className="px-5 py-3 font-bold">Skill proof</th>
                <th scope="col" className="px-5 py-3 font-bold">Submitted</th>
                <th scope="col" className="px-5 py-3 font-bold">Status</th>
                <th scope="col" className="px-5 py-3 text-center font-bold">Photo</th>
                {status === 'pending' && <th scope="col" className="px-5 py-3 text-right font-bold">Review</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {visibleItems.map((item) => {
                const id = String(item.verification_id);
                const isUpdating = actionId === id;
                return <tr key={id} className="align-middle hover:bg-gray-50/70">
                  <td className="px-5 py-4">
                    <p className="text-sm font-bold text-ink">{item.full_name}</p>
                    <p className="mt-0.5 text-xs text-muted">{item.email}</p>
                  </td>
                  <td className="px-5 py-4">
                    <p className="text-sm font-semibold text-ink">{item.skill_name}</p>
                    {item.notes && <p className="mt-1 max-w-xs text-xs text-muted">{item.notes}</p>}
                  </td>
                  <td className="px-5 py-4 text-xs text-muted">{item.submitted_at ? new Date(item.submitted_at).toLocaleString() : '—'}</td>
                  <td className="px-5 py-4">
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${item.status === 'pending' ? 'bg-amber-50 text-amber-800' : item.status === 'approved' ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}>{item.status}</span>
                  </td>
                  <td className="px-5 py-4 text-center">
                    <button type="button" onClick={() => setSelectedPhoto(item)} aria-label={`Open ${item.full_name}'s ${item.skill_name} photo`} title="View proof photo" className="mx-auto grid h-10 w-10 place-items-center rounded-lg border border-line text-brand-700 transition-colors hover:border-brand-300 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
                      <ImageIcon className="h-5 w-5" />
                    </button>
                  </td>
                  {status === 'pending' && <td className="px-5 py-4">
                    <div className="flex justify-end gap-2">
                      <button type="button" disabled={isUpdating} onClick={() => void decide(id, 'approve')} className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-800 disabled:cursor-wait disabled:opacity-60">
                        <CheckCircle2Icon className="h-3.5 w-3.5" />{isUpdating ? 'Saving…' : 'Approve'}
                      </button>
                      <button type="button" disabled={isUpdating} onClick={() => void decide(id, 'reject')} className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-60">
                        <XCircleIcon className="h-3.5 w-3.5" />Reject
                      </button>
                    </div>
                  </td>}
                </tr>;
              })}
            </tbody>
          </table>
        </div>
      </div>}

      {selectedPhoto && createPortal(<div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/65 p-3 backdrop-blur-[2px] sm:p-6" role="dialog" aria-modal="true" aria-label={`${selectedPhoto.full_name}'s ${selectedPhoto.skill_name} proof photo`} onClick={(event) => { if (event.target === event.currentTarget) setSelectedPhoto(null); }}>
        <section className="flex h-[min(82vh,680px)] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-white/30 bg-slate-950 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="relative z-[101] flex shrink-0 items-center justify-between gap-4 border-b border-white/15 bg-black/35 px-4 py-3 text-white sm:px-6">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">{selectedPhoto.full_name} · {selectedPhoto.skill_name}</p>
            <p className="truncate text-xs text-white/65">{selectedPhoto.email}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <div className="hidden items-center gap-1 rounded-lg bg-white/10 p-1 sm:flex" aria-label="Photo zoom controls">
              <button type="button" onClick={() => setPhotoZoom((zoom) => Math.max(0.5, Math.round((zoom - 0.25) * 100) / 100))} disabled={photoZoom <= 0.5} className="grid h-8 w-8 place-items-center rounded text-lg font-bold leading-none hover:bg-white/15 disabled:opacity-40" aria-label="Zoom out" title="Zoom out">−</button>
              <button type="button" onClick={() => setPhotoZoom(1)} className="min-w-12 rounded px-1 py-2 text-[11px] font-bold hover:bg-white/15" aria-label="Reset zoom" title="Reset zoom">{Math.round(photoZoom * 100)}%</button>
              <button type="button" onClick={() => setPhotoZoom((zoom) => Math.min(3, Math.round((zoom + 0.25) * 100) / 100))} disabled={photoZoom >= 3} className="grid h-8 w-8 place-items-center rounded text-lg font-bold leading-none hover:bg-white/15 disabled:opacity-40" aria-label="Zoom in" title="Zoom in">+</button>
            </div>
            <button type="button" autoFocus onClick={() => setSelectedPhoto(null)} className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-xs font-bold text-white hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white" aria-label="Back to reviews">
              <ArrowLeftIcon className="h-4 w-4" /> Back <XIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-slate-900/70 p-4 sm:p-6">
          <img src={photoSource(selectedPhoto)} alt={`${selectedPhoto.full_name}'s ${selectedPhoto.skill_name} verification proof`} className="max-h-full max-w-full rounded-md border border-white/30 bg-slate-950 object-contain shadow-xl transition-transform duration-150" style={{ transform: `scale(${photoZoom})` }} />
        </div>
        <div className="relative z-[101] flex shrink-0 items-center justify-center gap-3 border-t border-white/10 bg-black/35 px-3 py-2 sm:hidden">
          <button type="button" onClick={() => setPhotoZoom((zoom) => Math.max(0.5, Math.round((zoom - 0.25) * 100) / 100))} disabled={photoZoom <= 0.5} className="grid h-9 w-9 place-items-center rounded-lg bg-white/10 text-lg font-bold text-white disabled:opacity-40" aria-label="Zoom out">−</button>
          <button type="button" onClick={() => setPhotoZoom(1)} className="min-w-14 rounded-lg px-2 py-2 text-xs font-bold text-white" aria-label="Reset zoom">{Math.round(photoZoom * 100)}%</button>
          <button type="button" onClick={() => setPhotoZoom((zoom) => Math.min(3, Math.round((zoom + 0.25) * 100) / 100))} disabled={photoZoom >= 3} className="grid h-9 w-9 place-items-center rounded-lg bg-white/10 text-lg font-bold text-white disabled:opacity-40" aria-label="Zoom in">+</button>
        </div>
        <p className="shrink-0 pb-3 text-center text-[11px] text-white/55">Press Esc or click outside the photo to close</p>
        </section>
      </div>, document.body)}
    </section>
  );
}
