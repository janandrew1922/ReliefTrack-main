
import React, { useEffect, useMemo, useState } from 'react';
import L from 'leaflet';
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet';
import {
  BuildingIcon,
  ExternalLinkIcon,
  HomeIcon,
  MapPinIcon,
  NavigationIcon,
  PackageIcon,
  TruckIcon,
  WarehouseIcon } from
'lucide-react';
import { getLocations, getShipments } from '../services/reliefService';
import { useResource } from '../hooks/useResource';
import { EmptyBlock, ErrorBlock, LoadingBlock } from './StateViews';
import type { LocationKind, ReliefLocation } from '../types/domain';
import 'leaflet/dist/leaflet.css';

/** Mirrors the locations.location_type enum, plus 'vehicle' for live shipments. */
export const locationLabel: Record<LocationKind, string> = {
  donation_center: 'Donation drop-off',
  warehouse: 'Warehouse / repack hub',
  distribution_center: 'Distribution center',
  evacuation_center: 'Evacuation center',
  affected_area: 'Affected area',
  other: 'Other site',
  vehicle: 'Vehicle in transit'
};

const glyph: Record<LocationKind, string> = {
  donation_center: '♥',
  warehouse: '▣',
  distribution_center: '⌂',
  evacuation_center: '⛨',
  affected_area: '!',
  other: '•',
  vehicle: '→'
};

const kindIcon: Record<LocationKind, React.ComponentType<{className?: string;}>> = {
  donation_center: PackageIcon,
  warehouse: WarehouseIcon,
  distribution_center: BuildingIcon,
  evacuation_center: HomeIcon,
  affected_area: MapPinIcon,
  other: MapPinIcon,
  vehicle: TruckIcon
};

const allKinds = Object.keys(locationLabel) as LocationKind[];

function makeIcon(kind: LocationKind) {
  return L.divIcon({
    className: 'relief-map-icon',
    html: `<span class="relief-map-marker relief-map-marker--${kind}">${glyph[kind]}</span>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17]
  });
}

function MapViewport({ location, zoom = 11 }: {location: ReliefLocation | undefined; zoom?: number;}) {
  const map = useMap();
  useEffect(() => {
    if (location) map.flyTo(location.coordinates, zoom, { duration: 0.8 });
  }, [location, map, zoom]);
  return null;
}

function LiveShipmentMarkers({ locations }: { locations: ReliefLocation[] }) {
  const shipments = useResource(getShipments);

  useEffect(() => {
    const timer = window.setInterval(() => { void shipments.reload(); }, 15000);
    return () => window.clearInterval(timer);
  }, [shipments.reload]);

  return <>
    {(shipments.data ?? []).map((shipment) => {
      if (shipment.status === 'delivered' || shipment.status === 'cancelled' || !shipment.coordinates) return null;
      const origin = locations.find((location) => location.name === shipment.origin);
      return <React.Fragment key={shipment.id}>
        {origin && <Polyline positions={[origin.coordinates, shipment.coordinates]} pathOptions={{ color: '#0f766e', opacity: 0.7, weight: 3, dashArray: '7 8' }} />}
        {shipment.status === 'in_transit' && shipment.locationUpdatedAt && <Marker position={shipment.coordinates} icon={makeIcon('vehicle')}>
          <Popup><p className="font-semibold text-sm text-slate-900">{shipment.vehicle} · {shipment.reference}</p><p className="text-xs text-slate-500 mt-1">GPS updated {new Date(shipment.locationUpdatedAt).toLocaleString()}</p></Popup>
        </Marker>}
      </React.Fragment>;
    })}
  </>;
}

interface ReliefMapProps {
  kinds?: LocationKind[];
  heightClassName?: string;
  showList?: boolean;
  title?: string;
  description?: string;
  focusLocationId?: string;
  showVehicles?: boolean;
}

export function ReliefMap({ kinds = allKinds, heightClassName = 'h-[430px]', showList = true, title = 'Live relief map', description = 'Select a marker to see the site details and directions.', focusLocationId, showVehicles = false }: ReliefMapProps) {
  const { data, loading, error, reload } = useResource(getLocations);
  const [selectedId, setSelectedId] = useState('');
  const [hoveredId, setHoveredId] = useState('');

  const locations = useMemo(
    () => (data ?? []).filter((location) => kinds.includes(location.kind) && location.coordinates),
    [data, kinds]
  );
  const selected = locations.find((location) => location.id === (hoveredId || selectedId)) ?? locations[0];
  const focused = locations.find((location) => location.id === selectedId) ?? locations[0];

  useEffect(() => {
    if (focusLocationId && locations.some((location) => location.id === focusLocationId)) {
      setSelectedId(focusLocationId);
      setHoveredId('');
    }
  }, [focusLocationId, locations]);

  useEffect(() => {
    if (locations.length > 0 && !locations.some((location) => location.id === selectedId)) {
      setSelectedId(locations[0].id);
    }
  }, [locations, selectedId]);

  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-white">
      <div className="flex flex-col gap-3 px-5 py-4 border-b border-line sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-bold text-ink">{title}</h2>
          <p className="text-xs text-muted mt-0.5">{description}</p>
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-medium text-muted">
          {kinds.map((kind) =>
          <span key={kind} className="inline-flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 rounded-full relief-map-marker--${kind}`} />
              {locationLabel[kind]}
            </span>
          )}
        </div>
      </div>

      {loading &&
      <div className="p-5">
          <LoadingBlock label="Loading map locations" />
        </div>
      }
      {error &&
      <div className="p-5">
          <ErrorBlock message={error} onRetry={reload} />
        </div>
      }
      {data && locations.length === 0 &&
      <div className="p-5">
          <EmptyBlock message="No mapped locations yet. Add latitude and longitude to your locations table." />
        </div>
      }

      {locations.length > 0 &&
      <div className="grid xl:grid-cols-[minmax(0,1fr)_290px]">
          <div className={`relative ${heightClassName} xl:h-auto min-h-[360px]`}>
            <MapContainer
            center={[12.8797, 121.774]}
            zoom={6}
            scrollWheelZoom
            className="h-full w-full z-0"
            aria-label="Relief locations map">
            
              <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            
              <MapViewport location={focused} zoom={focusLocationId ? 15 : 11} />
              {showVehicles && <LiveShipmentMarkers locations={locations} />}
              {locations.flatMap((location, index) => locations.slice(index + 1).filter((other) => (location.operationIds ?? []).some((operationId) => other.operationIds?.includes(operationId))).map((other) => (
              <Polyline key={`operation-${location.id}-${other.id}`} positions={[location.coordinates, other.coordinates]} pathOptions={{ color: '#d97706', opacity: 0.55, weight: 2, dashArray: '3 7' }} />
            )))}
              {locations.map((location) =>
            <Marker
              key={location.id}
              position={location.coordinates}
              icon={makeIcon(location.kind)}
              eventHandlers={{
                click: () => setSelectedId(location.id),
                mouseover: () => setHoveredId(location.id),
                mouseout: () => setHoveredId('')
              }}>
              
                  <Popup>
                    <p className="font-semibold text-sm text-slate-900">{location.name}</p>
                    <p className="text-xs text-slate-500 mt-1">{location.detail}</p>
                  </Popup>
                </Marker>
            )}
            </MapContainer>
          </div>

          {showList && selected &&
        <aside className="border-t border-line p-4 xl:border-l xl:border-t-0">
              <div className="flex items-center gap-2">
                {React.createElement(kindIcon[selected.kind], { className: 'w-4 h-4 text-brand-700' })}
                <span className="text-[11px] font-bold uppercase tracking-wide text-brand-700">
                  {locationLabel[selected.kind]}
                </span>
              </div>
              <h3 className="mt-2 text-base font-bold text-ink">{selected.name}</h3>
                {selected.imageUrl &&
              <img src={selected.imageUrl} alt={`${selected.name} site`} className="mt-3 aspect-[16/9] w-full rounded-lg object-cover" />
              }
              <p className="mt-1 flex gap-1.5 text-xs leading-relaxed text-muted">
                <MapPinIcon className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                {[selected.address, selected.city, selected.province].filter(Boolean).join(', ')}
              </p>

              {selected.detail &&
          <div className="mt-4 rounded-xl bg-brand-50 p-3 text-brand-800">
                  <p className="text-xs leading-relaxed">{selected.detail}</p>
                </div>
          }

              {selected.operatedBy &&
            <p className="mt-3 text-xs text-muted"><span className="font-semibold text-ink">Operated by</span> · {selected.operatedBy}</p>
            }
              {selected.contactPhone &&
            <a href={`tel:${selected.contactPhone}`} className="mt-2 block text-xs font-semibold text-brand-700">Call {selected.contactPhone}</a>
            }
                {selected.feedbackRating != null &&
              <p className="mt-2 text-xs text-muted">Feedback · <span className="font-semibold text-ink">{selected.feedbackRating.toFixed(1)}/5</span>{selected.feedbackCount != null ? ` from ${selected.feedbackCount} responses` : ''}</p>
            }
              {selected.volunteersNeeded !== undefined &&
            <p className="mt-2 text-xs font-semibold text-rose-700">{selected.volunteersNeeded} volunteer{selected.volunteersNeeded === 1 ? '' : 's'} needed</p>
            }

              <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${selected.coordinates[0]},${selected.coordinates[1]}`}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand-700 px-3 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-brand-800 focus:outline-none focus:ring-2 focus:ring-brand-600 focus:ring-offset-2">
            
                <NavigationIcon className="w-3.5 h-3.5" /> Get directions
                <ExternalLinkIcon className="w-3.5 h-3.5" />
              </a>

              <div className="mt-4 max-h-32 space-y-1.5 overflow-y-auto pr-1">
                {locations.
            filter((location) => location.id !== selected.id).
            map((location) =>
            <button
              key={location.id}
              onClick={() => setSelectedId(location.id)}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs text-muted transition-colors hover:bg-gray-50 hover:text-ink">
              
                      <span className={`h-2 w-2 shrink-0 rounded-full relief-map-marker--${location.kind}`} />
                      <span className="truncate">{location.name}</span>
                    </button>
            )}
              </div>
            </aside>
        }
        </div>
      }
    </section>);

}
