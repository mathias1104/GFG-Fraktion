import { NextResponse } from 'next/server';
import { handleUpload } from '@vercel/blob/client';
import { leseSitzung } from '@/lib/auth';
import { darf, ERLAUBTE_TYPEN } from '@/lib/dateien';

/** Erlaubt dem Browser, direkt in den privaten Blob-Speicher hochzuladen (auch große Dateien) */
export async function POST(req) {
  const body = await req.json();
  const me = await leseSitzung();
  try {
    const r = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pfad) => {
        if (!darf(me, pfad) || pfad.includes('..')) throw new Error('Kein Zugriff auf diesen Bereich.');
        return { allowedContentTypes: ERLAUBTE_TYPEN, maximumSizeInBytes: 100 * 1024 * 1024, addRandomSuffix: true };
      },
    });
    return NextResponse.json(r);
  } catch (e) {
    return NextResponse.json({ fehler: e.message }, { status: 400 });
  }
}
