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
    banco?: string;
    monto?: string;
    fecha?: string;
    hora?: string;
    remitente?: string;
    destinatario?: string;
    referencia?: string;
    numeroOperacion?: string;
    identificadores?: string[];
    textoCompleto?: string;
  };
  textoUsuario: {
    monto?: string;
    plataforma?: string;
    referencia?: string;
    nombre?: string;
    ocr?: string;
    datosImportantes?: string[];
  };
  coincidencias: string[];
  diferencias: string[];
  observaciones: string[];
  hipotesis: string;
  nivelCoincidencia: number;
  estado: "Coincide" | "Parcialmente Coincide" | "No Coincide";
};

export const analyzeReceipt = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => InputSchema.parse(d))
  .handler(async ({ data }): Promise<AnalysisResult> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY no está configurado");

    const systemPrompt = `Eres un experto en verificación de comprobantes de pago. Analizas imágenes de comprobantes (transferencias, recargas, depósitos) y los comparas con texto proporcionado por el usuario.

Debes:
1. Hacer OCR completo de la imagen extrayendo todos los datos visibles.
2. Analizar el texto pegado por el usuario.
3. Comparar ambos detectando coincidencias, diferencias e inconsistencias (montos distintos, referencias distintas, nombres distintos, plataformas distintas, fechas futuras o inválidas, datos incompletos).
4. Calcular un nivel de coincidencia entre 0 y 100.
5. Determinar estado: "Coincide" (>=85), "Parcialmente Coincide" (40-84), "No Coincide" (<40).
6. Devolver SIEMPRE JSON válido con exactamente este esquema (sin texto adicional, sin markdown):

{
  "ocr": {
    "plataforma": "string",
    "banco": "string",
    "monto": "string",
    "fecha": "string",
    "hora": "string",
    "remitente": "string",
    "destinatario": "string",
    "referencia": "string",
    "numeroOperacion": "string",
    "identificadores": ["string"],
    "textoCompleto": "string"
  },
  "textoUsuario": {
    "monto": "string",
    "plataforma": "string",
    "referencia": "string",
    "nombre": "string",
    "ocr": "string",
    "datosImportantes": ["string"]
  },
  "coincidencias": ["string"],
  "diferencias": ["string"],
  "observaciones": ["string"],
  "hipotesis": "string",
  "nivelCoincidencia": 0,
  "estado": "Coincide"
}

Usa "" si un campo no aplica. No incluyas emojis en los valores.`;

    const userContent: Array<Record<string, unknown>> = [
      {
        type: "text",
        text: `Analiza el siguiente comprobante y compáralo con este texto del usuario:\n\n${data.pastedText || "(no se proporcionó texto)"}\n\nResponde solo con el JSON.`,
      },
      {
        type: "image_url",
        image_url: { url: `data:${data.imageMime};base64,${data.imageBase64}` },
      },
    ];

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      if (res.status === 429) throw new Error("Demasiadas solicitudes, intenta más tarde.");
      if (res.status === 402) throw new Error("Créditos de IA agotados. Recarga tu workspace.");
      throw new Error(`Error de IA (${res.status}): ${text.slice(0, 200)}`);
    }

    const json = await res.json();
    const content: string = json?.choices?.[0]?.message?.content ?? "{}";

    let parsed: AnalysisResult;
    try {
      const cleaned = content.replace(/^```json\s*|\s*```$/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error("La IA devolvió una respuesta no válida.");
    }

    // sanitize
    parsed.nivelCoincidencia = Math.max(0, Math.min(100, Number(parsed.nivelCoincidencia) || 0));
    if (!["Coincide", "Parcialmente Coincide", "No Coincide"].includes(parsed.estado)) {
      parsed.estado =
        parsed.nivelCoincidencia >= 85
          ? "Coincide"
          : parsed.nivelCoincidencia >= 40
            ? "Parcialmente Coincide"
            : "No Coincide";
    }
    return parsed;
  });
