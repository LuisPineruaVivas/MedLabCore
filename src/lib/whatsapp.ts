/** wa.me number for a Venezuelan phone as typed ("0414-123.45.67", "+58 414..."); null when there is none. */
export const whatsappNumber = (phone: string | null | undefined) => {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (!digits) return null;
  return digits.startsWith("58") ? digits : `58${digits.replace(/^0/, "")}`;
};

export const DEFAULT_RESULTS_MESSAGE = "Tus resultados están listos, los puedes ver de inmediato en el siguiente enlace:";

/** WhatsApp text for the results link: the lab's own message (or the default) followed by the link. */
export const resultsMessage = (custom: string | null | undefined, link: string, fallback = DEFAULT_RESULTS_MESSAGE) =>
  `${custom?.trim() || fallback} ${link}`;
