import type { ThermalReceiptData } from "@/lib/thermalReceiptTypes";

export function buildReceiptHTML(data: ThermalReceiptData, paperMm: 58 | 80 = 58) {
  const labName = data.labData?.name || 'LABORATORIO MEDICO';
  const labAddr = data.labData?.address || '';
  const labPhone = data.labData?.phone || '';

  const orderNum = String(data.orderId).padStart(4, '0');
  const orderDate = data.orderDate;
  const patient = data.patientName;
  const patientId = data.patientId;

  const items = data.items || [];
  const total = Number(data.total) || 0;
  const exchangeRate = data.exchangeRate ? Number(data.exchangeRate) : null;
  const totalBs = data.totalBs ? Number(data.totalBs).toFixed(2) : null;

  const pin = data.accessPin || '';

  const itemRows = items.map(i => `
    <tr>
      <td class="item-name">${i.test_name}</td>
      <td class="item-price">$${Number(i.price).toFixed(2)}</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Nota de Entrega ${orderNum}</title>
  <style>
    /* ── Reset ── */
    * { margin: 0; padding: 0; box-sizing: border-box; }

    /* ── Page size: 58mm wide, auto height ── */
    @page {
      size: ${paperMm}mm auto;
      margin: 0;
    }

    /* ── Body: un poco más de aire a la derecha (zona no imprimible del rodillo) ── */
    html, body {
      width: ${paperMm}mm;
      padding: 3mm 6mm 3mm 4mm;
      font-family: 'Courier New', Courier, monospace;
      font-size: 8pt;
      color: #000;
      background: #fff;
    }

    /* ── Utilities ── */
    .center { text-align: center; }
    .right  { text-align: right; }
    .bold   { font-weight: bold; }
    .large  { font-size: 10pt; }
    .small  { font-size: 7pt; }
    .hr     { border: none; border-top: 1px dashed #000; margin: 2mm 0; }
    .mt1    { margin-top: 1mm; }
    .mt2    { margin-top: 2mm; }
    .mt3    { margin-top: 3mm; }

    /* ── Tablas ── */
    table { width: 100%; border-collapse: collapse; }
    table.info-table td:last-child { padding-left: 2mm; }

    /* Tabla de ítems: ancho fijo para que la columna USD no se coma el texto */
    table.item-table { table-layout: fixed; width: 100%; }
    table.item-table th:first-child,
    table.item-table td.item-name {
      width: 68%;
      padding: 0.5mm 1mm 0.5mm 0;
      vertical-align: top;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }
    table.item-table th:last-child,
    table.item-table td.item-price {
      width: 32%;
      padding: 0.5mm 0 0.5mm 1mm;
      text-align: right;
      white-space: nowrap;
      font-weight: bold;
    }
    .total-row td { font-weight: bold; border-top: 1px dashed #000; padding-top: 1mm; }
    .bs-row td { font-size: 7pt; }
    .bs-row td:last-child { font-weight: bold; }

    /* ── Hide everything when printing except receipt ── */
    @media screen {
      body { background: #f0f0f0; padding: 20px; }
      .receipt {
        background: white;
        max-width: ${paperMm}mm;
        margin: 0 auto;
        padding: 4mm 5mm 4mm 4mm;
        box-shadow: 0 2px 12px rgba(0,0,0,0.2);
      }
    }
    @media print {
      html, body { background: white; }
      .receipt { padding: 0; }
    }
  </style>
</head>
<body>
<div class="receipt">

  <!-- Encabezado -->
  <div class="center bold large">${labName}</div>
  ${labAddr ? `<div class="center small mt1">${labAddr}</div>` : ''}
  ${labPhone ? `<div class="center small">${labPhone}</div>` : ''}

  <hr class="hr mt2">
  <div class="center bold large mt1">NOTA DE ENTREGA</div>
  <hr class="hr mt1">

  <!-- Orden -->
  <table class="mt1 info-table">
    <tr><td>ORDEN</td><td class="right">${orderNum.padStart(4, '0')}</td></tr>
    <tr><td>FECHA</td><td class="right">${orderDate}</td></tr>
  </table>

  <div class="mt2">PACIENTE:</div>
  <div class="bold mt1">${patient}</div>
  <div class="small">${patientId}</div>

  <!-- Items -->
  <hr class="hr mt2">
  <table class="item-table">
    <thead>
      <tr><th style="text-align:left">EXAMEN</th><th>USD</th></tr>
    </thead>
    <tbody>${itemRows}</tbody>
    <tfoot>
      <tr class="total-row">
        <td>TOTAL USD</td>
        <td class="right">$${total.toFixed(2)}</td>
      </tr>
      ${(exchangeRate !== null && totalBs !== null) ? `
      <tr class="bs-row">
        <td>TASA BS</td>
        <td class="right">${exchangeRate.toFixed(2)}</td>
      </tr>
      <tr class="bs-row">
        <td>TOTAL BS</td>
        <td class="right">Bs. ${totalBs}</td>
      </tr>
      ` : ''}
    </tfoot>
  </table>

  <!-- PIN -->
  ${pin ? `
  <hr class="hr mt2">
  <div class="center mt1">PIN DE ACCESO</div>
  <div class="center bold large mt1">${pin.split('').join(' ')}</div>
  ` : ''}

  <!-- Footer -->
  <hr class="hr mt2">
  <div class="center small mt1">Gracias por su preferencia</div>

</div>
</body>
</html>`;
}

export async function printThermalReceipt(data: ThermalReceiptData, paperMm: 58 | 80 = 58): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const html = buildReceiptHTML(data, paperMm);
      const win = window.open('', '_blank', 'width=400,height=700');

      if (!win) {
        reject(new Error("Ventana emergente bloqueada. Por favor, permite pop-ups para este sitio."));
        return;
      }

      win.document.write(html);
      win.document.close();

      win.onload = () => {
        setTimeout(() => {
          win.print();
          resolve();
        }, 800);
      };

      // Fallback en caso de que onload falle
      setTimeout(() => {
        try {
          if (!win.print) {
            win.print();
            resolve();
          }
        } catch (e) { }
      }, 1500);

    } catch (error) {
      reject(error);
    }
  });
}
