import type {
  ActivityItem,
  Alert,
  CategorySlice,
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
  ShipmentStatus,
  Skill,
  Vehicle,
  TrackedDonation,
  VolunteerProfile,
  VolunteerRosterEntry,
  DriverProfile
} from '../types/domain';
import type { AdminProfile } from '../contexts/AdminAuth';

const STORAGE_KEY = 'relieftrack.local-store';

interface LocalSkillVerification {
  verification_id: string;
  volunteer_id: string;
  skill_id: string;
  photo_filename: string;
  photo_data: string;
  status: 'pending' | 'approved' | 'rejected';
  submitted_at: string;
  full_name: string;
  email: string;
  skill_name: string;
}

interface LocalStore {
  operations: Operation[];
  locations: ReliefLocation[];
  shifts: Shift[];
  skills: Skill[];
  volunteers: VolunteerProfile[];
  joinedShifts: Record<string, JoinedShift[]>;
  donations: TrackedDonation[];
  inventory: InventoryItem[];
  shipments: Shipment[];
  vehicles: Vehicle[];
  drivers: { id: string; fullName: string; email: string; password: string; vehicleId: string; status?: 'active' | 'inactive'; phone?: string; drivingLicenseNumber?: string; drivingLicenseType?: string }[];
  neededItems: NeededItem[];
  activities: ActivityItem[];
  alerts: Alert[];
  loginCodes: Record<string, string>;
  skillVerifications: LocalSkillVerification[];
}

const operations: Operation[] = [
  {
    id: 'op-1',
    name: 'Metro Manila Flood Response',
    description: 'Emergency food, water, and hygiene support for flood-affected communities.',
    type: 'disaster_response',
    status: 'active',
    startDate: '2026-09-01',
    endDate: '2026-10-15',
    locationCount: 4,
    volunteersNeeded: 80
  },
  {
    id: 'op-2',
    name: 'Northern Luzon Recovery',
    description: 'Recovery supplies and volunteer support for displaced families.',
    type: 'relief_distribution',
    status: 'planned',
    startDate: '2026-09-20',
    endDate: '2026-11-30',
    locationCount: 2,
    volunteersNeeded: 40
  }
];

const locations: ReliefLocation[] = [
  {
    id: 'loc-1', kind: 'donation_center', name: 'Caloocan Donation Center', address: '12th Avenue, Grace Park', city: 'Caloocan', province: 'Metro Manila', coordinates: [14.6577, 120.9830], status: 'active', detail: 'Open daily, 8:00 AM to 6:00 PM.', operatedBy: 'Caloocan ReliefTrack Team', imageUrl: '/85d10986-1e79-4d08-9a63-921b83635322.jpg', operationIds: ['op-1']
  },
  {
    id: 'loc-2', kind: 'warehouse', name: 'Caloocan Relief Warehouse', address: 'Samson Road, Monumento', city: 'Caloocan', province: 'Metro Manila', coordinates: [14.6547, 120.9830], status: 'active', detail: 'Main sorting and repacking hub.', operatedBy: 'Caloocan ReliefTrack Team', imageUrl: '/85d10986-1e79-4d08-9a63-921b83635322.jpg', operationIds: ['op-1', 'op-2']
  },
  {
    id: 'loc-3', kind: 'distribution_center', name: 'Caloocan Distribution Hub', address: 'Barangay 176, Bagong Silang', city: 'Caloocan', province: 'Metro Manila', coordinates: [14.7566, 120.9948], status: 'active', detail: 'Family relief pack distribution point.', operatedBy: 'Caloocan ReliefTrack Team', imageUrl: '/85d10986-1e79-4d08-9a63-921b83635322.jpg', operationIds: ['op-1', 'op-2']
  },
  {
    id: 'loc-4', kind: 'affected_area', name: 'Barangay 176 Relief Area', address: 'Bagong Silang', city: 'Caloocan', province: 'Metro Manila', coordinates: [14.7580, 120.9960], status: 'active', detail: 'Priority area for current response.', operatedBy: 'Caloocan ReliefTrack Team', imageUrl: '/85d10986-1e79-4d08-9a63-921b83635322.jpg', operationIds: ['op-1']
  }
];

const shifts: Shift[] = [
  { id: 'shift-1', name: 'Morning Warehouse Shift', location: 'Caloocan Relief Warehouse', city: 'Caloocan', date: 'Thu, Sep 10', window: '8:00 AM - 12:00 PM', filled: 8, needed: 12, status: 'open', coordinates: [14.6547, 120.9830], requiredSkills: ['Packing & sorting', 'Driving'] },
  { id: 'shift-2', name: 'Afternoon Packing Shift', location: 'Caloocan Relief Warehouse', city: 'Caloocan', date: 'Thu, Sep 10', window: '1:00 PM - 5:00 PM', filled: 10, needed: 10, status: 'full', coordinates: [14.6547, 120.9830], requiredSkills: ['Packing & sorting', 'First Aid'] },
  { id: 'shift-3', name: 'Family Distribution Support', location: 'Caloocan Distribution Hub', city: 'Caloocan', date: 'Fri, Sep 11', window: '9:00 AM - 1:00 PM', filled: 5, needed: 14, status: 'open', coordinates: [14.7566, 120.9948], requiredSkills: ['Community outreach', 'First Aid'] }
];

const skills: Skill[] = [
  { id: 'skill-1', name: 'Packing & sorting', description: 'Sort and pack donated goods.' },
  { id: 'skill-2', name: 'Driving', description: 'Drive or assist with vehicle logistics.' },
  { id: 'skill-3', name: 'First Aid', description: 'Provide basic first aid support.' },
  { id: 'skill-4', name: 'Community outreach', description: 'Support family registration and distribution.' }
];

const inventory: InventoryItem[] = [
  { id: 'inv-1', itemName: 'Rice', category: 'Food', location: 'Caloocan Relief Warehouse', quantity: 180, unit: 'kg', minimumStock: 300, status: 'low_stock' },
  { id: 'inv-2', itemName: 'Bottled water', category: 'Water', location: 'Caloocan Relief Warehouse', quantity: 620, unit: 'bottles', minimumStock: 500, status: 'available' },
  { id: 'inv-3', itemName: 'Hygiene kits', category: 'Hygiene', location: 'Caloocan Relief Warehouse', quantity: 86, unit: 'kits', minimumStock: 120, status: 'low_stock' },
  { id: 'inv-4', itemName: 'Family blankets', category: 'Shelter', location: 'Caloocan Distribution Hub', quantity: 0, unit: 'pieces', minimumStock: 60, status: 'out_of_stock' }
];

const neededItems: NeededItem[] = [
  { id: 'need-1', itemName: 'Rice', category: 'Food', location: 'Caloocan Relief Warehouse', quantityNeeded: 500, quantityReceived: 180, priority: 'critical', status: 'partially_fulfilled' },
  { id: 'need-2', itemName: 'Bottled water', category: 'Water', location: 'Caloocan Relief Warehouse', quantityNeeded: 1000, quantityReceived: 620, priority: 'high', status: 'partially_fulfilled' },
  { id: 'need-3', itemName: 'Hygiene kits', category: 'Hygiene', location: 'Caloocan Distribution Hub', quantityNeeded: 250, quantityReceived: 86, priority: 'medium', status: 'partially_fulfilled' },
  { id: 'need-4', itemName: 'Family blankets', category: 'Shelter', location: 'Caloocan Distribution Hub', quantityNeeded: 300, quantityReceived: 0, priority: 'high', status: 'needed' }
];

const shipments: Shipment[] = [
  { id: 'ship-1', reference: 'SHIP-2026-001', origin: 'Caloocan Relief Warehouse', destination: 'Caloocan Distribution Hub', itemDescription: 'Rice and bottled water', quantity: 260, vehicle: 'Relief Van 01', plateNumber: 'NCR 4821', status: 'in_transit', note: 'Expected before 3:00 PM.', coordinates: [14.70, 120.988], originCoordinates: [14.6547, 120.9830] },
  { id: 'ship-2', reference: 'SHIP-2026-002', origin: 'Caloocan Donation Center', destination: 'Caloocan Relief Warehouse', itemDescription: 'Hygiene kits', quantity: 40, vehicle: 'Truck 02', plateNumber: 'NCR 7712', status: 'packed', note: 'Awaiting driver assignment.', coordinates: [14.66, 120.984] }
];

const vehicles: Vehicle[] = [
  { id: 'vehicle-1', name: 'Relief Van 01', plateNumber: 'NCR 4821', driverName: 'Mark Santos', status: 'in_use', hasDriverAccount: true },
  { id: 'vehicle-2', name: 'Truck 02', plateNumber: 'NCR 7712', driverName: '', status: 'available', hasDriverAccount: false }
];

const initialStore: LocalStore = {
  operations,
  locations,
  shifts,
  skills,
  volunteers: [{ volunteerId: 'vol-1', fullName: 'John Dela Cruz', email: 'john@example.com', phone: '09171234567', status: 'active', skills: ['Packing & sorting'] }],
  joinedShifts: { 'vol-1': [{ ...shifts[0], signupStatus: 'approved', hours: 4 }] },
  donations: [{
    reference: 'RT-001001', donor: 'Maria Santos', donorEmail: 'maria@example.com', type: 'goods', amount: '0', operation: operations[0].name, destination: locations[2].name, date: 'Sep 9, 2026', stage: 'received',
    items: [{ name: 'Rice', category: 'Food', quantity: 25, unit: 'kg' }],
    updates: [{ stage: 'pledged', message: 'Donation pledged by donor.', time: 'Sep 8, 2026' }, { stage: 'received', message: 'Goods received at Caloocan Donation Center.', time: 'Sep 9, 2026' }]
  }],
  inventory,
  shipments,
  vehicles,
  drivers: [{ id: 'driver-1', fullName: 'Mark Santos', email: 'driver@relieftrack.local', password: 'driver12345', vehicleId: 'vehicle-1', status: 'active', phone: '' }],
  neededItems,
  activities: [
    { id: 'act-1', action: 'Donation Received', description: '25 kg of rice received at Caloocan Donation Center.', module: 'Donations', staff: 'Maria Santos', time: '1 hour ago' },
    { id: 'act-2', action: 'Shipment In Transit', description: 'SHIP-2026-001 departed for Caloocan Distribution Hub.', module: 'Shipments', staff: 'Juan Dela Cruz', time: '3 hours ago' },
    { id: 'act-3', action: 'Low Rice Stock', description: 'Rice stock is below the minimum level at Caloocan Relief Warehouse.', module: 'Inventory', staff: 'System', time: '1 day ago' }
  ],
  alerts: [
    { id: 'alert-1', type: 'inventory', title: 'Low rice stock', message: 'Rice is below the minimum stock level at Caloocan Relief Warehouse.', priority: 'high', isRead: false, time: '1 day ago' },
    { id: 'alert-2', type: 'volunteer', title: 'Volunteer coverage needed', message: 'Family Distribution Support still needs 9 volunteers.', priority: 'medium', isRead: false, time: 'Today' }
  ],
  loginCodes: {},
  skillVerifications: []
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function localShipmentTracking(store: LocalStore, shipment: Shipment) {
  const origin = store.locations.find((location) => location.name === shipment.origin);
  const destination = store.locations.find((location) => location.name === shipment.destination);
  return {
    reference: shipment.reference,
    status: shipment.status,
    coordinates: shipment.locationUpdatedAt ? shipment.coordinates : null,
    locationUpdatedAt: shipment.locationUpdatedAt ?? null,
    lastLocation: shipment.locationUpdatedAt ? 'Driver GPS location' : shipment.status === 'delivered' ? shipment.destination : shipment.origin,
    origin: shipment.origin,
    destination: shipment.destination,
    originCoordinates: shipment.originCoordinates ?? origin?.coordinates ?? null,
    destinationCoordinates: destination?.coordinates ?? (shipment.status === 'delivered' ? shipment.coordinates : null)
  };
}

function readStore(): LocalStore {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    const store = saved ? { ...clone(initialStore), ...JSON.parse(saved) as Partial<LocalStore> } : clone(initialStore);
    store.drivers ??= clone(initialStore.drivers);
    const medicalSkill = store.skills.find((skill) => skill.name === 'Medical Assistance');
    if (medicalSkill) {
      const firstAidSkill = store.skills.find((skill) => skill.name === 'First Aid');
      const firstAidId = firstAidSkill?.id ?? medicalSkill.id;
      if (!firstAidSkill) {
        medicalSkill.name = 'First Aid';
        medicalSkill.description = 'Basic emergency, first aid, and medical assistance';
      }
      store.volunteers = store.volunteers.map((volunteer) => ({ ...volunteer, skills: [...new Set(volunteer.skills.map((skill) => skill === 'Medical Assistance' ? 'First Aid' : skill))] }));
      store.shifts = store.shifts.map((shift) => ({ ...shift, requiredSkills: [...new Set(shift.requiredSkills.map((skill) => skill === 'Medical Assistance' ? 'First Aid' : skill))] }));
      const seenVerifications = new Set<string>();
      store.skillVerifications = store.skillVerifications.map((verification) => ({ ...verification, skill_id: verification.skill_id === medicalSkill.id ? firstAidId : verification.skill_id, skill_name: verification.skill_name === 'Medical Assistance' ? 'First Aid' : verification.skill_name })).filter((verification) => {
        const key = `${verification.volunteer_id}:${verification.skill_id}`;
        if (seenVerifications.has(key)) return false;
        seenVerifications.add(key);
        return true;
      });
      if (firstAidSkill) store.skills = store.skills.filter((skill) => skill.id !== medicalSkill.id);
      writeStore(store);
    }
    store.vehicles = store.vehicles.map((vehicle) => ({ ...vehicle, hasDriverAccount: vehicle.hasDriverAccount ?? store.drivers.some((driver) => driver.vehicleId === vehicle.id) }));
    const sampleDriver = store.drivers.find((driver) => driver.id === 'driver-1');
    const sampleVehicle = store.vehicles.find((vehicle) => vehicle.id === sampleDriver?.vehicleId);
    if (sampleVehicle) store.shipments = store.shipments.map((shipment) => shipment.id === 'ship-1' ? { ...shipment, vehicle: sampleVehicle.name, plateNumber: sampleVehicle.plateNumber } : shipment);
    const oldCities = /Makati|Pasig|Marikina|Quezon City|Manila/;
    const locationNames: Record<string, string> = {
      'Makati Drop-off Center': 'Caloocan Donation Center',
      'Pasig Relief Warehouse': 'Caloocan Relief Warehouse',
      'Marikina Distribution Hub': 'Caloocan Distribution Hub',
      'Barangay Tumana': 'Barangay 176 Relief Area',
      'Quezon City Donation Center': 'Caloocan Donation Center',
      'Pasig Community Drop-off': 'Bagong Silang Community Drop-off'
    };
    const migrateText = (value: string) => Object.entries(locationNames).reduce((text, [oldName, newName]) => text.replaceAll(oldName, newName), value).replaceAll('Makati', 'Caloocan').replaceAll('Pasig', 'Caloocan').replaceAll('Marikina', 'Caloocan');
    if (oldCities.test(JSON.stringify(store))) {
      const caloocanCoordinates: Record<string, [number, number]> = {
        'Caloocan Donation Center': [14.6577, 120.9830],
        'Caloocan Relief Warehouse': [14.6547, 120.9830],
        'Caloocan Distribution Hub': [14.7566, 120.9948],
        'Barangay 176 Relief Area': [14.7580, 120.9960]
      };
      const caloocanAddresses: Record<string, string> = {
        'Caloocan Donation Center': '12th Avenue, Grace Park',
        'Caloocan Relief Warehouse': 'Samson Road, Monumento',
        'Caloocan Distribution Hub': 'Barangay 176, Bagong Silang',
        'Barangay 176 Relief Area': 'Bagong Silang'
      };
      store.locations = store.locations.map((location) => {
        const name = migrateText(location.name);
        return { ...location, name, address: caloocanAddresses[name] ?? migrateText(location.address), city: 'Caloocan', coordinates: caloocanCoordinates[name] ?? [14.6547, 120.9830] };
      });
      store.shifts = store.shifts.map((shift) => ({ ...shift, location: migrateText(shift.location), city: 'Caloocan', coordinates: shift.location.includes('Distribution') ? [14.7566, 120.9948] : [14.6547, 120.9830] }));
      store.inventory = store.inventory.map((item) => ({ ...item, location: migrateText(item.location) }));
      store.neededItems = store.neededItems.map((item) => ({ ...item, location: migrateText(item.location) }));
      store.shipments = store.shipments.map((shipment) => ({ ...shipment, origin: migrateText(shipment.origin), destination: migrateText(shipment.destination), coordinates: shipment.destination.includes('Distribution') ? [14.7566, 120.9948] : [14.6547, 120.9830] }));
      store.donations = store.donations.map((donation) => ({ ...donation, destination: migrateText(donation.destination), operation: migrateText(donation.operation), updates: donation.updates.map((update) => ({ ...update, message: migrateText(update.message) })) }));
      store.activities = store.activities.map((activity) => ({ ...activity, description: migrateText(activity.description) }));
      store.alerts = store.alerts.map((alert) => ({ ...alert, message: migrateText(alert.message) }));
      store.joinedShifts = Object.fromEntries(Object.entries(store.joinedShifts).map(([id, joined]) => [id, joined.map((shift) => ({ ...shift, location: migrateText(shift.location), city: 'Caloocan' }))]));
      writeStore(store);
    }
    return store;
  } catch {
    return clone(initialStore);
  }
}

function writeStore(store: LocalStore) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch (cause) {
    throw new Error(cause instanceof DOMException && cause.name === 'QuotaExceededError'
      ? 'Browser storage is full. Your changes were not saved; free up storage and try again.'
      : 'Browser storage is unavailable. Your changes were not saved.');
  }
}

export function isLocalStorageAvailable() {
  try {
    const key = `${STORAGE_KEY}.probe`;
    window.localStorage.setItem(key, '1');
    window.localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

function jsonBody(init?: RequestInit) {
  return init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {};
}

function dashboard(store: LocalStore): DashboardSummary {
  const categoryTotals = new Map<string, number>();
  store.donations.forEach((donation) => donation.items.forEach((item) => {
    categoryTotals.set(item.category, (categoryTotals.get(item.category) ?? 0) + item.quantity);
  }));
  const categoryMix: CategorySlice[] = Array.from(categoryTotals, ([category, quantity]) => ({ category, quantity }));
  const lastFiveDays = Array.from({ length: 5 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (4 - index));
    return {
      key: date.toISOString().slice(0, 10),
      day: date.toLocaleDateString('en-US', { weekday: 'short' })
    };
  });

  const trend = lastFiveDays.map((entry) => ({ day: entry.day, cash: 0, goods: 0 }));

  store.donations.forEach((donation) => {
    const date = new Date(donation.date);
    if (Number.isNaN(date.getTime())) return;
    const key = date.toISOString().slice(0, 10);
    const index = lastFiveDays.findIndex((day) => day.key === key);
    if (index === -1) return;

    const donationCash = donation.type === 'cash' || donation.type === 'mixed'
      ? Number(String(donation.amount).replace(/[^0-9.]/g, '')) || 0
      : 0;
    const donationGoods = donation.items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);

    trend[index].cash += donationCash;
    trend[index].goods += donation.type === 'goods' || donation.type === 'mixed' ? donationGoods : 0;
  });

  return {
    kpis: [
      { id: 'active-volunteers', label: 'Active volunteers', value: String(store.volunteers.length), sub: 'checked in today', delta: '+0', trend: 'flat' },
      { id: 'donations', label: 'Donations received', value: String(store.donations.length), sub: 'total records', delta: '+3', trend: 'up' },
      { id: 'inventory', label: 'Inventory items', value: String(store.inventory.length), sub: 'tracked items', delta: '+1', trend: 'up' },
      { id: 'operations', label: 'Active operations', value: String(store.operations.filter((item) => item.status === 'active').length), sub: 'currently active', delta: '0', trend: 'flat' }
    ],
    alerts: clone(store.alerts),
    activity: clone(store.activities),
    donationTrend: trend,
    categoryMix
  };
}

function joinedShift(shift: Shift, signupStatus: JoinedShift['signupStatus'] = 'pending'): JoinedShift {
  return { ...shift, signupStatus, hours: 4 };
}

export async function localRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const [endpoint, query = ''] = path.split('?');
  const params = new URLSearchParams(query);
  const body = jsonBody(init);
  const store = readStore();

  switch (endpoint) {
    case 'admin_login.php': {
      const email = String(body.email ?? '').toLowerCase();
      const password = String(body.password ?? '');
      if (email !== 'admin@relieftrack.com' || password !== 'admin123') throw new Error('Invalid email or password.');
      return { admin: { staffId: '1', fullName: 'System Administrator', email, role: 'admin' as const } } as T;
    }
    case 'admin_logout.php': return { signedOut: true } as T;
    case 'admin_session.php': {
      const profile = window.sessionStorage.getItem('relieftrack.admin.session');
      if (!profile) throw new Error('Staff authentication required.');
      return { admin: JSON.parse(profile) as AdminProfile } as T;
    }
    case 'admin_driver_create.php': {
      const vehicle = store.vehicles.find((entry) => entry.id === String(body.vehicleId ?? '') && !entry.hasDriverAccount);
      const email = String(body.email ?? '').trim().toLowerCase();
      const password = String(body.password ?? '');
      if (!vehicle || password.length < 10 || !String(body.fullName ?? '').trim() || !email.includes('@')) throw new Error('Enter a driver name, valid email, password with at least 10 characters, and unassigned vehicle.');
      if (store.drivers.some((entry) => entry.email === email)) throw new Error('A driver account already uses that email.');
      const driver = { id: `driver-${Date.now()}`, fullName: String(body.fullName), email, password, vehicleId: vehicle.id, status: 'active' as const, phone: String(body.phone ?? '') };
      store.drivers.push(driver); vehicle.driverName = driver.fullName; vehicle.hasDriverAccount = true;
      writeStore(store); return { created: true } as T;
    }
    case 'driver_register.php': {
      const name = String(body.fullName ?? '').trim(); const email = String(body.email ?? '').trim().toLowerCase(); const password = String(body.password ?? '');
      if (!name || !email.includes('@') || password.length < 10) throw new Error('Enter your name, a valid email, and a password with at least 10 characters.');
      if (store.drivers.some((entry) => entry.email === email)) throw new Error('An account already uses that email.');
      store.drivers.push({ id: `driver-${Date.now()}`, fullName: name, email, password, vehicleId: '', status: 'pending', phone: String(body.phone ?? ''), drivingLicenseNumber: String(body.drivingLicenseNumber ?? ''), drivingLicenseType: String(body.drivingLicenseType ?? '') });
      writeStore(store); return { created: true, status: 'pending' } as T;
    }
    case 'driver_login.php': {
      const email = String(body.email ?? '').trim().toLowerCase();
      const driver = store.drivers.find((entry) => entry.email === email && entry.password === String(body.password ?? '') && entry.status !== 'inactive');
      if (!driver) throw new Error('Invalid email or password.');
      const vehicle = store.vehicles.find((entry) => entry.id === driver.vehicleId);
      return { driver: { driverId: driver.id, fullName: driver.fullName, email, phone: driver.phone, drivingLicenseNumber: driver.drivingLicenseNumber, drivingLicenseType: driver.drivingLicenseType, vehicleName: vehicle?.name ?? 'No vehicle', plateNumber: vehicle?.plateNumber ?? '' } satisfies DriverProfile } as T;
    }
    case 'driver_session.php': {
      const raw = window.sessionStorage.getItem('relieftrack.driver.session');
      if (!raw) throw new Error('Driver sign-in required.');
      return { driver: JSON.parse(raw) as DriverProfile } as T;
    }
    case 'driver_logout.php': return { signedOut: true } as T;
    case 'driver_profile_update.php': {
      const profile = JSON.parse(window.sessionStorage.getItem('relieftrack.driver.session') ?? 'null') as DriverProfile | null;
      const driver = store.drivers.find((entry) => entry.id === profile?.driverId && entry.status !== 'inactive');
      if (!driver) throw new Error('Driver sign-in required.');
      const name = String(body.fullName ?? '').trim(); if (!name) throw new Error('Enter a full name.');
      driver.fullName = name; driver.phone = String(body.phone ?? ''); driver.drivingLicenseNumber = String(body.drivingLicenseNumber ?? ''); driver.drivingLicenseType = String(body.drivingLicenseType ?? '');
      const vehicle = store.vehicles.find((entry) => entry.id === driver.vehicleId); if (vehicle) vehicle.driverName = name;
      const updated: DriverProfile = { driverId: driver.id, fullName: name, email: driver.email, phone: driver.phone, drivingLicenseNumber: driver.drivingLicenseNumber, drivingLicenseType: driver.drivingLicenseType, vehicleName: vehicle?.name ?? 'No vehicle', plateNumber: vehicle?.plateNumber ?? '' };
      window.sessionStorage.setItem('relieftrack.driver.session', JSON.stringify(updated)); writeStore(store); return { driver: updated } as T;
    }
    case 'driver_account_delete.php': {
      const profile = JSON.parse(window.sessionStorage.getItem('relieftrack.driver.session') ?? 'null') as DriverProfile | null;
      const driver = store.drivers.find((entry) => entry.id === profile?.driverId && entry.status !== 'inactive');
      if (!driver || driver.password !== String(body.password ?? '')) throw new Error('Your current password is incorrect.');
      driver.status = 'inactive';
      const vehicle = store.vehicles.find((entry) => entry.id === driver.vehicleId);
      if (vehicle) { vehicle.driverName = ''; vehicle.hasDriverAccount = false; if (vehicle.status === 'in_use') vehicle.status = 'available'; }
      driver.vehicleId = '';
      store.shipments.filter((entry) => entry.vehicle === vehicle?.name && ['pending','packed'].includes(entry.status)).forEach((entry) => { entry.status = 'cancelled'; });
      writeStore(store); window.sessionStorage.removeItem('relieftrack.driver.session'); return { deleted: true } as T;
    }
    case 'admin_drivers.php': return store.drivers.map((driver) => { const vehicle = store.vehicles.find((entry) => entry.id === driver.vehicleId); return { id: driver.id, fullName: driver.fullName, email: driver.email, phone: driver.phone ?? '', drivingLicenseNumber: driver.drivingLicenseNumber ?? '', drivingLicenseType: driver.drivingLicenseType ?? '', status: driver.status ?? 'active', vehicleId: vehicle?.id ?? null, vehicleName: vehicle?.name ?? 'Unassigned', plateNumber: vehicle?.plateNumber ?? '', completedDeliveries: store.shipments.filter((shipment) => shipment.driverId === driver.id && shipment.status === 'delivered').length }; }) as T;
    case 'admin_driver_manage.php': {
      const driver = store.drivers.find((entry) => entry.id === String(body.driverId ?? '')); if (!driver) throw new Error('Driver not found.');
      const name = String(body.fullName ?? '').trim(); const status = String(body.status ?? 'inactive') as 'pending' | 'active' | 'inactive';
      if (!name || !['pending','active','inactive'].includes(status)) throw new Error('Driver details are incomplete.');
      const nextVehicle = store.vehicles.find((entry) => entry.id === String(body.vehicleId ?? ''));
      if (status === 'active' && !nextVehicle) throw new Error('Assign an available vehicle before activating this driver.');
      if (nextVehicle && nextVehicle.hasDriverAccount && nextVehicle.id !== driver.vehicleId) throw new Error('Choose a vehicle without another driver.');
      const priorVehicle = store.vehicles.find((entry) => entry.id === driver.vehicleId);
      if (priorVehicle && (priorVehicle.id !== nextVehicle?.id || status === 'inactive')) { priorVehicle.driverName = ''; priorVehicle.hasDriverAccount = false; if (priorVehicle.status === 'in_use') priorVehicle.status = 'available'; }
      driver.fullName = name; driver.email = String(body.email ?? driver.email).toLowerCase(); driver.phone = String(body.phone ?? ''); driver.drivingLicenseNumber = String(body.drivingLicenseNumber ?? ''); driver.drivingLicenseType = String(body.drivingLicenseType ?? ''); driver.status = status;
      if (body.newPassword) { if (String(body.newPassword).length < 10) throw new Error('New password must be at least 10 characters.'); driver.password = String(body.newPassword); }
      if (status === 'active' && nextVehicle) { driver.vehicleId = nextVehicle.id; nextVehicle.driverName = name; nextVehicle.hasDriverAccount = true; }
      if (status === 'inactive') driver.vehicleId = '';
      if (status === 'inactive') store.shipments.filter((shipment) => shipment.vehicle === priorVehicle?.name && ['pending','packed'].includes(shipment.status)).forEach((shipment) => { shipment.status = 'cancelled'; });
      writeStore(store); return { updated: true } as T;
    }
    case 'driver_shipments.php': {
      const raw = window.sessionStorage.getItem('relieftrack.driver.session');
      if (!raw) throw new Error('Driver sign-in required.');
      const profile = JSON.parse(raw) as DriverProfile;
      const driver = store.drivers.find((entry) => entry.id === profile.driverId && entry.status !== 'inactive');
      if (!driver) { window.sessionStorage.removeItem('relieftrack.driver.session'); throw new Error('Driver account is no longer active.'); }
      const vehicle = store.vehicles.find((entry) => entry.id === driver?.vehicleId);
      return clone(store.shipments.filter((entry) => entry.vehicle === vehicle?.name && ['pending','packed','in_transit'].includes(entry.status)).map((entry) => ({ ...entry, originAddress: store.locations.find((location) => location.name === entry.origin)?.address ?? '', destinationAddress: store.locations.find((location) => location.name === entry.destination)?.address ?? '', originCoordinates: store.locations.find((location) => location.name === entry.origin)?.coordinates ?? entry.originCoordinates }))) as T;
    }
    case 'dashboard.php': return dashboard(store) as T;
    case 'operation_create.php': {
      const now = Date.now();
      const operation: Operation = {
        id: `op-${now}`,
        name: String(body.name ?? ''),
        description: String(body.description ?? ''),
        type: String(body.type ?? 'disaster_response'),
        status: (body.status === 'active' ? 'active' : 'planned') as Operation['status'],
        startDate: String(body.startDate ?? ''),
        endDate: String(body.endDate ?? ''),
        locationCount: Number(body.locationCount ?? 0),
        volunteersNeeded: Number(body.volunteersNeeded ?? 0)
      };
      if (!operation.name || !operation.description || !operation.startDate || !operation.endDate) throw new Error('Complete all required operation fields.');
      if (operation.endDate < operation.startDate) throw new Error('End date must be on or after the start date.');
      const shiftDate = String(body.shiftDate ?? '');
      const shiftStart = String(body.shiftStart ?? '');
      const shiftEnd = String(body.shiftEnd ?? '');
      const requiredSkillIds = Array.isArray(body.requiredSkillIds) ? body.requiredSkillIds.map(String) : [];
      if (!body.shiftName || !shiftDate || !shiftStart || !shiftEnd) throw new Error('Complete all required operation and first-shift fields.');
      if (shiftDate < operation.startDate || shiftDate > operation.endDate) throw new Error('The first volunteer shift must fall within the operation dates.');
      if (shiftEnd <= shiftStart) throw new Error('The shift end time must be later than its start time.');
      if (operation.volunteersNeeded < 1) throw new Error('The first volunteer shift needs at least one open slot.');
      const address = String(body.address ?? '').trim();
      const coordinates = body.coordinates as [number, number] | undefined;
      if (!address || !coordinates || coordinates.length !== 2) throw new Error('Add an exact address and pin the operation on the map.');
      if (!address.toLowerCase().includes('caloocan')) throw new Error('The checkpoint address must be in Caloocan.');
      const checkpointName = String(body.locationName ?? `${operation.name} checkpoint`);
      const shiftId = `shift-${now}`;
      operation.volunteerShortfall = operation.volunteersNeeded;
      store.operations.unshift(operation);
      store.locations.unshift({
        id: `loc-${now}`,
        kind: 'distribution_center',
        name: checkpointName,
        address,
        city: 'Caloocan',
        province: 'Metro Manila',
        coordinates,
        status: 'active',
        detail: `${operation.name} volunteer and donation checkpoint.`,
        operationIds: [operation.id]
      });
      const shiftDay = new Date(`${shiftDate}T12:00:00`);
      const displayTime = (time: string) => new Date(`2000-01-01T${time}:00`).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      store.shifts.unshift({ id: shiftId, operationId: operation.id, name: String(body.shiftName), location: checkpointName, city: 'Caloocan', date: shiftDay.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }), window: `${displayTime(shiftStart)} - ${displayTime(shiftEnd)}`, filled: 0, approved: 0, needed: operation.volunteersNeeded, status: 'open', coordinates, requiredSkills: store.skills.filter((skill) => requiredSkillIds.includes(skill.id)).map((skill) => skill.name) });
      store.activities.unshift({ id: `act-${now}`, action: 'Operation Created', description: `${operation.name} and its first volunteer shift were added to the response plan.`, module: 'Operations', staff: 'System Administrator', time: 'Just now' });
      writeStore(store);
      return clone(operation) as T;
    }
    case 'operations.php': return clone(store.operations.map((operation) => {
      const operationLocations = store.locations.filter((location) => location.operationIds?.includes(operation.id)).map((location) => location.name);
      const volunteerShortfall = store.shifts.filter((shift) => operationLocations.includes(shift.location)).reduce((total, shift) => total + Math.max(shift.needed - shift.filled, 0), 0);
      return { ...operation, volunteerShortfall };
    })) as T;
    case 'operation_update.php': {
      const operationId = String(body.operationId ?? '');
      const operation = store.operations.find((entry) => entry.id === operationId);
      if (!operation) throw new Error('Operation not found.');
      const name = String(body.name ?? '').trim();
      const description = String(body.description ?? '').trim();
      const startDate = String(body.startDate ?? '');
      const endDate = String(body.endDate ?? '');
      const volunteersNeeded = Number(body.volunteersNeeded);
      if (!name || !description || !startDate || !endDate) throw new Error('Complete all required operation fields.');
      if (endDate < startDate) throw new Error('End date must be on or after the start date.');
      if (!Number.isInteger(volunteersNeeded) || volunteersNeeded < 0) throw new Error('Volunteer target must be zero or greater.');
      if (!['disaster_response', 'relief_distribution', 'rescue', 'donation_drive', 'other'].includes(String(body.type)) || !['planned', 'active', 'completed', 'cancelled'].includes(String(body.status))) throw new Error('Choose a valid operation type and status.');
      operation.name = name;
      operation.description = description;
      operation.type = String(body.type ?? operation.type);
      operation.status = body.status as Operation['status'];
      operation.startDate = startDate;
      operation.endDate = endDate;
      operation.volunteersNeeded = volunteersNeeded;
      writeStore(store);
      return { updated: true } as T;
    }
    case 'operation_delete.php': {
      const operationId = String(body.operationId ?? '');
      const operation = store.operations.find((entry) => entry.id === operationId);
      if (!operation) throw new Error('Operation not found.');
      const operationShiftIds = new Set(store.shifts.filter((shift) => shift.operationId === operationId).map((shift) => shift.id));
      store.shifts = store.shifts.filter((shift) => !operationShiftIds.has(shift.id));
      for (const [volunteerId, joined] of Object.entries(store.joinedShifts)) {
        store.joinedShifts[volunteerId] = joined.filter((shift) => !operationShiftIds.has(shift.id));
      }
      store.locations = store.locations.map((location) => ({ ...location, operationIds: (location.operationIds ?? []).filter((id) => id !== operationId) }));
      store.operations = store.operations.filter((entry) => entry.id !== operationId);
      store.activities.unshift({ id: `act-${Date.now()}`, action: 'Operation Deleted', description: `${operation.name} was deleted along with its shifts and sign-ups.`, module: 'Operations', staff: 'System Administrator', time: 'Just now' });
      writeStore(store);
      return { deleted: true } as T;
    }
    case 'alerts.php': return clone(store.alerts) as T;
    case 'activity_log.php': return clone(store.activities) as T;
    case 'inventory.php': return clone(store.inventory) as T;
    case 'shipments.php': return clone(store.shipments) as T;
    case 'vehicles.php': {
      if (init?.method?.toUpperCase() !== 'POST') return clone(store.vehicles) as T;
      const name = String(body.name ?? '').trim();
      const plateNumber = String(body.plateNumber ?? '').trim().toUpperCase();
      if (!name || !plateNumber) throw new Error('Vehicle name and plate number are required.');
      if (store.vehicles.some((vehicle) => vehicle.plateNumber.toUpperCase() === plateNumber)) throw new Error('A vehicle with that plate number already exists.');
      const vehicle: Vehicle = { id: `vehicle-${Date.now()}`, name, plateNumber, driverName: '', hasDriverAccount: false, status: 'available' };
      store.vehicles.unshift(vehicle);
      store.activities.unshift({ id: `act-${Date.now()}`, action: 'Added Vehicle', description: `${name} (${plateNumber}) was added to the fleet.`, module: 'Logistics', staff: 'System Administrator', time: 'Just now' });
      writeStore(store);
      return { created: true, vehicle: clone(vehicle) } as T;
    }
    case 'shipment_create.php': {
      const donation = store.donations.find((entry) => entry.reference === String(body.donationReference ?? ''));
      if (!donation) throw new Error('Donation reference not found.');
      if (donation.stage !== 'allocated' || donation.type === 'cash') throw new Error('Only allocated goods donations can be shipped.');
      if (store.shipments.some((entry) => entry.donationReference === donation.reference && entry.status !== 'cancelled')) throw new Error('This donation already has a shipment.');
      const vehicle = store.vehicles.find((entry) => entry.id === String(body.vehicleId ?? '') && entry.status === 'available');
      const origin = store.locations.find((entry) => entry.id === String(body.sourceLocationId ?? ''));
      const destination = store.locations.find((entry) => entry.id === String(body.destinationLocationId ?? ''));
      if (!vehicle || !origin || !destination) throw new Error('Choose an available vehicle, pickup site, and destination.');
      if (donation.dropOffLocationId && origin.id !== donation.dropOffLocationId) throw new Error('Shipment pickup must match the donor’s selected drop-off center.');
      if (donation.destinationLocationId && destination.id !== donation.destinationLocationId) throw new Error('Shipment destination must match the donor’s selected relief area.');
      if (!donation.dropOffLocationId) {
        donation.dropOffLocationId = origin.id;
        donation.dropOffLocation = origin.name;
        donation.updates.push({ stage: 'allocated', message: 'Pickup site set while preparing the shipment.', location: origin.name, time: 'Just now' });
      }
      const nextNumber = store.shipments.reduce((highest, entry) => Math.max(highest, Number(entry.reference.match(/(\d+)$/)?.[1] ?? 0)), 0) + 1;
      const shipment: Shipment = {
        id: `ship-${Date.now()}`, reference: `SHIP-2026-${String(nextNumber).padStart(3, '0')}`,
        origin: origin.name, destination: destination.name,
        itemDescription: donation.items.map((item) => `${item.quantity} ${item.unit} ${item.name}`).join(', '),
        quantity: donation.items.reduce((sum, item) => sum + item.quantity, 0), vehicle: vehicle.name,
        plateNumber: vehicle.plateNumber, status: 'pending', note: String(body.note ?? 'Shipment prepared.'),
        coordinates: destination.coordinates, donationReference: donation.reference, donor: donation.donor, driverId: store.drivers.find((driver) => driver.vehicleId === vehicle.id)?.id ?? null
      };
      vehicle.status = 'in_use';
      store.shipments.unshift(shipment);
      store.activities.unshift({ id: `act-${Date.now()}`, action: 'Shipment Prepared', description: `${shipment.reference} prepared for donation ${donation.reference}.`, module: 'Shipments', staff: 'System Administrator', time: 'Just now' });
      writeStore(store);
      return clone(shipment) as T;
    }
    case 'shipment_update_status.php': {
      const shipment = store.shipments.find((entry) => entry.id === String(body.shipmentId ?? ''));
      if (!shipment) throw new Error('Shipment not found.');
      const next = String(body.status ?? '') as ShipmentStatus;
      const transitions: Record<ShipmentStatus, ShipmentStatus[]> = { pending: ['packed', 'cancelled'], packed: ['in_transit', 'cancelled'], in_transit: ['delivered'], delivered: [], cancelled: [] };
      if (!transitions[shipment.status].includes(next)) throw new Error('This shipment status change is not allowed.');
      const donation = store.donations.find((entry) => entry.reference === shipment.donationReference);
      if (donation && next === 'in_transit') {
        for (const item of donation.items) {
          const stock = store.inventory.find((entry) => entry.itemName.toLowerCase() === item.name.toLowerCase() && entry.location === shipment.origin);
          if (!stock || stock.quantity < item.quantity) throw new Error(`Not enough verified ${item.name} stock at ${shipment.origin} to dispatch.`);
          stock.quantity -= item.quantity;
          stock.status = stock.quantity <= 0 ? 'out_of_stock' : stock.quantity < stock.minimumStock ? 'low_stock' : 'available';
        }
        donation.stage = 'in_transit';
        donation.updates.push({ stage: 'in_transit', message: `${shipment.reference} has departed the hub.`, location: shipment.origin, time: 'Just now' });
      }
      if (donation && next === 'delivered') {
        donation.stage = 'distributed';
        donation.updates.push({ stage: 'distributed', message: `${shipment.reference} was delivered.`, location: shipment.destination, time: 'Just now' });
        donation.items.forEach((item) => {
          const need = store.neededItems.find((entry) => entry.itemName.toLowerCase() === item.name.toLowerCase() && entry.category.toLowerCase() === item.category.toLowerCase() && entry.location === shipment.destination);
          if (need) {
            need.quantityReceived = Math.min(need.quantityNeeded, need.quantityReceived + item.quantity);
            need.status = need.quantityReceived >= need.quantityNeeded ? 'fulfilled' : need.quantityReceived > 0 ? 'partially_fulfilled' : 'needed';
          }
        });
        const vehicle = store.vehicles.find((entry) => entry.name === shipment.vehicle);
        if (vehicle) vehicle.status = 'available';
      }
      if (donation && next === 'cancelled') {
        donation.updates.push({ stage: 'allocated', message: `${shipment.reference} was cancelled before dispatch; donation remains allocated.`, location: shipment.origin, time: 'Just now' });
        const vehicle = store.vehicles.find((entry) => entry.name === shipment.vehicle);
        if (vehicle) vehicle.status = 'available';
      }
      shipment.status = next;
      shipment.note = String(body.note ?? (next === 'in_transit' ? 'Driver dispatched.' : next === 'delivered' ? 'Delivered successfully.' : next === 'cancelled' ? 'Cancelled before dispatch.' : 'Ready for next step.'));
      writeStore(store);
      return { updated: true, status: next } as T;
    }
    case 'shipment_update_location.php': {
      const shipment = store.shipments.find((entry) => entry.id === String(body.shipmentId ?? ''));
      if (!shipment) throw new Error('Shipment not found.');
      if (shipment.status !== 'in_transit') throw new Error('GPS sharing is available for shipments in transit.');
      const latitude = Number(body.latitude), longitude = Number(body.longitude);
      if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) throw new Error('Invalid GPS coordinates.');
      shipment.coordinates = [latitude, longitude];
      shipment.locationUpdatedAt = new Date().toISOString();
      writeStore(store);
      return { updated: true } as T;
    }
    case 'donations.php': return store.donations.map((donation, index): DonorEntry => {
      const donationShipments = store.shipments.filter((shipment) => shipment.donationReference === donation.reference);
      const latestShipment = donationShipments[donationShipments.length - 1];
      return { id: donation.reference, donor: donation.donor, donorEmail: donation.donorEmail ?? '', type: donation.type, amount: donation.amount, destination: donation.destination, destinationLocationId: donation.destinationLocationId ?? null, dropOffLocation: donation.dropOffLocation, dropOffLocationId: donation.dropOffLocationId ?? null, itemSummary: donation.items.map((item) => `${item.quantity} ${item.unit} ${item.name}`).join(', '), donorPreference: donation.donorPreference, paymentProof: donation.paymentProof, lastCheckpoint: [...donation.updates].reverse().find((update) => update.location)?.location ?? null, shipmentReference: latestShipment?.reference ?? null, shipmentStatus: latestShipment?.status ?? null, status: donation.stage, time: donation.date || `${index + 1} days ago` };
    }) as T;
    case 'donation_update_stage.php': {
      const reference = String(body.reference ?? '');
      const donation = store.donations.find((entry) => entry.reference === reference);
      if (!donation) throw new Error('Donation reference not found.');
      const stage = String(body.stage ?? '') as TrackedDonation['stage'];
      const validStages: TrackedDonation['stage'][] = ['pledged', 'received', 'verified', 'allocated', 'distributed'];
      if (!validStages.includes(stage)) throw new Error('Invalid donation stage.');
      const nextByStage: Record<string, string> = { pledged: 'received', received: 'verified', verified: 'allocated', allocated: donation.type === 'cash' ? 'distributed' : '' };
      if (nextByStage[donation.stage] !== stage) throw new Error('Donation progress must follow the intake and allocation steps. Create a shipment to dispatch goods donations.');
      donation.stage = stage;
      const location = String(body.location ?? '').trim() || null;
      donation.updates.push({ stage, message: String(body.message ?? `Donation confirmed at ${location ?? donation.destination}.`), time: 'Just now', location });
      if (stage === 'verified' && donation.type !== 'cash') {
        donation.items.forEach((item) => {
          const existing = store.inventory.find((entry) => entry.itemName.toLowerCase() === item.name.toLowerCase() && entry.location === (donation.dropOffLocation ?? donation.destination));
          if (existing) {
            existing.quantity += item.quantity;
            existing.status = existing.quantity < existing.minimumStock ? 'low_stock' : 'available';
          } else {
            store.inventory.unshift({ id: `inv-${Date.now()}-${item.name}`, itemName: item.name, category: item.category, location: donation.dropOffLocation ?? donation.destination, quantity: item.quantity, unit: item.unit, minimumStock: 0, status: 'available' });
          }
        });
      }
      store.activities.unshift({ id: `act-${Date.now()}`, action: `Donation ${stage}`, description: `${donation.reference} was updated at ${donation.destination}.`, module: 'Donations', staff: 'System Administrator', time: 'Just now' });
      writeStore(store);
      return clone(donation) as T;
    }
    case 'admin_donations_delete.php': {
      const reference = String(body.id ?? '');
      const donation = store.donations.find((entry) => entry.reference === reference);
      if (!donation) throw new Error('Donation reference not found.');
      if (store.shipments.some((entry) => entry.donationReference === reference)) throw new Error('This donation has a shipment record and cannot be deleted.');
      store.donations = store.donations.filter((entry) => entry.reference !== reference);
      store.activities.unshift({ id: `act-${Date.now()}`, action: 'Donation Deleted', description: `${reference} was removed from the donation ledger.`, module: 'Donations', staff: 'System Administrator', time: 'Just now' });
      writeStore(store);
      return { deleted: true } as T;
    }
    case 'locations.php': {
      if (init?.method?.toUpperCase() === 'POST') {
        const name = String(body.name ?? '').trim();
        const address = String(body.address ?? '').trim();
        const city = String(body.city ?? '').trim();
        const province = String(body.province ?? '').trim();
        const latitude = Number(body.latitude);
        const longitude = Number(body.longitude);
        if (!name || !address || !city || !province || !Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) throw new Error('Enter the drop-off name, address, city, province, and valid coordinates.');
        const location: ReliefLocation = { id: `loc-${Date.now()}`, kind: 'donation_center', name, address, city, province, coordinates: [latitude, longitude], status: 'active', detail: String(body.detail ?? '').trim() || 'Donation drop-off center.', contactPhone: String(body.contactPhone ?? '').trim() || undefined, operationIds: [], volunteersNeeded: 0 };
        store.locations.unshift(location);
        store.activities.unshift({ id: `act-${Date.now()}`, action: 'Added Drop-off Location', description: `${name} was added as a donation drop-off location.`, module: 'Logistics', staff: 'System Administrator', time: 'Just now' });
        writeStore(store);
        return { created: true, location: clone(location) } as T;
      }
      return clone(store.locations.map((location) => ({
      ...location,
      contactPhone: location.contactPhone ?? null,
      operatedBy: location.operatedBy ?? null,
      imageUrl: location.imageUrl ?? null,
      feedbackRating: location.feedbackRating ?? null,
      feedbackCount: location.feedbackCount ?? null,
      operationIds: location.operationIds ?? [],
      volunteersNeeded: store.shifts.filter((shift) => shift.location === location.name && ['open', 'full'].includes(shift.status)).reduce((total, shift) => total + Math.max(shift.needed - shift.filled, 0), 0)
      }))) as T;
    }
    case 'needed_items.php': return clone(store.neededItems) as T;
    case 'shifts.php': return clone(store.shifts.map((shift) => ({
      ...shift,
      approved: Object.values(store.joinedShifts).flat().filter((joined) => joined.id === shift.id && joined.signupStatus === 'approved').length
    }))) as T;
    case 'skills.php': return clone(store.skills) as T;
    case 'admin_skill_verifications.php': {
      const status = params.get('status');
      const records = store.skillVerifications.filter((record) => !status || record.status === status);
      return clone(records.sort((a, b) => b.submitted_at.localeCompare(a.submitted_at))) as T;
    }
    case 'admin_skill_verify.php': {
      const record = store.skillVerifications.find((entry) => entry.verification_id === String(body.verificationId ?? ''));
      if (!record) throw new Error('Verification not found.');
      const decision = String(body.decision ?? '');
      if (!['approve', 'reject'].includes(decision)) throw new Error('Decision must be approve or reject.');
      record.status = decision === 'approve' ? 'approved' : 'rejected';
      writeStore(store);
      return { decision, verification: clone(record) } as T;
    }
    case 'volunteers.php': return store.volunteers.map((volunteer): VolunteerRosterEntry => ({ id: volunteer.volunteerId, fullName: volunteer.fullName, email: volunteer.email, phone: volunteer.phone, address: volunteer.address ?? '', status: volunteer.status, skills: volunteer.skills, shiftsCompleted: (store.joinedShifts[volunteer.volunteerId] ?? []).filter((shift) => shift.signupStatus === 'completed').length, emergencyContact: volunteer.emergencyContact ?? '', emergencyPhone: volunteer.emergencyPhone ?? '', drivingLicenseNumber: volunteer.drivingLicenseNumber ?? '', drivingLicenseType: volunteer.drivingLicenseType ?? '', firstAidQualification: volunteer.firstAidQualification ?? '', verificationStatus: volunteer.verificationStatus ?? 'unverified', verificationPhoto: volunteer.verificationPhoto ?? null, verificationSubmittedAt: volunteer.verificationSubmittedAt ?? null, verificationNotes: volunteer.verificationNotes ?? null })) as T;
    case 'admin_volunteer_manage.php': {
      const volunteer = store.volunteers.find((entry) => entry.volunteerId === String(body.volunteerId ?? '')); if (!volunteer) throw new Error('Volunteer not found.');
      volunteer.fullName = String(body.fullName ?? volunteer.fullName); volunteer.email = String(body.email ?? volunteer.email).toLowerCase(); volunteer.phone = String(body.phone ?? ''); volunteer.address = String(body.address ?? ''); volunteer.emergencyContact = String(body.emergencyContact ?? ''); volunteer.emergencyPhone = String(body.emergencyPhone ?? ''); volunteer.drivingLicenseNumber = String(body.drivingLicenseNumber ?? ''); volunteer.drivingLicenseType = String(body.drivingLicenseType ?? ''); volunteer.firstAidQualification = String(body.firstAidQualification ?? '');
      volunteer.skills = store.skills.filter((skill) => (body.skillIds as string[] ?? []).includes(skill.id)).map((skill) => skill.name); writeStore(store); return { volunteer: clone(volunteer) } as T;
    }
    case 'admin_volunteer_status.php': {
      const volunteer = store.volunteers.find((entry) => entry.volunteerId === String(body.volunteerId ?? '')); if (!volunteer) throw new Error('Volunteer not found.');
      volunteer.status = String(body.status) as VolunteerProfile['status'];
      if (volunteer.status === 'inactive') store.joinedShifts[volunteer.volunteerId] = (store.joinedShifts[volunteer.volunteerId] ?? []).map((shift) => shift.signupStatus === 'completed' ? shift : { ...shift, signupStatus: 'cancelled' });
      writeStore(store); return { status: volunteer.status } as T;
    }
    case 'admin_volunteer_delete.php': {
      const volunteer = store.volunteers.find((entry) => entry.volunteerId === String(body.volunteerId ?? '')); if (!volunteer) throw new Error('Volunteer not found.');
      volunteer.status = 'inactive'; store.joinedShifts[volunteer.volunteerId] = (store.joinedShifts[volunteer.volunteerId] ?? []).map((shift) => shift.signupStatus === 'completed' ? shift : { ...shift, signupStatus: 'cancelled' }); writeStore(store); return { deleted: true } as T;
    }
    case 'volunteer_checkin.php': {
      const match = /^RT-VOL-([A-Za-z0-9_-]+)$/i.exec(String(body.code ?? '').trim());
      if (!match) throw new Error('This QR code is not a ReliefTrack volunteer code.');
      const volunteer = store.volunteers.find((entry) => entry.volunteerId.toLowerCase() === match[1].toLowerCase());
      if (!volunteer) throw new Error('No registered volunteer matches this QR code.');
      const shift = store.shifts.find((entry) => entry.id === String(body.shiftId ?? ''));
      if (!shift || !['open', 'full', 'ongoing'].includes(shift.status)) throw new Error('Choose a shift that is currently accepting check-ins.');
      const joined = store.joinedShifts[volunteer.volunteerId] ?? [];
      const signup = joined.find((entry) => entry.id === shift.id);
      if (!signup || !['pending', 'approved'].includes(signup.signupStatus)) throw new Error('This volunteer is not signed up for the selected shift.');
      const alreadyCheckedIn = Boolean(signup.checkedInAt);
      const checkedInAt = signup.checkedInAt ?? new Date().toISOString();
      signup.signupStatus = 'approved';
      signup.checkedInAt = checkedInAt;
      volunteer.status = 'active';
      writeStore(store);
      return { volunteerId: volunteer.volunteerId, fullName: volunteer.fullName, status: volunteer.status, shiftId: shift.id, shiftName: shift.name, checkedInAt, alreadyCheckedIn } as T;
    }
    case 'donation_track.php': {
      const donation = store.donations.find((entry) => entry.reference.toLowerCase() === String(params.get('reference') ?? '').toLowerCase());
      if (!donation || donation.donorEmail?.toLowerCase() !== String(params.get('email') ?? '').trim().toLowerCase()) throw new Error('No donation matched that reference and email.');
      const shipment = store.shipments.find((entry) => entry.donationReference === donation.reference);
      return clone({ ...donation, shipmentTracking: shipment ? localShipmentTracking(store, shipment) : null }) as T;
    }
    case 'donation_list.php': return clone(store.donations.filter((donation) => donation.reference.toLowerCase() === String(params.get('reference') ?? '').trim().toLowerCase() && donation.donorEmail?.toLowerCase() === String(params.get('email') ?? '').trim().toLowerCase()).map((donation) => {
      const shipment = store.shipments.find((entry) => entry.donationReference === donation.reference);
      return { ...donation, shipmentTracking: shipment ? localShipmentTracking(store, shipment) : null };
    })) as T;
    case 'donation_create.php': {
      const request = body as unknown as DonationRequest;
      const nextId = store.donations.reduce((highest, donation) => {
        const match = /^RT-(\d{6})$/i.exec(donation.reference);
        return match ? Math.max(highest, Number(match[1])) : highest;
      }, 1001) + 1;
      const reference = `RT-${String(nextId).padStart(6, '0')}`;
      const operation = store.operations.find((item) => item.id === request.operationId) ?? store.operations[0];
      const location = store.locations.find((item) => item.id === request.preferredLocationId);
      const dropOff = store.locations.find((item) => item.id === request.dropOffLocationId);
      if (!request.donorName.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(request.donorEmail) || !location) throw new Error('Enter your name, a valid email address, and a relief destination.');
      if ((request.donationType === 'cash' || request.donationType === 'mixed') && request.amount < 1) throw new Error('Enter a donation amount greater than zero.');
      if ((request.donationType === 'goods' || request.donationType === 'mixed') && (!dropOff || !request.items?.length)) throw new Error('Choose a donation drop-off location and at least one item.');
      if (dropOff && !['donation_center', 'warehouse'].includes(dropOff.kind)) throw new Error('Choose an active donation center or warehouse for drop-off.');
      const donation: TrackedDonation = {
        reference,
        donor: request.donorName || 'Anonymous donor',
        donorEmail: request.donorEmail,
        type: request.donationType,
        amount: String(request.amount || 0),
        operation: operation.name,
        destination: location?.name ?? store.locations[2].name,
        donorPreference: request.donorPreference,
        paymentProof: request.paymentProof,
        destinationLocationId: location?.id ?? store.locations[2].id,
        dropOffLocation: dropOff?.name,
        dropOffLocationId: dropOff?.id,
        date: new Date().toISOString(),
        stage: 'pledged',
        items: request.items ?? [],
        updates: [{ stage: 'pledged', message: 'Donation pledged by donor.', time: 'Just now' }]
      };
      store.donations.unshift(donation);
      store.activities.unshift({ id: `act-${Date.now()}`, action: 'Donation Pledged', description: `${donation.donor} created donation ${reference}.`, module: 'Donations', staff: 'System', time: 'Just now' });
      writeStore(store);
      return { reference, donationId: reference } as T;
    }
    case 'auth_request_code.php': {
      const email = String(body.email ?? '').toLowerCase();
      if (!email) throw new Error('Enter an email address.');
      store.loginCodes[email] = '123456';
      writeStore(store);
      return { sent: true, debugCode: '123456' } as T;
    }
    case 'auth_verify_code.php': {
      const email = String(body.email ?? '').toLowerCase();
      if (store.loginCodes[email] !== String(body.code ?? '')) throw new Error('That code is invalid or has expired.');
      let volunteer = store.volunteers.find((entry) => entry.email.toLowerCase() === email);
      if (volunteer?.status === 'inactive' || volunteer?.status === 'suspended') throw new Error('This volunteer account is inactive.');
      if (!volunteer) {
        volunteer = { volunteerId: `vol-${Date.now()}`, fullName: 'Demo Volunteer', email, phone: '', status: 'active', skills: [] };
        store.volunteers.push(volunteer);
      }
      writeStore(store);
      return { volunteer: clone(volunteer), shifts: clone(store.joinedShifts[volunteer.volunteerId] ?? []) } as T;
    }
    case 'volunteer_session.php': {
      const profile = window.sessionStorage.getItem('relieftrack.volunteer.session');
      if (!profile) throw new Error('Volunteer authentication required.');
      const volunteer = JSON.parse(profile) as VolunteerProfile;
      const activeVolunteer = store.volunteers.find((entry) => entry.volunteerId === volunteer.volunteerId && !['inactive','suspended'].includes(entry.status));
      if (!activeVolunteer) { window.sessionStorage.removeItem('relieftrack.volunteer.session'); throw new Error('Volunteer session is no longer active.'); }
      return { volunteer: clone(activeVolunteer), shifts: clone(store.joinedShifts[volunteer.volunteerId] ?? []) } as T;
    }
    case 'volunteer_logout.php': return { signedOut: true } as T;
    case 'volunteer_profile_update.php': {
      const sessionProfile = JSON.parse(window.sessionStorage.getItem('relieftrack.volunteer.session') ?? 'null') as VolunteerProfile | null;
      const volunteer = store.volunteers.find((entry) => entry.volunteerId === sessionProfile?.volunteerId && !['inactive','suspended'].includes(entry.status));
      if (!volunteer) throw new Error('Volunteer authentication required.');
      volunteer.fullName = String(body.fullName ?? '').trim(); volunteer.phone = String(body.phone ?? ''); volunteer.address = String(body.address ?? ''); volunteer.emergencyContact = String(body.emergencyContact ?? ''); volunteer.emergencyPhone = String(body.emergencyPhone ?? ''); volunteer.drivingLicenseNumber = String(body.drivingLicenseNumber ?? ''); volunteer.drivingLicenseType = String(body.drivingLicenseType ?? ''); volunteer.firstAidQualification = String(body.firstAidQualification ?? '');
      volunteer.skills = store.skills.filter((skill) => (body.skillIds as string[] ?? []).includes(skill.id)).map((skill) => skill.name);
      if (!volunteer.fullName) throw new Error('Enter a valid name.');
      writeStore(store); return { volunteer: clone(volunteer) } as T;
    }
    case 'volunteer_account_delete.php': {
      const sessionProfile = JSON.parse(window.sessionStorage.getItem('relieftrack.volunteer.session') ?? 'null') as VolunteerProfile | null;
      const volunteer = store.volunteers.find((entry) => entry.volunteerId === sessionProfile?.volunteerId);
      if (!volunteer) throw new Error('Volunteer authentication required.');
      volunteer.status = 'inactive'; store.joinedShifts[volunteer.volunteerId] = (store.joinedShifts[volunteer.volunteerId] ?? []).map((shift) => shift.signupStatus === 'completed' ? shift : { ...shift, signupStatus: 'cancelled' });
      writeStore(store); window.sessionStorage.removeItem('relieftrack.volunteer.session'); return { deleted: true } as T;
    }
    case 'volunteer_upload_skill_verification.php': {
      const profile = window.sessionStorage.getItem('relieftrack.volunteer.session');
      if (!profile) throw new Error('Volunteer authentication required.');
      const volunteer = JSON.parse(profile) as VolunteerProfile;
      const skillId = String(body.skillId ?? '');
      const photo = String(body.photo ?? '');
      const skill = store.skills.find((entry) => entry.id === skillId);
      if (!skill || !volunteer.skills.includes(skill.name)) throw new Error('You do not have this skill assigned.');
      if (!photo.startsWith('data:image/')) throw new Error('A valid skill photo is required.');
      const record: LocalSkillVerification = {
        verification_id: `${volunteer.volunteerId}-${skillId}`,
        volunteer_id: volunteer.volunteerId,
        skill_id: skillId,
        photo_filename: `${volunteer.volunteerId}-${skillId}`,
        photo_data: photo,
        status: 'pending',
        submitted_at: new Date().toISOString(),
        full_name: volunteer.fullName,
        email: volunteer.email,
        skill_name: skill.name
      };
      const existing = store.skillVerifications.findIndex((entry) => entry.volunteer_id === volunteer.volunteerId && entry.skill_id === skillId);
      if (existing >= 0) store.skillVerifications[existing] = record;
      else store.skillVerifications.push(record);
      writeStore(store);
      return { uploaded: true, verification: clone(record) } as T;
    }
    case 'volunteer_register.php': {
      const volunteerId = `vol-${Date.now()}`;
      const registered: VolunteerProfile = { volunteerId, fullName: String(body.fullName ?? ''), email: String(body.email ?? '').toLowerCase(), phone: String(body.phone ?? ''), status: 'pending', skills: store.skills.filter((skill) => (body.skillIds as string[] ?? []).includes(skill.id)).map((skill) => skill.name), drivingLicenseNumber: String(body.drivingLicenseNumber ?? ''), drivingLicenseType: String(body.drivingLicenseType ?? ''), firstAidQualification: String(body.firstAidQualification ?? ''), emergencyContact: String(body.emergencyContact ?? ''), emergencyPhone: String(body.emergencyPhone ?? '') };
      store.volunteers.push(registered);
      const selected = store.shifts.find((shift) => shift.id === body.shiftId);
      store.joinedShifts[volunteerId] = selected ? [joinedShift(selected)] : [];
      writeStore(store);
      return { volunteer: registered, shifts: store.joinedShifts[volunteerId] } as T;
    }
    case 'volunteer_shifts.php': return clone(store.joinedShifts[String(params.get('volunteer_id'))] ?? []) as T;
    case 'shift_join.php': {
      const volunteerId = String(body.volunteerId);
      const activeVolunteer = store.volunteers.find((entry) => entry.volunteerId === volunteerId && entry.status === 'active');
      if (!activeVolunteer) throw new Error('Only active volunteers can join shifts.');
      const shift = store.shifts.find((entry) => entry.id === body.shiftId);
      if (!shift) throw new Error('That shift is no longer available.');
      const joined = store.joinedShifts[volunteerId] ?? [];
      if (!joined.some((entry) => entry.id === shift.id)) joined.push(joinedShift(shift));
      store.joinedShifts[volunteerId] = joined;
      writeStore(store);
      return clone(joined) as T;
    }
    case 'shift_cancel.php': {
      const volunteerId = String(body.volunteerId);
      const joined = (store.joinedShifts[volunteerId] ?? []).map((entry) => entry.id === body.shiftId ? { ...entry, signupStatus: 'cancelled' as const } : entry);
      store.joinedShifts[volunteerId] = joined;
      writeStore(store);
      return clone(joined) as T;
    }
    default: throw new Error(`Local endpoint not implemented: ${endpoint}`);
  }
}
