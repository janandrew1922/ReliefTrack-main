import { useEffect, useState } from 'react';
import L from 'leaflet';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { LoaderCircleIcon, MapPinIcon, SearchIcon } from 'lucide-react';
import type { Coordinates } from '../types/domain';
import 'leaflet/dist/leaflet.css';

const caloocanCenter: Coordinates = [14.6547, 120.9830];

function markerIcon() {
  return L.divIcon({
    className: 'relief-map-icon',
    html: '<span class="relief-map-marker relief-map-marker--distribution_center">+</span>',
    iconSize: [34, 34],
    iconAnchor: [17, 17]
  });
}

function MapClickHandler({ onPick }: { onPick: (coordinates: Coordinates) => void }) {
  useMapEvents({
    click: (event) => onPick([event.latlng.lat, event.latlng.lng])
  });
  return null;
}

function MapPan({ coordinates }: { coordinates: Coordinates }) {
  const map = useMap();
  useEffect(() => { map.flyTo(coordinates, Math.max(map.getZoom(), 14), { duration: 0.6 }); }, [coordinates, map]);
  return null;
}

interface AddressResult { display_name: string; lat: string; lon: string; }

interface LocationPickerProps {
  coordinates: Coordinates;
  onChange: (coordinates: Coordinates) => void;
  onAddressResolved?: (address: string) => void;
}

export function LocationPicker({ coordinates = caloocanCenter, onChange, onAddressResolved }: LocationPickerProps) {
  const [resolving, setResolving] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<AddressResult[]>([]);

  const searchAddress = async () => {
    const search = query.trim();
    if (!search) { setLookupError('Enter an address or place to search.'); return; }
    setSearching(true); setLookupError(null); setResults([]);
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&countrycodes=ph&limit=5&q=${encodeURIComponent(search)}`, { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error('Address search failed.');
      const found = await response.json() as AddressResult[];
      if (!found.length) { setLookupError('No matching address found. Try a nearby street, barangay, or landmark.'); return; }
      setResults(found);
    } catch {
      setLookupError('Could not search addresses. Check your connection and try again.');
    } finally { setSearching(false); }
  };

  const resolveAddress = async () => {
    setResolving(true);
    setLookupError(null);
    try {
      const [latitude, longitude] = coordinates;
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`, {
        headers: { Accept: 'application/json' }
      });
      if (!response.ok) throw new Error('Address lookup failed.');
      const result = await response.json() as { display_name?: string };
      if (!result.display_name) throw new Error('No address was found for this point.');
      onAddressResolved?.(result.display_name);
    } catch {
      setLookupError('Could not resolve the address. Enter the exact address manually.');
    } finally {
      setResolving(false);
    }
  };

  return (
    <div>
      <div className="mb-2">
        <label className="sr-only" htmlFor="location-address-search">Search address</label>
        <div className="flex gap-2"><input id="location-address-search" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void searchAddress(); } }} placeholder="Search address, barangay, or landmark" className="min-w-0 flex-1 rounded-lg border border-line px-3 py-2.5 text-sm" /><button type="button" onClick={() => void searchAddress()} disabled={searching} className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-brand-800 px-3 py-2 text-xs font-bold text-white disabled:opacity-60">{searching ? <LoaderCircleIcon className="h-4 w-4 animate-spin" /> : <SearchIcon className="h-4 w-4" />}{searching ? 'Searching' : 'Search'}</button></div>
        {results.length > 0 && <ul className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-line bg-white">{results.map((result) => <li key={`${result.lat},${result.lon}`}><button type="button" onClick={() => { const point: Coordinates = [Number(result.lat), Number(result.lon)]; onChange(point); onAddressResolved?.(result.display_name); setQuery(result.display_name); setResults([]); setLookupError(null); }} className="w-full border-b border-line px-3 py-2 text-left text-xs text-ink last:border-0 hover:bg-brand-50">{result.display_name}</button></li>)}</ul>}
      </div>
      <div className="h-56 overflow-hidden rounded-xl border border-line">
        <MapContainer center={coordinates} zoom={14} scrollWheelZoom className="h-full w-full" aria-label="Choose operation location">
          <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <MapPan coordinates={coordinates} />
          <MapClickHandler onPick={onChange} />
          <Marker position={coordinates} icon={markerIcon()} />
        </MapContainer>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5"><MapPinIcon className="h-3.5 w-3.5 text-brand-700" /> Click the exact checkpoint on the map.</span>
        <button type="button" onClick={resolveAddress} disabled={resolving} className="inline-flex items-center gap-1.5 font-bold text-brand-700 hover:text-brand-800 disabled:opacity-60">
          {resolving && <LoaderCircleIcon className="h-3.5 w-3.5 animate-spin" />}
          {resolving ? 'Finding address...' : 'Resolve address from pin'}
        </button>
      </div>
      {lookupError && <p role="alert" className="mt-2 text-xs text-amber-700">{lookupError}</p>}
    </div>
  );
}
