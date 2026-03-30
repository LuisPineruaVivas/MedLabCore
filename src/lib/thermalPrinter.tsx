import { render } from "react-thermal-printer";
import { OrderReceiptEscPos } from "@/lib/orderReceiptEscPos";
import type { ThermalReceiptData } from "@/lib/thermalReceiptTypes";

export interface ThermalPrinterOptions {
  baudRate?: number;
  port?: SerialPort;
  requestOnMissingPort?: boolean;
  closeAfterPrint?: boolean;
}

let activePort: SerialPort | null = null;

export function isWebSerialSupported() {
  return typeof navigator !== "undefined" && !!navigator.serial;
}

export async function getRememberedThermalPrinterPort() {
  if (!navigator.serial?.getPorts) return null;

  const ports = await navigator.serial.getPorts();
  return ports[0] ?? null;
}

export async function requestThermalPrinterPort() {
  if (!navigator.serial?.requestPort) {
    throw new Error("Web Serial no esta disponible en este navegador.");
  }

  const port = await navigator.serial.requestPort();
  activePort = port;
  return port;
}

async function resolvePort(options?: ThermalPrinterOptions) {
  if (options?.port) {
    activePort = options.port;
    return options.port;
  }

  if (activePort) return activePort;

  const rememberedPort = await getRememberedThermalPrinterPort();
  if (rememberedPort) {
    activePort = rememberedPort;
    return rememberedPort;
  }

  if (options?.requestOnMissingPort === false) {
    throw new Error("No hay una impresora termica seleccionada.");
  }

  return requestThermalPrinterPort();
}

async function ensurePortOpen(port: SerialPort, baudRate: number) {
  if (port.readable || port.writable) return;
  await port.open({ baudRate });
}

export async function buildThermalReceiptCommands(data: ThermalReceiptData) {
  // render() must receive a <Printer> element directly — calling OrderReceiptEscPos as a
  // plain function (instead of JSX) returns the inner <Printer type="epson" ...> element
  // so the library can correctly read `type` and `characterSet` from props to build the
  // printer driver. Wrapping it in <OrderReceiptEscPos /> caused type=undefined → printer=undefined → crash.
  return render(OrderReceiptEscPos(data));
}

export async function printThermalReceipt(
  data: ThermalReceiptData,
  options?: ThermalPrinterOptions,
) {
  if (!isWebSerialSupported()) {
    throw new Error("Este navegador no soporta Web Serial. Usa Chrome o Edge en HTTPS o localhost.");
  }

  const port = await resolvePort(options);
  const baudRate = options?.baudRate ?? 9600;
  const closeAfterPrint = options?.closeAfterPrint ?? true;
  const receiptData = await buildThermalReceiptCommands(data);

  await ensurePortOpen(port, baudRate);

  const writer = port.writable?.getWriter();
  if (!writer) {
    throw new Error("No se pudo obtener acceso de escritura a la impresora.");
  }

  try {
    await writer.write(receiptData);
  } finally {
    writer.releaseLock();
    if (closeAfterPrint) {
      await port.close();
    }
  }

  activePort = closeAfterPrint ? null : port;
  return receiptData;
}
