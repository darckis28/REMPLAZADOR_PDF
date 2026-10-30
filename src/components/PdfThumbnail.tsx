import { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import { FileText, ZoomIn } from 'lucide-react';

type Props = {
  doc: PDFDocumentProxy | null;
  pageIndex: number;
  selected: boolean;
  changed?: boolean;
  variant: 'original' | 'replacement';
  onSelect: () => void;
  onPreview: () => void;
};

export default function PdfThumbnail({
  doc, pageIndex, selected, changed = false, variant, onSelect, onPreview,
}: Props) {
  const outerRef = useRef<HTMLButtonElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setVisible(false);
    const element = outerRef.current;
    if (!element) return;
    if (!('IntersectionObserver' in window)) { setVisible(true); return; }
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
      { rootMargin: '220px' },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [doc, pageIndex]);

  useEffect(() => {
    setReady(false);
    setFailed(false);
    if (!doc || !visible) return;
    let cancelled = false;
    let renderTask: RenderTask | undefined;
    const render = async () => {
      try {
        const page = await doc.getPage(pageIndex + 1);
        if (cancelled) return;
        const canvas = canvasRef.current;
        const context = canvas?.getContext('2d', { alpha: false });
        if (!canvas || !context) return;
        const viewport = page.getViewport({ scale: 1 });
        const scale = Math.min(132 / viewport.width, 139 / viewport.height);
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        const full = page.getViewport({ scale: scale * ratio });
        canvas.width = Math.max(1, Math.floor(full.width));
        canvas.height = Math.max(1, Math.floor(full.height));
        canvas.style.width = `${Math.floor(viewport.width * scale)}px`;
        canvas.style.height = `${Math.floor(viewport.height * scale)}px`;
        renderTask = page.render({ canvas, canvasContext: context, viewport: full });
        await renderTask.promise;
        if (!cancelled) setReady(true);
      } catch (error) {
        if (!cancelled && !(error instanceof Error && error.name === 'RenderingCancelledException')) setFailed(true);
      }
    };
    void render();
    return () => { cancelled = true; renderTask?.cancel(); };
  }, [doc, visible, pageIndex]);

  return (
    <button ref={outerRef} type="button"
      className={`page-tile ${selected ? 'is-selected' : ''} tile-${variant}`}
      onClick={onSelect} onDoubleClick={onPreview} aria-pressed={selected}
      aria-label={`Seleccionar página ${pageIndex + 1}${changed ? ', modificada' : ''}`}
      title="Seleccionar página. Doble clic para ampliar.">
      <span className="page-paper">
        {!ready && !failed && <span className="page-skeleton" />}
        {failed && <FileText size={27} strokeWidth={1.5} className="page-error-icon" />}
        <canvas ref={canvasRef} className={ready ? 'canvas-ready' : 'canvas-hidden'} />
        <span className="page-hover-zoom" aria-hidden="true"><ZoomIn size={16} /></span>
      </span>
      <span className="page-caption">
        <span>Pág. {pageIndex + 1}</span>
        {changed ? <span className="changed-tag">Editada</span> : selected ? <span className="selected-dot" /> : null}
      </span>
    </button>
  );
}
