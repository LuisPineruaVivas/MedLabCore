import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    // Extraemos los datos del body
    const { image, fields } = await req.json();
    const apiKey = Deno.env.get('GEMINI_API_KEY');

    if (!image) throw new Error("No se recibió imagen");
    if (!fields || !Array.isArray(fields)) throw new Error("Los campos a extraer deben ser un arreglo");
    if (!apiKey) throw new Error("Falta la configuración de GEMINI_API_KEY en el servidor");

    // Mejoramos el prompt para forzar a Gemini a devolver EXCLUSIVAMENTE JSON válido sin markdown
    const prompt = `Extrae los siguientes campos de la imagen: ${fields.join(", ")}. 
    Tu respuesta debe ser estrictamente un objeto JSON válido y plano, sin bloques de código markdown (\`\`\`json), sin saltos de línea innecesarios y sin texto adicional.`;
    
    // NOTA: Se actualizó al modelo estable actual gemini-2.5-flash para producción
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            // Manejamos si mandan el data:image/jpeg;base64,... completo o solo el string plano
            { inline_data: { mime_type: "image/jpeg", data: image.includes(',') ? image.split(',')[1] : image } }
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