import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const InputSchema = z.object({
  imageBase64: z.string().min(20),
  imageMime: z.string().min(3),
  pastedText: z.string().default(""),
});

export type AnalysisResult = {
  ocr: {
    plataforma?: string;
    monto?: string;
    referencia?: string;
    fecha?: string;
  };
  coincidencias: string[];
  diferencias: string[];
  hipotesis: string;
  nivelCoincidencia: number;
  estado: "Coincide" | "Parcialmente Coincide" | "No Coincide";
};

const SYSTEM_PROMPT = `Eres un verificador experto de comprobantes de pago. Compara la imagen con el texto del usuario.

Sé ULTRA BREVE Y RESUMIDO. Máximo:
- 3 coincidencias (frases cortas, máx 8 palabras)
- 3 diferencias (frases cortas, máx 8 palabras)
- hipotesis: UNA sola oración corta (máx 20 palabras)

Calcula nivelCoincidencia (0-100). Estado: "Coincide" (>=85), "Parcialmente Coincide" (40-84), "No Coincide" (<40).

Devuelve SOLO JSON válido (sin markdown, sin texto extra) con este esquema exacto:
{
  "ocr": { "plataforma": "", "monto": "", "referencia": "", "fecha": "" },
  "coincidencias": [],
  "diferencias": [],
  "hipotesis": "",
  "nivelCoincidencia": 0,
  "estado": "Coincide"
}

Usa "" si un campo falta. Sin emojis.`;

const MODELS = ["google/gemini-2.5-flash", "google/gemini-3-flash-preview", "openai/gpt-5-mini"];

async function callModel(model: string, apiKey: string, body: object): Promise<string> {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
    body: JSON.stringify({ ...body, model }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`(${res.status}) ${text.slice(0, 160)}`);
  }
  const json = await res.json();
  return json?.choices?.[0]?.message?.content ?? "{}";
}

export const analyzeReceipt = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => InputSchema.parse(d))
  .handler(async ({ data }): Promise<AnalysisResult> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY no está configurado");

    const body = {
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Compara este comprobante con el texto del usuario:\n\n${data.pastedText || "(sin texto)"}\n\nResponde SOLO con el JSON, ultra breve.`,
            },
            {
              type: "image_url",
              image_url: { url: `data:${data.imageMime};base64,${data.imageBase64}` },
            },
          ],
        },
      ],
      response_format: { type: "json_object" },
    };

    let lastErr: unknown = null;
    for (const model of MODELS) {
      try {
        const content = await callModel(model, apiKey, body);
        const cleaned = content.replace(/^```json\s*|\s*```$/g, "").trim();
        const parsed = JSON.parse(cleaned) as AnalysisResult;
        parsed.nivelCoincidencia = Math.max(
          0,
          Math.min(100, Number(parsed.nivelCoincidencia) || 0),
        );
        if (!["Coincide", "Parcialmente Coincide", "No Coincide"].includes(parsed.estado)) {
          parsed.estado =
            parsed.nivelCoincidencia >= 85
              ? "Coincide"
              : parsed.nivelCoincidencia >= 40
                ? "Parcialmente Coincide"
                : "No Coincide";
        }
        parsed.coincidencias = (parsed.coincidencias ?? []).slice(0, 3);
        parsed.diferencias = (parsed.diferencias ?? []).slice(0, 3);
        return parsed;
      } catch (e) {
        lastErr = e;
      }
    }

    const msg = lastErr instanceof Error ? lastErr.message : "desconocido";
    if (msg.includes("429")) throw new Error("Demasiadas solicitudes, intenta más tarde.");
    if (msg.includes("402")) throw new Error("Créditos de IA agotados.");
    throw new Error(`No se pudo analizar el comprobante: ${msg}`);
  });
