import { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import { ExternalLink, X, FileText, LoaderCircle } from 'lucide-react';

type Props = {
  doc: PDFDocumentProxy | null;
  pageIndex: number;
  title: string;
  onClose: () => void;
  onNativePreview: () => void;
};

export default function PdfLargePreview({ doc, pageIndex, title, onClose, onNativePreview }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const listener = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [onClose]);

  useEffect(() => {
    if (!doc) { setFailed(true); setLoading(false); return; }
    let cancelled = false;
    let renderTask: RenderTask | undefined;
    setFailed(false);
    setLoading(true);
    const run = async () => {
      try {
        const page = await doc.getPage(pageIndex + 1);
        if (cancelled) return;
        const canvas = canvasRef.current;
        const context = canvas?.getContext('2d', { alpha: false });
        if (!canvas || !context) throw new Error('No se pudo preparar el visor de PDF.');
        const natural = page.getViewport({ scale: 1 });
        const width = Math.max(240, Math.min(window.innerWidth - 72, 650));
        const height = Math.max(240, Math.min(window.innerHeight - 210, 820));
        const scale = Math.min(width / natural.width, height / natural.height);
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        const viewport = page.getViewport({ scale: scale * ratio });
        canvas.width = Math.max(1, Math.floor(viewport.width));
        canvas.height = Math.max(1, Math.floor(viewport.height));
        canvas.style.width = `${Math.floor(natural.width * scale)}px`;
        canvas.style.height = `${Math.floor(natural.height * scale)}px`;
        renderTask = page.render({ canvas, canvasContext: context, viewport });
        await renderTask.promise;
        if (!cancelled) setLoading(false);
      } catch (error) {
        if (!cancelled && !(error instanceof Error && error.name === 'RenderingCancelledException')) {
          setFailed(true);
          setLoading(false);
        }
      }
    };
    void run();
    return () => { cancelled = true; renderTask?.cancel(); };
  }, [doc, pageIndex]);

  return (
    <div className="preview-overlay" role="presentation" onMouseDown={onClose}>
      <div className="preview-dialog" role="dialog" aria-modal="true"
        aria-label={`Vista previa de ${title}, página ${pageIndex + 1}`}
        onMouseDown={(event) => event.stopPropagation()}>
        <div className="preview-bar">
          <div><strong>{title}</strong><span>Página {pageIndex + 1}</span></div>
          <div className="preview-bar-actions">
            <button type="button" className="preview-native-button" onClick={onNativePreview}
              title="Abrir este PDF en el visor nativo del navegador"><ExternalLink size={15} /> Otro visor</button>
            <button type="button" aria-label="Cerrar vista previa" className="icon-button" onClick={onClose}><X size={19} /></button>
          </div>
        </div>
        <div className="preview-stage">
          <canvas ref={canvasRef} className={failed ? 'canvas-hidden' : ''} />
          {failed && (
            <div className="preview-error"><FileText />
              <span>No se pudo mostrar esta página.</span>
              <button type="button" className="preview-native-button" onClick={onNativePreview}>
                <ExternalLink size={15} /> Abrir en el visor del navegador
              </button>
            </div>
          )}
          {!failed && loading && <div className="preview-loading" role="status"><LoaderCircle size={23} className="spin" /> Preparando vista previa...</div>}
        </div>
      </div>
    </div>
  );
}
