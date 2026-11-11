// Kopiert die Dateien für die Texterkennung von Scans nach public/ocr (selbst gehostet, kein fremder Server nötig)
import { cpSync, mkdirSync } from 'node:fs';
const ziel = 'public/ocr';
mkdirSync(ziel, { recursive: true });
const dateien = [
  ['node_modules/tesseract.js/dist/worker.min.js', 'worker.min.js'],
  ['node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js', 'tesseract-core-lstm.wasm.js'],
  ['node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js'],
  ['node_modules/@tesseract.js-data/deu/4.0.0_best_int/deu.traineddata.gz', 'deu.traineddata.gz'],
];
for (const [von, nach] of dateien) cpSync(von, `${ziel}/${nach}`);
// Decoder für gescannte PDFs (JBIG2 von Kopierern, JPEG 2000)
mkdirSync(`${ziel}/pdf`, { recursive: true });
for (const d of ['jbig2.wasm', 'openjpeg.wasm', 'qcms_bg.wasm', 'jbig2_nowasm_fallback.js', 'openjpeg_nowasm_fallback.js']) cpSync(`node_modules/pdfjs-dist/wasm/${d}`, `${ziel}/pdf/${d}`);
for (const d of ['pdf.min.mjs', 'pdf.worker.min.mjs']) cpSync(`node_modules/pdfjs-dist/build/${d}`, `${ziel}/pdf/${d}`);
console.log('OCR-Dateien bereit');
