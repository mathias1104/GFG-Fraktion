'use client';
/**
 * Liest gescannte Einladungen (PDF ohne Textebene oder Foto) direkt im Browser.
 * Die Erkennung läuft lokal, Programm und Sprachmodell kommen von der eigenen App (public/ocr).
 */
export async function leseScan(url, fortschritt = () => {}) {
  fortschritt('Datei wird geladen');
  const res = await fetch(url);
  if (!res.ok) throw new Error('Die Datei konnte nicht geladen werden.');
  const typ = res.headers.get('content-type') || '';
  const daten = new Uint8Array(await res.arrayBuffer());
  const bilder = [];
  if (/pdf/.test(typ)) {
    // pdf.js direkt von der eigenen App laden, inklusive Decoder für Kopierer-Scans (JBIG2)
    const basis = `${window.location.origin}/ocr/pdf/`;
    const pdfjs = await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ `${basis}pdf.min.mjs`);
    pdfjs.GlobalWorkerOptions.workerSrc = `${basis}pdf.worker.min.mjs`;
    const pdf = await pdfjs.getDocument({ data: daten, wasmUrl: basis, isEvalSupported: false }).promise;
    const seiten = Math.min(pdf.numPages, 4);
    for (let i = 1; i <= seiten; i += 1) {
      fortschritt(`Seite ${i} von ${seiten} wird vorbereitet`);
      const seite = await pdf.getPage(i);
      const vp = seite.getViewport({ scale: 3 });
      const c = document.createElement('canvas');
      c.width = Math.round(vp.width); c.height = Math.round(vp.height);
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
      await seite.render({ canvasContext: ctx, viewport: vp }).promise;
      bilder.push(c);
    }
  } else if (/^image\//.test(typ)) {
    bilder.push(new Blob([daten], { type: typ }));
  } else {
    throw new Error('Diese Datei kann nicht als Scan gelesen werden.');
  }
  fortschritt('Texterkennung wird gestartet');
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('deu', 1, {
    workerPath: '/ocr/worker.min.js', corePath: '/ocr', langPath: '/ocr', gzip: true, cacheMethod: 'write',
  });
  try {
    await worker.setParameters({ tessedit_pageseg_mode: '6' });
    let text = '';
    for (const [i, b] of bilder.entries()) {
      fortschritt(`Seite ${i + 1} von ${bilder.length} wird gelesen`);
      const { data } = await worker.recognize(b);
      text += `${data.text}\n`;
    }
    return text;
  } finally {
    await worker.terminate();
  }
}
