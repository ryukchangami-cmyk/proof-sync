import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  Upload,
  ImageIcon,
  X,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Info,
  FileText,
  Loader2,
} from "lucide-react";

import bgAsset from "@/assets/knight-bg.jpeg.asset.json";
import { analyzeReceipt, type AnalysisResult } from "@/lib/api/analyze.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Verificador de Comprobantes" },
      {
        name: "description",
        content:
          "Sube un comprobante y compáralo con texto. Análisis OCR con IA, estilo iOS 26 Liquid Glass.",
      },
    ],
  }),
  component: HomePage,
});

const MAX_DIM = 1600;

async function compressImage(
  file: File,
): Promise<{ base64: string; mime: string; dataUrl: string }> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = dataUrl;
  });

  const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, w, h);
  const outDataUrl = canvas.toDataURL("image/jpeg", 0.82);
  const base64 = outDataUrl.split(",")[1] ?? "";
  return { base64, mime: "image/jpeg", dataUrl: outDataUrl };
}

function HomePage() {
  const [preview, setPreview] = useState<string | null>(null);
  const [payload, setPayload] = useState<{ base64: string; mime: string } | null>(null);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const bgStyle = useMemo(
    () => ({ ["--app-bg-image" as string]: `url(${bgAsset.url})` }) as React.CSSProperties,
    [],
  );

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.match(/^image\/(jpe?g|png|webp)$/i)) {
      setError("Formato no soportado. Usa JPG, PNG o WEBP.");
      return;
    }
    setError(null);
    setResult(null);
    try {
      const { base64, mime, dataUrl } = await compressImage(file);
      setPreview(dataUrl);
      setPayload({ base64, mime });
    } catch {
      setError("No se pudo procesar la imagen.");
    }
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const f = e.dataTransfer.files?.[0];
      if (f) void handleFile(f);
    },
    [handleFile],
  );

  const onAnalyze = useCallback(async () => {
    if (!payload) {
      setError("Sube primero un comprobante.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const r = await analyzeReceipt({
        data: {
          imageBase64: payload.base64,
          imageMime: payload.mime,
          pastedText: text,
        },
      });
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido.");
    } finally {
      setLoading(false);
    }
  }, [payload, text]);

  const clearImage = () => {
    setPreview(null);
    setPayload(null);
    setResult(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <main className="bg-app min-h-dvh w-full" style={bgStyle}>
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 pb-24 pt-[max(env(safe-area-inset-top),1.25rem)]">
        <header className="animate-in-up flex items-center justify-between pt-2">
          <div className="flex items-center gap-3">
            <div className="glass-chip flex h-10 w-10 items-center justify-center">
              <ShieldCheck className="h-5 w-5 text-foreground" />
            </div>
            <div>
              <h1 className="text-[22px] font-semibold leading-tight tracking-tight">
                Verificador de Comprobantes
              </h1>
              <p className="text-[13px] text-muted-foreground">
                Análisis OCR con IA · Liquid Glass
              </p>
            </div>
          </div>
        </header>

        <section className="glass animate-in-up p-5">
          <div className="mb-4 flex items-center gap-2">
            <ImageIcon className="h-4 w-4 text-accent" />
            <h2 className="text-[17px] font-semibold tracking-tight">Subir Comprobante</h2>
          </div>

          {!preview ? (
            <label
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={onDrop}
              className={`group relative flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed transition-all ${
                isDragging
                  ? "border-accent bg-white/10"
                  : "border-white/20 bg-white/5 hover:bg-white/10"
              }`}
            >
              <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleFile(f);
                }}
              />
              <div className="glass-chip flex h-14 w-14 items-center justify-center">
                <Upload className="h-6 w-6" />
              </div>
              <div className="text-center">
                <p className="text-[15px] font-medium">Arrastra o toca para subir</p>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  JPG, PNG o WEBP · compresión automática
                </p>
              </div>
            </label>
          ) : (
            <div className="relative overflow-hidden rounded-3xl border border-white/15">
              <img
                src={preview}
                alt="Vista previa del comprobante"
                className="block w-full"
                loading="lazy"
              />
              <button
                onClick={clearImage}
                aria-label="Quitar imagen"
                className="glass-chip absolute right-3 top-3 flex h-9 w-9 items-center justify-center text-foreground transition active:scale-95"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </section>

        <section className="glass animate-in-up p-5">
          <div className="mb-3 flex items-center gap-2">
            <FileText className="h-4 w-4 text-accent" />
            <h2 className="text-[17px] font-semibold tracking-tight">Texto de Comparación</h2>
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`Pega aquí los datos del pago para comparar con la imagen...\n\nEjemplo:\nRecarga $3.00\nMercado Pago · Argentina\nReferencia 164105224872`}
            rows={7}
            className="glass-input w-full resize-y p-4 leading-relaxed"
            style={{ fontSize: "16px" }}
          />

          <button
            onClick={onAnalyze}
            disabled={loading || !payload}
            className="btn-primary mt-4 flex h-12 w-full items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Analizando...
              </>
            ) : (
              <>
                <Sparkles className="h-5 w-5" />
                Analizar Comprobante
              </>
            )}
          </button>

          {error && (
            <div className="mt-3 flex items-start gap-2 rounded-2xl border border-destructive/40 bg-destructive/15 p-3 text-[14px]">
              <AlertTriangle className="mt-[2px] h-4 w-4 shrink-0 text-destructive-foreground" />
              <span>{error}</span>
            </div>
          )}
        </section>

        {loading && (
          <section className="glass animate-in-up overflow-hidden p-5">
            <div className="shimmer h-6 w-1/2 rounded-md" />
            <div className="mt-4 space-y-3">
              <div className="shimmer h-4 w-full rounded-md" />
              <div className="shimmer h-4 w-5/6 rounded-md" />
              <div className="shimmer h-4 w-2/3 rounded-md" />
            </div>
          </section>
        )}

        {result && <ResultCard result={result} />}

        <p className="glass animate-in-up px-5 py-4 text-[12px] leading-relaxed text-muted-foreground">
          Este análisis es una evaluación basada en información visual y textual. No garantiza la
          autenticidad de ningún comprobante ni confirma que un pago haya sido realizado. La
          verificación definitiva debe realizarse directamente con la entidad financiera
          correspondiente.
        </p>
      </div>
    </main>
  );
}

function StatusBadge({ estado, nivel }: { estado: AnalysisResult["estado"]; nivel: number }) {
  const map = {
    Coincide: { bg: "var(--gradient-success)", Icon: CheckCircle2 },
    "Parcialmente Coincide": { bg: "var(--gradient-warning)", Icon: AlertTriangle },
    "No Coincide": { bg: "var(--gradient-danger)", Icon: XCircle },
  } as const;
  const { Icon } = map[estado];
  return (
    <div
      className="flex items-center gap-2 rounded-full border border-white/25 px-3 py-1.5 text-[13px] font-semibold text-[oklch(0.12_0.04_305)]"
      style={{ background: map[estado].bg }}
    >
      <Icon className="h-4 w-4" />
      <span>{estado}</span>
      <span className="opacity-80">· {nivel}%</span>
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string | string[] }) {
  const v = Array.isArray(value) ? value.filter(Boolean).join(", ") : value;
  if (!v) return null;
  return (
    <div className="flex items-start justify-between gap-3 border-b border-white/10 py-2.5 last:border-b-0">
      <span className="text-[13px] text-muted-foreground">{label}</span>
      <span className="max-w-[60%] text-right text-[14px] font-medium">{v}</span>
    </div>
  );
}

function BulletList({ items, tone }: { items: string[]; tone: "ok" | "warn" | "info" }) {
  if (!items?.length) {
    return <p className="text-[13px] text-muted-foreground">Sin elementos.</p>;
  }
  const Icon = tone === "ok" ? CheckCircle2 : tone === "warn" ? AlertTriangle : Info;
  const color =
    tone === "ok"
      ? "text-[oklch(0.85_0.16_150)]"
      : tone === "warn"
        ? "text-[oklch(0.88_0.16_80)]"
        : "text-accent";
  return (
    <ul className="space-y-2">
      {items.map((it, i) => (
        <li key={i} className="flex items-start gap-2 text-[14px]">
          <Icon className={`mt-[3px] h-4 w-4 shrink-0 ${color}`} />
          <span className="leading-snug">{it}</span>
        </li>
      ))}
    </ul>
  );
}

function ResultCard({ result }: { result: AnalysisResult }) {
  return (
    <section className="glass-strong animate-in-up space-y-5 p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[18px] font-semibold tracking-tight">Resultado</h2>
        <StatusBadge estado={result.estado} nivel={result.nivelCoincidencia} />
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between text-[12px] text-muted-foreground">
          <span>Nivel de coincidencia</span>
          <span>{result.nivelCoincidencia}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${result.nivelCoincidencia}%`,
              background:
                result.estado === "Coincide"
                  ? "var(--gradient-success)"
                  : result.estado === "Parcialmente Coincide"
                    ? "var(--gradient-warning)"
                    : "var(--gradient-danger)",
            }}
          />
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <h3 className="mb-2 text-[15px] font-semibold">Análisis OCR</h3>
        <div>
          <Row label="Plataforma" value={result.ocr.plataforma} />
          <Row label="Banco" value={result.ocr.banco} />
          <Row label="Monto" value={result.ocr.monto} />
          <Row label="Fecha" value={result.ocr.fecha} />
          <Row label="Hora" value={result.ocr.hora} />
          <Row label="Remitente" value={result.ocr.remitente} />
          <Row label="Destinatario" value={result.ocr.destinatario} />
          <Row label="Referencia" value={result.ocr.referencia} />
          <Row label="N° Operación" value={result.ocr.numeroOperacion} />
          <Row label="Identificadores" value={result.ocr.identificadores} />
        </div>
        {result.ocr.textoCompleto && (
          <details className="mt-3">
            <summary className="cursor-pointer text-[13px] text-muted-foreground">
              Ver texto completo detectado
            </summary>
            <pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap rounded-xl bg-black/30 p-3 text-[12px]">
              {result.ocr.textoCompleto}
            </pre>
          </details>
        )}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <h3 className="mb-2 text-[15px] font-semibold">Datos Detectados (texto)</h3>
        <Row label="Monto" value={result.textoUsuario.monto} />
        <Row label="Plataforma" value={result.textoUsuario.plataforma} />
        <Row label="Referencia" value={result.textoUsuario.referencia} />
        <Row label="Nombre" value={result.textoUsuario.nombre} />
        <Row label="OCR" value={result.textoUsuario.ocr} />
        <Row label="Datos importantes" value={result.textoUsuario.datosImportantes} />
      </div>

      <div className="grid gap-3">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <h3 className="mb-2 text-[15px] font-semibold">Coincidencias</h3>
          <BulletList items={result.coincidencias ?? []} tone="ok" />
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <h3 className="mb-2 text-[15px] font-semibold">Diferencias</h3>
          <BulletList items={result.diferencias ?? []} tone="warn" />
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <h3 className="mb-2 text-[15px] font-semibold">Observaciones</h3>
          <BulletList items={result.observaciones ?? []} tone="info" />
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <h3 className="mb-2 text-[15px] font-semibold">Hipótesis de la IA</h3>
        <p className="text-[14px] leading-relaxed text-foreground/90">
          {result.hipotesis || "Sin hipótesis."}
        </p>
      </div>
    </section>
  );
}
