import { useEffect, useRef, useState } from 'react';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {
  ArrowDownToLine, ArrowRight, Check, CheckCircle2, ChevronRight,
  FileCheck2, FileStack, FileText, Info, LockKeyhole,
  Plus, RotateCcw, ShieldCheck, Sparkles, Undo2, WandSparkles, X,
} from 'lucide-react';
import PdfPanel from './PdfPanel';
import PdfLargePreview from './PdfLargePreview';
import {
  downloadName, insertBlankPdfPage, insertPdfPage, makePdfBlob, readPdfFile, replacePdfPage,
} from '../lib/pdf';
import type { PdfFile } from '../lib/pdf';

GlobalWorkerOptions.workerSrc = workerUrl;

type Busy = 'original' | 'replacement' | 'change' | null;
type EditMode = 'replace' | 'insert';
type InsertSource = 'pdf' | 'blank';
type InsertPosition = 'before' | 'after';
type Change = { kind: EditMode; target: number; source: number; sourceName: string };
type Preview = { side: 'original' | 'replacement'; page: number } | null;

function usePdfPreview(bytes: Uint8Array | null) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    setDoc(null);
    setError(false);
    if (!bytes) return;
    let cancelled = false;
    // pdf.js puede transferir el buffer al worker. Nunca entregamos el original.
    const task = getDocument({ data: new Uint8Array(bytes), useSystemFonts: true });
    task.promise.then(
      (result) => {
        if (cancelled) return; // La tarea de carga se destruye en el cleanup del efecto.
        setDoc(result);
      },
      () => { if (!cancelled) setError(true); },
    );
    return () => {
      cancelled = true;
      void task.destroy();
    };
  }, [bytes]);
  return { doc, error };
}

export default function PdfPageReplacer() {
  const [original, setOriginal] = useState<PdfFile | null>(null);
  const [replacement, setReplacement] = useState<PdfFile | null>(null);
  const [workingBytes, setWorkingBytes] = useState<Uint8Array | null>(null);
  const [target, setTarget] = useState(0);
  const [source, setSource] = useState(0);
  const [mode, setMode] = useState<EditMode>('replace');
  const [insertSource, setInsertSource] = useState<InsertSource>('pdf');
  const [insertPosition, setInsertPosition] = useState<InsertPosition>('after');
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [changes, setChanges] = useState<Change[]>([]);
  const [preview, setPreview] = useState<Preview>(null);
  const undoStack = useRef<Uint8Array[]>([]);
  const lock = useRef(false);

  const currentPreview = usePdfPreview(workingBytes);
  const sourcePreview = usePdfPreview(replacement?.bytes ?? null);
  const needsDonor = mode === 'replace' || insertSource === 'pdf';
  const canChange = Boolean(original && workingBytes && !busy && (!needsDonor || replacement));
  const hasChanges = changes.length > 0;
  const insertedCount = changes.filter((change) => change.kind === 'insert').length;
  const workingPdf = original && workingBytes
    ? { ...original, bytes: workingBytes, size: workingBytes.byteLength, pageCount: original.pageCount + insertedCount }
    : null;
  // Recalcula las posiciones resaltadas si se insertan páginas delante de otras ya editadas.
  let editedPositions = new Set<number>();
  for (const change of changes) {
    if (change.kind === 'insert') {
      editedPositions = new Set([...editedPositions].map((index) => index >= change.target ? index + 1 : index));
    }
    editedPositions.add(change.target);
  }
  const uniqueChanged = [...editedPositions];

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(''), 3600);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  async function uploadOriginal(file: File) {
    if (lock.current) return;
    if (hasChanges && !window.confirm('Cambiar el PDF original descartará los cambios realizados. ¿Continuar?')) return;
    lock.current = true;
    setBusy('original'); setError(''); setNotice('');
    try {
      const next = await readPdfFile(file);
      setOriginal(next);
      setWorkingBytes(next.bytes);
      setTarget(0);
      setChanges([]);
      undoStack.current = [];
      setPreview(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo cargar el PDF original.');
    } finally {
      lock.current = false;
      setBusy(null);
    }
  }

  async function uploadReplacement(file: File) {
    if (lock.current) return;
    lock.current = true;
    setBusy('replacement'); setError(''); setNotice('');
    try {
      const next = await readPdfFile(file);
      setReplacement(next);
      setSource(0);
      setPreview(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo cargar el PDF de reemplazo.');
    } finally {
      lock.current = false;
      setBusy(null);
    }
  }

  async function applyChange() {
    if (lock.current || !original || !workingBytes || (needsDonor && !replacement)) return;
    lock.current = true;
    setBusy('change'); setError(''); setNotice('');
    try {
      const insertIndex = target + (insertPosition === 'after' ? 1 : 0);
      const nextBytes = mode === 'replace'
        ? await replacePdfPage(workingBytes, replacement!.bytes, target, source)
        : insertSource === 'blank'
          ? await insertBlankPdfPage(workingBytes, insertIndex, target)
          : await insertPdfPage(workingBytes, replacement!.bytes, insertIndex, source);
      undoStack.current.push(workingBytes);
      // Limita la memoria que ocupa la función Deshacer.
      while (undoStack.current.length > 10 || (undoStack.current.length > 1 && undoStack.current.reduce((sum, bytes) => sum + bytes.byteLength, 0) > 160 * 1024 * 1024)) {
        undoStack.current.shift();
      }
      setWorkingBytes(nextBytes);
      setChanges((previous) => [...previous, {
        kind: mode,
        target: mode === 'insert' ? insertIndex : target,
        source: mode === 'insert' && insertSource === 'blank' ? -1 : source,
        sourceName: mode === 'insert' && insertSource === 'blank' ? 'Hoja en blanco' : replacement!.name,
      }]);
      if (mode === 'insert') setTarget(insertIndex);
      setNotice(mode === 'insert'
        ? `Página ${insertIndex + 1} añadida correctamente.`
        : `Página ${target + 1} reemplazada correctamente.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo modificar el documento.');
    } finally {
      setBusy(null);
      lock.current = false;
    }
  }

  function undoLast() {
    if (lock.current || undoStack.current.length === 0) return;
    const previous = undoStack.current.pop();
    if (!previous) return;
    const last = changes[changes.length - 1];
    const previousPageCount = (original?.pageCount ?? 1) + insertedCount - (last?.kind === 'insert' ? 1 : 0);
    setWorkingBytes(previous);
    setChanges((items) => items.slice(0, -1));
    setTarget((current) => Math.min(current, previousPageCount - 1));
    setNotice('Último cambio deshecho.');
    setError('');
  }

  function resetAll() {
    if (lock.current || !original) return;
    undoStack.current = [];
    setWorkingBytes(original.bytes);
    setChanges([]);
    setTarget(0);
    setError('');
    setNotice('Se restauró el documento original.');
  }

  function downloadResult() {
    if (!workingBytes || !original || !hasChanges || lock.current) return;
    const blob = makePdfBlob(workingBytes);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = downloadName(original.name);
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
    setNotice('El PDF editado está listo para guardar.');
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="container header-inner">
          <a className="brand" href="/" aria-label="Folio, inicio">
            <span className="brand-mark"><FileStack size={22} strokeWidth={2.2} /></span>
            <span>folio<span className="brand-stop">.</span></span>
          </a>
          <div className="header-right">
            <span className="header-tool"><FileText size={15} /> Editor de documentos</span>
            <span className="header-rule" />
            <span className="privacy-pill"><span className="online-dot" /> 100% privado</span>
          </div>
        </div>
      </header>

      <main className="container main-container">
        <div className="breadcrumb"><span>HERRAMIENTAS PDF</span><ChevronRight size={13} /><span>EDITAR PÁGINAS</span></div>
        <div className="hero">
          <div className="hero-copy">
            <span className="hero-eyebrow"><Sparkles size={14} /> SIMPLE, RÁPIDO Y SIN REGISTRO</span>
            <h1>Reemplaza o añade hojas.<br /><span>Conserva lo demás.</span></h1>
            <p>Cambia páginas de tu PDF o agrega nuevas sin alterar las demás. Selecciona, edita y descarga tu documento en segundos.</p>
          </div>
          <aside className="hero-privacy">
            <div className="hero-privacy-icon"><ShieldCheck size={21} /></div>
            <div><strong>Tus archivos se quedan contigo</strong><p>Todo se procesa en tu navegador. Ningún documento se sube a servidores.</p></div>
          </aside>
        </div>

        <div className="stepper" aria-label="Pasos del proceso">
          <div className={`step ${original && (!needsDonor || replacement) ? 'step-done' : 'step-active'}`}>
            <span className="step-number">{original && (!needsDonor || replacement) ? <Check size={15} /> : '1'}</span><span>Subir archivos</span>
          </div>
          <div className="step-track"><span /></div>
          <div className={`step ${original && (!needsDonor || replacement) ? 'step-active' : ''}`}>
            <span className="step-number">2</span><span>Elegir páginas</span>
          </div>
          <div className="step-track"><span /></div>
          <div className={`step ${hasChanges ? 'step-active' : ''}`}>
            <span className="step-number">3</span><span>Descargar PDF</span>
          </div>
        </div>

        <div className="workbench-label"><div><span className="workbench-dot" /> ESPACIO DE TRABAJO</div><span>Selecciona las páginas que quieres editar</span></div>
        <div className="panels-layout">
          <PdfPanel variant="original" title="PDF original" description="El documento que quieres editar"
            pdf={workingPdf} previewDoc={currentPreview.doc} selectedPage={target}
            onSelect={setTarget} onFile={(file) => { void uploadOriginal(file); }}
            onPreview={(page) => setPreview({ side: 'original', page })}
            changes={uniqueChanged} loading={busy === 'original'} action={mode} />
          <div className="middle-exchange" aria-hidden="true"><ArrowRight size={19} /></div>
          <PdfPanel variant="replacement" title="PDF con hojas nuevas" description="El documento con la hoja que quieres usar"
            pdf={replacement} previewDoc={sourcePreview.doc} selectedPage={source}
            onSelect={setSource} onFile={(file) => { void uploadReplacement(file); }}
            onPreview={(page) => setPreview({ side: 'replacement', page })}
            loading={busy === 'replacement'} />
        </div>

        {(currentPreview.error || sourcePreview.error) && (
          <p className="soft-warning"><Info size={15} /> Algunas miniaturas no pudieron mostrarse, pero puedes intentar editar las páginas de todos modos.</p>
        )}
        {error && <div className="alert alert-error" role="alert"><Info size={18} /> <span>{error}</span><button type="button" onClick={() => setError('')} aria-label="Cerrar aviso"><X size={17} /></button></div>}
        {notice && <div className="alert alert-success" role="status"><CheckCircle2 size={18} /> <span>{notice}</span><button type="button" onClick={() => setNotice('')} aria-label="Cerrar aviso"><X size={17} /></button></div>}

        <section className="edit-options" aria-label="Opciones de edición">
          <div className="edit-options-heading"><strong>¿Qué quieres hacer?</strong><span>Elige una acción para tu documento</span></div>
          <div className="edit-mode-buttons" role="group" aria-label="Acción de edición">
            <button type="button" className={`edit-option ${mode === 'replace' ? 'active' : ''}`}
              aria-pressed={mode === 'replace'} onClick={() => setMode('replace')}>
              <WandSparkles size={16} /> Reemplazar hoja
            </button>
            <button type="button" className={`edit-option ${mode === 'insert' ? 'active' : ''}`}
              aria-pressed={mode === 'insert'} onClick={() => setMode('insert')}>
              <Plus size={17} /> Agregar hoja
            </button>
          </div>
          {mode === 'insert' && (
            <div className="insert-options">
              <div className="insert-option-group">
                <span>¿Qué hoja agregar?</span>
                <div className="choice-buttons" role="group" aria-label="Origen de la hoja">
                  <button type="button" aria-pressed={insertSource === 'pdf'} className={insertSource === 'pdf' ? 'chosen' : ''} onClick={() => setInsertSource('pdf')}>Desde otro PDF</button>
                  <button type="button" aria-pressed={insertSource === 'blank'} className={insertSource === 'blank' ? 'chosen' : ''} onClick={() => setInsertSource('blank')}>Hoja en blanco</button>
                </div>
              </div>
              <div className="insert-option-group">
                <span>¿Dónde colocarla?</span>
                <div className="choice-buttons" role="group" aria-label="Posición de inserción">
                  <button type="button" aria-pressed={insertPosition === 'before'} className={insertPosition === 'before' ? 'chosen' : ''} onClick={() => setInsertPosition('before')}>Antes de la pág. {target + 1}</button>
                  <button type="button" aria-pressed={insertPosition === 'after'} className={insertPosition === 'after' ? 'chosen' : ''} onClick={() => setInsertPosition('after')}>Después de la pág. {target + 1}</button>
                </div>
              </div>
              {insertSource === 'blank' && <p className="blank-note"><Info size={14} /> Para añadir una hoja en blanco solo necesitas el PDF original; usaremos las medidas de la página seleccionada.</p>}
            </div>
          )}
        </section>

        <section className="action-panel" aria-label="Acciones de PDF">
          <div className="action-info">
            <div className="action-symbol">{mode === 'insert' ? <Plus size={23} /> : <WandSparkles size={23} />}</div>
            <div>
              <h3>{canChange
                ? mode === 'insert'
                  ? `Añadir página ${target + (insertPosition === 'after' ? 2 : 1)}`
                  : <>Página {target + 1} <ArrowRight size={15} /> Página {source + 1}</>
                : mode === 'insert' ? 'Listo para agregar una hoja' : 'Listo para reemplazar'}</h3>
              <p>{!canChange
                ? needsDonor ? 'Sube los dos archivos PDF para comenzar.' : 'Sube tu PDF original para comenzar.'
                : mode === 'insert'
                  ? `Se insertará ${insertSource === 'blank' ? 'una hoja en blanco' : `la página ${source + 1} del otro PDF`} ${insertPosition === 'before' ? 'antes' : 'después'} de la página ${target + 1}, sin eliminar páginas.`
                  : 'La página seleccionada del segundo PDF sustituirá la del original.'}</p>
            </div>
          </div>
          <button type="button" className="primary-button" onClick={() => { void applyChange(); }} disabled={!canChange}>
            {busy === 'change' ? <RotateCcw size={18} className="spin" /> : mode === 'insert' ? <Plus size={19} /> : <WandSparkles size={18} />}
            {busy === 'change' ? 'Procesando...' : mode === 'insert' ? 'Agregar hoja' : 'Reemplazar página'}
            {busy !== 'change' && <ArrowRight size={17} />}
          </button>
        </section>

        <section className="result-panel" aria-label="Resultado del documento">
          <div className="result-text">
            <span className="result-icon"><FileCheck2 size={22} /></span>
            <div><h3>Tu documento final</h3><p>{hasChanges
              ? `${changes.length} ${changes.length === 1 ? 'cambio realizado' : 'cambios realizados'} · ${insertedCount} ${insertedCount === 1 ? 'hoja añadida' : 'hojas añadidas'} · ${workingPdf?.pageCount ?? 0} páginas totales`
              : 'Una vez que edites una página, podrás descargarlo aquí.'}</p>
            </div>
          </div>
          <div className="result-buttons">
            <button type="button" className="text-button" onClick={undoLast} disabled={busy !== null || undoStack.current.length === 0} title="Deshacer último reemplazo"><Undo2 size={16} /> Deshacer</button>
            <button type="button" className="text-button" onClick={resetAll} disabled={busy !== null || !hasChanges} title="Restaurar PDF original"><RotateCcw size={15} /> Restaurar</button>
            <button type="button" className="download-button" onClick={downloadResult} disabled={busy !== null || !hasChanges}><ArrowDownToLine size={18} /> Descargar PDF</button>
          </div>
        </section>

        {hasChanges && (
          <div className="changes-box">
            <strong>Historial de cambios</strong>
            <div className="change-chips">
              {changes.slice(-8).map((change, index) => <span key={`${changes.length}-${index}`} className="change-chip">
                <Check size={13} /> {change.kind === 'insert' ? 'Añadida' : 'Reemplazada'} pág. {change.target + 1} {change.source < 0 ? '(en blanco)' : `← pág. ${change.source + 1}`}
              </span>)}
              {changes.length > 8 && <span className="more-changes">y {changes.length - 8} más</span>}
            </div>
          </div>
        )}
        <p className="bottom-tip"><Info size={15} /> Las hojas tomadas de otro PDF conservan su contenido y dimensiones. Las hojas en blanco copian el tamaño de la hoja seleccionada. Editar un PDF firmado digitalmente puede invalidar su firma.</p>
      </main>
      <footer className="app-footer"><div className="container footer-inner"><span><span className="footer-brand">folio.</span> Herramientas PDF sencillas</span><span><LockKeyhole size={13} /> Procesamiento local · Sin subir archivos</span></div></footer>

      {preview && <PdfLargePreview
        doc={preview.side === 'original' ? currentPreview.doc : sourcePreview.doc}
        pageIndex={preview.page}
        title={preview.side === 'original' ? 'PDF original' : 'PDF de reemplazo'}
        onClose={() => setPreview(null)} />}
    </div>
  );
}
