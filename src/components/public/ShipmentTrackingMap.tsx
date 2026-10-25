import { useEffect } from 'react';
import L from 'leaflet';
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet';
import type { Coordinates } from '../../types/domain';

const pickupIcon = L.divIcon({ className: '', html: '<span class="shipment-track-pin shipment-track-pin--pickup">P</span>', iconSize: [30, 30], iconAnchor: [15, 15] });
const destinationIcon = L.divIcon({ className: '', html: '<span class="shipment-track-pin shipment-track-pin--destination">D</span>', iconSize: [30, 30], iconAnchor: [15, 15] });
const driverIcon = L.divIcon({ className: '', html: '<span class="shipment-track-pin shipment-track-pin--driver">🚚</span>', iconSize: [38, 38], iconAnchor: [19, 19] });

function FitRoute({ points }: { points: Coordinates[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length > 1) map.fitBounds(L.latLngBounds(points), { padding: [36, 36], maxZoom: 13 });
    else if (points[0]) map.setView(points[0], 12);
  }, [map, points]);
  return null;
}

export function ShipmentTrackingMap({
  origin,
  destination,
  originCoordinates,
  destinationCoordinates,
  driverCoordinates,
  locationUpdatedAt,
  status
}: {
  origin: string;
  destination: string;
  originCoordinates?: Coordinates | null;
  destinationCoordinates?: Coordinates | null;
  driverCoordinates?: Coordinates | null;
  locationUpdatedAt?: string | null;
  status: string;
}) {
  const points = [originCoordinates, driverCoordinates, destinationCoordinates].filter((point): point is Coordinates => Boolean(point));
  if (!points.length) return <div className="rounded-xl bg-gray-50 p-4 text-xs text-muted">Shipment coordinates are not available yet. The last recorded checkpoint is shown in the donation timeline.</div>;

  return <div className="overflow-hidden rounded-xl border border-line bg-white">
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
      <div><h3 className="text-sm font-bold text-ink">Shipment location</h3><p className="mt-0.5 text-xs text-muted">Updates as the driver shares GPS from the route.</p></div>
      <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${driverCoordinates && status === 'in_transit' ? 'bg-emerald-50 text-emerald-800' : 'bg-gray-100 text-gray-700'}`}>{driverCoordinates && status === 'in_transit' ? 'Driver GPS received' : status.replaceAll('_', ' ')}</span>
    </div>
    <div className="h-[320px] w-full">
      <MapContainer center={points[0]} zoom={11} scrollWheelZoom className="h-full w-full" aria-label="Donation shipment location map">
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <FitRoute points={points} />
        {originCoordinates && destinationCoordinates && <Polyline positions={[originCoordinates, destinationCoordinates]} pathOptions={{ color: '#94a3b8', weight: 3, dashArray: '6 7' }} />}
        {originCoordinates && <Marker position={originCoordinates} icon={pickupIcon}><Popup><strong>Pickup</strong><br />{origin}</Popup></Marker>}
        {destinationCoordinates && <Marker position={destinationCoordinates} icon={destinationIcon}><Popup><strong>Destination</strong><br />{destination}</Popup></Marker>}
        {driverCoordinates && <Marker position={driverCoordinates} icon={driverIcon}><Popup><strong>Last driver location</strong><br />{locationUpdatedAt ? new Date(locationUpdatedAt).toLocaleString() : 'GPS update received'}</Popup></Marker>}
      </MapContainer>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-3 text-xs">
      <p className="text-muted">Last known location: <span className="font-semibold text-ink">{driverCoordinates ? 'Driver GPS position' : originCoordinates ? origin : destination}</span>{locationUpdatedAt ? ` · Updated ${new Date(locationUpdatedAt).toLocaleString()}` : ''}</p>
      {driverCoordinates && <a href={`https://www.google.com/maps/search/?api=1&query=${driverCoordinates[0]},${driverCoordinates[1]}`} target="_blank" rel="noreferrer" className="font-bold text-brand-700 underline">Open in Maps</a>}
    </div>
  </div>;
}
