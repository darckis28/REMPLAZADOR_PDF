import { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import { X, FileText } from 'lucide-react';

type Props = { doc: PDFDocumentProxy | null; pageIndex: number; title: string; onClose: () => void };

export default function PdfLargePreview({ doc, pageIndex, title, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const listener = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [onClose]);

  useEffect(() => {
    if (!doc) return;
    let cancelled = false;
    let renderTask: RenderTask | undefined;
    setFailed(false);
    const run = async () => {
      try {
        const page = await doc.getPage(pageIndex + 1);
        if (cancelled) return;
        const canvas = canvasRef.current;
        const context = canvas?.getContext('2d', { alpha: false });
        if (!canvas || !context) return;
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
      } catch (error) {
        if (!cancelled && !(error instanceof Error && error.name === 'RenderingCancelledException')) setFailed(true);
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
          <button type="button" aria-label="Cerrar vista previa" className="icon-button" onClick={onClose}><X size={19} /></button>
        </div>
        <div className="preview-stage">
          {!failed ? <canvas ref={canvasRef} /> : <div className="preview-error"><FileText />No se pudo mostrar la página.</div>}
        </div>
      </div>
    </div>
  );
}
