import { useEffect, useRef, useState } from "react";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import type { PDFDocumentProxy } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import {
  ArrowDownToLine,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  FileCheck2,
  FileStack,
  FileText,
  Info,
  LockKeyhole,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Undo2,
  WandSparkles,
  X,
} from "lucide-react";
import PdfPanel from "./PdfPanel";
import PdfLargePreview from "./PdfLargePreview";
import {
  downloadName,
  makePdfBlob,
  readPdfFile,
  replacePdfPage,
} from "../lib/pdf";
import type { PdfFile } from "../lib/pdf";

GlobalWorkerOptions.workerSrc = workerUrl;

type Busy = "original" | "replacement" | "replace" | null;
type Change = { target: number; source: number; sourceName: string };
type Preview = { side: "original" | "replacement"; page: number } | null;

function usePdfPreview(bytes: Uint8Array | null) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    setDoc(null);
    setError(false);
    if (!bytes) return;
    let cancelled = false;
    // pdf.js puede transferir el buffer al worker. Nunca entregamos el original.
    const task = getDocument({
      data: new Uint8Array(bytes),
      useSystemFonts: true,
    });
    task.promise.then(
      (result) => {
        if (cancelled) {
          void result.destroy();
          return;
        }
        setDoc(result);
      },
      () => {
        if (!cancelled) setError(true);
      },
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
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [changes, setChanges] = useState<Change[]>([]);
  const [preview, setPreview] = useState<Preview>(null);
  const undoStack = useRef<Uint8Array[]>([]);
  const lock = useRef(false);

  const currentPreview = usePdfPreview(workingBytes);
  const sourcePreview = usePdfPreview(replacement?.bytes ?? null);
  const canReplace = Boolean(original && replacement && workingBytes && !busy);
  const hasChanges = changes.length > 0;
  const uniqueChanged = [...new Set(changes.map((change) => change.target))];

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(""), 3600);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  async function uploadOriginal(file: File) {
    if (lock.current) return;
    if (
      hasChanges &&
      !window.confirm(
        "Cambiar el PDF original descartará los reemplazos realizados. ¿Continuar?",
      )
    )
      return;
    lock.current = true;
    setBusy("original");
    setError("");
    setNotice("");
    try {
      const next = await readPdfFile(file);
      setOriginal(next);
      setWorkingBytes(next.bytes);
      setTarget(0);
      setChanges([]);
      undoStack.current = [];
      setPreview(null);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No se pudo cargar el PDF original.",
      );
    } finally {
      lock.current = false;
      setBusy(null);
    }
  }

  async function uploadReplacement(file: File) {
    if (lock.current) return;
    lock.current = true;
    setBusy("replacement");
    setError("");
    setNotice("");
    try {
      const next = await readPdfFile(file);
      setReplacement(next);
      setSource(0);
      setPreview(null);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No se pudo cargar el PDF de reemplazo.",
      );
    } finally {
      lock.current = false;
      setBusy(null);
    }
  }

  async function applyReplacement() {
    if (lock.current || !original || !replacement || !workingBytes) return;
    lock.current = true;
    setBusy("replace");
    setError("");
    setNotice("");
    try {
      const nextBytes = await replacePdfPage(
        workingBytes,
        replacement.bytes,
        target,
        source,
      );
      undoStack.current.push(workingBytes);
      // Limita la memoria que ocupa la función Deshacer.
      while (
        undoStack.current.length > 10 ||
        (undoStack.current.length > 1 &&
          undoStack.current.reduce((sum, bytes) => sum + bytes.byteLength, 0) >
            160 * 1024 * 1024)
      ) {
        undoStack.current.shift();
      }
      setWorkingBytes(nextBytes);
      setChanges((previous) => [
        ...previous,
        {
          target,
          source,
          sourceName: replacement.name,
        },
      ]);
      setNotice(`Página ${target + 1} reemplazada correctamente.`);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No se pudo reemplazar esta hoja.",
      );
    } finally {
      setBusy(null);
      lock.current = false;
    }
  }

  function undoLast() {
    if (lock.current || undoStack.current.length === 0) return;
    const previous = undoStack.current.pop();
    if (!previous) return;
    setWorkingBytes(previous);
    setChanges((items) => items.slice(0, -1));
    setNotice("Último reemplazo deshecho.");
    setError("");
  }

  function resetAll() {
    if (lock.current || !original) return;
    undoStack.current = [];
    setWorkingBytes(original.bytes);
    setChanges([]);
    setTarget(0);
    setError("");
    setNotice("Se restauró el documento original.");
  }

  function downloadResult() {
    if (!workingBytes || !original || !hasChanges || lock.current) return;
    const blob = makePdfBlob(workingBytes);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = downloadName(original.name);
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
    setNotice("El PDF editado está listo para guardar.");
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="container header-inner">
          <a
            className="brand"
            href="/"
            aria-label="Folio, inicio"
          >
            <span className="brand-mark">
              <FileStack
                size={22}
                strokeWidth={2.2}
              />
            </span>
            <span>
              CAMBIALO<span className="brand-stop">.</span>
            </span>
          </a>
          {/* <div className="header-right">
            <span className="header-tool">
              <FileText size={15} /> Editor de documentos
            </span>
            <span className="header-rule" />
            <span className="privacy-pill">
              <span className="online-dot" /> 100% privado
            </span>
          </div> */}
        </div>
      </header>

      <main className="container main-container">
        <div className="breadcrumb">
          <span>HERRAMIENTAS PDF</span>
          <ChevronRight size={13} />
          <span>REEMPLAZAR PÁGINAS</span>
        </div>
        <div className="hero">
          <div className="hero-copy">
            <span className="hero-eyebrow">
              <Sparkles size={14} /> SIMPLE, RÁPIDO Y SIN REGISTRO
            </span>
            <h1>
              Reemplaza páginas.
              <br />
              <span>Conserva lo demás.</span>
            </h1>
            <p>
              Cambia una hoja de tu PDF por otra sin alterar las demás.
              Selecciona, reemplaza y descarga tu documento en segundos.
            </p>
          </div>
          <aside className="hero-privacy">
            <div className="hero-privacy-icon">
              <ShieldCheck size={21} />
            </div>
            <div>
              <strong>Tus archivos se quedan contigo</strong>
              <p>
                Todo se procesa en tu navegador. Ningún documento se sube a
                servidores.
              </p>
            </div>
          </aside>
        </div>

        <div
          className="stepper"
          aria-label="Pasos del proceso"
        >
          <div
            className={`step ${original && replacement ? "step-done" : "step-active"}`}
          >
            <span className="step-number">
              {original && replacement ? <Check size={15} /> : "1"}
            </span>
            <span>Subir archivos</span>
          </div>
          <div className="step-track">
            <span />
          </div>
          <div
            className={`step ${original && replacement ? "step-active" : ""}`}
          >
            <span className="step-number">2</span>
            <span>Elegir páginas</span>
          </div>
          <div className="step-track">
            <span />
          </div>
          <div className={`step ${hasChanges ? "step-active" : ""}`}>
            <span className="step-number">3</span>
            <span>Descargar PDF</span>
          </div>
        </div>

        <div className="workbench-label">
          <div>
            <span className="workbench-dot" /> ESPACIO DE TRABAJO
          </div>
          <span>Selecciona una hoja de cada documento</span>
        </div>
        <div className="panels-layout">
          <PdfPanel
            variant="original"
            title="PDF original"
            description="El documento que quieres editar"
            pdf={original}
            previewDoc={currentPreview.doc}
            selectedPage={target}
            onSelect={setTarget}
            onFile={(file) => {
              void uploadOriginal(file);
            }}
            onPreview={(page) => setPreview({ side: "original", page })}
            changes={uniqueChanged}
            loading={busy === "original"}
          />
          <div
            className="middle-exchange"
            aria-hidden="true"
          >
            <ArrowRight size={19} />
          </div>
          <PdfPanel
            variant="replacement"
            title="PDF de reemplazo"
            description="El documento con la hoja nueva"
            pdf={replacement}
            previewDoc={sourcePreview.doc}
            selectedPage={source}
            onSelect={setSource}
            onFile={(file) => {
              void uploadReplacement(file);
            }}
            onPreview={(page) => setPreview({ side: "replacement", page })}
            loading={busy === "replacement"}
          />
        </div>

        {(currentPreview.error || sourcePreview.error) && (
          <p className="soft-warning">
            <Info size={15} /> Algunas miniaturas no pudieron mostrarse, pero
            puedes intentar reemplazar las páginas de todos modos.
          </p>
        )}
        {error && (
          <div
            className="alert alert-error"
            role="alert"
          >
            <Info size={18} /> <span>{error}</span>
            <button
              type="button"
              onClick={() => setError("")}
              aria-label="Cerrar aviso"
            >
              <X size={17} />
            </button>
          </div>
        )}
        {notice && (
          <div
            className="alert alert-success"
            role="status"
          >
            <CheckCircle2 size={18} /> <span>{notice}</span>
            <button
              type="button"
              onClick={() => setNotice("")}
              aria-label="Cerrar aviso"
            >
              <X size={17} />
            </button>
          </div>
        )}

        <section
          className="action-panel"
          aria-label="Acciones de PDF"
        >
          <div className="action-info">
            <div className="action-symbol">
              <WandSparkles size={23} />
            </div>
            <div>
              <h3>
                {canReplace ? (
                  <>
                    Página {target + 1} <ArrowRight size={15} /> Página{" "}
                    {source + 1}
                  </>
                ) : (
                  "Listo para reemplazar"
                )}
              </h3>
              <p>
                {canReplace
                  ? "La página seleccionada del segundo PDF sustituirá la del original."
                  : "Sube los dos archivos PDF para comenzar."}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="primary-button"
            onClick={() => {
              void applyReplacement();
            }}
            disabled={!canReplace}
          >
            {busy === "replace" ? (
              <RotateCcw
                size={18}
                className="spin"
              />
            ) : (
              <WandSparkles size={18} />
            )}
            {busy === "replace" ? "Reemplazando..." : "Reemplazar página"}
            {busy !== "replace" && <ArrowRight size={17} />}
          </button>
        </section>

        <section
          className="result-panel"
          aria-label="Resultado del documento"
        >
          <div className="result-text">
            <span className="result-icon">
              <FileCheck2 size={22} />
            </span>
            <div>
              <h3>Tu documento final</h3>
              <p>
                {hasChanges
                  ? `${changes.length} ${changes.length === 1 ? "reemplazo realizado" : "reemplazos realizados"} · ${uniqueChanged.length} ${uniqueChanged.length === 1 ? "página modificada" : "páginas modificadas"}`
                  : "Una vez que reemplaces una página, podrás descargarlo aquí."}
              </p>
            </div>
          </div>
          <div className="result-buttons">
            <button
              type="button"
              className="text-button"
              onClick={undoLast}
              disabled={busy !== null || undoStack.current.length === 0}
              title="Deshacer último reemplazo"
            >
              <Undo2 size={16} /> Deshacer
            </button>
            <button
              type="button"
              className="text-button"
              onClick={resetAll}
              disabled={busy !== null || !hasChanges}
              title="Restaurar PDF original"
            >
              <RotateCcw size={15} /> Restaurar
            </button>
            <button
              type="button"
              className="download-button"
              onClick={downloadResult}
              disabled={busy !== null || !hasChanges}
            >
              <ArrowDownToLine size={18} /> Descargar PDF
            </button>
          </div>
        </section>

        {hasChanges && (
          <div className="changes-box">
            <strong>Historial de reemplazos</strong>
            <div className="change-chips">
              {changes.slice(-8).map((change, index) => (
                <span
                  key={`${changes.length}-${index}`}
                  className="change-chip"
                >
                  <Check size={13} /> Hoja {change.target + 1} ← hoja{" "}
                  {change.source + 1}
                </span>
              ))}
              {changes.length > 8 && (
                <span className="more-changes">y {changes.length - 8} más</span>
              )}
            </div>
          </div>
        )}
        <p className="bottom-tip">
          <Info size={15} /> El reemplazo mantiene el contenido y tamaño de la
          hoja nueva. Si sus dimensiones son distintas, esa hoja tendrá un
          tamaño diferente. Los PDF firmados digitalmente pueden perder validez
          al editarlos.
        </p>
      </main>
      <footer className="app-footer">
        <div className="container footer-inner">
          <span>
            <span className="footer-brand">CAMBIALO.</span>
            {/* <span
              style={{ display: "block", fontSize: "0.82rem", opacity: 0.8 }}
            >
              Herramienta sencilla para reemplazar páginas
            </span> */}
          </span>
          <span
            style={{
              display: "grid",
              gap: "0.3rem",
              justifyItems: "end",
              textAlign: "right",
            }}
          >
            <span style={{ fontSize: "0.82rem", fontWeight: 600 }}>
              Diseño hecho por Andi Aguirre
            </span>
            <span style={{ fontSize: "0.78rem", opacity: 0.8 }}>
              Equipo RR.HH. · ODPE Chanchamayo
            </span>
            {/* <LockKeyhole size={13} /> Procesamiento local · Sin subir archivos */}
          </span>
        </div>
      </footer>

      {preview && (
        <PdfLargePreview
          doc={
            preview.side === "original" ? currentPreview.doc : sourcePreview.doc
          }
          pageIndex={preview.page}
          title={
            preview.side === "original" ? "PDF original" : "PDF de reemplazo"
          }
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
}
