
/**
 * These types mirror the ReliefTrack MySQL schema exactly.
 * Column names are converted to camelCase in the PHP layer.
 */

export type Trend = 'up' | 'down' | 'flat';

export interface Kpi {
  id: string;
  label: string;
  value: string;
  sub: string;
  delta: string;
  trend: Trend;
}

/* ---------- operations ---------- */

export type OperationStatus = 'planned' | 'active' | 'completed' | 'cancelled';

export interface Operation {
  id: string;
  name: string;
  description: string;
  type: string;
  status: OperationStatus;
  startDate: string;
  endDate: string;
  locationCount: number;
  volunteersNeeded: number;
  volunteerShortfall?: number;
}

/* ---------- locations ---------- */

export type Coordinates = [number, number];

export type LocationKind =
'warehouse' |
'evacuation_center' |
'distribution_center' |
'donation_center' |
'affected_area' |
'other' |
'vehicle';

export interface ReliefLocation {
  id: string;
  kind: LocationKind;
  name: string;
  address: string;
  city: string;
  province: string;
  coordinates: Coordinates;
  status: 'active' | 'inactive';
  detail: string;
  contactPhone?: string;
  operatedBy?: string;
  imageUrl?: string;
  feedbackRating?: number;
  feedbackCount?: number;
  volunteersNeeded?: number;
  operationIds?: string[];
}

/* ---------- shifts & signups ---------- */

export type ShiftStatus = 'open' | 'full' | 'ongoing' | 'completed' | 'cancelled';
export type SignupStatus = 'pending' | 'approved' | 'rejected' | 'completed' | 'cancelled';

export interface Shift {
  id: string;
  operationId?: string;
  name: string;
  location: string;
  city: string;
  date: string;
  window: string;
  filled: number;
  approved?: number;
  needed: number;
  status: ShiftStatus;
  coordinates: [number, number] | null;
  requiredSkills?: string[];
}

export interface JoinedShift {
  id: string;
  name: string;
  location: string;
  city: string;
  date: string;
  window: string;
  signupStatus: SignupStatus;
  checkedInAt?: string | null;
  hours: number;
  coordinates: [number, number] | null;
}

/* ---------- volunteers ---------- */

export interface Skill {
  id: string;
  name: string;
  description: string;
}

export interface VolunteerProfile {
  volunteerId: string;
  fullName: string;
  email: string;
  phone: string;
  address?: string;
  status: 'pending' | 'active' | 'inactive' | 'suspended';
  skills: string[];
  drivingLicenseNumber?: string;
  drivingLicenseType?: string;
  firstAidQualification?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  verificationStatus?: 'unverified' | 'pending' | 'approved' | 'rejected';
  verificationPhoto?: string | null;
  verificationSubmittedAt?: string | null;
  verificationNotes?: string | null;
}

export interface VolunteerSkillVerification {
  verificationId: number;
  volunteerId: number;
  skillId: number;
  skillName: string;
  photoFilename: string;
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: string;
  reviewedBy?: number | null;
  reviewedAt?: string | null;
  notes?: string | null;
}

export interface VolunteerRosterEntry {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  address?: string;
  status: string;
  skills: string[];
  shiftsCompleted: number;
  emergencyContact?: string;
  emergencyPhone?: string;
  drivingLicenseNumber?: string;
  drivingLicenseType?: string;
  firstAidQualification?: string;
  verificationStatus?: 'unverified' | 'pending' | 'approved' | 'rejected';
  verificationPhoto?: string | null;
  verificationSubmittedAt?: string | null;
  verificationNotes?: string | null;
}

export interface VolunteerCheckInResult {
  volunteerId: string;
  fullName: string;
  status: VolunteerProfile['status'];
  shiftId: string;
  shiftName: string;
  checkedInAt: string;
  alreadyCheckedIn: boolean;
}

export interface RegistrationDetails {
  fullName: string;
  email: string;
  phone: string;
  address: string;
  emergencyContact: string;
  emergencyPhone: string;
  skillIds: string[];
  drivingLicenseNumber: string;
  drivingLicenseType: string;
  firstAidQualification: string;
}

/* ---------- donations ---------- */

export type DonationType = 'cash' | 'goods' | 'mixed';

export type TrackStage = 'pledged' | 'received' | 'verified' | 'allocated' | 'in_transit' | 'distributed';

export interface DonationItem {
  name: string;
  category: string;
  quantity: number;
  unit: string;
}

export interface DonationUpdate {
  stage: TrackStage;
  message: string;
  time: string;
  location?: string | null;
}

export interface TrackedDonation {
  reference: string;
  donor: string;
  donorEmail: string;
  type: DonationType;
  amount: string;
  operation: string;
  destination: string;
  donorPreference?: string;
  paymentProof?: string;
  destinationLocationId?: string | null;
  dropOffLocation?: string;
  dropOffLocationId?: string | null;
  shipmentTracking?: {
    reference: string;
    status: ShipmentStatus;
    coordinates: Coordinates | null;
    locationUpdatedAt: string | null;
    lastLocation?: string | null;
    origin?: string | null;
    destination?: string | null;
    originCoordinates?: Coordinates | null;
    destinationCoordinates?: Coordinates | null;
  } | null;
  date: string;
  stage: TrackStage;
  items: DonationItem[];
  updates: DonationUpdate[];
}

export interface DonorEntry {
  id: string;
  donor: string;
  donorEmail: string;
  type: DonationType;
  amount: string;
  destination: string;
  status: string;
  time: string;
  itemSummary?: string;
  dropOffLocation?: string;
  lastCheckpoint?: string | null;
  shipmentReference?: string | null;
  shipmentStatus?: ShipmentStatus | null;
  donorPreference?: string;
  paymentProof?: string;
  destinationLocationId?: string | null;
  dropOffLocationId?: string | null;
}

export interface DonationRequest {
  donorName: string;
  donorEmail: string;
  donorPhone: string;
  donationType: DonationType;
  amount: number;
  operationId: string;
  preferredLocationId: string | null;
  dropOffLocationId: string | null;
  donorPreference: string;
  paymentProof?: string;
  items: DonationItem[];
}

/* ---------- inventory & needs ---------- */

export interface InventoryItem {
  id: string;
  itemName: string;
  category: string;
  location: string;
  quantity: number;
  unit: string;
  minimumStock: number;
  status: 'available' | 'low_stock' | 'out_of_stock';
}

export type Priority = 'low' | 'medium' | 'high' | 'critical';

export interface NeededItem {
  id: string;
  itemName: string;
  category: string;
  location: string;
  quantityNeeded: number;
  quantityReceived: number;
  priority: Priority;
  status: 'needed' | 'partially_fulfilled' | 'fulfilled';
}

/* ---------- logistics ---------- */

export type ShipmentStatus = 'pending' | 'packed' | 'in_transit' | 'delivered' | 'cancelled';

export interface Shipment {
  id: string;
  reference: string;
  origin: string;
  destination: string;
  itemDescription: string;
  quantity: number;
  vehicle: string;
  plateNumber: string;
  status: ShipmentStatus;
  note: string;
  coordinates: [number, number] | null;
  locationUpdatedAt?: string | null;
  donationReference?: string | null;
  driverId?: string | null;
  donor?: string | null;
  originCoordinates?: Coordinates | null;
  originAddress?: string;
  destinationAddress?: string;
}

export interface Vehicle {
  id: string;
  name: string;
  plateNumber: string;
  driverName: string;
  status: 'available' | 'in_use' | 'maintenance' | 'unavailable';
  hasDriverAccount?: boolean;
}

export interface DriverProfile { driverId: string; fullName: string; email: string; phone?: string; drivingLicenseNumber?: string; drivingLicenseType?: string; vehicleName: string; plateNumber: string; }
export interface DriverRosterEntry extends DriverProfile { status: 'pending' | 'active' | 'inactive'; vehicleId: string | null; completedDeliveries: number; }

export interface CreateShipmentRequest {
  donationReference: string;
  vehicleId: string;
  sourceLocationId: string;
  destinationLocationId: string;
  note?: string;
}

/* ---------- alerts & activity ---------- */

export interface Alert {
  id: string;
  type: 'inventory' | 'volunteer' | 'donation' | 'shipment' | 'operation' | 'system';
  title: string;
  message: string;
  priority: Priority;
  isRead: boolean;
  time: string;
}

export interface ActivityItem {
  id: string;
  action: string;
  description: string;
  module: string;
  staff: string;
  time: string;
}

/* ---------- dashboard ---------- */

export interface TrendPoint {
  day: string;
  cash: number;
  goods: number;
}

export interface CategorySlice {
  category: string;
  quantity: number;
}

export interface DashboardSummary {
  kpis: Kpi[];
  alerts: Alert[];
  activity: ActivityItem[];
  donationTrend: TrendPoint[];
  categoryMix: CategorySlice[];
}
