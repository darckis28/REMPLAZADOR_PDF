import { useRef, useState } from 'react';
import type { ChangeEvent, DragEvent, KeyboardEvent } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { ArrowUpFromLine, Check, Eye, FileText, FolderOpen, RefreshCw, UploadCloud } from 'lucide-react';
import PdfThumbnail from './PdfThumbnail';
import type { PdfFile } from '../lib/pdf';
import { readableSize } from '../lib/pdf';

type Props = {
  variant: 'original' | 'replacement'; title: string; description: string;
  pdf: PdfFile | null; previewDoc: PDFDocumentProxy | null;
  selectedPage: number; onSelect: (index: number) => void;
  onFile: (file: File) => void; onPreview: (page: number) => void;
  changes?: number[]; loading?: boolean;
};

export default function PdfPanel({
  variant, title, description, pdf, previewDoc, selectedPage,
  onSelect, onFile, onPreview, changes = [], loading = false,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const isOriginal = variant === 'original';
  const accent = isOriginal ? 'violet' : 'mint';
  const openPicker = () => { if (!loading) inputRef.current?.click(); };
  const receive = (file?: File) => { if (file && !loading) onFile(file); };
  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    receive(event.target.files?.[0]); event.target.value = '';
  };
  const onDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault(); setDragging(false); receive(event.dataTransfer.files?.[0]);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault(); openPicker();
    }
  };

  return (
    <section className={`pdf-panel panel-${variant}`} aria-label={title}>
      <input ref={inputRef} type="file" accept=".pdf,application/pdf"
        aria-label={`Subir ${title.toLowerCase()}`} hidden onChange={onFileChange} />
      <div className="panel-heading">
        <div className={`panel-index index-${accent}`}>{isOriginal ? '01' : '02'}</div>
        <div className="panel-titles"><h2>{title}</h2><p>{description}</p></div>
        {pdf && <button type="button" className="change-file" onClick={openPicker} disabled={loading}>
          <RefreshCw size={14} /> Cambiar
        </button>}
      </div>
      {pdf ? (
        <>
          <div className="file-strip">
            <div className={`file-icon file-icon-${accent}`}><FileText size={21} /></div>
            <div className="file-details"><strong title={pdf.name}>{pdf.name}</strong>
              <span>{pdf.pageCount} {pdf.pageCount === 1 ? 'página' : 'páginas'} <i /> {readableSize(pdf.size)}</span>
            </div>
            <span className="file-ok" title="PDF cargado"><Check size={15} /></span>
          </div>
          <div className="pages-heading">
            <span>SELECCIONA UNA PÁGINA</span>
            <button type="button" className="preview-link" onClick={() => onPreview(selectedPage)} disabled={!previewDoc}>
              <Eye size={14} /> Ver ampliada
            </button>
          </div>
          <div className="pages-grid-scroll" role="region" aria-label={`Páginas de ${title}`} tabIndex={0}>
            <div className="pages-grid">
              {Array.from({ length: pdf.pageCount }, (_, index) => (
                <PdfThumbnail key={index} doc={previewDoc} pageIndex={index}
                  selected={selectedPage === index} changed={changes.includes(index)}
                  variant={variant} onSelect={() => onSelect(index)}
                  onPreview={() => { onSelect(index); onPreview(index); }} />
              ))}
            </div>
          </div>
          <div className="panel-footnote"><Check size={14} />
            <span>{isOriginal ? 'Hoja que se reemplazará' : 'Hoja que se copiará'}: <strong>{selectedPage + 1}</strong></span>
          </div>
        </>
      ) : (
        <div className={`upload-dropzone ${dragging ? 'is-dragging' : ''} dropzone-${variant}`}
          role="button" tabIndex={0} onClick={openPicker} onKeyDown={onKeyDown}
          onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
          onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
          onDragLeave={(event) => { event.preventDefault(); setDragging(false); }}
          onDrop={onDrop} aria-label={`Seleccionar archivo para ${title.toLowerCase()}`}>
          <div className={`upload-mark upload-mark-${accent}`}>
            {loading ? <RefreshCw size={28} className="spin" /> : <UploadCloud size={29} strokeWidth={1.65} />}
          </div>
          <div className="upload-title">{loading ? 'Abriendo PDF...' : isOriginal ? 'Sube tu PDF original' : 'Sube el PDF con las hojas nuevas'}</div>
          <p>Arrastra tu archivo aquí o selecciónalo desde tu equipo.</p>
          <div className={`upload-button upload-button-${accent}`}><FolderOpen size={17} /> Explorar archivos</div>
          <small><ArrowUpFromLine size={13} /> Solo archivos .PDF · Máx. 120 MB</small>
        </div>
      )}
    </section>
  );
}
