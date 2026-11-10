import 'server-only';
import fs from 'node:fs/promises';
import path from 'node:path';
import { put, get, del } from '@vercel/blob';

// Dateiablage: Vercel Blob (privat) auf Vercel, lokaler Ordner in der Entwicklung
export const blobAktiv = () => !!process.env.BLOB_READ_WRITE_TOKEN;
const LOKAL = process.env.GFG_DATEI_ORDNER || '/tmp/gfg-dateien';

/** Bereiche und wer sie lesen und beschreiben darf */
export function darf(me, pfad) {
  if (!me) return false;
  if (pfad.startsWith('gr/')) return !!me.gr;
  if (pfad.startsWith('marketing/')) return !!me.mk;
  return false;
}

export const sichererName = (n) => String(n || 'datei').normalize('NFKD').replace(/[^\w.\-]+/g, '-').replace(/-+/g, '-').slice(-80) || 'datei';

export const ERLAUBTE_TYPEN = [
  'application/pdf', 'text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'video/mp4', 'video/quicktime',
];

export async function speichereDatei(pfad, buffer, contentType) {
  if (blobAktiv()) {
    const r = await put(pfad, buffer, { access: 'private', contentType, addRandomSuffix: true });
    return r.pathname;
  }
  const ziel = path.join(/*turbopackIgnore: true*/ LOKAL, pfad);
  await fs.mkdir(path.dirname(ziel), { recursive: true });
  await fs.writeFile(ziel, buffer);
  return pfad;
}

export async function leseDatei(pfad) {
  if (blobAktiv()) {
    const r = await get(pfad, { access: 'private', useCache: false });
    if (!r || r.statusCode !== 200) return null;
    const buffer = Buffer.from(await new Response(r.stream).arrayBuffer());
    return { buffer, contentType: r.blob.contentType || 'application/octet-stream' };
  }
  try {
    const buffer = await fs.readFile(path.join(/*turbopackIgnore: true*/ LOKAL, pfad));
    return { buffer, contentType: typVonName(pfad) };
  } catch { return null; }
}

export async function loescheDatei(pfad) {
  if (blobAktiv()) { try { await del(pfad); } catch { /* schon weg */ } return; }
  try { await fs.unlink(path.join(/*turbopackIgnore: true*/ LOKAL, pfad)); } catch { /* schon weg */ }
}

export function typVonName(n) {
  const e = String(n).toLowerCase().split('.').pop();
  return ({
    pdf: 'application/pdf', txt: 'text/plain', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    doc: 'application/msword', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', mp4: 'video/mp4', mov: 'video/quicktime',
  })[e] || 'application/octet-stream';
}

/** Text aus PDF, DOCX oder TXT */
export async function textAusDatei(pfad) {
  const d = await leseDatei(pfad);
  if (!d) throw new Error('Datei nicht gefunden.');
  const typ = d.contentType.includes('octet') ? typVonName(pfad) : d.contentType;
  if (typ.includes('pdf')) return pdfText(d.buffer);
  if (typ.includes('wordprocessingml')) {
    const mammoth = await import('mammoth');
    const r = await mammoth.extractRawText({ buffer: d.buffer });
    return r.value;
  }
  if (typ.startsWith('text/')) return d.buffer.toString('utf8');
  throw new Error('Aus diesem Dateityp kann ich keinen Text lesen. Bitte PDF oder Word-Datei verwenden.');
}

/** PDF-Text zeilenweise rekonstruieren (Position der Textstücke) */
async function pdfText(buffer) {
  const { getDocumentProxy } = await import('unpdf');
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const seiten = [];
  for (let n = 1; n <= Math.min(pdf.numPages, 30); n += 1) {
    const seite = await pdf.getPage(n);
    const inhalt = await seite.getTextContent();
    const zeilen = new Map();
    for (const it of inhalt.items) {
      if (!it.str) continue;
      const y = Math.round(it.transform[5] / 3) * 3;
      if (!zeilen.has(y)) zeilen.set(y, []);
      zeilen.get(y).push({ x: it.transform[4], s: it.str });
    }
    const text = [...zeilen.entries()].sort((a, b) => b[0] - a[0])
      .map(([, teile]) => teile.sort((a, b) => a.x - b.x).map((t) => t.s).join(' ').replace(/\s+/g, ' ').trim())
      .filter(Boolean).join('\n');
    seiten.push(text);
  }
  return seiten.join('\n');
}
