import { PDFDocument } from 'pdf-lib';

export type PdfFile = {
  name: string;
  size: number;
  bytes: Uint8Array;
  pageCount: number;
};
const MAX_SIZE = 120 * 1024 * 1024;

export function readableSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function readPdfFile(file: File): Promise<PdfFile> {
  if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
    throw new Error('Selecciona un archivo PDF válido.');
  }
  if (file.size === 0) throw new Error('El archivo está vacío.');
  if (file.size > MAX_SIZE) throw new Error('Este PDF supera los 120 MB. Usa un archivo más pequeño.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const header = new TextDecoder('latin1').decode(bytes.subarray(0, 1024));
  if (!header.includes('%PDF-')) throw new Error('Este archivo no parece ser un PDF válido.');
  try {
    const doc = await PDFDocument.load(bytes, { updateMetadata: false });
    if (doc.getPageCount() === 0) throw new Error('El PDF no contiene páginas.');
    return { name: file.name, size: file.size, bytes, pageCount: doc.getPageCount() };
  } catch (error) {
    if (error instanceof Error && error.message === 'El PDF no contiene páginas.') throw error;
    throw new Error('No se pudo abrir el PDF. Puede estar protegido con contraseña o dañado.');
  }
}

/** Reemplaza una hoja completa; mantiene el texto y gráficos como PDF, no como imagen. */
export async function replacePdfPage(
  baseBytes: Uint8Array,
  donorBytes: Uint8Array,
  destinationIndex: number,
  donorIndex: number,
): Promise<Uint8Array> {
  const base = await PDFDocument.load(baseBytes, { updateMetadata: false });
  const donor = await PDFDocument.load(donorBytes, { updateMetadata: false });
  if (destinationIndex < 0 || destinationIndex >= base.getPageCount()) {
    throw new Error('La página original seleccionada ya no existe.');
  }
  if (donorIndex < 0 || donorIndex >= donor.getPageCount()) {
    throw new Error('La página de reemplazo seleccionada ya no existe.');
  }
  const [copiedPage] = await base.copyPages(donor, [donorIndex]);
  base.removePage(destinationIndex);
  base.insertPage(destinationIndex, copiedPage);
  return base.save({ updateFieldAppearances: false });
}

export function makePdfBlob(bytes: Uint8Array): Blob {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return new Blob([buffer], { type: 'application/pdf' });
}

export function downloadName(originalName: string): string {
  const stem = originalName.replace(/\.pdf$/i, '').trim() || 'documento';
  return `${stem}_paginas_reemplazadas.pdf`;
}
