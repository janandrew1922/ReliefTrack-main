// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { API_ENDPOINTS } from '../reliefService';
import { localRequest } from '../localApi';
import { resolveAuthenticatedApi, staffGet } from './apiTestHarness';

const phpRouter = readFileSync(resolve(process.cwd(), 'php-api/index.php'), 'utf8');
const phpEndpoints = Array.from(phpRouter.matchAll(/case\s+'([^']+\.php)'/g), (match) => match[1]).sort();
const serviceEndpoints = Object.values(API_ENDPOINTS).slice().sort();

/** Endpoints the PHP router serves without a staff session. */
const publicReadEndpoints = [
  API_ENDPOINTS.locations,
  API_ENDPOINTS.operations,
  API_ENDPOINTS.shipments,
  API_ENDPOINTS.neededItems,
  API_ENDPOINTS.shifts,
  API_ENDPOINTS.skills
];

/**
 * Endpoints the PHP router protects with `requireStaff()`. The frontend only
 * reaches them from the staff console, which signs in first.
 */
const staffReadEndpoints = [
  API_ENDPOINTS.dashboard,
  API_ENDPOINTS.alerts,
  API_ENDPOINTS.activity,
  API_ENDPOINTS.inventory,
  API_ENDPOINTS.donorLedger,
  API_ENDPOINTS.volunteerRoster
];

function keyShape(value: unknown): unknown {
  if (Array.isArray(value)) {
    return Array.from(new Set(value.map((entry) => JSON.stringify(keyShape(entry))))).sort();
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, keyShape((value as Record<string, unknown>)[key])]));
  }
  return typeof value;
}

beforeEach(() => {
  window.localStorage.clear();
});

describe('API endpoint contract', () => {
  it('keeps every PHP router endpoint represented in the typed service registry', () => {
    expect(serviceEndpoints).toEqual(phpEndpoints);
  });

  it('matches local and live PHP response key shapes when XAMPP is reachable', async ({ skip }) => {
    const api = await resolveAuthenticatedApi();
    if (!api) {
      skip();
      return;
    }
    const { base, session } = api;

    for (const endpoint of publicReadEndpoints) {
      const local = await localRequest<unknown>(endpoint);
      const response = await fetch(`${base}/${endpoint}`);
      const envelope = await response.json() as {success: boolean;data?: unknown;message?: string;};
      expect(response.ok && envelope.success, `${endpoint} should return success=true`).toBe(true);
      expect(keyShape(local), `${endpoint} local/PHP response keys`).toEqual(keyShape(envelope.data));
    }

    for (const endpoint of staffReadEndpoints) {
      const local = await localRequest<unknown>(endpoint);
      const response = await staffGet(base, endpoint, session);
      const envelope = await response.json() as {success: boolean;data?: unknown;message?: string;};
      expect(response.ok && envelope.success, `${endpoint} should return success=true for staff`).toBe(true);
      expect(keyShape(local), `${endpoint} local/PHP response keys`).toEqual(keyShape(envelope.data));
    }
  });
});

describe('local donation parity', () => {
  it('uses a stable reference and finds donations by exact donor email', async () => {
    const payload = {
      donorName: 'Contract Test Donor',
      donorEmail: 'contract-test@example.invalid',
      donorPhone: '',
      donationType: 'goods',
      amount: 0,
      operationId: 'op-1',
      preferredLocationId: 'loc-1',
      donorPreference: '',
      items: [{ name: 'Contract Test Rice', category: 'Food', quantity: 2, unit: 'kg' }]
    };
    const result = await localRequest<{reference: string;}>('donation_create.php', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    expect(result.reference).toMatch(/^RT-\d{6}$/);
    const tracked = await localRequest<{reference: string;donorEmail: string;}> (
      `donation_track.php?reference=${encodeURIComponent(result.reference)}`
    );
    const donations = await localRequest<{reference: string;donorEmail: string;}[]>(
      `donation_list.php?email=${encodeURIComponent(payload.donorEmail)}`
    );
    const wrongEmail = await localRequest<unknown[]>(
      `donation_list.php?email=${encodeURIComponent('not-the-donor@example.invalid')}`
    );

    expect(tracked).toMatchObject({ reference: result.reference, donorEmail: payload.donorEmail });
    expect(donations.some((donation) => donation.reference === result.reference)).toBe(true);
    expect(wrongEmail).toEqual([]);
  });
});