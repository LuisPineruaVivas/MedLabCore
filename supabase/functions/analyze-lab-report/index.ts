import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // 1. Manejar CORS
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('No hay header de Autorización');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 2. Extraer el JWT y validarlo
    const jwt = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(jwt);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'JWT Inválido' }), { status: 403, headers: corsHeaders });
    }

    
    // Extraemos los datos del body
    const { image, fields } = await req.json();
    const apiKey = Deno.env.get('GEMINI_API_KEY');

    if (!image) throw new Error("No se recibió imagen");
    
    // 2. Llamada directa a Gemini (Sin validar usuario por ahora)
    const prompt = `Extrae estos campos de la imagen: ${fields.join(", ")}. Responde solo JSON plano.`;
    
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inline_data: { mime_type: "image/jpeg", data: image.split(',')[1] } }
          ]
        }]
      })
    });

    const result = await response.json();
    console.log("Respuesta de Gemini recibida con éxito");

    // 3. Retornar directamente lo que diga Gemini
    const textResponse = result.candidates[0].content.parts[0].text;
    const cleanJson = textResponse.replace(/```json|```/g, "").trim();

    return new Response(cleanJson, { 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
})