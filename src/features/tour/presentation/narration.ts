/**
 * Lines spoken in the /demo presentation. Plain data with no imports, so
 * scripts/generate-demo-voice.ts can read it with Node and record each line as public/demo/voice/<id>.mp3.
 * Lines avoid the product name so the recordings survive a rename.
 * After editing a line, run the script again: a line whose text changed falls back to the browser voice
 * until it is recorded again (the manifest stores a hash of the recorded text).
 */
export const NARRATION = {
  intro: "Maneja tu laboratorio de principio a fin.",
  dashboard: "Tu panel te muestra el día de un vistazo: pacientes, órdenes creadas, ingresos y pruebas pendientes.",
  orderOpen: "Llega una paciente a hacerse un examen, así que procedes a crearle una orden.",
  orderSearch: "La buscas por nombre o por cédula. Es nueva, así que la registras ahí mismo.",
  patientFill: "Registras sus datos e información personal.",
  patientSave: "Guardas, y ya queda lista para su orden.",
  orderTests: "Agregas los exámenes a realizar con solo escribir el nombre y seleccionar.",
  orderTotal: "El total sale al instante, en dólares y en bolívares, con la tasa del día.",
  orderCreate: "Una vez lista verificas y creas la orden.",
  resultsOpen: "Cuando tienes los resultados, abres la orden…",
  resultsFill: "…llenas los resultados para cada examen, guardas y listo",
  reportOpen: "Con un clic generas el informe en PDF…",
  reportShow: "…con tu logo, ordenado y listo para entregar.",
  shareSend: "Y lo mejor: se lo envías por WhatsApp.",
  shareOpen: "Tu paciente toca el enlace y ve sus resultados al instante, desde su teléfono.",
  outro: "Sin papeles, sin transcribir y sin llamadas preguntando por resultados. Pruébalo",
} as const;

export type LineId = keyof typeof NARRATION;

/** Short, stable fingerprint of a line's text (FNV-1a), shared by the recorder and the player. */
export function textHash(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16);
}
