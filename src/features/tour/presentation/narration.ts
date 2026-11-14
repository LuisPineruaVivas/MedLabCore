/**
 * Lines spoken in the /demo presentation. Plain data with no imports, so
 * scripts/generate-demo-voice.ts can read it with Node and record each line as public/demo/voice/<id>.mp3.
 * Lines avoid the product name so the recordings survive a rename.
 * After editing a line, run the script again: a line whose text changed falls back to the browser voice
 * until it is recorded again (the manifest stores a hash of the recorded text).
 */
export const NARRATION = {
  intro: "Así se maneja un laboratorio de principio a fin, en menos de dos minutos.",
  dashboard: "Tu panel te muestra el día de un vistazo: pacientes, pendientes y lo facturado.",
  orderOpen: "Llega una paciente y le creas su orden.",
  orderSearch: "La buscas por nombre o por cédula. Es nueva, así que la registras ahí mismo, sin salir de la orden.",
  patientFill: "Registras sus datos en segundos. La edad se calcula sola.",
  patientSave: "Guardas, y ya queda lista para su orden.",
  orderTests: "Agregas sus exámenes con solo escribir el nombre.",
  orderTotal: "El total sale al instante, en dólares y en bolívares, con la tasa del día.",
  orderCreate: "Creas la orden, y la nota de entrega sale lista, con el PIN para consultar resultados.",
  resultsOpen: "Cuando tienes los resultados, abres la orden…",
  resultsFill: "…escribes los valores, con el rango de referencia siempre a la vista, y guardas.",
  reportOpen: "Con un clic generas el informe en PDF…",
  reportShow: "…con tu logo, ordenado y listo para entregar.",
  shareSend: "Y lo mejor: se lo envías por WhatsApp.",
  shareOpen: "Tu paciente toca el enlace y ve sus resultados al instante, desde su teléfono.",
  outro: "Sin papeles, sin transcribir y sin llamadas preguntando por resultados. Pruébalo gratis durante siete días.",
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
