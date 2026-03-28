import { Br, Cut, Line, Printer, QRCode, Row, Text } from "react-thermal-printer";
import type { ThermalReceiptData } from "@/lib/thermalReceiptTypes";

function sanitizeText(value?: string | number | null) {
  if (value == null) return "";

  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E\n]/g, "")
    .trim();
}

function formatMoney(value?: number | null, prefix = "$") {
  if (typeof value !== "number" || Number.isNaN(value)) return "";
  return `${prefix}${value.toFixed(2)}`;
}

function formatOrderNumber(orderId: ThermalReceiptData["orderId"]) {
  const numericValue = Number(orderId);
  if (Number.isFinite(numericValue)) {
    return numericValue.toString().padStart(4, "0");
  }

  return sanitizeText(orderId);
}

export function OrderReceiptEscPos({
  orderId,
  orderDate,
  patientName,
  patientId,
  items,
  total,
  accessPin,
  portalUrl,
  exchangeRate,
  totalBs,
  labData,
}: ThermalReceiptData) {
  const lab = labData || {};
  const portalLink = accessPin && portalUrl
    ? `${portalUrl}?order=${encodeURIComponent(String(orderId))}&pin=${encodeURIComponent(accessPin)}`
    : null;

  return (
    <Printer type="epson" width={48} characterSet="pc437_usa">
      <Text align="center" bold>{sanitizeText(lab.name || "LABORATORIO")}</Text>
      {!!lab.address && <Text align="center">{sanitizeText(lab.address)}</Text>}
      {!!lab.phone && <Text align="center">{sanitizeText(lab.phone)}</Text>}
      {!!lab.email && <Text align="center">{sanitizeText(lab.email)}</Text>}

      <Br />
      <Line />
      <Text align="center" bold size={{ width: 2, height: 2 }}>
        NOTA DE ENTREGA
      </Text>
      <Line />

      <Row left="ORDEN" right={formatOrderNumber(orderId)} />
      <Row left="FECHA" right={sanitizeText(orderDate)} />
      <Text>PACIENTE</Text>
      <Text bold>{sanitizeText(patientName)}</Text>
      {!!patientId && <Text>CI: {sanitizeText(patientId)}</Text>}

      <Br />
      <Line />
      <Row left="EXAMEN" right="USD" />
      <Line />

      {items.map((item, index) => (
        <Row
          key={`${item.test_name}-${index}`}
          left={sanitizeText(item.test_name)}
          right={formatMoney(item.price)}
        />
      ))}

      <Line />
      <Row
        left={<Text bold>TOTAL USD</Text>}
        right={<Text bold>{formatMoney(total)}</Text>}
      />

      {typeof exchangeRate === "number" && (
        <Row left="TASA BS" right={formatMoney(exchangeRate, "")} />
      )}

      {typeof totalBs === "number" && (
        <Row left="TOTAL BS" right={formatMoney(totalBs, "Bs. ")} />
      )}

      {!!accessPin && (
        <>
          <Br />
          <Line />
          <Text align="center">PIN DE ACCESO</Text>
          <Text align="center" bold size={{ width: 2, height: 2 }}>
            {sanitizeText(accessPin)}
          </Text>
        </>
      )}

      {!!portalLink && (
        <>
          <Br />
          <Text align="center">CONSULTA TUS RESULTADOS</Text>
          <QRCode align="center" content={portalLink} />
          <Text align="center">{sanitizeText(portalUrl)}</Text>
        </>
      )}

      <Br />
      <Text align="center">Gracias por su preferencia</Text>
      <Cut />
    </Printer>
  );
}
