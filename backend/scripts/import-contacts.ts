// backend/scripts/import-contacts.ts — apply the council contact registry
// (issue #34) to an existing zones import.
//
//   npm run contacts                    # uses backend/data/council-contacts.json
//   tsx scripts/import-contacts.ts <file.json>
//
// Per entry: councils.entity/contact_phone/contact_form_url/contact_app are
// set, and alert_emails is written to every zone of that council. Councils
// absent from the DB are reported and skipped. Idempotent.
import { readFileSync } from 'node:fs';
import type pg from 'pg';
import { pool } from '../src/db.js';

const file = process.argv[2] ?? 'data/council-contacts.json';

export interface CouncilContact {
  entity?: string | null;
  emails?: string[];
  phone?: string | null;
  form_url?: string | null;
  app?: string | null;
  notes?: string;
}

type Queryable = Pick<pg.Pool | pg.PoolClient, 'query'>;

export async function applyContacts(
  db: Queryable,
  contacts: Record<string, CouncilContact>,
): Promise<{ applied: string[]; missing: string[] }> {
  const applied: string[] = [];
  const missing: string[] = [];
  for (const [name, c] of Object.entries(contacts)) {
    if (name.startsWith('$')) continue;
    const { rows } = await db.query(
      `UPDATE councils
       SET entity = $2, contact_phone = $3, contact_form_url = $4, contact_app = $5
       WHERE name = $1 RETURNING id`,
      [name, c.entity ?? null, c.phone ?? null, c.form_url ?? null, c.app ?? null],
    );
    if (!rows.length) {
      missing.push(name);
      continue;
    }
    if (c.emails?.length) {
      await db.query('UPDATE council_zones SET alert_emails = $2 WHERE council_id = $1', [
        rows[0].id,
        c.emails,
      ]);
    }
    applied.push(name);
  }
  return { applied, missing };
}

async function main() {
  const contacts = JSON.parse(readFileSync(file, 'utf8')) as Record<string, CouncilContact>;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { applied, missing } = await applyContacts(client, contacts);
    await client.query('COMMIT');
    for (const name of applied) console.log(`  ${name}`);
    console.log(`done — ${applied.length} councils updated`);
    if (missing.length) console.warn(`not in DB (skipped): ${missing.join(', ')}`);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run only as a script, not on import (tests pull in applyContacts).
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
