import { useEffect, useRef, useState } from 'react';
import { ArrowUpRightIcon, LocateFixedIcon, LogOutIcon, MapPinIcon, NavigationIcon, PackageCheckIcon, TruckIcon } from 'lucide-react';
import { useDriverAuth } from '../../contexts/DriverAuth';
import { useResource } from '../../hooks/useResource';
import { getDriverShipments, registerDriver, updateShipmentLocation, updateShipmentStatus } from '../../services/reliefService';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../components/StateViews';
import { shipmentLabel, shipmentStyle } from '../../components/LogisticsTable';
import type { Shipment } from '../../types/domain';
import type { PublicRoute } from '../../components/public/PublicNav';

export function DriverPortal({ onNavigate }: { onNavigate: (route: PublicRoute) => void }) {
  const { driver, restoring, busy, error, signIn } = useDriverAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [licenseType, setLicenseType] = useState('');
  const [registrationMessage, setRegistrationMessage] = useState('');
  if (restoring) return <main className="mx-auto max-w-3xl px-4 py-20 text-center text-sm text-muted">Restoring driver session…</main>;
  if (driver) return <DriverDashboard onNavigate={onNavigate} />;

  return <main className="mx-auto grid min-h-[70vh] max-w-5xl items-center gap-10 px-4 py-12 sm:px-6 lg:grid-cols-2">
    <div><span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-100 text-brand-800"><TruckIcon className="h-6 w-6" /></span>
      <p className="mt-6 text-xs font-bold uppercase tracking-[0.18em] text-brand-700">Driver portal</p>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-ink">Your route, all in one place.</h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-muted">Sign in to see shipments assigned to your vehicle, navigate to the relief site, and share your live location during delivery.</p>
    </div>
    <form onSubmit={(event) => { event.preventDefault(); if (creatingAccount) void registerDriver({ fullName, email, password, phone, drivingLicenseNumber: licenseNumber, drivingLicenseType: licenseType }).then(() => { setRegistrationMessage('Driver account request sent. An administrator must activate your account and assign a vehicle before you can sign in.'); setCreatingAccount(false); setPassword(''); }).catch((cause) => setRegistrationMessage(cause instanceof Error ? cause.message : 'Could not create driver account.')); else void signIn(email, password); }} className="rounded-2xl border border-line bg-white p-6 shadow-sm">
      <h2 className="text-lg font-bold text-ink">{creatingAccount ? 'Create driver account' : 'Driver sign in'}</h2>
      {creatingAccount && <label className="mt-5 block text-xs font-semibold text-muted">Full name<input required autoComplete="name" value={fullName} onChange={(event) => setFullName(event.target.value)} className="mt-1.5 w-full rounded-lg border border-line px-3 py-2.5 text-sm text-ink" /></label>}
      <label className="mt-5 block text-xs font-semibold text-muted">Email
        <input required type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1.5 w-full rounded-lg border border-line px-3 py-2.5 text-sm text-ink" />
      </label>
      {creatingAccount && <>
        <label className="mt-4 block text-xs font-semibold text-muted">Phone<input value={phone} onChange={(event) => setPhone(event.target.value)} className="mt-1.5 w-full rounded-lg border border-line px-3 py-2.5 text-sm text-ink" /></label>
        <label className="mt-4 block text-xs font-semibold text-muted">Driving license number<input value={licenseNumber} onChange={(event) => setLicenseNumber(event.target.value)} className="mt-1.5 w-full rounded-lg border border-line px-3 py-2.5 text-sm text-ink" /></label>
        <label className="mt-4 block text-xs font-semibold text-muted">Driving license type<input value={licenseType} onChange={(event) => setLicenseType(event.target.value)} className="mt-1.5 w-full rounded-lg border border-line px-3 py-2.5 text-sm text-ink" /></label>
      </>}
      <label className="mt-4 block text-xs font-semibold text-muted">Password
        <input required minLength={creatingAccount ? 10 : undefined} type="password" autoComplete={creatingAccount ? 'new-password' : 'current-password'} value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1.5 w-full rounded-lg border border-line px-3 py-2.5 text-sm text-ink" />
      </label>
      {error && <p role="alert" className="mt-4 rounded-lg bg-rose-50 px-3 py-2.5 text-xs font-medium text-rose-700">{error}</p>}
      <button type="submit" disabled={busy} className="mt-5 w-full rounded-lg bg-brand-800 px-4 py-3 text-sm font-bold text-white hover:bg-brand-900 disabled:opacity-60">{busy ? (creatingAccount ? 'Creating…' : 'Signing in…') : (creatingAccount ? 'Request driver account' : 'Sign in to routes')}</button>
      {registrationMessage && <p role="status" className="mt-4 rounded-lg bg-emerald-50 px-3 py-2.5 text-xs font-medium text-emerald-800">{registrationMessage}</p>}
      <button type="button" onClick={() => setCreatingAccount(!creatingAccount)} className="mt-3 w-full rounded-lg border border-line px-4 py-3 text-sm font-bold text-ink hover:bg-gray-50">{creatingAccount ? 'Already have an account? Sign in' : 'Need a driver account? Create one'}</button>
      <p className="mt-4 text-xs leading-relaxed text-muted">New driver accounts need administrator approval and a vehicle assignment before route access is enabled.</p>
      {import.meta.env.VITE_DATA_MODE !== 'api' && <p className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-xs text-muted">Local preview sign-in: <span className="font-semibold text-ink">driver@relieftrack.local</span> / <span className="font-semibold text-ink">driver12345</span></p>}
    </form>
  </main>;
}

function DriverDashboard({ onNavigate }: { onNavigate: (route: PublicRoute) => void }) {
  const { driver, signOut, updateProfile, deleteAccount, busy, error } = useDriverAuth();
  const shipments = useResource(getDriverShipments);
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState(driver?.fullName ?? '');
  const [phone, setPhone] = useState(driver?.phone ?? '');
  const [licenseNumber, setLicenseNumber] = useState(driver?.drivingLicenseNumber ?? '');
  const [licenseType, setLicenseType] = useState(driver?.drivingLicenseType ?? '');
  const [accountMessage, setAccountMessage] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  useEffect(() => { const timer = window.setInterval(() => { void shipments.reload(); }, 15000); return () => window.clearInterval(timer); }, [shipments.reload]);
  const rows = shipments.data ?? [];
  return <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
    <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-brand-900 px-5 py-5 text-white sm:px-7">
      <div><p className="text-xs font-semibold uppercase tracking-wider text-brand-100">Driver workspace</p><h1 className="mt-1 text-2xl font-extrabold">Welcome, {driver?.fullName}</h1><p className="mt-1 text-sm text-brand-100">{driver?.vehicleName} · {driver?.plateNumber}</p></div>
      <div className="flex gap-2"><button onClick={() => setEditing(!editing)} className="rounded-lg bg-white/10 px-3 py-2 text-xs font-bold hover:bg-white/20">Profile settings</button><button onClick={() => { signOut(); onNavigate('driver'); }} className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-xs font-bold hover:bg-white/20"><LogOutIcon className="h-4 w-4" /> Sign out</button></div>
    </header>
    {editing && <section className="mt-5 rounded-2xl border border-line bg-white p-5">
      <h2 className="text-lg font-bold text-ink">Driver account settings</h2><p className="mt-1 text-xs text-muted">Email and assigned vehicle are managed by your administrator.</p>
      <form onSubmit={async (event) => { event.preventDefault(); setAccountMessage(''); if (await updateProfile({ fullName, phone, drivingLicenseNumber: licenseNumber, drivingLicenseType: licenseType })) setAccountMessage('Profile saved.'); }} className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-semibold text-muted">Full name<input required value={fullName} onChange={(event) => setFullName(event.target.value)} className="mt-1 block w-full rounded-lg border border-line px-3 py-2.5 text-sm text-ink" /></label>
        <label className="text-xs font-semibold text-muted">Phone<input value={phone} onChange={(event) => setPhone(event.target.value)} className="mt-1 block w-full rounded-lg border border-line px-3 py-2.5 text-sm text-ink" /></label>
        <label className="text-xs font-semibold text-muted">Driving license number<input value={licenseNumber} onChange={(event) => setLicenseNumber(event.target.value)} className="mt-1 block w-full rounded-lg border border-line px-3 py-2.5 text-sm text-ink" /></label>
        <label className="text-xs font-semibold text-muted">Driving license type<input value={licenseType} onChange={(event) => setLicenseType(event.target.value)} className="mt-1 block w-full rounded-lg border border-line px-3 py-2.5 text-sm text-ink" /></label>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2"><button disabled={busy} className="rounded-lg bg-brand-800 px-4 py-2.5 text-xs font-bold text-white">{busy ? 'Saving…' : 'Save profile'}</button>{accountMessage && <span role="status" className="text-xs text-emerald-800">{accountMessage}</span>}{error && <span role="alert" className="text-xs text-rose-700">{error}</span>}</div>
      </form>
      <div className="mt-5 border-t border-line pt-4"><h3 className="text-sm font-bold text-rose-800">Delete account</h3><p className="mt-1 text-xs text-muted">Your account will be deactivated, signed out, and removed from new deliveries. Delivery history is retained.</p>
        {!confirmDelete ? <button onClick={() => setConfirmDelete(true)} className="mt-3 rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700">Delete account</button> : <div className="mt-3 flex flex-wrap items-center gap-2"><input required type="password" autoComplete="current-password" value={deletePassword} onChange={(event) => setDeletePassword(event.target.value)} placeholder="Current password" className="rounded-lg border border-line px-3 py-2 text-sm" /><button disabled={busy || !deletePassword} onClick={() => { if (window.confirm('Deactivate your driver account? This action signs you out.')) void deleteAccount(deletePassword).then((deleted) => { if (deleted) { window.alert('Your driver account has been deactivated. Delivery history is retained.'); onNavigate('driver'); } }); }} className="rounded-lg bg-rose-700 px-3 py-2 text-xs font-bold text-white">{busy ? 'Deleting…' : 'Confirm delete'}</button><button onClick={() => setConfirmDelete(false)} className="rounded-lg border border-line px-3 py-2 text-xs font-bold">Cancel</button></div>}
      </div>
    </section>}
    <div className="mt-7 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-brand-700">Assigned work</p><h2 className="mt-1 text-xl font-bold text-ink">Your delivery routes</h2></div><p className="text-xs text-muted">This page refreshes every 15 seconds.</p></div>
    <section className="mt-4 space-y-4">
      {shipments.loading && <LoadingBlock label="Loading your assigned shipments" rows={2} />}
      {shipments.error && <ErrorBlock message={shipments.error} onRetry={shipments.reload} />}
      {shipments.data && rows.length === 0 && <EmptyBlock message="No active shipments are assigned to your vehicle yet. Your coordinator will prepare a route here." />}
      {rows.map((shipment) => <DriverShipmentCard key={shipment.id} shipment={shipment} onChanged={shipments.reload} />)}
    </section>
  </main>;
}

function DriverShipmentCard({ shipment, onChanged }: { shipment: Shipment; onChanged: () => void }) {
  const [sharing, setSharing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const lastSentAt = useRef(0);
  useEffect(() => {
    if (!sharing) return;
    if (!navigator.geolocation) { setMessage('GPS is not available on this device.'); setSharing(false); return; }
    const watchId = navigator.geolocation.watchPosition(async ({ coords }) => {
      if (Date.now() - lastSentAt.current < 10000) return;
      lastSentAt.current = Date.now();
      try { await updateShipmentLocation(shipment.id, coords.latitude, coords.longitude); setMessage(`Live location shared · ${new Date().toLocaleTimeString()}`); onChanged(); }
      catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Could not share your location.'); }
    }, (cause) => setMessage(cause.code === cause.PERMISSION_DENIED ? 'Allow location access in your browser settings to share GPS.' : 'Could not read GPS. Check that location services are on.'), { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 });
    return () => navigator.geolocation.clearWatch(watchId);
  }, [sharing, shipment.id, onChanged]);

  const setStatus = async (status: 'in_transit' | 'delivered') => {
    setBusy(true); setMessage('');
    try { await updateShipmentStatus(shipment.id, status); if (status === 'in_transit') setSharing(true); if (status === 'delivered') setSharing(false); setMessage(status === 'in_transit' ? 'Trip started. GPS sharing will begin after you allow location access.' : 'Delivery confirmed. Thank you!'); onChanged(); }
    catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Could not update shipment.'); }
    finally { setBusy(false); }
  };
  const directions = `https://www.google.com/maps/dir/?api=1&${shipment.originCoordinates ? `origin=${shipment.originCoordinates[0]},${shipment.originCoordinates[1]}` : `origin=${encodeURIComponent(shipment.originAddress || shipment.origin)}`}&${shipment.coordinates ? `destination=${shipment.coordinates[0]},${shipment.coordinates[1]}` : `destination=${encodeURIComponent(shipment.destinationAddress || shipment.destination)}`}`;

  return <article className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4"><div className="flex items-center gap-2"><span className="rounded-lg bg-brand-50 p-2 text-brand-800"><TruckIcon className="h-4 w-4" /></span><span className="font-mono text-sm font-bold text-ink">{shipment.reference}</span></div><span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${shipmentStyle[shipment.status]}`}>{shipmentLabel[shipment.status]}</span></div>
    <div className="grid gap-5 p-5 md:grid-cols-[1fr_auto]">
      <div><p className="text-sm font-bold text-ink">{shipment.itemDescription || 'Relief supplies'} <span className="font-medium text-muted">· {shipment.quantity} items</span></p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="rounded-xl bg-gray-50 p-3"><p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-muted"><MapPinIcon className="h-3 w-3" /> Pickup</p><p className="mt-1 text-sm font-semibold text-ink">{shipment.origin}</p><p className="text-xs text-muted">{shipment.originAddress}</p></div><div className="rounded-xl bg-brand-50 p-3"><p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-brand-800"><PackageCheckIcon className="h-3 w-3" /> Destination</p><p className="mt-1 text-sm font-semibold text-ink">{shipment.destination}</p><p className="text-xs text-muted">{shipment.destinationAddress}</p></div></div>
        {shipment.locationUpdatedAt && <p className="mt-3 text-xs text-muted">Last GPS update: {new Date(shipment.locationUpdatedAt).toLocaleString()}</p>}
      </div>
      <div className="flex flex-wrap content-start gap-2 md:max-w-56 md:flex-col">
        <a href={directions} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-lg border border-line px-3 py-2.5 text-xs font-bold text-ink hover:bg-gray-50"><NavigationIcon className="h-4 w-4" /> Open route <ArrowUpRightIcon className="h-3.5 w-3.5" /></a>
        {shipment.status === 'packed' && <button disabled={busy} onClick={() => void setStatus('in_transit')} className="rounded-lg bg-brand-800 px-3 py-2.5 text-xs font-bold text-white hover:bg-brand-900 disabled:opacity-50">{busy ? 'Updating…' : 'Pick up & start trip'}</button>}
        {shipment.status === 'in_transit' && <><button onClick={() => setSharing(!sharing)} className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs font-bold ${sharing ? 'bg-rose-50 text-rose-700' : 'bg-brand-800 text-white hover:bg-brand-900'}`}><LocateFixedIcon className="h-4 w-4" />{sharing ? 'Stop sharing GPS' : 'Share live GPS'}</button><button disabled={busy} onClick={() => void setStatus('delivered')} className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100">{busy ? 'Updating…' : 'Confirm delivery'}</button></>}
      </div>
    </div>
    {message && <p role="status" className="border-t border-line bg-gray-50 px-5 py-3 text-xs font-medium text-muted">{message}</p>}
  </article>;
}
