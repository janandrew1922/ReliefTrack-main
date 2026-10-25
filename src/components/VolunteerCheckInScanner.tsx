import { useCallback, useEffect, useRef, useState } from 'react';
import QrScanner from 'qr-scanner';
import { CameraIcon, CheckCircle2Icon, ImageUpIcon, XIcon } from 'lucide-react';
import { ApiError } from '../services/http';
import { checkInVolunteer } from '../services/reliefService';
import type { Shift, VolunteerCheckInResult } from '../types/domain';

interface VolunteerCheckInScannerProps {
  shifts: Shift[];
  onClose: () => void;
  onCheckedIn: (result: VolunteerCheckInResult) => void;
}

export function VolunteerCheckInScanner({ shifts, onClose, onCheckedIn }: VolunteerCheckInScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<QrScanner | null>(null);
  const [shiftId, setShiftId] = useState('');
  const [cameraOn, setCameraOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<VolunteerCheckInResult | null>(null);
  const availableShifts = shifts.filter((shift) => ['open', 'full', 'ongoing'].includes(shift.status));

  useEffect(() => {
    if (!availableShifts.some((shift) => shift.id === shiftId)) {
      setShiftId(availableShifts[0]?.id ?? '');
    }
  }, [availableShifts, shiftId]);

  const processCode = useCallback(async (code: string) => {
    if (!shiftId || busy) return;
    setBusy(true);
    setError('');
    setCameraOn(false);
    try {
      const result = await checkInVolunteer(code, shiftId);
      setSuccess(result);
      onCheckedIn(result);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Could not check in this volunteer. Try another QR code.');
    } finally {
      setBusy(false);
    }
  }, [busy, onCheckedIn, shiftId]);

  useEffect(() => {
    if (!cameraOn || !videoRef.current) return;
    const scanner = new QrScanner(videoRef.current, (result) => void processCode(result.data), {
      preferredCamera: 'environment',
      maxScansPerSecond: 4,
      highlightScanRegion: true,
      returnDetailedScanResult: true
    });
    scannerRef.current = scanner;
    scanner.start().catch(() => setError('Camera access failed. Allow camera permission or upload a QR image instead.'));
    return () => {
      scanner.stop();
      scanner.destroy();
      if (scannerRef.current === scanner) scannerRef.current = null;
    };
  }, [cameraOn, processCode]);

  const scanImage = async (file?: File) => {
    if (!file) return;
    setError('');
    try {
      const result = await QrScanner.scanImage(file, { returnDetailedScanResult: true });
      await processCode(result.data);
    } catch {
      setError('No readable QR code found in that image. Try a clearer photo.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-ink/50 p-4" role="dialog" aria-modal="true" aria-label="Volunteer attendance check-in">
      <section className="my-auto w-full max-w-lg rounded-xl bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-ink">Volunteer attendance</h2>
            <p className="mt-1 text-xs text-muted">Scan the volunteer's ReliefTrack check-in QR code.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close scanner" className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-gray-100">
            <XIcon className="h-4 w-4" />
          </button>
        </header>

        <div className="space-y-4 p-5">
          <label className="block">
            <span className="text-xs font-bold text-ink">Shift</span>
            <select value={shiftId} onChange={(event) => setShiftId(event.target.value)} disabled={!availableShifts.length || busy} className="mt-1.5 w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-600">
              {!availableShifts.length && <option value="">No shifts accepting check-ins</option>}
              {availableShifts.map((shift) => <option key={shift.id} value={shift.id}>{shift.name} · {shift.date} · {shift.location}</option>)}
            </select>
          </label>

          {success ?
          <div className="rounded-lg bg-emerald-50 p-4" role="status">
            <div className="flex items-start gap-3">
              <CheckCircle2Icon className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
              <div>
                <p className="text-sm font-bold text-emerald-900">{success.alreadyCheckedIn ? 'Already checked in' : 'Volunteer checked in'}</p>
                <p className="mt-1 text-sm text-emerald-800">{success.fullName} · {success.shiftName}</p>
                <p className="mt-1 text-xs text-emerald-700">Volunteer status: Active · {new Date(success.checkedInAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</p>
              </div>
            </div>
            <button type="button" onClick={() => setSuccess(null)} className="mt-4 text-xs font-bold text-emerald-800 underline">Scan another volunteer</button>
          </div> :
          <>
            <div className="overflow-hidden rounded-lg bg-ink">
              {cameraOn ?
              <video ref={videoRef} className="aspect-video w-full object-cover" muted playsInline /> :
              <div className="grid aspect-video place-items-center px-6 text-center text-sm text-white/75">
                {busy ? 'Checking volunteer and recording attendance…' : 'Camera preview will appear here.'}
              </div>
              }
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <button type="button" disabled={!shiftId || busy} onClick={() => { setError(''); setCameraOn((current) => !current); }} className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-700 px-4 py-3 text-sm font-bold text-white hover:bg-brand-800 disabled:opacity-50">
                <CameraIcon className="h-4 w-4" /> {cameraOn ? 'Stop camera' : 'Use camera'}
              </button>
              <label className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-line px-4 py-3 text-sm font-bold text-ink hover:bg-gray-50 ${!shiftId || busy ? 'pointer-events-none opacity-50' : ''}`}>
                <ImageUpIcon className="h-4 w-4" /> Upload QR image
                <input type="file" accept="image/*" className="sr-only" disabled={!shiftId || busy} onChange={(event) => { void scanImage(event.target.files?.[0]); event.currentTarget.value = ''; }} />
              </label>
            </div>
          </>
          }

          {error && <p className="rounded-lg bg-rose-50 px-3 py-2.5 text-xs font-medium text-rose-700" role="alert">{error}</p>}
          {!availableShifts.length && <p className="text-xs text-muted">Only open, full, or ongoing shifts can be checked in.</p>}
        </div>
      </section>
    </div>
  );
}