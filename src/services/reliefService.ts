
import { http } from './http';
import type {
  ActivityItem,
  Alert,
  DashboardSummary,
  DonationRequest,
  DonorEntry,
  InventoryItem,
  JoinedShift,
  NeededItem,
  Operation,
  ReliefLocation,
  Shift,
  Shipment,
  Skill,
  TrackedDonation,
  VolunteerProfile,
  VolunteerCheckInResult,
  VolunteerRosterEntry,
  RegistrationDetails,
  TrackStage,
  Coordinates } from
'../types/domain';
import type { CreateShipmentRequest, ShipmentStatus, Vehicle, DriverRosterEntry } from '../types/domain';
import type { AdminProfile } from '../contexts/AdminAuth';
import type { DriverProfile } from '../types/domain';

export const API_ENDPOINTS = {
  adminLogin: 'admin_login.php',
  adminLogout: 'admin_logout.php',
  adminSession: 'admin_session.php',
  createOperation: 'operation_create.php',
  updateOperation: 'operation_update.php',
  deleteOperation: 'operation_delete.php',
  operations: 'operations.php',
  dashboard: 'dashboard.php',
  alerts: 'alerts.php',
  activity: 'activity_log.php',
  inventory: 'inventory.php',
  shipments: 'shipments.php',
  donorLedger: 'donations.php',
  updateDonationStage: 'donation_update_stage.php',
  updateShipmentLocation: 'shipment_update_location.php',
  createShipment: 'shipment_create.php',
  updateShipmentStatus: 'shipment_update_status.php',
  vehicles: 'vehicles.php',
  createDriver: 'admin_driver_create.php',
  registerDriver: 'driver_register.php',
  adminDrivers: 'admin_drivers.php',
  adminDriverManage: 'admin_driver_manage.php',
  driverProfileUpdate: 'driver_profile_update.php',
  driverAccountDelete: 'driver_account_delete.php',
  driverLogin: 'driver_login.php',
  driverSession: 'driver_session.php',
  driverLogout: 'driver_logout.php',
  driverShipments: 'driver_shipments.php',
  deleteDonation: 'admin_donations_delete.php',
  locations: 'locations.php',
  neededItems: 'needed_items.php',
  createDonation: 'donation_create.php',
  trackDonation: 'donation_track.php',
  donationList: 'donation_list.php',
  shifts: 'shifts.php',
  skills: 'skills.php',
  volunteerRoster: 'volunteers.php',
  volunteerCheckIn: 'volunteer_checkin.php',
  volunteerUploadVerification: 'volunteer_upload_verification.php',
  adminVolunteerVerify: 'admin_volunteer_verify.php',
  adminVolunteerStatus: 'admin_volunteer_status.php',
  adminVolunteerDelete: 'admin_volunteer_delete.php',
  adminVolunteerManage: 'admin_volunteer_manage.php',
  volunteerProfileUpdate: 'volunteer_profile_update.php',
  volunteerAccountDelete: 'volunteer_account_delete.php',
  volunteerUploadSkillVerification: 'volunteer_upload_skill_verification.php',
  adminSkillVerify: 'admin_skill_verify.php',
  volunteerSkillVerifications: 'volunteer_skill_verifications.php',
  adminSkillVerifications: 'admin_skill_verifications.php',
  registerVolunteer: 'volunteer_register.php',
  requestLoginCode: 'auth_request_code.php',
  verifyLoginCode: 'auth_verify_code.php',
  volunteerShifts: 'volunteer_shifts.php',
  joinShift: 'shift_join.php',
  cancelShift: 'shift_cancel.php',
  volunteerSession: 'volunteer_session.php',
  volunteerLogout: 'volunteer_logout.php'
} as const;

/* ---------- Staff authentication ---------- */

export const adminLogin = (email: string, password: string) =>
  http.post<{admin: AdminProfile;}>(API_ENDPOINTS.adminLogin, { email, password });

export const adminLogout = () => http.post<{signedOut: boolean;}>(API_ENDPOINTS.adminLogout, {});
export const getAdminSession = () => http.get<{admin: AdminProfile;}>(API_ENDPOINTS.adminSession);

/* ---------- Coordinator dashboard ---------- */

export const createOperation = (payload: Omit<Operation, 'id' | 'locationCount'> & { locationCount?: number; locationName: string; address: string; city: string; province: string; coordinates: Coordinates; shiftName: string; shiftDate: string; shiftStart: string; shiftEnd: string; requiredSkillIds: string[] }) =>
  http.post<Operation>(API_ENDPOINTS.createOperation, payload);

export const updateOperation = (operationId: string, payload: Pick<Operation, 'name' | 'description' | 'type' | 'status' | 'startDate' | 'endDate' | 'volunteersNeeded'>) =>
  http.post<{updated: boolean}>(API_ENDPOINTS.updateOperation, { operationId, ...payload });

export const deleteOperation = (operationId: string) =>
  http.post<{deleted: boolean}>(API_ENDPOINTS.deleteOperation, { operationId });

export const getDashboard = (signal?: AbortSignal) => http.get<DashboardSummary>(API_ENDPOINTS.dashboard, signal);
export const getOperations = (signal?: AbortSignal) => http.get<Operation[]>(API_ENDPOINTS.operations, signal);
export const getAlerts = (signal?: AbortSignal) => http.get<Alert[]>(API_ENDPOINTS.alerts, signal);
export const getActivity = (signal?: AbortSignal) => http.get<ActivityItem[]>(API_ENDPOINTS.activity, signal);
export const getInventory = (signal?: AbortSignal) => http.get<InventoryItem[]>(API_ENDPOINTS.inventory, signal);
export const getShipments = (signal?: AbortSignal) => http.get<Shipment[]>(API_ENDPOINTS.shipments, signal);
export const updateShipmentLocation = (shipmentId: string, latitude: number, longitude: number) =>
  http.post<{updated: boolean}>(API_ENDPOINTS.updateShipmentLocation, { shipmentId, latitude, longitude });
export const getVehicles = (signal?: AbortSignal) => http.get<Vehicle[]>(API_ENDPOINTS.vehicles, signal);
export const createVehicle = (name: string, plateNumber: string, vehicleType: string, capacity: string) =>
  http.post<{created: boolean; vehicle: Vehicle}>(API_ENDPOINTS.vehicles, { name, plateNumber, vehicleType, capacity });
export const createShipment = (payload: CreateShipmentRequest) =>
  http.post<Shipment>(API_ENDPOINTS.createShipment, payload);
export const updateShipmentStatus = (shipmentId: string, status: ShipmentStatus, note?: string) =>
  http.post<{updated: boolean; status: ShipmentStatus}>(API_ENDPOINTS.updateShipmentStatus, { shipmentId, status, note });
export const createDriver = (fullName: string, email: string, password: string, phone: string, vehicleId: string) =>
  http.post<{created: boolean}>(API_ENDPOINTS.createDriver, { fullName, email, password, phone, vehicleId });
export const registerDriver = (payload: {fullName: string; email: string; password: string; phone: string; drivingLicenseNumber: string; drivingLicenseType: string}) =>
  http.post<{created: boolean; status: 'pending'}>(API_ENDPOINTS.registerDriver, payload);
export const updateDriverProfile = (payload: Pick<DriverProfile, 'fullName' | 'phone' | 'drivingLicenseNumber' | 'drivingLicenseType'>) =>
  http.post<{driver: DriverProfile}>(API_ENDPOINTS.driverProfileUpdate, payload);
export const deleteDriverAccount = (password: string) => http.post<{deleted: boolean}>(API_ENDPOINTS.driverAccountDelete, { password });
export const getAdminDrivers = (signal?: AbortSignal) => http.get<DriverRosterEntry[]>(API_ENDPOINTS.adminDrivers, signal);
export const manageDriver = (payload: {driverId: string; fullName: string; email: string; phone: string; drivingLicenseNumber: string; drivingLicenseType: string; status: 'pending' | 'active' | 'inactive'; newPassword?: string; vehicleId?: string}) => http.post<{updated: boolean}>(API_ENDPOINTS.adminDriverManage, payload);
export const driverLogin = (email: string, password: string) => http.post<{driver: DriverProfile & {csrfToken: string}}>(API_ENDPOINTS.driverLogin, { email, password });
export const getDriverSession = () => http.get<{driver: DriverProfile & {csrfToken: string}}>(API_ENDPOINTS.driverSession);
export const driverLogout = () => http.post<{signedOut: boolean}>(API_ENDPOINTS.driverLogout, {});
export const getDriverShipments = (signal?: AbortSignal) => http.get<Shipment[]>(API_ENDPOINTS.driverShipments, signal);
export const getDonorLedger = (signal?: AbortSignal) => http.get<DonorEntry[]>(API_ENDPOINTS.donorLedger, signal);

export const updateDonationStage = (reference: string, stage: TrackStage, message?: string, location?: string) =>
  http.post<TrackedDonation>(API_ENDPOINTS.updateDonationStage, { reference, stage, message, location });

export const deleteDonation = (reference: string) =>
  http.post<{deleted: boolean;}>(API_ENDPOINTS.deleteDonation, { id: reference });

/* ---------- Shared map data ---------- */

export const getLocations = (signal?: AbortSignal) => http.get<ReliefLocation[]>(API_ENDPOINTS.locations, signal);
export const createDropoffLocation = (payload: {name: string; address: string; city: string; province: string; latitude: number; longitude: number; detail: string; contactPhone?: string}) =>
  http.post<{created: boolean; location: ReliefLocation}>(API_ENDPOINTS.locations, payload);

/* ---------- Donations ---------- */

export const getNeededItems = (signal?: AbortSignal) => http.get<NeededItem[]>(API_ENDPOINTS.neededItems, signal);

export const createDonation = (payload: DonationRequest) =>
http.post<{reference: string;donationId: string;}>(API_ENDPOINTS.createDonation, payload);

export const trackDonation = (reference: string, email: string) =>
http.get<TrackedDonation>(`${API_ENDPOINTS.trackDonation}?reference=${encodeURIComponent(reference)}&email=${encodeURIComponent(email)}`);

export const getMyDonations = (email: string, reference: string) =>
http.get<TrackedDonation[]>(`${API_ENDPOINTS.donationList}?email=${encodeURIComponent(email)}&reference=${encodeURIComponent(reference)}`);

/* ---------- Volunteers ---------- */

export const getShifts = (signal?: AbortSignal) => http.get<Shift[]>(API_ENDPOINTS.shifts, signal);
export const getSkills = (signal?: AbortSignal) => http.get<Skill[]>(API_ENDPOINTS.skills, signal);
export const getVolunteerRoster = (signal?: AbortSignal) => http.get<VolunteerRosterEntry[]>(API_ENDPOINTS.volunteerRoster, signal);

export const checkInVolunteer = (code: string, shiftId: string) =>
http.post<VolunteerCheckInResult>(API_ENDPOINTS.volunteerCheckIn, { code, shiftId });

export const registerVolunteer = (payload: RegistrationDetails & {shiftId?: string;}) =>
http.post<{volunteer: VolunteerProfile;shifts: JoinedShift[];}>(API_ENDPOINTS.registerVolunteer, payload);

export const requestLoginCode = (email: string) =>
http.post<{sent: boolean;debugCode?: string;}>(API_ENDPOINTS.requestLoginCode, { email });

export const verifyLoginCode = (email: string, code: string) =>
http.post<{volunteer: VolunteerProfile;shifts: JoinedShift[];}>(API_ENDPOINTS.verifyLoginCode, { email, code });

export const getMyShifts = (volunteerId: string) =>
http.get<JoinedShift[]>(`${API_ENDPOINTS.volunteerShifts}?volunteer_id=${encodeURIComponent(volunteerId)}`);

export const getVolunteerSession = () =>
http.get<{volunteer: VolunteerProfile;shifts: JoinedShift[]}>(API_ENDPOINTS.volunteerSession);

export const volunteerLogout = () => http.post<{signedOut: boolean;}>(API_ENDPOINTS.volunteerLogout, {});

export const joinShift = (volunteerId: string, shiftId: string) =>
http.post<JoinedShift[]>(API_ENDPOINTS.joinShift, { volunteerId, shiftId });

export const cancelShift = (volunteerId: string, shiftId: string) =>
http.post<JoinedShift[]>(API_ENDPOINTS.cancelShift, { volunteerId, shiftId });

export const volunteerUploadVerification = (photo: string) =>
http.post<{uploaded: boolean; photo: string; status: string;}>(API_ENDPOINTS.volunteerUploadVerification, { photo });

export const adminVolunteerVerify = (volunteerId: string, decision: 'approve' | 'reject', notes?: string) =>
http.post<{decision: string;}>(API_ENDPOINTS.adminVolunteerVerify, { volunteerId, decision, notes });

export const updateVolunteerStatus = (volunteerId: string, status: 'active' | 'inactive') =>
http.post<{status: string;}>(API_ENDPOINTS.adminVolunteerStatus, { volunteerId, status });

export const deleteVolunteer = (volunteerId: string) =>
http.post<{deleted: boolean;}>(API_ENDPOINTS.adminVolunteerDelete, { volunteerId });
export const updateVolunteerProfile = (payload: Partial<RegistrationDetails>) => http.post<{volunteer: VolunteerProfile}>(API_ENDPOINTS.volunteerProfileUpdate, payload);
export const deactivateVolunteerAccount = () => http.post<{deleted: boolean}>(API_ENDPOINTS.volunteerAccountDelete, {});
export const manageVolunteer = (volunteerId: string, payload: Partial<RegistrationDetails>) => http.post<{volunteer: VolunteerProfile}>(API_ENDPOINTS.adminVolunteerManage, { volunteerId, ...payload });

export const volunteerUploadSkillVerification = (skillId: string, photo: string) =>
http.post<{uploaded: boolean;}>(API_ENDPOINTS.volunteerUploadSkillVerification, { skillId, photo });

export const adminSkillVerify = (verificationId: string, decision: 'approve' | 'reject', notes?: string) =>
http.post<{decision: string;}>(API_ENDPOINTS.adminSkillVerify, { verificationId, decision, notes });

export const getVolunteerSkillVerifications = (volunteerId?: string) =>
http.get<any[]>(API_ENDPOINTS.volunteerSkillVerifications + (volunteerId ? `?volunteer_id=${volunteerId}` : ''));

export const getAdminSkillVerifications = (status?: string) =>
http.get<any[]>(API_ENDPOINTS.adminSkillVerifications + (status ? `?status=${status}` : ''));
