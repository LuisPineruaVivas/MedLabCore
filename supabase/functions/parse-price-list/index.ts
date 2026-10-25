import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Edge Function: parse-price-list
 *
 * Receives a base64-encoded image (PNG/JPG) or text content (extracted from DOCX on the client),
 * sends it to Gemini Flash, and returns a structured list of { name, price }.
 *
 * Body:
 *   - file_base64: string  (base64 of image) OR
 *   - text_content: string (plain text extracted from DOCX)
 *   - mime_type: string    ("image/png" | "image/jpeg" | "text/plain")
 *
 * Returns:
 *   { items: Array<{ name: string; price: number }> }
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── Auth: verify caller is super_admin ──────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roleCheck } = await supabaseAdmin.rpc("has_role", {
      _user_id: caller.id,
      _role: "super_admin",
    });
    if (!roleCheck) {
      return new Response(JSON.stringify({ error: "Forbidden: super_admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Parse body ───────────────────────────────────────────────────
    const body = await req.json();
    const { file_base64, text_content, mime_type } = body as {
      file_base64?: string;
      text_content?: string;
      mime_type?: string;
    };

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

    if (!file_base64 && !text_content) {
      return new Response(
        JSON.stringify({ error: "Provide either file_base64 (image) or text_content (DOCX text)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Build Gemini prompt parts ────────────────────────────────────
    const systemPrompt = `Eres un asistente que extrae listas de precios de exámenes de laboratorio.
Analiza el contenido y devuelve ÚNICAMENTE un objeto JSON válido con esta estructura exacta:
{
  "items": [
    { "name": "NOMBRE DEL EXAMEN EN MAYÚSCULAS", "price": 12.5 }
  ]
}

Reglas importantes:
- Extrae TODOS los exámenes con sus precios que encuentres.
- El campo "name" debe ser el nombre del examen en MAYÚSCULAS, sin números de ítem al inicio.
- El campo "price" debe ser un número decimal (sin símbolo de moneda).
- Si hay múltiples tablas (ej. "Pruebas Rutina" y "Pruebas Especiales"), extrae TODAS.
- Ignora encabezados de tabla, totales, datos del laboratorio y textos de pie de página.
- No incluyas columnas de "Tiempo de Entrega", "Tipo de Muestra" ni "Método".
- Si un examen no tiene precio visible, omítelo.
- Responde SOLO con el JSON, sin markdown ni texto adicional.`;

    type GeminiPart = { text: string } | { inline_data: { mime_type: string; data: string } };
    const parts: GeminiPart[] = [{ text: systemPrompt }];

    if (file_base64) {
      // Image mode
      const cleanBase64 = file_base64.includes(",")
        ? file_base64.split(",")[1]
        : file_base64;
      parts.push({
        inline_data: {
          mime_type: mime_type ?? "image/jpeg",
          data: cleanBase64,
        },
      });
    } else {
      // Text mode (DOCX extracted text)
      parts.push({ text: `\n\nContenido del documento:\n${text_content}` });
    }

    // ── Call Gemini Flash ────────────────────────────────────────────
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.1, // low temperature for precise extraction
          },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      throw new Error(`Gemini API error: ${errText}`);
    }

    const geminiData = await geminiRes.json();
    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText) {
      throw new Error("Gemini returned no content");
    }

    // Parse and validate the response
    const parsed = JSON.parse(rawText.trim());
    if (!Array.isArray(parsed?.items)) {
      throw new Error("Unexpected response format from Gemini");
    }

    // Sanitize: ensure name is string and price is number
    const items = parsed.items
      .filter((i: { name?: unknown; price?: unknown }) =>
        typeof i.name === "string" && i.name.trim() !== "" && typeof i.price === "number"
      )
      .map((i: { name: string; price: number }) => ({
        name: i.name.trim().toUpperCase(),
        price: Math.max(0, Number(i.price)),
      }));

    return new Response(JSON.stringify({ items }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("parse-price-list error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
