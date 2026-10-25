
import { useEffect, useRef, useState } from 'react';
import { LocateFixedIcon, TruckIcon } from 'lucide-react';
import { getShipments, updateShipmentLocation } from '../services/reliefService';
import { useResource } from '../hooks/useResource';
import { EmptyBlock, ErrorBlock, LoadingBlock } from './StateViews';
import type { ShipmentStatus } from '../types/domain';

export const shipmentStyle: Record<ShipmentStatus, string> = {
  pending: 'text-amber-600 bg-amber-50',
  packed: 'text-violet-600 bg-violet-50',
  in_transit: 'text-brand-700 bg-brand-50',
  delivered: 'text-emerald-600 bg-emerald-50',
  cancelled: 'text-rose-600 bg-rose-50'
};

export const shipmentLabel: Record<ShipmentStatus, string> = {
  pending: 'Pending',
  packed: 'Packed',
  in_transit: 'In transit',
  delivered: 'Delivered',
  cancelled: 'Cancelled'
};

export function DriverGps({ shipmentId, onUpdate }: { shipmentId: string; onUpdate: () => void }) {
  const [sharing, setSharing] = useState(false);
  const [message, setMessage] = useState('');
  const lastSentAt = useRef(0);

  useEffect(() => {
    if (!sharing) return;
    if (!navigator.geolocation) {
      setMessage('GPS is not available on this device.');
      setSharing(false);
      return;
    }
    const watchId = navigator.geolocation.watchPosition(async ({ coords }) => {
      if (Date.now() - lastSentAt.current < 10000) return;
      lastSentAt.current = Date.now();
      try {
        await updateShipmentLocation(shipmentId, coords.latitude, coords.longitude);
        setMessage(`Location shared ${new Date().toLocaleTimeString()}`);
        onUpdate();
      } catch (cause) {
        setMessage(cause instanceof Error ? cause.message : 'Could not share location.');
      }
    }, (error) => {
      setMessage(error.code === error.PERMISSION_DENIED ? 'Allow location access to share GPS.' : 'GPS signal unavailable.');
      setSharing(false);
    }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 });
    return () => navigator.geolocation.clearWatch(watchId);
  }, [sharing, shipmentId, onUpdate]);

  return <div className="flex flex-col items-end gap-1">
    <button type="button" onClick={() => { setMessage(''); setSharing((active) => !active); }}
      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold ${sharing ? 'bg-rose-50 text-rose-700' : 'bg-brand-50 text-brand-700'}`}>
      <LocateFixedIcon className="h-3.5 w-3.5" /> {sharing ? 'Stop GPS' : 'Share GPS'}
    </button>
    {message && <span className="max-w-40 text-right text-[10px] text-muted">{message}</span>}
  </div>;
}

export function LogisticsTable() {
  const { data, loading, error, reload } = useResource(getShipments);

  useEffect(() => {
    const timer = window.setInterval(() => { void reload(); }, 15000);
    return () => window.clearInterval(timer);
  }, [reload]);

  if (loading) return <LoadingBlock label="Loading shipments" />;
  if (error) return <ErrorBlock message={error} onRetry={reload} />;
  if (!data || data.length === 0) return <EmptyBlock message="No shipments recorded yet." />;

  return (
    <section className="rounded-2xl border border-line bg-white">
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <div className="flex items-center gap-2">
          <TruckIcon className="h-4 w-4 text-brand-700" />
          <h2 className="text-sm font-bold text-ink">Shipments &amp; dispatch</h2>
        </div>
        <span className="text-xs text-muted">{data.length} tracked</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-muted">
              <th className="px-5 py-2.5 font-semibold">Reference</th>
              <th className="px-4 py-2.5 font-semibold">Route</th>
              <th className="px-4 py-2.5 font-semibold">Cargo</th>
              <th className="px-4 py-2.5 font-semibold">Vehicle</th>
              <th className="px-4 py-2.5 font-semibold">Status</th>
              <th className="px-5 py-2.5 text-right font-semibold">GPS / update</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {data.map((shipment) =>
            <tr key={shipment.id} className="transition-colors hover:bg-gray-50/60">
                <td className="px-5 py-3 font-mono text-xs font-semibold text-ink">{shipment.reference}</td>
                <td className="px-4 py-3 font-medium text-ink">
                  {shipment.origin} → {shipment.destination}
                </td>
                <td className="px-4 py-3 text-muted">
                  {shipment.itemDescription}
                  {shipment.quantity > 0 && ` · ${shipment.quantity}`}
                </td>
                <td className="px-4 py-3 text-muted">
                  {shipment.vehicle}
                  {shipment.plateNumber && ` · ${shipment.plateNumber}`}
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${shipmentStyle[shipment.status]}`}>
                    {shipmentLabel[shipment.status]}
                  </span>
                </td>
                <td className="px-5 py-3 text-right text-xs font-medium text-ink">
                  {shipment.status === 'in_transit' ? <DriverGps shipmentId={shipment.id} onUpdate={reload} /> : shipment.note}
                  {shipment.locationUpdatedAt && <p className="mt-1 text-[10px] text-muted">GPS updated {new Date(shipment.locationUpdatedAt).toLocaleTimeString()}</p>}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>);

}
