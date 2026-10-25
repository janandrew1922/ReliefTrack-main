
import React, { useState } from 'react';
import {
  ArrowLeftIcon,
  BanknoteIcon,
  BuildingIcon,
  CheckCircle2Icon,
  CopyIcon,
  HeartHandshakeIcon,
  PackageIcon,
  SearchIcon,
  SmartphoneIcon } from
'lucide-react';
import { ReliefMap } from '../../components/ReliefMap';
import { ErrorBlock, LoadingBlock } from '../../components/StateViews';
import { useResource } from '../../hooks/useResource';
import { createDonation, getLocations, getNeededItems, getOperations } from '../../services/reliefService';
import { ApiError } from '../../services/http';
import { donationAmounts, paymentAccounts, peso, type PaymentChannel } from '../../data/staticContent';
import type { DonationItem, LocationKind } from '../../types/domain';
import type { PublicRoute } from '../../components/public/PublicNav';

interface DonateProps {
  onNavigate: (route: PublicRoute) => void;
}

const channelIcon: Record<PaymentChannel, React.ComponentType<{className?: string;}>> = {
  gcash: SmartphoneIcon,
  bank: BuildingIcon
};

const donationMapKinds: LocationKind[] = ['donation_center', 'warehouse', 'distribution_center', 'evacuation_center', 'affected_area', 'other'];

function CopyRow({ label, value }: {label: string;value: string;}) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</p>
        <p className="mt-0.5 truncate text-sm font-bold text-ink">{value}</p>
      </div>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard?.writeText(value);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1600);
        }}
        className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-line bg-white px-2.5 py-1.5 text-[11px] font-bold text-ink transition-colors hover:bg-gray-50">
        
        {copied ? <CheckCircle2Icon className="h-3 w-3 text-brand-700" /> : <CopyIcon className="h-3 w-3" />}
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>);

}

async function preparePaymentProof(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Choose a JPEG, PNG, or WebP image.');
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not prepare this image. Choose another photo.');
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    let quality = 0.82;
    let blob: Blob | null = null;
    do {
      blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
      if (blob && blob.size <= 2.5 * 1024 * 1024) break;
      quality -= 0.1;
    } while (quality >= 0.42);
    if (!blob || blob.size > 2.5 * 1024 * 1024) throw new Error('Photo is too large to prepare. Choose a smaller image.');
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Could not read this photo.'));
      reader.onerror = () => reject(new Error('Could not read this photo.'));
      reader.readAsDataURL(blob!);
    });
  } finally {
    bitmap.close();
  }
}

export function Donate({ onNavigate }: DonateProps) {
  const needs = useResource(getNeededItems);
  const operations = useResource(getOperations);
  const locations = useResource(getLocations);

  const [mode, setMode] = useState<'cash' | 'goods' | 'other'>('cash');
  const [amount, setAmount] = useState(1000);
  const [channel, setChannel] = useState<PaymentChannel>('gcash');
  const [locationId, setLocationId] = useState('');
  const [dropOffLocationId, setDropOffLocationId] = useState('');
  const [items, setItems] = useState<DonationItem[]>([]);
  const [otherItemName, setOtherItemName] = useState('');
  const [otherItemQuantity, setOtherItemQuantity] = useState(1);
  const [donorName, setDonorName] = useState('');
  const [donorEmail, setDonorEmail] = useState('');
  const [donorPhone, setDonorPhone] = useState('');
  const [note, setNote] = useState('');
  const [proof, setProof] = useState('');
  const [proofPhoto, setProofPhoto] = useState('');
  const [proofPhotoName, setProofPhotoName] = useState('');
  const [preparingProofPhoto, setPreparingProofPhoto] = useState(false);

  const [step, setStep] = useState<'form' | 'pay' | 'done'>('form');
  const [reference, setReference] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const account = paymentAccounts.find((entry) => entry.id === channel)!;
  const dropOffs = (locations.data ?? []).filter(
    (location) => location.kind === 'donation_center' || location.kind === 'warehouse'
  );
  const donationAreas = (locations.data ?? []).filter((location) => location.kind !== 'vehicle');
  const selectedLocation = donationAreas.find((location) => location.id === locationId);
  const selectedDropOff = dropOffs.find((location) => location.id === dropOffLocationId);
  const needsAtLocation = (locationName: string) => (needs.data ?? []).filter(
    (need) => need.location === locationName && need.status !== 'fulfilled'
  );
  const selectedOperation = selectedLocation?.operationIds?.[0] || (operations.data ?? [])[0]?.id || '';
  const customItem: DonationItem[] = otherItemName.trim()
    ? [{ name: otherItemName.trim(), category: 'Other', quantity: Math.max(1, otherItemQuantity), unit: 'pcs' }]
    : [];
  const submittedItems: DonationItem[] = mode === 'other' ? customItem : [...items, ...customItem];

  const toggleItem = (itemName: string, category: string) =>
  setItems((current) =>
  current.some((entry) => entry.name === itemName) ?
  current.filter((entry) => entry.name !== itemName) :
  [...current, { name: itemName, category, quantity: 1, unit: 'pcs' }]
  );

  const setQuantity = (itemName: string, quantity: number) =>
  setItems((current) => current.map((entry) => entry.name === itemName ? { ...entry, quantity } : entry));

  const save = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const preference = [
      note,
      mode === 'cash' ? `Cash for ${selectedLocation?.name ?? 'selected area'} · Payment channel: ${account.name}` : `Goods for ${selectedLocation?.name ?? 'selected area'} · Drop-off center: ${selectedDropOff?.name ?? 'not selected'}`,
      proof ? `Transaction reference: ${proof}` : ''].

      filter(Boolean).
      join(' | ');

      const result = await createDonation({
        donorName,
        donorEmail,
        donorPhone,
        donationType: mode,
        amount: mode === 'cash' ? amount : 0,
        operationId: selectedOperation,
        preferredLocationId: locationId || null,
        dropOffLocationId: mode !== 'cash' ? dropOffLocationId || null : null,
        donorPreference: preference,
        paymentProof: mode === 'cash' && channel === 'gcash' ? proofPhoto : undefined,
        items: mode !== 'cash' ? submittedItems : []
      });
      setReference(result.reference);
      setStep('done');
    } catch (cause) {
      setSubmitError(cause instanceof ApiError ? cause.message : 'Could not save your donation. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  /* ---------------- confirmation ---------------- */

  if (step === 'done') {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <div className="rounded-2xl border border-line bg-white p-8 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-brand-50 text-brand-700">
            <CheckCircle2Icon className="h-7 w-7" />
          </span>
          <h1 className="mt-5 text-2xl font-extrabold tracking-tight text-ink">
            Salamat, {donorName || 'kaibigan'}!
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            {mode === 'cash' ?
            `We recorded your ${peso(amount)} ${account.name} payment. Our team will verify it shortly.` :
            'Your pledged goods are recorded. Bring them to your chosen drop-off center.'}
          </p>

          <div className="mt-6 rounded-xl bg-brand-50 p-4 text-left">
            <p className="text-[11px] font-bold uppercase tracking-wide text-brand-700">Your reference number</p>
            <div className="mt-1 flex items-center justify-between gap-3">
              <p className="font-mono text-lg font-bold text-brand-900">{reference}</p>
              <button
                onClick={() => navigator.clipboard?.writeText(reference)}
                className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1.5 text-[11px] font-bold text-brand-800">
                
                <CopyIcon className="h-3 w-3" /> Copy
              </button>
            </div>
            <p className="mt-2 text-xs text-brand-800">Save this number so you can follow your donation.</p>
          </div>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <button
              onClick={() => onNavigate('track')}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-700 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-brand-800">
              
              <SearchIcon className="h-4 w-4" /> Track this donation
            </button>
            <button
              onClick={() => {
                setStep('form');
                setProof('');
                setReference('');
                setItems([]);
              }}
              className="inline-flex items-center justify-center rounded-xl border border-line px-5 py-3 text-sm font-bold text-ink transition-colors hover:bg-gray-50">
              
              Donate again
            </button>
          </div>
        </div>
      </div>);

  }

  /* ---------------- payment ---------------- */

  if (step === 'pay') {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <button
          onClick={() => setStep('form')}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted transition-colors hover:text-ink">
          
          <ArrowLeftIcon className="h-4 w-4" /> Back
        </button>

        <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-ink">Send {peso(amount)}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Transfer the amount using {account.name}, then enter your proof of payment so we can verify it.
        </p>

        <div className="mt-6 rounded-2xl border border-line bg-white p-6">
          <div className="flex items-center gap-2.5">
            {React.createElement(channelIcon[channel], { className: 'h-5 w-5 text-brand-700' })}
            <div>
              <p className="text-sm font-bold text-ink">{account.name}</p>
              <p className="text-xs text-muted">{account.detail}</p>
            </div>
          </div>

          <div className="mt-4 divide-y divide-line rounded-xl bg-gray-50 px-4">
            <CopyRow label="Account name" value={account.accountName} />
            <CopyRow label={channel === 'gcash' ? 'GCash number' : 'Account number'} value={account.accountNumber} />
            <CopyRow label="Amount to send" value={peso(amount)} />
          </div>

          {account.extra && <p className="mt-3 text-xs text-muted">{account.extra}</p>}

          <ol className="mt-5 space-y-2">
            {account.steps.map((instruction, index) =>
            <li key={instruction} className="flex gap-2.5 text-xs leading-relaxed text-muted">
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-100 text-[10px] font-bold text-brand-800">
                  {index + 1}
                </span>
                {instruction}
              </li>
            )}
          </ol>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (channel === 'gcash' && !proofPhoto) {
              setSubmitError('Upload a photo of your GCash payment receipt to continue.');
              return;
            }
            void save();
          }}
          className="mt-5 rounded-2xl border border-line bg-white p-6">
          
          <h2 className="text-sm font-bold text-ink">Proof of payment</h2>
          <p className="mt-0.5 text-xs text-muted">Enter the transaction reference printed on your receipt.</p>

          <label className="mt-4 block">
            <span className="text-xs font-semibold text-muted">Transaction reference number</span>
            <input
              type="text"
              required
              value={proof}
              onChange={(event) => setProof(event.target.value)}
              placeholder={channel === 'gcash' ? 'e.g. 1029 3847 5612' : 'e.g. IP2026090812345'}
              className="mt-1 w-full rounded-lg border border-line px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-600" />
            
          </label>

          {channel === 'gcash' && <label className="mt-4 block">
            <span className="text-xs font-semibold text-muted">GCash payment receipt photo (required)</span>
            <input type="file" accept="image/jpeg,image/png,image/webp" required disabled={preparingProofPhoto || submitting} onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              setProofPhoto('');
              setProofPhotoName('');
              setSubmitError(null);
              setPreparingProofPhoto(true);
              void preparePaymentProof(file).then((photo) => {
                setProofPhoto(photo);
                setProofPhotoName(file.name);
              }).catch((cause) => {
                setSubmitError(cause instanceof Error ? cause.message : 'Could not prepare the receipt photo.');
                event.target.value = '';
              }).finally(() => setPreparingProofPhoto(false));
            }} className="mt-1.5 w-full text-sm" />
            {preparingProofPhoto && <span className="mt-1 block text-xs text-muted">Preparing receipt photo…</span>}
            {!preparingProofPhoto && proofPhoto && <span className="mt-1 block text-xs text-emerald-700">Receipt photo ready: {proofPhotoName}</span>}
          </label>}

          {submitError &&
          <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2.5 text-xs font-medium text-rose-700">{submitError}</p>
          }

          <button
            type="submit"
            disabled={submitting || preparingProofPhoto}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-700 px-5 py-3.5 text-sm font-bold text-white transition-colors hover:bg-brand-800 disabled:opacity-60">
            
            <CheckCircle2Icon className="h-4 w-4" /> {preparingProofPhoto ? 'Preparing photo…' : submitting ? 'Saving…' : 'I have sent the payment'}
          </button>
        </form>
      </div>);

  }

  /* ---------------- form ---------------- */

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-extrabold tracking-tight text-ink">Make a donation</h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
        Every donation is saved with a reference number so you can see exactly where it goes.
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.15fr_1fr]">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (mode === 'cash') setStep('pay');else
            void save();
          }}
          className="rounded-2xl border border-line bg-white p-6">

          <fieldset>
            <legend className="text-sm font-bold text-ink">Choose the area or center you want to support</legend>
            <p className="mt-1 text-xs leading-relaxed text-muted">Select a center first. Open supply needs are shown with each location.</p>
            {locations.loading && <LoadingBlock label="Loading donation centers" rows={2} />}
            {locations.error && <ErrorBlock message={locations.error} onRetry={locations.reload} />}
            <div className="mt-3 grid gap-2">
              {[...donationAreas].sort((left, right) => needsAtLocation(right.name).length - needsAtLocation(left.name).length).map((location) => {
                const openNeeds = needsAtLocation(location.name);
                const selected = location.id === locationId;
                return (
                  <button
                    key={location.id}
                    type="button"
                    onClick={() => {
                      setLocationId(location.id);
                      if (dropOffs.some((dropOff) => dropOff.id === location.id)) setDropOffLocationId(location.id);
                    }}
                    aria-pressed={selected}
                    className={`flex w-full items-start justify-between gap-3 rounded-xl border p-4 text-left transition-colors ${selected ? 'border-brand-700 bg-brand-50' : 'border-line hover:bg-gray-50'}`}>
                    <span className="min-w-0">
                      <span className="block text-sm font-bold text-ink">{location.name}</span>
                      <span className="mt-1 block text-xs text-muted">{[location.address, location.city].filter(Boolean).join(', ')}</span>
                      {openNeeds.length > 0 &&
                      <span className="mt-2 block text-xs leading-relaxed text-rose-700">
                        {openNeeds.map((need) => `${need.itemName}: ${Math.max(need.quantityNeeded - need.quantityReceived, 0).toLocaleString()} needed`).join(' · ')}
                      </span>
                      }
                    </span>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${openNeeds.length ? 'bg-rose-50 text-rose-700' : 'bg-gray-100 text-muted'}`}>
                      {openNeeds.length ? `${openNeeds.length} open need${openNeeds.length === 1 ? '' : 's'}` : 'No open needs'}
                    </span>
                  </button>
                );
              })}
            </div>
            {!locations.loading && !locations.error && donationAreas.length === 0 &&
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2.5 text-xs text-amber-800">No relief areas are available right now.</p>
            }
          </fieldset>

          {locationId ? <>
          
          <fieldset>
            <legend className="text-sm font-bold text-ink">What would you like to give?</legend>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => setMode('cash')}
                aria-pressed={mode === 'cash'}
                className={`rounded-xl border p-4 text-left transition-colors ${
                mode === 'cash' ? 'border-brand-700 bg-brand-50' : 'border-line hover:bg-gray-50'}`
                }>
                
                <BanknoteIcon className={`h-5 w-5 ${mode === 'cash' ? 'text-brand-700' : 'text-muted'}`} />
                <p className="mt-2 text-sm font-bold text-ink">Money</p>
                <p className="mt-0.5 text-xs text-muted">GCash or bank transfer</p>
              </button>
              <button
                type="button"
                onClick={() => setMode('goods')}
                aria-pressed={mode === 'goods'}
                className={`rounded-xl border p-4 text-left transition-colors ${
                mode === 'goods' ? 'border-brand-700 bg-brand-50' : 'border-line hover:bg-gray-50'}`
                }>
                
                <PackageIcon className={`h-5 w-5 ${mode === 'goods' ? 'text-brand-700' : 'text-muted'}`} />
                <p className="mt-2 text-sm font-bold text-ink">Goods</p>
                <p className="mt-0.5 text-xs text-muted">Drop off at a center near you</p>
              </button>
              <button
                type="button"
                onClick={() => setMode('other')}
                aria-pressed={mode === 'other'}
                className={`rounded-xl border p-4 text-left transition-colors ${mode === 'other' ? 'border-brand-700 bg-brand-50' : 'border-line hover:bg-gray-50'}`}>
                <HeartHandshakeIcon className={`h-5 w-5 ${mode === 'other' ? 'text-brand-700' : 'text-muted'}`} />
                <p className="mt-2 text-sm font-bold text-ink">Other</p>
                <p className="mt-0.5 text-xs text-muted">Something not listed above</p>
              </button>
            </div>
          </fieldset>

          {mode === 'cash' ?
          <>
              <fieldset className="mt-6">
                <legend className="text-sm font-bold text-ink">Choose an amount</legend>
                <div className="mt-3 flex flex-wrap gap-2">
                  {donationAmounts.map((value) =>
                <button
                  key={value}
                  type="button"
                  onClick={() => setAmount(value)}
                  aria-pressed={amount === value}
                  className={`rounded-lg border px-4 py-2.5 text-sm font-bold transition-colors ${
                  amount === value ?
                  'border-brand-700 bg-brand-700 text-white' :
                  'border-line text-ink hover:bg-gray-50'}`
                  }>
                  
                      {peso(value)}
                    </button>
                )}
                </div>
                <label className="mt-3 block">
                  <span className="text-xs font-semibold text-muted">Or enter another amount</span>
                  <input
                  type="number"
                  min={1}
                  required
                  value={amount}
                  onChange={(event) => setAmount(Number(event.target.value))}
                  className="mt-1 w-full rounded-lg border border-line px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-600" />
                
                </label>
              </fieldset>

              <fieldset className="mt-6">
                <legend className="text-sm font-bold text-ink">How will you send it?</legend>
                <div className="mt-3 space-y-2">
                  {paymentAccounts.map((entry) => {
                  const Icon = channelIcon[entry.id];
                  const selected = channel === entry.id;
                  return (
                    <label
                      key={entry.id}
                      className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition-colors ${
                      selected ? 'border-brand-700 bg-brand-50' : 'border-line hover:bg-gray-50'}`
                      }>
                      
                        <input
                        type="radio"
                        name="channel"
                        checked={selected}
                        onChange={() => setChannel(entry.id)}
                        className="h-4 w-4 shrink-0 accent-brand-700" />
                      
                        <Icon className={`h-5 w-5 shrink-0 ${selected ? 'text-brand-700' : 'text-muted'}`} />
                        <span className="min-w-0">
                          <span className="block text-sm font-bold text-ink">{entry.name}</span>
                          <span className="block text-xs text-muted">{entry.detail}</span>
                        </span>
                      </label>);

                })}
                </div>
              </fieldset>
            </> :

          <>
              <fieldset className="mt-6">
                <legend className="text-sm font-bold text-ink">{mode === 'other' ? 'Describe what you would like to give' : 'Select the items you can give'}</legend>
                <div className="mt-3">
                  {mode === 'other' ? <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
                    <label>
                      <span className="text-xs font-semibold text-muted">Item or contribution</span>
                      <input type="text" required value={otherItemName} onChange={(event) => setOtherItemName(event.target.value)} placeholder="e.g. hygiene kits, school supplies" className="mt-1 w-full rounded-lg border border-line px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-600" />
                    </label>
                    <label>
                      <span className="text-xs font-semibold text-muted">Quantity</span>
                      <input type="number" min={1} required value={otherItemQuantity} onChange={(event) => setOtherItemQuantity(Math.max(1, Number(event.target.value)))} className="mt-1 w-full rounded-lg border border-line px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-600" />
                    </label>
                    <p className="text-xs text-muted sm:col-span-2">Other donations are recorded as goods. Choose a drop-off center so the team can receive and track them.</p>
                  </div> : <>
                  {needs.loading && <LoadingBlock label="Loading needed items" />}
                  {needs.error && <ErrorBlock message={needs.error} onRetry={needs.reload} />}

                  {needs.data &&
                <div className="space-y-2">
                      {needs.data.filter((need) => need.location === selectedLocation?.name && need.status !== 'fulfilled').map((need) => {
                    const chosen = items.find((entry) => entry.name === need.itemName);
                    return (
                      <div
                        key={need.id}
                        className={`rounded-xl border p-3 transition-colors ${
                        chosen ? 'border-brand-700 bg-brand-50' : 'border-line'}`
                        }>
                        
                            <label className="flex cursor-pointer items-start gap-3">
                              <input
                            type="checkbox"
                            checked={Boolean(chosen)}
                            onChange={() => toggleItem(need.itemName, need.category)}
                            className="mt-0.5 h-4 w-4 accent-brand-700" />
                          
                              <span className="min-w-0">
                                <span className="block text-sm font-semibold text-ink">{need.itemName}</span>
                                <span className="block text-xs text-muted">
                                  {need.category} · {need.quantityNeeded - need.quantityReceived} still needed at{' '}
                                  {need.location}
                                </span>
                              </span>
                            </label>
                            {chosen &&
                        <label className="mt-2.5 flex items-center gap-2 pl-7">
                                <span className="text-xs font-semibold text-muted">Quantity</span>
                                <input
                            type="number"
                            min={1}
                            value={chosen.quantity}
                            onChange={(event) => setQuantity(need.itemName, Number(event.target.value))}
                            className="w-24 rounded-lg border border-line px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-brand-600" />
                          
                              </label>
                        }
                          </div>);

                  })}
                    </div>
                }
                  <div className="mt-3 grid gap-3 rounded-xl border border-dashed border-line p-3 sm:grid-cols-[1fr_140px]">
                    <label>
                      <span className="text-xs font-semibold text-muted">Other item (optional)</span>
                      <input type="text" value={otherItemName} onChange={(event) => setOtherItemName(event.target.value)} placeholder="Add an item not listed" className="mt-1 w-full rounded-lg border border-line px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-600" />
                    </label>
                    <label>
                      <span className="text-xs font-semibold text-muted">Quantity</span>
                      <input type="number" min={1} value={otherItemQuantity} onChange={(event) => setOtherItemQuantity(Math.max(1, Number(event.target.value)))} className="mt-1 w-full rounded-lg border border-line px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-600" />
                    </label>
                    <p className="text-xs text-muted sm:col-span-2">Add goods that are not in the current needs list.</p>
                  </div>
                  </>}
                </div>
              </fieldset>

              <label className="mt-6 block">
                <span className="text-sm font-bold text-ink">Where will you drop off these goods?</span>
                <select
                  value={dropOffLocationId}
                  onChange={(event) => setDropOffLocationId(event.target.value)}
                  required
                  className="mt-2 w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-600">
                  <option value="">Choose a donation center</option>
                  {dropOffs.map((location) => <option key={location.id} value={location.id}>{location.name} — {location.city}</option>)}
                </select>
              </label>

            </>
          }

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-bold text-ink">Your name</span>
              <input
                type="text"
                required
                value={donorName}
                onChange={(event) => setDonorName(event.target.value)}
                placeholder="Juan Dela Cruz"
                className="mt-2 w-full rounded-lg border border-line px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-600" />
              
            </label>
            <label className="block">
              <span className="text-sm font-bold text-ink">Email address</span>
              <input
                type="email"
                required
                value={donorEmail}
                onChange={(event) => setDonorEmail(event.target.value)}
                placeholder="For your tracking updates"
                className="mt-2 w-full rounded-lg border border-line px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-600" />
              
            </label>
            <label className="block">
              <span className="text-sm font-bold text-ink">Mobile number</span>
              <input
                type="text"
                value={donorPhone}
                onChange={(event) => setDonorPhone(event.target.value)}
                placeholder="09171234567"
                className="mt-2 w-full rounded-lg border border-line px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-600" />
              
            </label>
            <label className="block">
              <span className="text-sm font-bold text-ink">Note for the team</span>
              <input
                type="text"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Optional preference"
                className="mt-2 w-full rounded-lg border border-line px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-600" />
              
            </label>
          </div>

          {submitError && mode !== 'cash' &&
          <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2.5 text-xs font-medium text-rose-700">{submitError}</p>
          }

          <button
            type="submit"
            disabled={submitting || mode !== 'cash' && (mode === 'other' ? !otherItemName.trim() : submittedItems.length === 0)}
            className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-700 px-5 py-3.5 text-sm font-bold text-white transition-colors hover:bg-brand-800 disabled:opacity-60">
            
            <HeartHandshakeIcon className="h-4 w-4" />
            {mode === 'cash' ?
            `Continue to ${account.name}` :
            submitting ?
            'Saving…' :
            `Pledge ${submittedItems.length} item type${submittedItems.length === 1 ? '' : 's'}`}
          </button>
          <p className="mt-3 text-center text-xs text-muted">
            You will receive a reference number to track your donation.
          </p>
          </> :
          <p className="mt-5 rounded-lg bg-brand-50 px-3 py-2.5 text-xs font-medium text-brand-800">
            Choose a center above to see the available donation options.
          </p>
          }
        </form>

        <div className="space-y-5">
          <ReliefMap
            kinds={donationMapKinds}
            focusLocationId={locationId}
            heightClassName="h-[360px]"
            title="Live relief map"
            description={selectedLocation ? `Showing ${selectedLocation.name}. Choose another area above to move the map.` : 'Choose an area or center above to focus the map.'}
          />
          <div className="rounded-2xl border border-line bg-white p-5">
            <h2 className="text-sm font-bold text-ink">Bringing goods in person?</h2>
            <ol className="mt-3 space-y-2.5 text-xs leading-relaxed text-muted">
              <li>
                <span className="font-semibold text-ink">1.</span> Pick a drop-off center on the map and get
                directions.
              </li>
              <li>
                <span className="font-semibold text-ink">2.</span> Label your boxes with the item type and quantity.
              </li>
              <li>
                <span className="font-semibold text-ink">3.</span> Show your reference number at the counter.
              </li>
            </ol>
          </div>
        </div>
      </div>
    </div>);

}
