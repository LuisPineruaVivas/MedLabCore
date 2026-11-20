/** wa.me number for a Venezuelan phone as typed ("0414-123.45.67", "+58 414..."); null when there is none. */
export const whatsappNumber = (phone: string | null | undefined) => {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (!digits) return null;
  return digits.startsWith("58") ? digits : `58${digits.replace(/^0/, "")}`;
};
