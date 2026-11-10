// Dokumentenspeicher: Neon Postgres auf Vercel, lokale JSON-Datei in der Entwicklung.
import 'server-only';
import { neon } from '@neondatabase/serverless';
import fs from 'node:fs';
import { seedDocs } from './seed';

const DB_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
const sql = DB_URL ? neon(DB_URL) : null;
const FILE = process.env.GFG_FILE_STORE || '/tmp/gfg-store.json';

export const datenbankVorhanden = () => !!sql || process.env.NODE_ENV !== 'production' || !!process.env.GFG_FILE_STORE;

let mem = null;
function fileLoad() {
  if (mem) return mem;
  try { mem = JSON.parse(fs.readFileSync(/*turbopackIgnore: true*/ FILE, 'utf8')); } catch { mem = {}; }
  return mem;
}
function fileSave() { fs.writeFileSync(/*turbopackIgnore: true*/ FILE, JSON.stringify(mem, null, 1)); }

let bereit = null;
function ensure() {
  if (!bereit) {
    bereit = (async () => {
      if (sql) {
        await sql`CREATE TABLE IF NOT EXISTS gfg_docs (
          col text NOT NULL, id text NOT NULL, data jsonb NOT NULL,
          updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (col, id))`;
        const r = await sql`SELECT 1 FROM gfg_docs WHERE col = 'config' AND id = 'app'`;
        if (!r.length) for (const d of seedDocs()) await rawPut(d.col, d.id, d.data);
      } else {
        fileLoad();
        if (!mem.config?.app) {
          for (const d of seedDocs()) { mem[d.col] ??= {}; mem[d.col][d.id] = d.data; }
          fileSave();
        }
      }
    })().catch((e) => { bereit = null; throw e; });
  }
  return bereit;
}

async function rawPut(col, id, data) {
  if (sql) {
    await sql`INSERT INTO gfg_docs (col, id, data, updated_at) VALUES (${col}, ${id}, ${JSON.stringify(data)}::jsonb, now())
      ON CONFLICT (col, id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`;
  } else {
    fileLoad(); mem[col] ??= {}; mem[col][id] = data; fileSave();
  }
}

/** Alle Dokumente der genannten Sammlungen: { col: [{id, ...data}] } */
export async function alle(cols) {
  await ensure();
  const out = Object.fromEntries(cols.map((c) => [c, []]));
  if (sql) {
    const rows = await sql`SELECT col, id, data FROM gfg_docs WHERE col = ANY(${cols})`;
    for (const r of rows) out[r.col].push({ ...r.data, id: r.id });
  } else {
    fileLoad();
    for (const c of cols) out[c] = Object.entries(mem[c] || {}).map(([id, d]) => ({ ...d, id }));
  }
  return out;
}

export async function hole(col, id) {
  await ensure();
  if (sql) {
    const r = await sql`SELECT data FROM gfg_docs WHERE col = ${col} AND id = ${id}`;
    return r.length ? { ...r[0].data, id } : null;
  }
  fileLoad();
  const d = mem[col]?.[id];
  return d ? { ...d, id } : null;
}

export async function setze(col, id, data) {
  await ensure();
  const { id: _weg, ...rest } = data;
  await rawPut(col, id, rest);
}

/** Flaches Zusammenführen (oberste Ebene) */
export async function ergaenze(col, id, teil) {
  await ensure();
  const { id: _weg, ...rest } = teil;
  if (sql) {
    const r = await sql`UPDATE gfg_docs SET data = data || ${JSON.stringify(rest)}::jsonb, updated_at = now()
      WHERE col = ${col} AND id = ${id} RETURNING id`;
    if (!r.length) throw new Error('nicht_gefunden');
  } else {
    fileLoad();
    if (!mem[col]?.[id]) throw new Error('nicht_gefunden');
    mem[col][id] = { ...mem[col][id], ...rest };
    fileSave();
  }
}

export async function loesche(col, id) {
  await ensure();
  if (sql) await sql`DELETE FROM gfg_docs WHERE col = ${col} AND id = ${id}`;
  else { fileLoad(); if (mem[col]) delete mem[col][id]; fileSave(); }
}
