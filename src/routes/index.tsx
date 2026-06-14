import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  Upload,
  ImageIcon,
  X,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
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
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 pb-24 pt-[max(env(safe-area-inset-top),1rem)]">
        <header className="animate-in-up flex items-center gap-3 pt-1">
          <div className="glass-chip flex h-9 w-9 items-center justify-center">
            <ShieldCheck className="h-4 w-4 text-foreground" />
          </div>
          <div>
            <h1 className="text-[17px] font-semibold leading-tight tracking-tight">
              Verificador de Comprobantes
            </h1>
            <p className="text-[12px] text-muted-foreground">Análisis OCR con IA</p>
          </div>
        </header>

        <section className="glass animate-in-up p-3">
          {!preview ? (
            <label
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={onDrop}
              className={`group relative flex cursor-pointer items-center gap-3 rounded-2xl border-2 border-dashed px-4 py-3 transition-all ${
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
              <div className="glass-chip flex h-10 w-10 shrink-0 items-center justify-center">
                <Upload className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-medium leading-tight">Subir comprobante</p>
                <p className="text-[12px] text-muted-foreground">JPG, PNG o WEBP</p>
              </div>
              <ImageIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
            </label>
          ) : (
            <div className="relative flex items-center gap-3 rounded-2xl border border-white/15 bg-white/5 p-2">
              <img
                src={preview}
                alt="Vista previa"
                className="h-16 w-16 shrink-0 rounded-xl object-cover"
                loading="lazy"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium">Comprobante listo</p>
                <p className="text-[11px] text-muted-foreground">Toca la X para cambiar</p>
              </div>
              <button
                onClick={clearImage}
                aria-label="Quitar imagen"
                className="glass-chip flex h-8 w-8 shrink-0 items-center justify-center text-foreground transition active:scale-95"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </section>

        <section className="glass animate-in-up p-4">
          <div className="mb-2 flex items-center gap-2">
            <FileText className="h-4 w-4 text-accent" />
            <h2 className="text-[15px] font-semibold tracking-tight">Texto de comparación</h2>
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Pega aquí los datos del pago..."
            rows={5}
            className="glass-input w-full resize-y p-3 leading-relaxed"
            style={{ fontSize: "16px" }}
          />

          <button
            onClick={onAnalyze}
            disabled={loading || !payload}
            className="btn-primary mt-3 flex h-11 w-full items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Analizando...
              </>
            ) : (
              <span>Analizar comprobante</span>
            )}
          </button>

          {error && (
            <div className="mt-3 flex items-start gap-2 rounded-2xl border border-destructive/40 bg-destructive/15 p-3 text-[13px]">
              <AlertTriangle className="mt-[2px] h-4 w-4 shrink-0 text-destructive-foreground" />
              <span>{error}</span>
            </div>
          )}
        </section>

        {loading && (
          <section className="glass animate-in-up overflow-hidden p-4">
            <div className="shimmer h-5 w-1/3 rounded-md" />
            <div className="mt-3 space-y-2">
              <div className="shimmer h-4 w-full rounded-md" />
              <div className="shimmer h-4 w-5/6 rounded-md" />
            </div>
          </section>
        )}

        {result && <ResultCard result={result} />}

        <p className="glass animate-in-up px-4 py-3 text-[11px] leading-relaxed text-muted-foreground">
          Evaluación informativa. No garantiza la autenticidad del comprobante. Verifica siempre con
          la entidad financiera.
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
      className="flex items-center gap-1.5 rounded-full border border-white/25 px-2.5 py-1 text-[12px] font-semibold text-[oklch(0.12_0.04_305)]"
      style={{ background: map[estado].bg }}
    >
      <Icon className="h-3.5 w-3.5" />
      <span>{estado}</span>
      <span className="opacity-80">· {nivel}%</span>
    </div>
  );
}

function MiniRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <span className="text-[12px] text-muted-foreground">{label}</span>
      <span className="max-w-[65%] truncate text-right text-[13px] font-medium">{value}</span>
    </div>
  );
}

function ResultCard({ result }: { result: AnalysisResult }) {
  const hasOcr =
    result.ocr.plataforma || result.ocr.monto || result.ocr.referencia || result.ocr.fecha;
  return (
    <section className="glass-strong animate-in-up space-y-3 p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[16px] font-semibold tracking-tight">Resultado</h2>
        <StatusBadge estado={result.estado} nivel={result.nivelCoincidencia} />
      </div>

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
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

      <p className="text-[13px] leading-snug text-foreground/90">{result.hipotesis}</p>

      {hasOcr && (
        <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5">
          <MiniRow label="Plataforma" value={result.ocr.plataforma} />
          <MiniRow label="Monto" value={result.ocr.monto} />
          <MiniRow label="Referencia" value={result.ocr.referencia} />
          <MiniRow label="Fecha" value={result.ocr.fecha} />
        </div>
      )}

      {(result.coincidencias?.length ?? 0) > 0 && (
        <div>
          <h3 className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
            Coincide
          </h3>
          <ul className="space-y-1">
            {result.coincidencias.map((it, i) => (
              <li key={i} className="flex items-start gap-2 text-[13px]">
                <CheckCircle2 className="mt-[2px] h-3.5 w-3.5 shrink-0 text-[oklch(0.85_0.16_150)]" />
                <span className="leading-snug">{it}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {(result.diferencias?.length ?? 0) > 0 && (
        <div>
          <h3 className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
            Difiere
          </h3>
          <ul className="space-y-1">
            {result.diferencias.map((it, i) => (
              <li key={i} className="flex items-start gap-2 text-[13px]">
                <AlertTriangle className="mt-[2px] h-3.5 w-3.5 shrink-0 text-[oklch(0.88_0.16_80)]" />
                <span className="leading-snug">{it}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
