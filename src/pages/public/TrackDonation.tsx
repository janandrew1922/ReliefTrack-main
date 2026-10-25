
import React, { useEffect, useState } from 'react';
import { AlertCircleIcon, MapPinIcon, PackageIcon, SearchIcon } from 'lucide-react';
import { DonationTimeline } from '../../components/public/DonationTimeline';
import { ShipmentTrackingMap } from '../../components/public/ShipmentTrackingMap';
import { ReliefMap } from '../../components/ReliefMap';
import { trackDonation } from '../../services/reliefService';
import { ApiError } from '../../services/http';
import type { TrackedDonation } from '../../types/domain';

export function TrackDonation() {
  const [query, setQuery] = useState('');
  const [email, setEmail] = useState('');
  const [trackingEmail, setTrackingEmail] = useState('');
  const [result, setResult] = useState<TrackedDonation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastCheckpoint = [...(result?.updates ?? [])].reverse().find((update) => update.location)?.location;

  useEffect(() => {
    if (!result?.reference || !trackingEmail) return;
    const reference = result.reference;
    const timer = window.setInterval(() => {
      void trackDonation(reference, trackingEmail).then(setResult).catch(() => undefined);
    }, 15000);
    return () => window.clearInterval(timer);
  }, [result?.reference, trackingEmail]);

  const search = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    setTrackingEmail(email.trim());
    try {
      setResult(await trackDonation(query.trim(), email.trim()));
    } catch (cause) {
      setResult(null);
      setError(cause instanceof ApiError && cause.status === 404
        ? 'No donation found with that reference. Check the number and try again.'
        : cause instanceof ApiError ? cause.message : 'We could not look up that reference number.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-extrabold tracking-tight text-ink">Track my donation</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Enter the donation reference and donor email from your receipt to view its progress.
      </p>

      <form onSubmit={search} className="mt-6 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <label className="flex-1">
          <span className="sr-only">Donation reference number</span>
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="e.g. RT-000124"
            className="w-full rounded-xl border border-line bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-600" />
          
        </label>
        <label className="flex-1">
          <span className="sr-only">Donor email address</span>
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Email used for donation"
            className="w-full rounded-xl border border-line bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-600" />
        </label>
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-700 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-brand-800 disabled:opacity-60">
          
          <SearchIcon className="h-4 w-4" /> {loading ? 'Searching…' : 'Track'}
        </button>
      </form>

      {error &&
      <div className="mt-8 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-4">
          <AlertCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <p className="text-sm font-bold text-amber-800">{error.startsWith('No donation found') ? 'No donation found' : 'We could not find that donation'}</p>
            <p className="mt-1 text-xs leading-relaxed text-amber-700">{error}</p>
          </div>
        </div>
      }

      {result &&
      <div className="mt-8 space-y-5">
          <section className="rounded-2xl border border-line bg-white p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="font-mono text-xs font-bold text-muted">{result.reference}</p>
                <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-ink">{result.amount}</h2>
                <p className="mt-1 text-sm capitalize text-muted">
                  {result.type} donation from {result.donor} · {result.date}
                </p>
              </div>
              <span
              className={`inline-flex shrink-0 items-center gap-1.5 self-start rounded-full px-3 py-1.5 text-xs font-bold ${
              result.stage === 'distributed' ? 'bg-brand-50 text-brand-800' : 'bg-amber-50 text-amber-700'}`
              }>
              
                {result.stage === 'distributed' ? 'Delivered to families' : 'In progress'}
              </span>
            </div>

            <dl className="mt-6 grid gap-4 border-t border-line pt-5 sm:grid-cols-2">
              <div>
                <dt className="flex items-center gap-1.5 text-xs text-muted">
                  <PackageIcon className="h-3.5 w-3.5" /> Operation
                </dt>
                <dd className="mt-1 text-sm font-semibold text-ink">{result.operation}</dd>
              </div>
              <div>
                <dt className="flex items-center gap-1.5 text-xs text-muted">
                  <MapPinIcon className="h-3.5 w-3.5" /> Destination
                </dt>
                <dd className="mt-1 text-sm font-semibold text-ink">{lastCheckpoint ?? result.destination}</dd>
              </div>
              {result.dropOffLocation && <div>
                <dt className="text-xs text-muted">Donation drop-off</dt>
                <dd className="mt-1 text-sm font-semibold text-ink">{result.dropOffLocation}</dd>
              </div>}
            </dl>

            {result.shipmentTracking && <div className="mt-5 rounded-xl border border-line bg-gray-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-brand-700">Shipment {result.shipmentTracking.reference}</p>
                  <p className="mt-1 text-sm font-semibold capitalize text-ink">{result.shipmentTracking.status.replaceAll('_', ' ')}</p>
                </div>
                {result.shipmentTracking.locationUpdatedAt && <span className="text-right text-[11px] text-muted">GPS updated {new Date(result.shipmentTracking.locationUpdatedAt).toLocaleString()}</span>}
              </div>
              <div className="mt-3 rounded-lg bg-white px-3 py-2.5">
                <p className="text-[10px] font-bold uppercase tracking-wide text-muted">Last known location</p>
                <p className="mt-1 text-sm font-semibold text-ink">{result.shipmentTracking.coordinates ? 'Driver GPS position' : result.shipmentTracking.lastLocation ?? lastCheckpoint ?? result.dropOffLocation ?? result.destination}</p>
                {result.shipmentTracking.coordinates && <p className="mt-0.5 font-mono text-[11px] text-muted">{result.shipmentTracking.coordinates[0].toFixed(5)}, {result.shipmentTracking.coordinates[1].toFixed(5)}</p>}
                {result.shipmentTracking.status === 'in_transit' && !result.shipmentTracking.coordinates && <p className="mt-1 text-xs text-muted">Waiting for the driver’s first GPS update. The pickup checkpoint is shown until then.</p>}
              </div>
            </div>}

            {result.items.length > 0 &&
          <div className="mt-5 border-t border-line pt-5">
                <p className="text-xs font-bold uppercase tracking-wide text-muted">Items donated</p>
                <ul className="mt-2 space-y-1.5">
                  {result.items.map((item) =>
              <li key={item.name} className="flex justify-between gap-3 text-sm">
                      <span className="text-muted">
                        {item.name}
                        {item.category && <span className="text-xs"> · {item.category}</span>}
                      </span>
                      <span className="shrink-0 font-semibold text-ink">
                        {item.quantity} {item.unit}
                      </span>
                    </li>
              )}
                </ul>
              </div>
          }
          </section>

          <section className="rounded-2xl border border-line bg-white p-6">
            <h3 className="text-sm font-bold text-ink">Donation progress</h3>
            <p className="mt-0.5 text-xs text-muted">Updated by hub and field coordinators.</p>
            <div className="mt-5">
              <DonationTimeline donation={result} />
            </div>
          </section>

          {result.shipmentTracking ? <ShipmentTrackingMap
            origin={result.shipmentTracking.origin ?? result.dropOffLocation ?? 'Pickup site'}
            destination={result.shipmentTracking.destination ?? result.destination}
            originCoordinates={result.shipmentTracking.originCoordinates}
            destinationCoordinates={result.shipmentTracking.destinationCoordinates}
            driverCoordinates={result.shipmentTracking.coordinates}
            locationUpdatedAt={result.shipmentTracking.locationUpdatedAt}
            status={result.shipmentTracking.status}
          /> : <ReliefMap
            kinds={['donation_center', 'warehouse', 'distribution_center', 'affected_area']}
            heightClassName="h-[420px]"
            title="Donation checkpoints in Caloocan"
            description="Follow the relief route from drop-off to distribution. Select a checkpoint for directions."
          />}

          {result.stage === 'distributed' &&
        <section className="rounded-2xl bg-brand-900 p-6 text-white">
              <h3 className="text-lg font-extrabold tracking-tight">{result.type === 'cash' ? 'Your donation has been delivered' : 'Your donation reached its destination'}</h3>
              <p className="mt-2 text-sm leading-relaxed text-brand-100">{result.type === 'cash' ? `Your contribution was allocated to ${result.destination}. Thank you for supporting the response.` : `Families in ${result.destination} received relief goods that included your donation. Maraming salamat sa tulong mo.`}</p>
            </section>
        }
        </div>
      }
    </div>);

}
