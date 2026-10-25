
import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart3Icon,
  CheckCircle2Icon,
  ClipboardListIcon,
  DownloadIcon,
  HeartHandshakeIcon,
  MapPinIcon,
  PackageIcon,
  PlusIcon,
  QrCodeIcon,
  SettingsIcon,
  TruckIcon,
  UserPlusIcon,
  UsersIcon } from
'lucide-react';
import { ReliefMap } from '../components/ReliefMap';
import { LocationPicker } from '../components/LocationPicker';
import { VolunteerCheckInScanner } from '../components/VolunteerCheckInScanner';
import { VerificationPanel } from '../components/VerificationPanel';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../components/StateViews';
import { shipmentLabel, shipmentStyle } from '../components/LogisticsTable';
import { useResource } from '../hooks/useResource';
import { donationStageLabel, priorityLabel, priorityStyle, stageOrder } from '../data/staticContent';
import {
  getActivity,
  getDonorLedger,
  getInventory,
  getNeededItems,
  getOperations,
  getShifts,
  getShipments,
  getVehicles,
  getLocations,
  getVolunteerRoster } from
'../services/reliefService';
import { createDriver, createVehicle, createDropoffLocation, getAdminDrivers, getSkills, manageDriver, manageVolunteer, deleteVolunteer, updateVolunteerStatus } from '../services/reliefService';
import { createShipment, deleteDonation, updateDonationStage, updateShipmentStatus } from '../services/reliefService';
import { API_BASE_URL } from '../services/http';
import type { CreateShipmentRequest, ShipmentStatus, VolunteerCheckInResult, DriverRosterEntry, Vehicle, RegistrationDetails } from '../types/domain';

export type PanelId = 'volunteers' | 'donations' | 'inventory' | 'logistics' | 'distribution' | 'reports' | 'settings' | 'verification';

interface PanelPageProps {
  panel: PanelId;
}

function PageHeader({
  eyebrow,
  title,
  description,
  icon: Icon





}: {eyebrow: string;title: string;description: string;icon: React.ComponentType<{className?: string;}>;}) {
  return (
    <div>
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand-700">
        <Icon className="h-4 w-4" /> {eyebrow}
      </div>
      <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-ink">{title}</h2>
      <p className="mt-1 text-sm text-muted">{description}</p>
    </div>);

}

function MetricCard({ label, value, detail }: {label: string;value: string;detail: string;}) {
  return (
    <div className="rounded-2xl border border-line bg-white p-5">
      <p className="text-2xl font-extrabold tracking-tight text-ink">{value}</p>
      <p className="mt-0.5 text-sm font-medium text-ink">{label}</p>
      <p className="mt-1 text-xs text-muted">{detail}</p>
    </div>);

}

function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const escape = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
  const csv = [headers, ...rows].map((row) => row.map(escape).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ---------------------------------------------------------------- */

function VolunteersPanel() {
  const roster = useResource(getVolunteerRoster);
  const shifts = useResource(getShifts);
  const skillResource = useResource(getSkills);
  const [filter, setFilter] = useState('All statuses');
  const [showScanner, setShowScanner] = useState(false);
  const [lastCheckIn, setLastCheckIn] = useState<VolunteerCheckInResult | null>(null);
  const [editingVolunteer, setEditingVolunteer] = useState<string | null>(null);
  const [volunteerDraft, setVolunteerDraft] = useState<RegistrationDetails>({ fullName: '', email: '', phone: '', address: '', emergencyContact: '', emergencyPhone: '', skillIds: [], drivingLicenseNumber: '', drivingLicenseType: '', firstAidQualification: '' });
  const [accountBusy, setAccountBusy] = useState(false);
  const [accountMessage, setAccountMessage] = useState('');
  const [accountError, setAccountError] = useState('');

  const statuses = useMemo(() => {
    const unique = new Set((roster.data ?? []).map((person) => person.status));
    return ['All statuses', ...Array.from(unique)];
  }, [roster.data]);

  const shortfall = (shifts.data ?? []).reduce(
    (sum, shift) => sum + Math.max(shift.needed - shift.filled, 0),
    0
  );
  const activeVolunteers = (roster.data ?? []).filter((person) => person.status === 'active').length;
  const filtered = (roster.data ?? []).filter(
    (person) => filter === 'All statuses' || person.status === filter
  );
  const editVolunteer = (person: NonNullable<typeof roster.data>[number]) => {
    setEditingVolunteer(person.id); setAccountMessage(''); setAccountError('');
    setVolunteerDraft({ fullName: person.fullName, email: person.email, phone: person.phone, address: person.address ?? '', emergencyContact: person.emergencyContact ?? '', emergencyPhone: person.emergencyPhone ?? '', skillIds: (skillResource.data ?? []).filter((skill) => person.skills.includes(skill.name)).map((skill) => skill.id), drivingLicenseNumber: person.drivingLicenseNumber ?? '', drivingLicenseType: person.drivingLicenseType ?? '', firstAidQualification: person.firstAidQualification ?? '' });
  };
  const saveVolunteer = async (event: React.FormEvent) => {
    event.preventDefault(); if (!editingVolunteer) return; setAccountBusy(true); setAccountError(''); setAccountMessage('');
    try { await manageVolunteer(editingVolunteer, volunteerDraft); setAccountMessage('Volunteer account updated.'); setEditingVolunteer(null); void roster.reload(); }
    catch (cause) { setAccountError(cause instanceof Error ? cause.message : 'Could not update volunteer.'); }
    finally { setAccountBusy(false); }
  };
  const toggleVolunteerStatus = async (person: NonNullable<typeof roster.data>[number]) => {
    if (person.status !== 'inactive' && !window.confirm(`Deactivate ${person.fullName}'s account? Active shift sign-ups will be cancelled; history will be retained.`)) return;
    setAccountBusy(true); setAccountError(''); setAccountMessage('');
    try { if (person.status === 'inactive') await updateVolunteerStatus(person.id, 'active'); else await deleteVolunteer(person.id); setAccountMessage(`${person.fullName}'s account is now ${person.status === 'inactive' ? 'active' : 'inactive'}.`); void roster.reload(); }
    catch (cause) { setAccountError(cause instanceof Error ? cause.message : 'Could not update volunteer status.'); }
    finally { setAccountBusy(false); }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="People power"
        title="Volunteers & shifts"
        description="Direct volunteers where their help is needed most."
        icon={UsersIcon} />
      

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard value={String(shortfall)} label="Open volunteer slots" detail="Across all scheduled shifts" />
        <MetricCard value={String(activeVolunteers)} label="Active volunteers" detail="Approved and available" />
        <MetricCard value={String((shifts.data ?? []).length)} label="Shifts scheduled" detail="All statuses" />
      </div>

      <div className="space-y-5">
        <section className="rounded-2xl border border-line bg-white p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-bold text-ink">Volunteer roster</h3>
              <p className="mt-0.5 text-xs text-muted">Registered volunteers and their skills</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                aria-label="Filter volunteers by status"
                className="rounded-lg border border-line bg-white px-2.5 py-2 text-xs font-medium text-ink outline-none focus:ring-2 focus:ring-brand-600">
                {statuses.map((status) => <option key={status}>{status}</option>)}
              </select>
              <button type="button" onClick={() => { setLastCheckIn(null); setShowScanner(true); }} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-700 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-brand-800">
                <QrCodeIcon className="h-4 w-4" /> Scan attendance
              </button>
            </div>
          </div>

          {lastCheckIn &&
          <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800" role="status">
            {lastCheckIn.fullName} checked in for {lastCheckIn.shiftName}; status is active.
          </p>
          }

          <div className="mt-4">
            {roster.loading && <LoadingBlock label="Loading roster" />}
            {roster.error && <ErrorBlock message={roster.error} onRetry={roster.reload} />}
            {roster.data && filtered.length === 0 && <EmptyBlock message="No volunteers match this filter." />}

            {filtered.length > 0 &&
            <div className="space-y-3">
                {filtered.map((person) => <React.Fragment key={person.id}>
              <div className="flex items-start gap-3 rounded-xl border border-line px-3.5 py-3">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-100 text-xs font-bold text-brand-800">
                      {person.fullName.
                  split(' ').
                  map((word) => word[0]).
                  join('').
                  slice(0, 2)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-ink">{person.fullName}</p>
                      <p className="truncate text-xs text-muted">
                        {person.phone} · {person.shiftsCompleted} shift
                        {person.shiftsCompleted === 1 ? '' : 's'} completed
                      </p>
                      {person.skills.length > 0 &&
                  <p className="mt-1 truncate text-[11px] text-muted">{person.skills.join(' · ')}</p>
                  }
                        {(person.drivingLicenseNumber || person.firstAidQualification) &&
                      <p className="mt-1 text-[11px] leading-relaxed text-muted">
                      {person.drivingLicenseNumber && `License ${person.drivingLicenseType || ''} · ${person.drivingLicenseNumber}`}
                      {person.drivingLicenseNumber && person.firstAidQualification && ' · '}
                      {person.firstAidQualification && `First aid · ${person.firstAidQualification}`}
                      </p>
                      }
                        {(person.emergencyContact || person.emergencyPhone) &&
                      <p className="mt-1 text-[11px] text-muted">Emergency contact · {[person.emergencyContact, person.emergencyPhone].filter(Boolean).join(' · ')}</p>
                      }
                    </div>
                    <span className="shrink-0 rounded-full bg-brand-50 px-2 py-1 text-[11px] font-semibold capitalize text-brand-700">
                      {person.status}
                    </span>
                    <div className="flex shrink-0 gap-2"><button type="button" onClick={() => editVolunteer(person)} className="rounded-lg border border-line px-2.5 py-1.5 text-[11px] font-bold">Edit</button><button type="button" disabled={accountBusy || person.status === 'suspended'} onClick={() => void toggleVolunteerStatus(person)} className="rounded-lg border border-line px-2.5 py-1.5 text-[11px] font-bold">{person.status === 'inactive' ? 'Activate' : 'Deactivate'}</button></div>
                  </div>
                  {editingVolunteer === person.id && <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" role="dialog" aria-modal="true" aria-labelledby="edit-volunteer-account-title"><form onSubmit={(event) => void saveVolunteer(event)} className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-line bg-white p-5 shadow-xl">
                    <div className="mb-4 flex items-start justify-between gap-4 border-b border-line pb-4"><div><p className="text-xs font-bold uppercase tracking-wider text-brand-700">Volunteer accounts</p><h2 id="edit-volunteer-account-title" className="mt-1 text-lg font-extrabold text-ink">Edit {person.fullName}</h2><p className="mt-1 text-xs text-muted">Update this volunteer’s recorded account information.</p></div><button type="button" onClick={() => setEditingVolunteer(null)} aria-label="Close" className="rounded-lg border border-line px-3 py-2 text-xs font-bold">Close</button></div>
                    <div className="grid gap-2 sm:grid-cols-2">
        <input required aria-label="Volunteer full name" value={volunteerDraft.fullName} onChange={(event) => setVolunteerDraft({ ...volunteerDraft, fullName: event.target.value })} placeholder="Full name" className="rounded-lg border border-line px-3 py-2 text-sm" />
                    <input required type="email" aria-label="Volunteer email" value={volunteerDraft.email} onChange={(event) => setVolunteerDraft({ ...volunteerDraft, email: event.target.value })} placeholder="Email" className="rounded-lg border border-line px-3 py-2 text-sm" />
                    <input aria-label="Phone" value={volunteerDraft.phone} onChange={(event) => setVolunteerDraft({ ...volunteerDraft, phone: event.target.value })} placeholder="Phone" className="rounded-lg border border-line px-3 py-2 text-sm" />
                    <input aria-label="Address" value={volunteerDraft.address} onChange={(event) => setVolunteerDraft({ ...volunteerDraft, address: event.target.value })} placeholder="Address" className="rounded-lg border border-line px-3 py-2 text-sm sm:col-span-2" />
                    <input aria-label="Emergency contact" value={volunteerDraft.emergencyContact} onChange={(event) => setVolunteerDraft({ ...volunteerDraft, emergencyContact: event.target.value })} placeholder="Emergency contact" className="rounded-lg border border-line px-3 py-2 text-sm" />
                    <input aria-label="Emergency phone" value={volunteerDraft.emergencyPhone} onChange={(event) => setVolunteerDraft({ ...volunteerDraft, emergencyPhone: event.target.value })} placeholder="Emergency phone" className="rounded-lg border border-line px-3 py-2 text-sm" />
                    <input aria-label="Driving license number" value={volunteerDraft.drivingLicenseNumber} onChange={(event) => setVolunteerDraft({ ...volunteerDraft, drivingLicenseNumber: event.target.value })} placeholder="Driving license number" className="rounded-lg border border-line px-3 py-2 text-sm" />
                    <input aria-label="Driving license type" value={volunteerDraft.drivingLicenseType} onChange={(event) => setVolunteerDraft({ ...volunteerDraft, drivingLicenseType: event.target.value })} placeholder="Driving license type" className="rounded-lg border border-line px-3 py-2 text-sm" />
                    <input aria-label="First aid qualification" value={volunteerDraft.firstAidQualification} onChange={(event) => setVolunteerDraft({ ...volunteerDraft, firstAidQualification: event.target.value })} placeholder="First aid qualification" className="rounded-lg border border-line px-3 py-2 text-sm sm:col-span-2" />
                    {skillResource.data && <fieldset className="sm:col-span-2"><legend className="text-xs font-semibold text-muted">Skills</legend><div className="mt-2 flex flex-wrap gap-2">{skillResource.data.map((skill) => <label key={skill.id} className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-3 py-2 text-xs"><input type="checkbox" checked={volunteerDraft.skillIds.includes(skill.id)} onChange={(event) => setVolunteerDraft({ ...volunteerDraft, skillIds: event.target.checked ? [...volunteerDraft.skillIds, skill.id] : volunteerDraft.skillIds.filter((id) => id !== skill.id) })} />{skill.name}</label>)}</div></fieldset>}
                    <div className="flex flex-wrap items-center gap-2 sm:col-span-2"><button disabled={accountBusy} className="rounded-lg bg-brand-800 px-3 py-2 text-xs font-bold text-white">{accountBusy ? 'Saving…' : 'Save account'}</button><button type="button" onClick={() => setEditingVolunteer(null)} className="rounded-lg border border-line px-3 py-2 text-xs font-bold">Cancel</button>{accountMessage && <span role="status" className="text-xs text-emerald-800">{accountMessage}</span>}{accountError && <span role="alert" className="text-xs text-rose-700">{accountError}</span>}</div>
                    </div>
                  </form></div>}
                </React.Fragment>)}
              </div>
            }
          </div>
        </section>
      </div>
      {showScanner &&
      <VolunteerCheckInScanner
        shifts={shifts.data ?? []}
        onClose={() => setShowScanner(false)}
        onCheckedIn={(result) => {
          setLastCheckIn(result);
          void roster.reload();
        }} />
      }
    </div>);

}

/* ---------------------------------------------------------------- */

function DonationsPanel() {
  const { data, loading, error, reload } = useResource(getDonorLedger);
  const [type, setType] = useState<'All' | 'cash' | 'goods' | 'mixed'>('All');
  const [confirming, setConfirming] = useState<string | null>(null);
  const [checkpoints, setCheckpoints] = useState<Record<string, string>>({});
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{id: string;donor: string;} | null>(null);
  const [deleting, setDeleting] = useState(false);

  const filtered = (data ?? []).filter((donor) => type === 'All' || donor.type === type);
  const cashCount = (data ?? []).filter((donor) => donor.type === 'cash').length;
  const goodsCount = (data ?? []).filter((donor) => donor.type !== 'cash').length;

  const nextDonationStage = (donor: NonNullable<typeof data>[number]) => {
    if (donor.status === 'pledged') return 'received' as const;
    if (donor.status === 'received') return 'verified' as const;
    if (donor.status === 'verified') return 'allocated' as const;
    if (donor.status === 'allocated' && donor.type === 'cash') return 'distributed' as const;
    return null;
  };

  const nextDonationAction = (donor: NonNullable<typeof data>[number]) => {
    if (donor.status === 'pledged') return donor.type === 'cash' ? 'Confirm payment received' : 'Confirm goods received';
    if (donor.status === 'received') return donor.type === 'cash' ? 'Verify payment' : 'Verify goods';
    if (donor.status === 'verified') return donor.type === 'cash' ? 'Allocate funds' : 'Allocate goods';
    if (donor.status === 'allocated' && donor.type === 'cash') return 'Complete allocation';
    return '';
  };

  const defaultCheckpoint = (donor: NonNullable<typeof data>[number]) =>
    ['pledged', 'received'].includes(donor.status) ? donor.dropOffLocation ?? donor.destination : donor.destination;

  const confirmNextStage = async (reference: string, checkpoint: string, nextStage: typeof stageOrder[number] | null) => {
    if (!nextStage) return;
    setConfirming(reference);
    setConfirmError(null);
    try {
      await updateDonationStage(reference, nextStage, `${donationStageLabel(nextStage, data?.find((entry) => entry.id === reference)?.type ?? 'goods')} confirmed at ${checkpoint}.`, checkpoint);
      reload();
    } catch (cause) {
      setConfirmError(cause instanceof Error ? cause.message : 'Could not confirm this donation.');
    } finally {
      setConfirming(null);
    }
  };

  const removeDonation = async (reference: string) => {
    setDeleting(true);
    setConfirmError(null);
    try {
      await deleteDonation(reference);
      setDeleteTarget(null);
      reload();
    } catch (cause) {
      setConfirmError(cause instanceof Error ? cause.message : 'Could not delete this donation.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Giving operations"
        title="Donations"
        description="Follow each gift from pledge and verification through allocation and delivery."
        icon={HeartHandshakeIcon} />
      

      {data &&
      <div className="grid gap-4 sm:grid-cols-3">
          <MetricCard value={String(data.length)} label="Total donations" detail="All statuses" />
          <MetricCard value={String(cashCount)} label="Cash donations" detail="GCash and bank transfers" />
          <MetricCard value={String(goodsCount)} label="In-kind donations" detail="Goods and mixed" />
        </div>
      }

      <div className="space-y-5">
        <section className="rounded-2xl border border-line bg-white">
          <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
            <div>
              <h3 className="text-sm font-bold text-ink">Donation ledger</h3>
              <p className="mt-0.5 text-xs text-muted">Newest donations first</p>
            </div>
            <select
              value={type}
              onChange={(event) => setType(event.target.value as typeof type)}
              aria-label="Filter donations by type"
              className="rounded-lg border border-line px-2 py-1.5 text-xs">
              
              <option value="All">All</option>
              <option value="cash">Cash</option>
              <option value="goods">Goods</option>
              <option value="mixed">Mixed</option>
            </select>
          </div>

          <div className="p-5">
            {loading && <LoadingBlock label="Loading donations" />}
            {error && <ErrorBlock message={error} onRetry={reload} />}
            {confirmError && <p role="alert" className="mb-3 rounded-lg bg-rose-50 px-3 py-2.5 text-xs font-medium text-rose-700">{confirmError}</p>}
            {data && filtered.length === 0 && <EmptyBlock message="No donations recorded for this filter." />}
          </div>

          {filtered.length > 0 &&
          <div className="divide-y divide-line border-t border-line">
              {filtered.map((donor) =>
            <div key={donor.id} className="px-5 py-3.5">
                  <div className="flex justify-between gap-3">
                    <p className="text-sm font-semibold text-ink">{donor.donor}</p>
                    <p className="shrink-0 text-sm font-bold text-brand-700">{donor.amount}</p>
                  </div>
                  <p className="mt-1 text-xs capitalize text-muted">
                    {donor.type} · {donor.time}
                  </p>
                  <span className="mt-2 inline-block rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold capitalize text-ink">
                    {stageOrder.includes(donor.status as typeof stageOrder[number]) ? donationStageLabel(donor.status as typeof stageOrder[number], donor.type) : donor.status.replaceAll('_', ' ')}
                  </span>
                  {donor.shipmentReference && <span className="ml-2 font-mono text-[11px] font-semibold text-brand-700">{donor.shipmentReference}</span>}
                  {donor.itemSummary && <p className="mt-2 text-xs text-muted">{donor.itemSummary}</p>}
                  <p className="mt-1 text-xs text-muted">{donor.status === 'pledged' && donor.dropOffLocation ? `Expected drop-off: ${donor.dropOffLocation}` : `Destination: ${donor.lastCheckpoint ?? donor.destination}`}</p>
                  {nextDonationStage(donor) &&
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <label className="min-w-0 flex-1">
                    <span className="sr-only">Last donation checkpoint for {donor.donor}</span>
                    <input value={checkpoints[donor.id] ?? defaultCheckpoint(donor)} onChange={(event) => setCheckpoints((current) => ({ ...current, [donor.id]: event.target.value }))}
                      placeholder="Confirm checkpoint" className="w-full rounded-lg border border-line px-3 py-2 text-xs text-ink" />
                  </label>
                  <button
                    onClick={() => void confirmNextStage(donor.id, (checkpoints[donor.id] ?? defaultCheckpoint(donor)).trim() || donor.destination, nextDonationStage(donor))}
                    disabled={confirming === donor.id}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-brand-700 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-60">
                    <CheckCircle2Icon className="h-3.5 w-3.5" />
                    {confirming === donor.id ? 'Saving...' : nextDonationAction(donor)}
                  </button>
                  </div>
                  }
                  {donor.status === 'allocated' && donor.type !== 'cash' && (!donor.shipmentReference || donor.shipmentStatus === 'cancelled') && <p className="mt-3 rounded-lg bg-brand-50 px-3 py-2 text-xs font-medium text-brand-800">Ready for shipping. Prepare a shipment in Logistics to continue.</p>}
                  {donor.donorPreference && <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900"><span className="font-bold">Donor note / payment reference:</span> {donor.donorPreference}</p>}
                  {donor.paymentProof && <a href={donor.paymentProof.startsWith('data:image/') ? donor.paymentProof : `${API_BASE_URL.replace(/\/$/, '')}/serve_file.php?type=payment&file=${encodeURIComponent(donor.paymentProof)}`} target="_blank" rel="noreferrer" className="mt-2 inline-flex rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-xs font-bold text-brand-800 hover:bg-brand-100">View GCash payment proof</a>}
                  {donor.shipmentReference ? <p className="mt-3 text-[11px] text-muted">Shipment records are retained for audit history.</p> : deleteTarget?.id === donor.id ?
                  <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label={`Confirm deletion of ${donor.donor}'s donation`}>
                    <span className="text-xs text-rose-700">Delete this donation record?</span>
                    <button onClick={() => void removeDonation(donor.id)} disabled={deleting} className="rounded-lg bg-rose-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-60">{deleting ? 'Deleting…' : 'Confirm delete'}</button>
                    <button onClick={() => setDeleteTarget(null)} disabled={deleting} className="rounded-lg border border-line px-3 py-2 text-xs font-bold text-ink">Cancel</button>
                  </div> :
                  <button onClick={() => setDeleteTarget({ id: donor.id, donor: donor.donor })} className="mt-3 ml-2 inline-flex items-center rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50">Delete</button>
                  }
                </div>
            )}
            </div>
          }
        </section>
      </div>
    </div>);

}

/* ---------------------------------------------------------------- */

const inventoryStyle = {
  available: 'text-brand-700 bg-brand-50',
  low_stock: 'text-amber-600 bg-amber-50',
  out_of_stock: 'text-rose-600 bg-rose-50'
} as const;

function InventoryPanel() {
  const { data, loading, error, reload } = useResource(getInventory);

  const low = (data ?? []).filter((item) => item.status !== 'available').length;
  const locations = new Set((data ?? []).map((item) => item.location)).size;

  const exportInventory = () => {
    if (!data) return;
    downloadCsv('relieftrack-inventory.csv', ['Item', 'Category', 'Location', 'Quantity', 'Unit', 'Minimum stock', 'Status'], data.map((item) => [item.itemName, item.category, item.location, item.quantity, item.unit, item.minimumStock, item.status]));
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Stock monitoring"
        title="Inventory"
        description="Quantities on hand against each item's minimum stock level."
        icon={PackageIcon} />
      

      {data &&
      <div className="grid gap-4 sm:grid-cols-3">
          <MetricCard value={String(data.length)} label="Tracked items" detail="Across all storage sites" />
          <MetricCard value={String(low)} label="Below minimum stock" detail="Low or out of stock" />
          <MetricCard value={String(locations)} label="Storage locations" detail="Reporting inventory" />
        </div>
      }

      {loading && <LoadingBlock label="Loading inventory" rows={4} />}
      {error && <ErrorBlock message={error} onRetry={reload} />}
      {data && data.length === 0 && <EmptyBlock message="No inventory has been recorded yet." />}

      {data && data.length > 0 &&
      <section className="overflow-hidden rounded-2xl border border-line bg-white">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <div>
              <h3 className="text-sm font-bold text-ink">Stock on hand</h3>
              <p className="mt-0.5 text-xs text-muted">Compared with the minimum stock level</p>
            </div>
            <button onClick={exportInventory} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-800">
              <DownloadIcon className="h-3.5 w-3.5" /> Export
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-muted">
                  <th className="px-5 py-2.5 font-semibold">Item</th>
                  <th className="px-4 py-2.5 font-semibold">Location</th>
                  <th className="px-4 py-2.5 font-semibold">On hand</th>
                  <th className="px-4 py-2.5 font-semibold">Minimum</th>
                  <th className="px-5 py-2.5 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.map((item) =>
              <tr key={item.id} className="transition-colors hover:bg-gray-50/60">
                    <td className="px-5 py-3">
                      <p className="font-semibold text-ink">{item.itemName}</p>
                      <p className="text-xs text-muted">{item.category}</p>
                    </td>
                    <td className="px-4 py-3 text-muted">{item.location}</td>
                    <td className="px-4 py-3 font-medium text-ink">
                      {item.quantity.toLocaleString()} {item.unit}
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {item.minimumStock.toLocaleString()} {item.unit}
                    </td>
                    <td className="px-5 py-3">
                      <span
                    className={`rounded-full px-2 py-1 text-[11px] font-semibold ${inventoryStyle[item.status]}`}>
                    
                        {item.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                  </tr>
              )}
              </tbody>
            </table>
          </div>
        </section>
      }
    </div>);

}

/* ---------------------------------------------------------------- */

function LogisticsPanel() {
  const shipments = useResource(getShipments);
  const donations = useResource(getDonorLedger);
  const locations = useResource(getLocations);
  const vehicles = useResource(getVehicles);
  const drivers = useResource(getAdminDrivers);
  const [donationReference, setDonationReference] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [sourceLocationId, setSourceLocationId] = useState('');
  const [destinationId, setDestinationId] = useState('');
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [driverName, setDriverName] = useState('');
  const [driverEmail, setDriverEmail] = useState('');
  const [driverPassword, setDriverPassword] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [driverVehicleId, setDriverVehicleId] = useState('');
  const [creatingDriver, setCreatingDriver] = useState(false);
  const [driverMessage, setDriverMessage] = useState<string | null>(null);
  const [driverError, setDriverError] = useState<string | null>(null);
  const [vehicleName, setVehicleName] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [vehicleType, setVehicleType] = useState('');
  const [vehicleCapacity, setVehicleCapacity] = useState('');
  const [creatingVehicle, setCreatingVehicle] = useState(false);
  const [vehicleMessage, setVehicleMessage] = useState<string | null>(null);
  const [vehicleError, setVehicleError] = useState<string | null>(null);
  const [showDropoffForm, setShowDropoffForm] = useState(false);
  const [dropoff, setDropoff] = useState({ name: '', address: '', city: 'Caloocan', province: 'Metro Manila', detail: '', contactPhone: '' });
  const [dropoffCoordinates, setDropoffCoordinates] = useState<[number, number]>([14.6547, 120.9830]);
  const [dropoffPinned, setDropoffPinned] = useState(false);
  const [creatingDropoff, setCreatingDropoff] = useState(false);
  const [dropoffMessage, setDropoffMessage] = useState<string | null>(null);
  const [dropoffError, setDropoffError] = useState<string | null>(null);

  const eligibleDonations = (donations.data ?? []).filter((donation) =>
    donation.status === 'allocated' && donation.type !== 'cash' && Boolean(donation.itemSummary) && (!donation.shipmentReference || donation.shipmentStatus === 'cancelled')
  );
  const selectedDonation = eligibleDonations.find((donation) => donation.id === donationReference) ?? eligibleDonations[0];
  const availableVehicles = (vehicles.data ?? []).filter((vehicle) => vehicle.status === 'available' && vehicle.hasDriverAccount);
  const vehiclesNeedingDriver = (vehicles.data ?? []).filter((vehicle) => vehicle.status === 'available' && !vehicle.hasDriverAccount);
  const destinations = (locations.data ?? []).filter((location) => ['distribution_center', 'evacuation_center', 'affected_area'].includes(location.kind));
  const pickupLocations = (locations.data ?? []).filter((location) => ['donation_center', 'warehouse'].includes(location.kind));

  useEffect(() => {
    if (!eligibleDonations.length) { if (donationReference) setDonationReference(''); return; }
    if (!eligibleDonations.some((donation) => donation.id === donationReference)) setDonationReference(eligibleDonations[0].id);
  }, [eligibleDonations, donationReference]);

  useEffect(() => {
    if (selectedDonation?.destinationLocationId) setDestinationId(selectedDonation.destinationLocationId);
    else if (destinations.length) setDestinationId(destinations[0].id);
  }, [selectedDonation?.id, selectedDonation?.destinationLocationId, locations.data]);

  useEffect(() => {
    if (selectedDonation?.dropOffLocationId) setSourceLocationId(selectedDonation.dropOffLocationId);
    else if (pickupLocations.length) setSourceLocationId(pickupLocations[0].id);
    else setSourceLocationId('');
  }, [selectedDonation?.id, selectedDonation?.dropOffLocationId, locations.data]);

  useEffect(() => {
    const timer = window.setInterval(() => { void shipments.reload(); }, 15000);
    return () => window.clearInterval(timer);
  }, [shipments.reload]);

  const rows = shipments.data ?? [];
  const inTransit = rows.filter((shipment) => shipment.status === 'in_transit').length;
  const pending = rows.filter((shipment) => shipment.status === 'pending' || shipment.status === 'packed').length;
  const delivered = rows.filter((shipment) => shipment.status === 'delivered').length;

  const prepareShipment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedDonation || !sourceLocationId || !destinationId || !vehicleId) return;
    setCreating(true); setError(null); setMessage(null);
    try {
      const payload: CreateShipmentRequest = {
        donationReference: selectedDonation.id,
        vehicleId,
        sourceLocationId,
        destinationLocationId: destinationId,
        note: `Relief shipment for ${selectedDonation.id}`
      };
      const shipment = await createShipment(payload);
      setMessage(`${shipment.reference} is ready for packing.`);
      void shipments.reload(); void donations.reload(); void vehicles.reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not prepare this shipment.');
    } finally { setCreating(false); }
  };

  const advanceShipment = async (shipmentId: string, status: ShipmentStatus) => {
    setUpdating(shipmentId); setError(null); setMessage(null);
    try {
      await updateShipmentStatus(shipmentId, status);
      setMessage(`Shipment marked ${shipmentLabel[status].toLowerCase()}.`);
      void shipments.reload(); void donations.reload(); void vehicles.reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update the shipment.');
    } finally { setUpdating(null); }
  };

  const provisionDriver = async (event: React.FormEvent) => {
    event.preventDefault(); setCreatingDriver(true); setDriverError(null); setDriverMessage(null);
    try {
      await createDriver(driverName, driverEmail, driverPassword, driverPhone, driverVehicleId);
      setDriverMessage(`Driver account created for ${driverName}. Share the sign-in details with them securely.`);
      setDriverName(''); setDriverEmail(''); setDriverPassword(''); setDriverPhone(''); setDriverVehicleId('');
      void vehicles.reload(); void drivers.reload();
    } catch (cause) { setDriverError(cause instanceof Error ? cause.message : 'Could not create driver account.'); }
    finally { setCreatingDriver(false); }
  };

  const addVehicle = async (event: React.FormEvent) => {
    event.preventDefault(); setCreatingVehicle(true); setVehicleError(null); setVehicleMessage(null);
    try {
      await createVehicle(vehicleName, vehiclePlate, vehicleType, vehicleCapacity);
      setVehicleMessage(`${vehicleName} was added to the fleet and is available for driver assignment.`);
      setVehicleName(''); setVehiclePlate(''); setVehicleType(''); setVehicleCapacity('');
      void vehicles.reload();
    } catch (cause) { setVehicleError(cause instanceof Error ? cause.message : 'Could not add vehicle.'); }
    finally { setCreatingVehicle(false); }
  };

  const addDropoff = async (event: React.FormEvent) => {
    event.preventDefault(); setDropoffError(null); setDropoffMessage(null);
    if (!dropoffPinned) { setDropoffError('Search for the address and select a result, or click the exact location on the map.'); return; }
    setCreatingDropoff(true);
    try {
      await createDropoffLocation({ ...dropoff, latitude: dropoffCoordinates[0], longitude: dropoffCoordinates[1] });
      setDropoffMessage(`${dropoff.name} is now available as a donation drop-off location.`);
      setDropoff({ name: '', address: '', city: 'Caloocan', province: 'Metro Manila', detail: '', contactPhone: '' });
      setDropoffCoordinates([14.6547, 120.9830]);
      setDropoffPinned(false);
      setShowDropoffForm(false); void locations.reload();
    } catch (cause) { setDropoffError(cause instanceof Error ? cause.message : 'Could not add drop-off location.'); }
    finally { setCreatingDropoff(false); }
  };

  const nextShipmentStatus: Partial<Record<ShipmentStatus, ShipmentStatus>> = { pending: 'packed' };

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Movement control" title="Logistics" description="Pack, dispatch, and confirm delivery for allocated goods donations." icon={TruckIcon} />
      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard value={String(inTransit)} label="In transit" detail="Driver GPS can be shared" />
        <MetricCard value={String(pending)} label="Needs action" detail="Packing or dispatch" />
        <MetricCard value={String(delivered)} label="Delivered" detail="Completed shipments" />
      </div>

      <section className="rounded-2xl border border-line bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-sm font-bold text-ink">Donation drop-off locations</h3><p className="mt-1 text-xs leading-relaxed text-muted">Add a center where donors can bring goods. It will appear in donation choices and on the relief map.</p></div><button type="button" onClick={() => { setDropoff({ name: '', address: '', city: 'Caloocan', province: 'Metro Manila', detail: '', contactPhone: '' }); setDropoffCoordinates([14.6547, 120.9830]); setDropoffPinned(false); setDropoffError(null); setShowDropoffForm(true); }} className="inline-flex items-center gap-2 rounded-lg bg-brand-800 px-4 py-2.5 text-xs font-bold text-white"><PlusIcon className="h-4 w-4" />Add drop-off</button></div>
        {dropoffMessage && <p role="status" className="mt-3 text-xs font-medium text-emerald-800">{dropoffMessage}</p>}{dropoffError && !showDropoffForm && <p role="alert" className="mt-3 text-xs font-medium text-rose-700">{dropoffError}</p>}
        <ul className="mt-4 divide-y divide-line rounded-lg border border-line">{pickupLocations.map((location) => <li key={location.id} className="flex flex-wrap justify-between gap-2 px-3 py-2.5 text-xs"><span className="font-semibold text-ink">{location.name}</span><span className="text-muted">{location.address}, {location.city}</span></li>)}</ul>
      </section>

      {showDropoffForm && <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" role="dialog" aria-modal="true" aria-labelledby="add-dropoff-title"><section className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-line bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-5"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-700">Logistics</p><h2 id="add-dropoff-title" className="mt-1 text-xl font-extrabold text-ink">Add drop-off location</h2><p className="mt-1 text-sm text-muted">Enter the center details and map coordinates.</p></div><button type="button" onClick={() => setShowDropoffForm(false)} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-gray-100">×</button></div>
        <form onSubmit={(event) => void addDropoff(event)} className="grid gap-3 px-6 py-5 sm:grid-cols-2">
          <input required maxLength={150} aria-label="Drop-off name" placeholder="Center name" value={dropoff.name} onChange={(event) => setDropoff({ ...dropoff, name: event.target.value })} className="rounded-lg border border-line px-3 py-2.5 text-sm" />
          <input required maxLength={255} aria-label="Address" placeholder="Street address" value={dropoff.address} onChange={(event) => setDropoff({ ...dropoff, address: event.target.value })} className="rounded-lg border border-line px-3 py-2.5 text-sm" />
          <input required maxLength={100} aria-label="City" placeholder="City" value={dropoff.city} onChange={(event) => setDropoff({ ...dropoff, city: event.target.value })} className="rounded-lg border border-line px-3 py-2.5 text-sm" />
          <input required maxLength={100} aria-label="Province" placeholder="Province" value={dropoff.province} onChange={(event) => setDropoff({ ...dropoff, province: event.target.value })} className="rounded-lg border border-line px-3 py-2.5 text-sm" />
          <div className="sm:col-span-2"><p className="text-sm font-bold text-ink">Operation checkpoint</p><p className="mb-2 mt-1 text-xs leading-relaxed text-muted">Search for an address, select the right result, then fine-tune the pin on the map. Pin the exact Caloocan location where volunteers will work or donations will be received.</p><LocationPicker coordinates={dropoffCoordinates} onChange={(coordinates) => { setDropoffCoordinates(coordinates); setDropoffPinned(true); }} onAddressResolved={(address) => setDropoff({ ...dropoff, address })} /><p className={`mt-2 text-xs font-semibold ${dropoffPinned ? 'text-emerald-800' : 'text-muted'}`}>{dropoffPinned ? 'Checkpoint selected. You can still adjust the pin.' : 'Select a search result or click the map to set the checkpoint.'}</p></div>
          <input maxLength={30} aria-label="Contact phone" placeholder="Contact phone (optional)" value={dropoff.contactPhone} onChange={(event) => setDropoff({ ...dropoff, contactPhone: event.target.value })} className="rounded-lg border border-line px-3 py-2.5 text-sm" />
          <input aria-label="Hours or details" placeholder="Hours or details (optional)" value={dropoff.detail} onChange={(event) => setDropoff({ ...dropoff, detail: event.target.value })} className="rounded-lg border border-line px-3 py-2.5 text-sm" />
          {dropoffError && <p role="alert" className="text-xs font-medium text-rose-700 sm:col-span-2">{dropoffError}</p>}
          <div className="flex justify-end gap-2 border-t border-line pt-4 sm:col-span-2"><button type="button" disabled={creatingDropoff} onClick={() => setShowDropoffForm(false)} className="rounded-lg border border-line px-4 py-2.5 text-xs font-bold">Cancel</button><button disabled={creatingDropoff} className="rounded-lg bg-brand-800 px-4 py-2.5 text-xs font-bold text-white">{creatingDropoff ? 'Adding…' : 'Create drop-off'}</button></div>
        </form>
      </section></div>}

      <section className="rounded-2xl border border-line bg-white p-5">
        <div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700"><TruckIcon className="h-5 w-5" /></span><div><h3 className="text-sm font-bold text-ink">Fleet vehicles</h3><p className="mt-1 text-xs leading-relaxed text-muted">Add a vehicle to make it available for driver assignment and shipments.</p></div></div>
        <form onSubmit={(event) => void addVehicle(event)} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <input required maxLength={100} aria-label="Vehicle name" placeholder="Vehicle name" value={vehicleName} onChange={(event) => setVehicleName(event.target.value)} className="rounded-lg border border-line px-3 py-2.5 text-sm" />
          <input required maxLength={30} aria-label="Plate number" placeholder="Plate number" value={vehiclePlate} onChange={(event) => setVehiclePlate(event.target.value)} className="rounded-lg border border-line px-3 py-2.5 text-sm uppercase" />
          <input maxLength={100} aria-label="Vehicle type" placeholder="Vehicle type (optional)" value={vehicleType} onChange={(event) => setVehicleType(event.target.value)} className="rounded-lg border border-line px-3 py-2.5 text-sm" />
          <input maxLength={100} aria-label="Vehicle capacity" placeholder="Capacity (optional)" value={vehicleCapacity} onChange={(event) => setVehicleCapacity(event.target.value)} className="rounded-lg border border-line px-3 py-2.5 text-sm" />
          <div className="flex flex-wrap items-center gap-3 sm:col-span-2 lg:col-span-4"><button disabled={creatingVehicle} className="inline-flex items-center gap-2 rounded-lg bg-brand-800 px-4 py-2.5 text-xs font-bold text-white hover:bg-brand-900 disabled:opacity-50"><PlusIcon className="h-4 w-4" />{creatingVehicle ? 'Adding…' : 'Add vehicle'}</button>{vehicleError && <p role="alert" className="text-xs font-medium text-rose-700">{vehicleError}</p>}{vehicleMessage && <p role="status" className="text-xs font-medium text-emerald-800">{vehicleMessage}</p>}</div>
        </form>
        {(vehicles.data ?? []).length > 0 && <ul className="mt-4 divide-y divide-line rounded-lg border border-line">{(vehicles.data ?? []).map((vehicle) => <li key={vehicle.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-xs"><span className="font-semibold text-ink">{vehicle.name} · {vehicle.plateNumber}</span><span className="text-muted">{vehicle.driverName || 'No driver assigned'} · {vehicle.status.replace('_', ' ')}</span></li>)}</ul>}
      </section>

      <DriverAccountManagement drivers={drivers.data ?? []} vehicles={vehicles.data ?? []} loading={drivers.loading} error={drivers.error} reload={drivers.reload} />

      <section className="rounded-2xl border border-line bg-white p-5">
        <div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700"><UserPlusIcon className="h-5 w-5" /></span><div><h3 className="text-sm font-bold text-ink">Driver accounts</h3><p className="mt-1 text-xs leading-relaxed text-muted">Create a sign-in and attach it to a vehicle. Drivers can then see that vehicle’s active routes and share GPS from their phone.</p></div></div>
        <form onSubmit={(event) => void provisionDriver(event)} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <input required aria-label="Driver full name" placeholder="Driver full name" value={driverName} onChange={(event) => setDriverName(event.target.value)} className="rounded-lg border border-line px-3 py-2.5 text-sm" />
          <input required type="email" aria-label="Driver email" placeholder="Driver email" value={driverEmail} onChange={(event) => setDriverEmail(event.target.value)} className="rounded-lg border border-line px-3 py-2.5 text-sm" />
          <input required minLength={10} type="password" aria-label="Temporary password" placeholder="Temporary password (10+ chars)" value={driverPassword} onChange={(event) => setDriverPassword(event.target.value)} className="rounded-lg border border-line px-3 py-2.5 text-sm" />
          <input aria-label="Driver phone" placeholder="Phone (optional)" value={driverPhone} onChange={(event) => setDriverPhone(event.target.value)} className="rounded-lg border border-line px-3 py-2.5 text-sm" />
          <select required aria-label="Assign vehicle" value={driverVehicleId} onChange={(event) => setDriverVehicleId(event.target.value)} className="rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-ink"><option value="">Assign available vehicle</option>{vehiclesNeedingDriver.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.name} · {vehicle.plateNumber}</option>)}</select>
          <div className="flex flex-wrap items-center gap-3 sm:col-span-2 lg:col-span-5"><button disabled={creatingDriver || !driverVehicleId} className="inline-flex items-center gap-2 rounded-lg bg-brand-800 px-4 py-2.5 text-xs font-bold text-white hover:bg-brand-900 disabled:opacity-50"><UserPlusIcon className="h-4 w-4" />{creatingDriver ? 'Creating…' : 'Create driver account'}</button>{!vehiclesNeedingDriver.length && <p className="text-xs text-muted">No unassigned vehicles are currently available.</p>}{driverError && <p role="alert" className="text-xs font-medium text-rose-700">{driverError}</p>}{driverMessage && <p role="status" className="text-xs font-medium text-emerald-800">{driverMessage}</p>}</div>
        </form>
      </section>

      <div className="space-y-5">
        <section className="rounded-2xl border border-line bg-white p-5">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700"><PlusIcon className="h-5 w-5" /></span>
            <div><h3 className="text-sm font-bold text-ink">Prepare a shipment</h3><p className="mt-1 text-xs leading-relaxed text-muted">Only verified and allocated goods can be packed. Existing donor pickup details are used; choose a pickup site for older donations without one.</p></div>
          </div>
          <form onSubmit={(event) => void prepareShipment(event)} className="mt-5 space-y-4">
            {(donations.loading || vehicles.loading || locations.loading) && <LoadingBlock label="Loading donation, vehicle, and destination options" />}
            {donations.error && <ErrorBlock message={donations.error} onRetry={donations.reload} />}
            {vehicles.error && <ErrorBlock message={vehicles.error} onRetry={vehicles.reload} />}
            {locations.error && <ErrorBlock message={locations.error} onRetry={locations.reload} />}
            <label className="block text-xs font-semibold text-muted">Allocated donation
              <select value={selectedDonation?.id ?? ''} onChange={(event) => setDonationReference(event.target.value)} disabled={!eligibleDonations.length} className="mt-1.5 w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-ink">
                {!eligibleDonations.length && <option value="">No donations ready for shipment</option>}
                {eligibleDonations.map((donation) => <option key={donation.id} value={donation.id}>{donation.id} · {donation.donor} · {donation.itemSummary || donation.type}</option>)}
              </select>
            </label>
            {selectedDonation && <div className="grid gap-3 rounded-xl bg-gray-50 p-3 sm:grid-cols-2">
              {selectedDonation.dropOffLocationId ? <div><p className="text-[10px] font-bold uppercase tracking-wide text-muted">Pickup</p><p className="mt-1 text-xs font-semibold text-ink">{selectedDonation.dropOffLocation || pickupLocations.find((site) => site.id === selectedDonation.dropOffLocationId)?.name || 'Selected drop-off'}</p></div> : <label className="text-[10px] font-bold uppercase tracking-wide text-muted">Choose pickup site for this donation
                <select required value={sourceLocationId} onChange={(event) => setSourceLocationId(event.target.value)} className="mt-1 w-full rounded-lg border border-line bg-white px-2 py-2 text-xs font-semibold normal-case text-ink">
                  <option value="">Select a donation center or warehouse</option>
                  {pickupLocations.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}
                </select>
              </label>}
              {selectedDonation.destinationLocationId ? <div><p className="text-[10px] font-bold uppercase tracking-wide text-muted">Delivery area</p><p className="mt-1 text-xs font-semibold text-ink">{selectedDonation.destination}</p></div> : <label className="text-[10px] font-bold uppercase tracking-wide text-muted">Delivery area
                <select value={destinationId} onChange={(event) => setDestinationId(event.target.value)} className="mt-1 w-full rounded-lg border border-line bg-white px-2 py-2 text-xs font-semibold normal-case text-ink">
                  {destinations.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}
                </select>
              </label>}
              <p className="text-xs text-muted sm:col-span-2">{selectedDonation.itemSummary}</p>
            </div>}
            <label className="block text-xs font-semibold text-muted">Available vehicle
              <select required value={vehicleId} onChange={(event) => setVehicleId(event.target.value)} className="mt-1.5 w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-ink">
                <option value="">Choose a vehicle</option>
                {availableVehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.name} · {vehicle.plateNumber} · {vehicle.driverName}</option>)}
              </select>
            </label>
            {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2.5 text-xs font-medium text-rose-700">{error}</p>}
            {message && <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2.5 text-xs font-medium text-emerald-800">{message}</p>}
            <button type="submit" disabled={creating || !selectedDonation || !sourceLocationId || !vehicleId || !destinationId || !availableVehicles.length} className="inline-flex items-center gap-2 rounded-lg bg-brand-700 px-4 py-2.5 text-xs font-bold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50">
              <TruckIcon className="h-4 w-4" /> {creating ? 'Preparing...' : 'Prepare shipment'}
            </button>
          </form>
          {!availableVehicles.length && <p className="mt-3 text-xs text-amber-700">No available vehicle has a driver account yet. Create a driver account above and assign an available vehicle first.</p>}
        </section>
      </div>

      <section className="rounded-2xl border border-line bg-white">
        <div className="border-b border-line px-5 py-4"><h3 className="text-sm font-bold text-ink">Shipment workflow</h3><p className="mt-1 text-xs text-muted">Pack shipments here. Drivers start trips and share GPS from their portal. Staff can follow live markers on the Distribution Map.</p></div>
        {error && <p role="alert" className="border-b border-rose-200 bg-rose-50 px-5 py-3 text-xs font-medium text-rose-700">Could not update shipment: {error}</p>}
        {message && <p role="status" className="border-b border-emerald-200 bg-emerald-50 px-5 py-3 text-xs font-medium text-emerald-800">{message}</p>}
        {shipments.loading && <div className="p-5"><LoadingBlock label="Loading shipments" /></div>}
        {shipments.error && <div className="p-5"><ErrorBlock message={shipments.error} onRetry={shipments.reload} /></div>}
        {shipments.data && rows.length === 0 && <div className="p-5"><EmptyBlock message="No shipments have been prepared yet." /></div>}
        {rows.length > 0 && <div className="divide-y divide-line">
          {rows.map((shipment) => <article key={shipment.id} className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2"><p className="font-mono text-xs font-bold text-ink">{shipment.reference}</p><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${shipmentStyle[shipment.status]}`}>{shipmentLabel[shipment.status]}</span>{shipment.donationReference && <span className="text-[11px] font-semibold text-brand-700">Donation {shipment.donationReference}</span>}</div>
              <p className="mt-1 text-sm font-semibold text-ink">{shipment.origin} → {shipment.destination}</p>
              <p className="mt-1 text-xs text-muted">{shipment.donor ? `${shipment.donor} · ` : ''}{shipment.vehicle} · {shipment.plateNumber} · {shipment.itemDescription}</p>
              <p className="mt-1 text-xs text-muted">{shipment.status === 'packed' ? 'Waiting for the assigned driver to start the trip.' : shipment.status === 'in_transit' ? 'Driver controls trip progress and GPS sharing.' : shipment.note}{shipment.locationUpdatedAt ? ` · GPS ${new Date(shipment.locationUpdatedAt).toLocaleTimeString()}` : ''}</p>
              {shipment.locationUpdatedAt && shipment.coordinates && <a href={`https://www.google.com/maps/search/?api=1&query=${shipment.coordinates[0]},${shipment.coordinates[1]}`} target="_blank" rel="noreferrer" className="mt-1 inline-flex text-xs font-bold text-brand-700 underline">Open last driver location</a>}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {nextShipmentStatus[shipment.status] && <button type="button" disabled={updating === shipment.id} onClick={() => void advanceShipment(shipment.id, nextShipmentStatus[shipment.status]!)} className="rounded-lg bg-brand-700 px-3 py-2 text-xs font-bold text-white hover:bg-brand-800 disabled:opacity-50">{updating === shipment.id ? 'Saving...' : `Mark ${shipmentLabel[nextShipmentStatus[shipment.status]!].toLowerCase()}`}</button>}
              {(shipment.status === 'pending' || shipment.status === 'packed') && <button type="button" disabled={updating === shipment.id} onClick={() => void advanceShipment(shipment.id, 'cancelled')} className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50">Cancel</button>}
            </div>
          </article>)}
        </div>}
      </section>
    </div>);
}

function DriverAccountManagement({ drivers, vehicles, loading, error, reload }: { drivers: DriverRosterEntry[]; vehicles: Vehicle[]; loading: boolean; error?: string; reload: () => void }) {
  const [editing, setEditing] = useState<DriverRosterEntry | null>(null);
  const [draft, setDraft] = useState({ fullName: '', email: '', phone: '', drivingLicenseNumber: '', drivingLicenseType: '', status: 'active' as 'pending' | 'active' | 'inactive', vehicleId: '', newPassword: '' });
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState(''); const [actionError, setActionError] = useState('');
  const startEdit = (driver: DriverRosterEntry) => { setEditing(driver); setDraft({ fullName: driver.fullName, email: driver.email, phone: driver.phone ?? '', drivingLicenseNumber: driver.drivingLicenseNumber ?? '', drivingLicenseType: driver.drivingLicenseType ?? '', status: driver.status, vehicleId: driver.vehicleId ?? '', newPassword: '' }); setMessage(''); setActionError(''); };
  const save = async (event: React.FormEvent) => { event.preventDefault(); if (!editing) return; setBusy(true); setMessage(''); setActionError(''); try { await manageDriver({ driverId: editing.id, ...draft, ...(draft.vehicleId ? { vehicleId: draft.vehicleId } : {}) }); setMessage(`Saved ${draft.fullName}'s account.`); setEditing(null); reload(); } catch (cause) { setActionError(cause instanceof Error ? cause.message : 'Could not update driver account.'); } finally { setBusy(false); } };
  return <section className="rounded-2xl border border-line bg-white p-5"><div className="flex items-center justify-between gap-3"><div><h3 className="text-sm font-bold text-ink">Driver account management</h3><p className="mt-1 text-xs text-muted">Edit driver details, reset passwords, deactivate accounts, and assign vehicles.</p></div><button type="button" onClick={reload} className="rounded-lg border border-line px-3 py-2 text-xs font-bold">Refresh</button></div>
    {loading && <LoadingBlock label="Loading driver accounts" />}{error && <ErrorBlock message={error} onRetry={reload} />}{message && <p role="status" className="mt-3 text-xs text-emerald-800">{message}</p>}{actionError && <p role="alert" className="mt-3 text-xs text-rose-700">{actionError}</p>}
    {!loading && !drivers.length && <p className="mt-4 text-sm text-muted">No driver accounts yet. Create one above; an administrator assigns its vehicle.</p>}
    <div className="mt-3 divide-y divide-line">{drivers.map((driver) => <div key={driver.id} className="py-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-semibold text-ink">{driver.fullName} <span className="ml-2 rounded-full bg-gray-100 px-2 py-1 text-[10px] capitalize text-muted">{driver.status}</span></p><p className="mt-1 text-xs text-muted">{driver.email} · {driver.vehicleName} {driver.plateNumber && `· ${driver.plateNumber}`} · {driver.completedDeliveries} completed deliveries</p></div><button type="button" onClick={() => startEdit(driver)} className="rounded-lg border border-line px-3 py-2 text-xs font-bold">Edit account</button></div>
      {editing?.id === driver.id && <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" role="dialog" aria-modal="true" aria-labelledby="edit-driver-account-title"><section className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-line bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-5"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-700">Driver accounts</p><h2 id="edit-driver-account-title" className="mt-1 text-xl font-extrabold text-ink">Edit {driver.fullName}</h2><p className="mt-1 text-sm text-muted">Update driver information, access, and vehicle assignment.</p></div><button type="button" onClick={() => setEditing(null)} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-gray-100">×</button></div>
        <form onSubmit={(event) => void save(event)} className="grid gap-3 px-6 py-5 sm:grid-cols-2">
        <input required aria-label="Driver name" value={draft.fullName} onChange={(event) => setDraft({ ...draft, fullName: event.target.value })} placeholder="Full name" className="rounded-lg border border-line px-3 py-2 text-sm" />
        <input required type="email" aria-label="Driver email" value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} placeholder="Email" className="rounded-lg border border-line px-3 py-2 text-sm" />
        <input aria-label="Driver phone" value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} placeholder="Phone" className="rounded-lg border border-line px-3 py-2 text-sm" />
        <input aria-label="License number" value={draft.drivingLicenseNumber} onChange={(event) => setDraft({ ...draft, drivingLicenseNumber: event.target.value })} placeholder="License number" className="rounded-lg border border-line px-3 py-2 text-sm" />
        <input aria-label="License type" value={draft.drivingLicenseType} onChange={(event) => setDraft({ ...draft, drivingLicenseType: event.target.value })} placeholder="License type" className="rounded-lg border border-line px-3 py-2 text-sm" />
        <select aria-label="Driver status" value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as 'pending' | 'active' | 'inactive' })} className="rounded-lg border border-line bg-white px-3 py-2 text-sm"><option value="pending">Pending approval</option><option value="active">Active</option><option value="inactive">Inactive</option></select>
        <select aria-label="Assign vehicle" value={draft.vehicleId} onChange={(event) => setDraft({ ...draft, vehicleId: event.target.value })} className="rounded-lg border border-line bg-white px-3 py-2 text-sm"><option value="">No vehicle</option>{vehicles.filter((vehicle) => !vehicle.hasDriverAccount || vehicle.id === driver.vehicleId).map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.name} · {vehicle.plateNumber}</option>)}</select>
        <input minLength={10} type="password" aria-label="Reset password" value={draft.newPassword} onChange={(event) => setDraft({ ...draft, newPassword: event.target.value })} placeholder="New password (optional, 10+ chars)" className="rounded-lg border border-line px-3 py-2 text-sm sm:col-span-2" />
        {actionError && <p role="alert" className="text-xs text-rose-700 sm:col-span-2">{actionError}</p>}
        <div className="flex justify-end gap-2 border-t border-line pt-4 sm:col-span-2"><button type="button" disabled={busy} onClick={() => setEditing(null)} className="rounded-lg border border-line px-4 py-2.5 text-xs font-bold">Cancel</button><button disabled={busy} className="rounded-lg bg-brand-800 px-4 py-2.5 text-xs font-bold text-white">{busy ? 'Saving…' : 'Save changes'}</button></div>
      </form></section></div>}
    </div>)}</div>
  </section>;
}

/* ---------------------------------------------------------------- */

function DistributionPanel() {
  const needs = useResource(getNeededItems);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Field coverage"
        title="Distribution map"
        description="Every relief site, donation center, warehouse, and vehicle on one map."
        icon={MapPinIcon} />
      

      <ReliefMap heightClassName="h-[540px]" showVehicles />

      <section className="rounded-2xl border border-line bg-white">
        <div className="border-b border-line px-5 py-4">
          <h3 className="text-sm font-bold text-ink">Outstanding needs by site</h3>
          <p className="mt-0.5 text-xs text-muted">From the needed items table</p>
        </div>

        <div className="p-5">
          {needs.loading && <LoadingBlock label="Loading needs" rows={3} />}
          {needs.error && <ErrorBlock message={needs.error} onRetry={needs.reload} />}
          {needs.data && needs.data.length === 0 && <EmptyBlock message="No outstanding needs recorded." />}
        </div>

        {needs.data && needs.data.length > 0 &&
        <div className="divide-y divide-line border-t border-line">
            {needs.data.map((need) => {
            const percent =
            need.quantityNeeded > 0 ?
            Math.min(Math.round(need.quantityReceived / need.quantityNeeded * 100), 100) :
            0;
            return (
              <div key={need.id} className="grid gap-3 px-5 py-4 md:grid-cols-[minmax(0,1fr)_160px_140px]">
                  <div>
                    <p className="text-sm font-semibold text-ink">{need.itemName}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      {need.location} · {need.quantityReceived}/{need.quantityNeeded} received
                    </p>
                  </div>
                  <div className="h-2 self-center overflow-hidden rounded-full bg-gray-100">
                    <div
                    className={`h-full rounded-full ${percent >= 80 ? 'bg-brand-600' : 'bg-amber-500'}`}
                    style={{ width: `${percent}%` }} />
                  
                  </div>
                  <span
                  className={`justify-self-start self-center rounded-full px-2.5 py-1 text-[11px] font-bold ${priorityStyle[need.priority]}`}>
                  
                    {priorityLabel[need.priority]}
                  </span>
                </div>);

          })}
          </div>
        }
      </section>
    </div>);

}

/* ---------------------------------------------------------------- */

function ReportsPanel() {
  const operations = useResource(getOperations);
  const shifts = useResource(getShifts);
  const volunteers = useResource(getVolunteerRoster);
  const donations = useResource(getDonorLedger);
  const inventory = useResource(getInventory);
  const needs = useResource(getNeededItems);
  const shipments = useResource(getShipments);
  const activity = useResource(getActivity);

  const reports: [string, string, string][] = [
    ['Operations summary', 'Shifts, sign-ups, and activity per operation', 'operations'],
    ['Donation accountability', 'Cash, goods, and their recorded status changes', 'donations'],
    ['Inventory & needs', 'Stock levels against minimum stock and outstanding needs', 'inventory']
  ];

  const getReport = (key: string): { headers: string[]; rows: (string | number)[][] } => {
    if (key === 'operations') return {
      headers: ['ID', 'Operation', 'Description', 'Type', 'Status', 'Start date', 'End date', 'Locations', 'Volunteers needed'],
      rows: (operations.data ?? []).map((item) => [item.id, item.name, item.description, item.type, item.status, item.startDate, item.endDate, item.locationCount, item.volunteersNeeded])
    };
    if (key === 'donations') return {
      headers: ['Reference', 'Donor', 'Type', 'Amount', 'Destination', 'Status', 'Time'],
      rows: (donations.data ?? []).map((item) => [item.id, item.donor, item.type, item.amount, item.destination, item.status, item.time])
    };
    return {
      headers: ['Item', 'Category', 'Location', 'On hand', 'Unit', 'Minimum stock', 'Inventory status', 'Needed', 'Received', 'Priority', 'Need status'],
      rows: (inventory.data ?? []).map((item) => {
        const need = needs.data?.find((entry) => entry.itemName === item.itemName);
        return [item.itemName, item.category, item.location, item.quantity, item.unit, item.minimumStock, item.status, need?.quantityNeeded ?? '', need?.quantityReceived ?? '', need?.priority ?? '', need?.status ?? ''];
      })
    };
  };

  const downloadReport = (key: string) => {
    const report = getReport(key);
    downloadCsv(`${key}-report.csv`, report.headers, report.rows);
  };

  const downloadAllReports = () => {
    const sections: (string | number)[][] = [];
    const addSection = (title: string, headers: string[], rows: (string | number)[][]) => {
      sections.push([title], headers, ...rows, []);
    };
    const operationReport = getReport('operations');
    const donationReport = getReport('donations');
    const inventoryReport = getReport('inventory');
    addSection('OPERATIONS SUMMARY', operationReport.headers, operationReport.rows);
    addSection('DONATION ACCOUNTABILITY', donationReport.headers, donationReport.rows);
    addSection('INVENTORY & NEEDS', inventoryReport.headers, inventoryReport.rows);
    addSection('VOLUNTEERS', ['ID', 'Name', 'Email', 'Phone', 'Status', 'Skills', 'Shifts completed'], (volunteers.data ?? []).map((item) => [item.id, item.fullName, item.email, item.phone, item.status, item.skills.join(' | '), item.shiftsCompleted]));
    addSection('SHIFTS', ['ID', 'Shift', 'Location', 'City', 'Date', 'Window', 'Filled', 'Needed', 'Status'], (shifts.data ?? []).map((item) => [item.id, item.name, item.location, item.city, item.date, item.window, item.filled, item.needed, item.status]));
    addSection('SHIPMENTS', ['Reference', 'Origin', 'Destination', 'Cargo', 'Quantity', 'Vehicle', 'Plate', 'Status', 'Note'], (shipments.data ?? []).map((item) => [item.reference, item.origin, item.destination, item.itemDescription, item.quantity, item.vehicle, item.plateNumber, item.status, item.note]));
    addSection('ACTIVITY LOG', ['ID', 'Action', 'Description', 'Module', 'Staff', 'Time'], (activity.data ?? []).map((item) => [item.id, item.action, item.description, item.module, item.staff, item.time]));
    downloadCsv('relieftrack-all-reports.csv', ['Section', 'Data'], sections);
  };

  const loading = [operations, shifts, volunteers, donations, inventory, needs, shipments, activity].some((resource) => resource.loading);


  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Accountability"
        title="Reports"
        description="Export a transparent view of relief activity for partners and donors."
        icon={BarChart3Icon} />
      

      <section className="rounded-2xl border border-line bg-white p-5">
        <h3 className="text-sm font-bold text-ink">Ready-to-export reports</h3>
        <p className="mt-0.5 text-xs text-muted">Each report is generated from the live database.</p>
        <button onClick={downloadAllReports} disabled={loading} className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-brand-700 px-3 py-2 text-xs font-bold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-60">
          <DownloadIcon className="h-3.5 w-3.5" /> {loading ? 'Preparing reports...' : 'Download all reports'}
        </button>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {reports.map(([title, detail, key]) =>
          <article key={title} className="rounded-xl border border-line p-4">
              <ClipboardListIcon className="h-5 w-5 text-brand-700" />
              <h4 className="mt-3 text-sm font-bold text-ink">{title}</h4>
              <p className="mt-1 text-xs leading-relaxed text-muted">{detail}</p>
              <button onClick={() => downloadReport(key)} disabled={loading} className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-800 disabled:opacity-50">
                <DownloadIcon className="h-3.5 w-3.5" /> Download CSV
              </button>
            </article>
          )}
        </div>
      </section>
    </div>);

}

/* ---------------------------------------------------------------- */

function SettingsPanel() {
  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Workspace"
        title="Settings"
        description="Configuration and access options for the operations team."
        icon={SettingsIcon} />

      <section className="rounded-2xl border border-line bg-white p-5">
        <h3 className="text-sm font-bold text-ink">Map and notification preferences</h3>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          Map visibility and alert delivery are currently controlled by the operations data. Personal preference controls are not available yet.
        </p>
      </section>

      <section className="rounded-2xl border border-line bg-white p-5">
        <h3 className="text-sm font-bold text-ink">Staff access</h3>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          Staff invitations are not available in this workspace. Ask an administrator to provision coordinator access.
        </p>
      </section>
    </div>);

}

/* ---------------------------------------------------------------- */
export function PanelPage({ panel }: PanelPageProps) {
  const panels: Record<PanelId, React.ReactNode> = {
    volunteers: <VolunteersPanel />,
    donations: <DonationsPanel />,
    inventory: <InventoryPanel />,
    logistics: <LogisticsPanel />,
    distribution: <DistributionPanel />,
    reports: <ReportsPanel />,
    settings: <SettingsPanel />,
    verification: <VerificationPanel />
  };

  return <div className="max-w-[1400px] p-5 md:p-7">{panels[panel]}</div>;
}
