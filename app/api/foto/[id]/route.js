import { hole } from '@/lib/db';
import { leseSitzung } from '@/lib/auth';

export async function GET(_req, { params }) {
  const me = await leseSitzung();
  if (!me) return new Response('Bitte anmelden', { status: 401 });
  const { id } = await params;
  const f = await hole('fotos', String(id).slice(0, 40));
  const m = f?.daten && String(f.daten).match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
  if (!m) return new Response('Nicht gefunden', { status: 404 });
  return new Response(Buffer.from(m[2], 'base64'), {
    headers: { 'Content-Type': m[1], 'Cache-Control': 'private, max-age=31536000, immutable' },
  });
}
