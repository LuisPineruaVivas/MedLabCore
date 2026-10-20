import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Roles del personal que ingresa resultados (canEnterResults); lab_affiliate queda fuera
const OCR_ROLES = ['lab_admin', 'bioanalyst', 'secretary']
const MAX_IMAGE_BYTES = 8 * 1024 * 1024
const MAX_FIELDS = 150
const MAX_FIELD_LENGTH = 120
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']

function badRequest(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

serve(async (req) => {
  // 1. Manejar CORS (Preflight)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('No hay header de Autorización');

    // RECOMENDACIÓN: Usa las variables de entorno internas de Supabase que ya vienen inyectadas
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '', // Cambiado a ANON_KEY para respetar el RLS si es necesario
      { global: { headers: { Authorization: authHeader } } } // Pasa el JWT del usuario automáticamente
    );

    // 2. Extraer el JWT y validarlo usando el método correcto de Supabase v2
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'JWT Inválido o expirado' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Solo personal de un laboratorio (no afiliados ni cuentas sin organización) puede usar el OCR,
    // que se factura a la clave del operador. RLS de profiles: cada usuario lee su propia fila.
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('org_id, role')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile?.org_id || !OCR_ROLES.includes(profile.role)) {
      return new Response(JSON.stringify({ error: 'No autorizado para usar el OCR' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Extraemos los datos del body
    const { image, fields } = await req.json();
    const apiKey = Deno.env.get('GEMINI_API_KEY');

    if (!image || typeof image !== 'string') return badRequest("No se recibió imagen");
    if (!fields || !Array.isArray(fields)) return badRequest("Los campos a extraer deben ser un arreglo");
    if (fields.length === 0 || fields.length > MAX_FIELDS) return badRequest(`Se permiten entre 1 y ${MAX_FIELDS} campos`);
    if (fields.some((f) => typeof f !== 'string' || f.length === 0 || f.length > MAX_FIELD_LENGTH)) {
      return badRequest(`Cada campo debe ser texto de hasta ${MAX_FIELD_LENGTH} caracteres`);
    }

    const dataUrlMatch = image.match(/^data:([^;,]+);base64,/);
    const mimeType = dataUrlMatch?.[1] ?? 'image/jpeg';
    if (!ALLOWED_MIME_TYPES.includes(mimeType)) return badRequest("Formato de imagen no soportado");
    const imageData = dataUrlMatch ? image.slice(dataUrlMatch[0].length) : image;
    // base64 ocupa 4 caracteres por cada 3 bytes
    if (Math.floor(imageData.length * 3 / 4) > MAX_IMAGE_BYTES) {
      return badRequest(`La imagen supera el máximo de ${MAX_IMAGE_BYTES / (1024 * 1024)} MB`, 413);
    }

    if (!apiKey) throw new Error("Falta la configuración de GEMINI_API_KEY en el servidor");

    // Mejoramos el prompt para forzar a Gemini a devolver EXCLUSIVAMENTE JSON válido sin markdown y con valores numéricos limpios
    const prompt = `Extrae los siguientes campos de la imagen: ${fields.join(", ")}.
    Para cada campo, extrae únicamente el valor numérico limpio del resultado (por ejemplo, si el resultado en la imagen es "2.9 x 10^3/uL" o "46.9 %" o "12.3 g/dL", extrae únicamente el número como "2.9", "46.9" o "12.3"). Si el resultado es una comparación o rango, extrae solo el rango o la comparación sin unidades (por ejemplo, "<0.5" o "2-4").
    Tu respuesta debe ser estrictamente un objeto JSON válido y plano, sin bloques de código markdown (\`\`\`json), sin saltos de línea innecesarios y sin texto adicional.`;
    
    // NOTA: Se actualizó al modelo estable actual gemini-2.5-flash para producción
    // La clave va en el header (no en la URL) para que no quede en logs de URLs
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            // Aceptamos el data:image/...;base64,... completo o solo el string plano
            { inline_data: { mime_type: mimeType, data: imageData } }
          ]
        }],
        // Forzamos al modelo a responder en formato JSON estructurado a nivel API
        generationConfig: {
          responseMimeType: "application/json"
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Error en la API de Gemini: ${errText}`);
    }

    const result = await response.json();
    console.log("Respuesta de Gemini recibida con éxito");

    // 3. Extraer el texto de manera segura
    const textResponse = result.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textResponse) throw new Error("Gemini no devolvió una respuesta válida.");

    // Ya no necesitas hacer el .replace(/```json/g) porque forzamos "application/json" en generationConfig
    return new Response(textResponse.trim(), { 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
})