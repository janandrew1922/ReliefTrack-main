
import type { DonationType, Priority, TrackStage } from '../types/domain';

/**
 * Content that is NOT stored in the database — copy, labels, palettes,
 * and the organisation's own payment accounts.
 */

/* Matches the donation_updates.status enum, in the order a donor sees it. */
export const stageOrder: TrackStage[] = [
'pledged',
'received',
'verified',
'allocated',
'in_transit',
'distributed'];


export const stageLabel: Record<TrackStage, string> = {
  pledged: 'Donation pledged',
  received: 'Received at the hub',
  verified: 'Contents verified',
  allocated: 'Allocated to a community',
  in_transit: 'On the way',
  distributed: 'Distributed to families'
};

export function donationStageLabel(stage: TrackStage, type: DonationType): string {
  if (type === 'cash') {
    const cashLabels: Partial<Record<TrackStage, string>> = {
      pledged: 'Payment pledged', received: 'Payment received', verified: 'Payment verified',
      allocated: 'Funds allocated', distributed: 'Funds delivered'
    };
    return cashLabels[stage] ?? stageLabel[stage];
  }
  return stageLabel[stage];
}

export const priorityLabel: Record<Priority, string> = {
  critical: 'Most needed',
  high: 'Urgently needed',
  medium: 'Needed',
  low: 'Helpful'
};

export const priorityStyle: Record<Priority, string> = {
  critical: 'bg-rose-50 text-rose-700',
  high: 'bg-amber-50 text-amber-700',
  medium: 'bg-sky-50 text-sky-700',
  low: 'bg-brand-50 text-brand-700'
};

export const categoryPalette = ['#0f766e', '#14b8a6', '#2dd4bf', '#5eead4', '#99f6e4', '#0e7490'];

export type PaymentChannel = 'gcash' | 'bank';

export interface PaymentAccount {
  id: PaymentChannel;
  name: string;
  detail: string;
  accountName: string;
  accountNumber: string;
  extra?: string;
  steps: string[];
}

export const paymentAccounts: PaymentAccount[] = [
{
  id: 'gcash',
  name: 'GCash',
  detail: 'Send via the GCash app · no service fee',
  accountName: 'ReliefTrack Disaster Response Fund',
  accountNumber: '0917 555 0142',
  steps: [
  'Open GCash and tap Send Money.',
  'Enter the number above and the exact amount.',
  'Type your reference number in the notes field.',
  'Screenshot the receipt and enter the transaction number below.']

},
{
  id: 'bank',
  name: 'Bank transfer',
  detail: 'BPI · InstaPay or online banking',
  accountName: 'ReliefTrack Disaster Response Fund Inc.',
  accountNumber: '4081 2255 3901',
  extra: 'BPI · Branch: Ortigas Center',
  steps: [
  'Log in to your online banking app.',
  'Transfer to the account name and number above.',
  'Use your reference number as the transfer remark.',
  'Save the confirmation slip and enter its number below.']

}];


export const donationAmounts = [500, 1000, 2500, 5000];

export const whatToBring = [
'A valid ID for hub check-in',
'Comfortable clothes and closed shoes',
'Your own water bottle — meals are provided at most hubs'];


export const howItWorks: [string, string][] = [
['You donate', 'Give funds online or drop off goods at a center near you.'],
['Volunteers repack', 'Your donation is sorted and packed into family relief packs.'],
['We deliver', 'Packs are loaded and dispatched to the affected community.'],
['Families receive', 'Your tracking page updates when your donation is distributed.']];


export const peso = (value: number) =>
'\u20B1' + new Intl.NumberFormat('en-PH', { maximumFractionDigits: 0 }).format(value);
