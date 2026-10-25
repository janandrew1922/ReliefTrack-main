
import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CalendarIcon, ClockIcon, MapPinIcon, XIcon } from 'lucide-react';
import { useVolunteerAuth } from '../../contexts/VolunteerAuth';
import { useResource } from '../../hooks/useResource';
import { getSkills, volunteerUploadSkillVerification } from '../../services/reliefService';
import type { Shift } from '../../types/domain';

interface VolunteerSignupModalProps {
  shift: Shift | null;
  selectedSkill: string;
  onClose: () => void;
  onRegistered: () => void;
}

async function prepareSkillPhoto(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Choose an image file.');
  const bitmap = await createImageBitmap(file);
  try {
    let maxDimension = 1800;
    while (maxDimension >= 600) {
      const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Could not prepare this image. Please choose another photo.');
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      let quality = 0.82;
      let blob: Blob | null = null;
      do {
        blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
        if (blob && blob.size <= 2.5 * 1024 * 1024) break;
        quality -= 0.12;
      } while (quality >= 0.46);
      if (blob && blob.size <= 2.5 * 1024 * 1024) {
        return await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Could not read this photo.'));
          reader.onerror = () => reject(new Error('Could not read this photo.'));
          reader.readAsDataURL(blob!);
        });
      }
      maxDimension = Math.floor(maxDimension * 0.75);
    }
    throw new Error('Photo is too large to prepare. Choose a smaller image.');
  } finally {
    bitmap.close();
  }
}

export function VolunteerSignupModal({ shift, selectedSkill, onClose, onRegistered }: VolunteerSignupModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const { volunteer, register, joinShift, busy, error, signOut, sendCode, verifyCode } = useVolunteerAuth();
  const skills = useResource(getSkills);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [drivingLicenseNumber, setDrivingLicenseNumber] = useState('');
  const [drivingLicenseType, setDrivingLicenseType] = useState('');
  const [firstAidQualification, setFirstAidQualification] = useState('');
  const [skillPhotos, setSkillPhotos] = useState<Record<string, string>>({});
  const [verificationCode, setVerificationCode] = useState('');
  const [debugCode, setDebugCode] = useState('');
  const [awaitingEmailVerification, setAwaitingEmailVerification] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [uploadingSkillProof, setUploadingSkillProof] = useState(false);
  const [processingSkillPhoto, setProcessingSkillPhoto] = useState(false);
  const [skillUploadError, setSkillUploadError] = useState<string | null>(null);

  // Reset the form and verification state whenever the modal is closed or a
  // different shift is selected, so re-opening starts from registration.
  useEffect(() => {
    if (!shift) {
      setAwaitingEmailVerification(false);
      setVerificationCode('');
      setDebugCode('');
    }
  }, [shift]);

  const selectedSkills = (skills.data ?? []).filter((skill) => skill.name === selectedSkill);
  const skillIds = selectedSkills.map((skill) => skill.id);
  const selectedSkillNames = selectedSkills.map((skill) => skill.name);
  const needsValidId = selectedSkillNames.some((name) => /^(distribution|packing)(\b|\s|&)/i.test(name));
  const needsDrivingDetails = selectedSkillNames.includes('Driving');
  const needsFirstAidDetails = selectedSkillNames.includes('First Aid');

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!shift || !dialog) return;
    const focusable = Array.from(dialog.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'));
    focusable[0]?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      } else if (event.key === 'Tab' && focusable.length > 0) {
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [shift, onClose]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!shift) return;

    // Every selected skill needs proof before registration can proceed.
    if (!volunteer && skillIds.some((skillId) => !skillPhotos[skillId])) {
      setSkillUploadError('Upload a verification photo for each selected skill to continue.');
      return;
    }

    if (awaitingEmailVerification) {
      if (!emailVerified) {
        if (!(await verifyCode(email, verificationCode))) return;
        setEmailVerified(true);
      }

      setUploadingSkillProof(true);
      setSkillUploadError(null);
      try {
        for (const skillId of skillIds) {
          const photo = skillPhotos[skillId];
          if (photo) await volunteerUploadSkillVerification(skillId, photo);
        }
        onRegistered();
      } catch (cause) {
        setSkillUploadError(cause instanceof Error ? cause.message : 'Could not submit skill verification photos. Please try again.');
      } finally {
        setUploadingSkillProof(false);
      }
      return;
    }

    if (volunteer) {
      if (await joinShift(shift.id)) onRegistered();
      return;
    }

    const registered = await register(
      { fullName, email, phone, address, emergencyContact, emergencyPhone, skillIds, drivingLicenseNumber, drivingLicenseType, firstAidQualification },
      shift.id
    );
    if (registered) {
      signOut();
      setAwaitingEmailVerification(true);
      const result = await sendCode(email);
      setDebugCode(result.ok ? result.debugCode ?? '' : '');
    }
  };

  return (
    <AnimatePresence>
      {shift &&
      <motion.div
        ref={dialogRef}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.16, ease: 'easeOut' }}
        className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-6"
        role="dialog"
        aria-modal="true"
        aria-label="Volunteer registration">
        
          <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.98 }}
          transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
          className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white sm:rounded-2xl">
          
            <div className="sticky top-0 flex items-start justify-between gap-3 border-b border-line bg-white px-6 py-4">
              <div>
                <h2 className="text-base font-bold text-ink">
                  {volunteer ? 'Confirm your shift' : 'Volunteer registration'}
                </h2>
                <p className="mt-0.5 text-xs text-muted">
                  {shift.name} · {shift.location}
                </p>
              </div>
              <button
              onClick={onClose}
              aria-label="Close"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-gray-100">
              
                <XIcon className="h-4 w-4" />
              </button>
            </div>

            <div className="px-6 py-5">
              <dl className="flex flex-wrap gap-x-5 gap-y-2 rounded-xl bg-gray-50 px-4 py-3 text-xs text-muted">
                <div className="inline-flex items-center gap-1.5">
                  <MapPinIcon className="h-3.5 w-3.5" /> {shift.city}
                </div>
                <div className="inline-flex items-center gap-1.5">
                  <CalendarIcon className="h-3.5 w-3.5" /> {shift.date}
                </div>
                <div className="inline-flex items-center gap-1.5">
                  <ClockIcon className="h-3.5 w-3.5" /> {shift.window}
                </div>
              </dl>

              <form onSubmit={submit} className="mt-5">
                {volunteer ?
              <div className="rounded-xl bg-brand-50 p-4">
                    <p className="text-sm font-bold text-brand-900">Signed in as {volunteer.fullName}</p>
                    <p className="mt-0.5 font-mono text-xs text-brand-800">Volunteer #{volunteer.volunteerId}</p>
                  </div> : awaitingEmailVerification ?
                  <div className="space-y-4">
                    <p className="text-sm leading-relaxed text-muted">Enter the one-time code sent to <span className="font-semibold text-ink">{email}</span> to verify your email and finish joining.</p>
                    <label className="block">
                      <span className="text-xs font-bold text-ink">Email verification code</span>
                      <input required inputMode="numeric" autoComplete="one-time-code" value={verificationCode} onChange={(event) => setVerificationCode(event.target.value)} className="mt-1.5 w-full rounded-lg border border-line px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-600" />
                    </label>
                    <button type="button" onClick={async () => { const result = await sendCode(email); setDebugCode(result.ok ? result.debugCode ?? '' : ''); }} className="text-xs font-semibold text-brand-700">Resend code</button>
                    <button type="button" onClick={() => { setAwaitingEmailVerification(false); setVerificationCode(''); setDebugCode(''); }} className="text-xs font-semibold text-muted hover:text-ink">Cancel</button>
                    {debugCode && <p className="text-xs font-medium text-amber-700">Development code: <span className="font-mono font-bold">{debugCode}</span></p>}
                  </div> :

              <>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="block">
                        <span className="text-xs font-bold text-ink">Full name</span>
                        <input
                      required
                      value={fullName}
                      onChange={(event) => setFullName(event.target.value)}
                      placeholder="Ana Santos"
                      className="mt-1.5 w-full rounded-lg border border-line px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-600" />
                    
                      </label>
                      <label className="block">
                        <span className="text-xs font-bold text-ink">Email</span>
                        <input
                      type="email"
                      required
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="you@email.com"
                      className="mt-1.5 w-full rounded-lg border border-line px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-600" />
                    
                      </label>
                      <label className="block">
                        <span className="text-xs font-bold text-ink">Mobile number</span>
                        <input
                      required
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      placeholder="09171234567"
                      className="mt-1.5 w-full rounded-lg border border-line px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-600" />
                    
                      </label>
                      <label className="block">
                        <span className="text-xs font-bold text-ink">Address</span>
                        <input
                      required
                      value={address}
                      onChange={(event) => setAddress(event.target.value)}
                      placeholder="City or barangay"
                      className="mt-1.5 w-full rounded-lg border border-line px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-600" />
                    
                      </label>
                      <label className="block">
                        <span className="text-xs font-bold text-ink">Emergency contact</span>
                        <input
                      required
                      value={emergencyContact}
                      onChange={(event) => setEmergencyContact(event.target.value)}
                      placeholder="Full name"
                      className="mt-1.5 w-full rounded-lg border border-line px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-600" />
                    
                      </label>
                      <label className="block">
                        <span className="text-xs font-bold text-ink">Emergency number</span>
                        <input
                      required
                      value={emergencyPhone}
                      onChange={(event) => setEmergencyPhone(event.target.value)}
                      placeholder="09181234567"
                      className="mt-1.5 w-full rounded-lg border border-line px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-600" />
                    
                      </label>
                    </div>

                    {needsDrivingDetails &&
                    <fieldset className="mt-5 grid gap-4 sm:grid-cols-2">
                      <legend className="col-span-full text-xs font-bold text-ink">Driving credentials</legend>
                      <label className="block">
                        <span className="text-xs font-bold text-ink">License number</span>
                        <input required value={drivingLicenseNumber} onChange={(event) => setDrivingLicenseNumber(event.target.value)} className="mt-1.5 w-full rounded-lg border border-line px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-600" />
                      </label>
                      <label className="block">
                        <span className="text-xs font-bold text-ink">License type</span>
                        <input required value={drivingLicenseType} onChange={(event) => setDrivingLicenseType(event.target.value)} placeholder="e.g. Restriction Code B" className="mt-1.5 w-full rounded-lg border border-line px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-600" />
                      </label>
                    </fieldset>
                    }
                    {needsFirstAidDetails &&
                    <label className="mt-5 block">
                      <span className="text-xs font-bold text-ink">First-aid training or qualification</span>
                      <input required value={firstAidQualification} onChange={(event) => setFirstAidQualification(event.target.value)} placeholder="Course, provider, or certification" className="mt-1.5 w-full rounded-lg border border-line px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-600" />
                    </label>
                    }
                    {selectedSkillNames.length > 0 &&
                    <div className="mt-5 space-y-3">
                      <span className="text-xs font-bold text-ink">{needsValidId ? 'Valid ID photo (required)' : 'Skill verification photo (required)'}</span>
                      {selectedSkillNames.map((name) => {
                        const skill = (skills.data ?? []).find((s) => s.name === name);
                        if (!skill) return null;
                        return (
                          <label key={skill.id} className="block">
                            <span className="text-xs text-muted">{needsValidId && /^(distribution|packing)(\b|\s|&)/i.test(name) ? `${name} — upload a valid ID photo` : `${name} — upload ID/certificate photo`}</span>
                            <input required type="file" accept="image/jpeg,image/png,image/webp" disabled={uploadingSkillProof || processingSkillPhoto} onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              setProcessingSkillPhoto(true);
                              setSkillUploadError(null);
                              setSkillPhotos((current) => {
                                const next = { ...current };
                                delete next[skill.id];
                                return next;
                              });
                              void prepareSkillPhoto(file).then((photo) => setSkillPhotos((current) => ({ ...current, [skill.id]: photo })))
                                .catch((cause) => setSkillUploadError(cause instanceof Error ? cause.message : 'Could not prepare this photo.'))
                                .finally(() => setProcessingSkillPhoto(false));
                            }} className="mt-1.5 w-full text-sm" />
                            {processingSkillPhoto && <span className="text-xs text-muted">Preparing photo…</span>}
                            {!processingSkillPhoto && skillPhotos[skill.id] && <span className="text-xs text-green-600">Photo ready to upload</span>}
                          </label>
                        );
                      })}
                    </div>
                    }
                    <p className="mt-4 text-xs text-muted">Email is verified by one-time code. SMS phone verification is not available until an SMS provider is configured.</p>
                  </>
              }

                {skillUploadError && <p role="alert" className="mt-4 rounded-lg bg-rose-50 px-3 py-2.5 text-xs font-medium text-rose-700">{emailVerified ? 'Email verified, but skill proof was not saved: ' : ''}{skillUploadError}{emailVerified ? ' You can retry without entering the code again.' : ''}</p>}

                {error &&
              <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2.5 text-xs font-medium text-rose-700">{error}</p>
              }

                <button
                type="submit"
                disabled={busy || uploadingSkillProof || processingSkillPhoto}
                className="mt-6 w-full rounded-xl bg-brand-700 px-5 py-3.5 text-sm font-bold text-white transition-colors hover:bg-brand-800 disabled:opacity-60">
                
                  {busy ? 'Saving…' : uploadingSkillProof ? 'Submitting skill proof…' : emailVerified ? 'Retry skill proof upload' : volunteer ? 'Confirm this shift' : awaitingEmailVerification ? 'Verify email & finish' : 'Register & continue'}
                </button>
                <p className="mt-3 text-center text-xs text-muted">
                  Your sign-up starts as pending until a coordinator approves it.
                </p>
              </form>
            </div>
          </motion.div>
        </motion.div>
      }
    </AnimatePresence>);

}
