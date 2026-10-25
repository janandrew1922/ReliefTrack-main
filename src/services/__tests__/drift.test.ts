// @vitest-environment jsdom
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'vitest';
import { localRequest } from '../localApi';
import { resolveAuthenticatedApi, staffGet } from './apiTestHarness';

const publicEndpoints = [
  'locations.php','operations.php','shipments.php','needed_items.php','shifts.php','skills.php'
];

const staffEndpoints = [
  'dashboard.php','alerts.php','activity_log.php','inventory.php','donations.php','volunteers.php'
];

function shape(v: unknown): unknown {
  if (Array.isArray(v)) return Array.from(new Set(v.map((e) => JSON.stringify(shape(e))))).sort();
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map((k) => [k, shape((v as Record<string, unknown>)[k])]));
  return typeof v;
}
function flatKeys(v: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(v)) { v.forEach((e) => flatKeys(e, out)); return out; }
  if (v && typeof v === 'object') { Object.keys(v).forEach((k) => { out.add(k); flatKeys((v as Record<string, unknown>)[k], out); }); }
  return out;
}

const report: unknown[] = [];

describe('drift report', () => {
  it('reports all mismatches', async () => {
    const api = await resolveAuthenticatedApi();
    if (!api) {
      console.log('SKIP: no reachable PHP API (start XAMPP or the dev PHP server)');
      return;
    }
    const { base, session } = api;

    for (const ep of publicEndpoints) {
      const local = await localRequest<unknown>(ep);
      const r = await fetch(`${base}/${ep}`);
      const env = await r.json() as { data?: unknown };
      report.push(compare(ep, local, env.data));
    }

    for (const ep of staffEndpoints) {
      const local = await localRequest<unknown>(ep);
      const r = await staffGet(base, ep, session);
      const env = await r.json() as { data?: unknown };
      report.push(compare(ep, local, env.data));
    }

    const target = join(tmpdir(), 'relieftrack-drift-report.json');
    writeFileSync(target, JSON.stringify(report, null, 2));
    console.log(`drift report written to ${target}`);
  });
});

function compare(ep: string, local: unknown, phpData: unknown) {
  const lk = flatKeys(local), pk = flatKeys(phpData);
  const onlyLocal = [...lk].filter((k) => !pk.has(k));
  const onlyPhp = [...pk].filter((k) => !lk.has(k));
  const localShape = shape(local), phpShape = shape(phpData);
  const status = onlyLocal.length === 0 && onlyPhp.length === 0 && JSON.stringify(localShape) === JSON.stringify(phpShape) ? 'MATCH' : 'DIFF';
  console.log(`${status} ${ep}${onlyLocal.length ? ' | local-only: ' + onlyLocal.join(',') : ''}${onlyPhp.length ? ' | php-only: ' + onlyPhp.join(',') : ''}`);
  return { endpoint: ep, status, onlyLocal, onlyPhp, localShape, phpShape };
}
