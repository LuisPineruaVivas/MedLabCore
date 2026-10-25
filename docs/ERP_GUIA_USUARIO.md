# Guía de uso — Módulo Administrativo (ERP)

Esta guía explica, paso a paso, cómo usar el módulo administrativo de MedLabCore: cobros, caja, inventario, consumo de insumos y reportes. El módulo sólo aparece en laboratorios donde MedLabCore lo activó. Si no ves las opciones del menú, pide la activación a soporte.

## ¿Quién puede hacer qué?

| Tarea | Administrador | Secretaria | Bioanalista |
|---|:---:|:---:|:---:|
| Configurar métodos de cobro y tasa de cambio | ✅ | | |
| Registrar pagos | ✅ | ✅ | |
| Anular pagos | ✅ | | |
| Crear planes de cuotas | ✅ | | |
| Abrir y cerrar caja | ✅ | ✅ | |
| Revisar cierres de caja | ✅ | | |
| Inventario: insumos, compras, ajustes | ✅ | | ✅ |
| Recetas de insumos por examen | ✅ (edita) | | ✅ (consulta) |
| Confirmar consumo al aprobar una orden | ✅ | | ✅ |
| Reportes financieros | ✅ | | |
| Reporte de inventario | ✅ | | ✅ |

## 1. Primeros pasos (administrador)

1. **Métodos de cobro** (menú *Métodos de cobro*): crea uno por cada forma en que recibes dinero, por ejemplo "Efectivo USD", "Efectivo Bs", "Zelle", "Pago móvil Banesco" o "Punto de venta". Indica el **tipo** (efectivo, transferencia, etc.) y la **moneda**: el cierre de caja sólo cuenta como efectivo los métodos de tipo *Efectivo*.
2. **Tasa de cambio** (*Configuración*): registra la tasa del día. Queda guardada con su fecha, y cada pago en bolívares usa la tasa vigente.
3. **Órdenes anteriores** (*Configuración → Módulo Administrativo*): si el laboratorio ya tenía órdenes, puedes generar sus facturas con **Generar facturas retroactivas**. Las órdenes pagadas quedan como facturas pagadas; las demás quedan emitidas con su saldo completo, y luego registras sus abonos.
4. **Inventario**: crea tus insumos (sección 4) y luego las **recetas** de cada examen (sección 5).

## 2. Cobros y facturas

- Cada orden nueva genera su **factura** automáticamente.
- **Registrar un pago:** abre la factura (*Facturas* → número de factura) → *Registrar pago*. Puedes combinar varios métodos en un mismo cobro, por ejemplo una parte en efectivo USD y otra en pago móvil en bolívares. El sistema convierte a USD con la tasa del día y no deja cobrar más que el saldo.
- **Pagos en cuotas:** en la factura, *Plan de cuotas* → reparte el saldo en fechas. Si ya había abonos, aparecen como una primera cuota pagada.
- **Anular un pago** (administrador): ícono 🚫 junto al pago → escribe el motivo. El pago queda en el historial, tachado, y el saldo vuelve a subir. No se pueden anular pagos de una caja ya cerrada.
- **Vencidas:** una factura pasa a *Vencida* cuando tiene una cuota o una fecha de pago atrasada. El sistema lo revisa todos los días a las 6:00 a. m. y cada vez que entra un pago.

## 3. Caja diaria

1. **Al iniciar el turno:** *Caja* → *Abrir caja* → registra el fondo inicial en USD y en Bs. Sólo puede haber una caja abierta por laboratorio.
2. **Durante el día:** cada pago que se registra queda asociado a la caja abierta. En la pantalla de Caja ves en vivo el **efectivo esperado** por moneda (fondo + cobros en efectivo) y los cobros electrónicos.
3. **Corte parcial:** el botón *Corte parcial* imprime un PDF con la situación actual sin cerrar la caja.
4. **Al cerrar:** *Cerrar caja* → cuenta el efectivo físico de cada moneda y escríbelo. El sistema muestra si la caja está **cuadrada**, si hay **sobrante** o si hay **faltante**. Si hay diferencia, las notas son obligatorias.
5. **Revisión** (administrador): en *Historial de cierres*, *Revisar* marca el cierre como revisado. Desde el historial también se descarga el PDF de cada cierre para firmarlo.

> Los cobros por Zelle, transferencia, pago móvil o punto de venta **no se cuentan en la gaveta**: se concilian con el estado de cuenta del banco.

## 4. Inventario

- **Nuevo insumo:** *Inventario* → *Nuevo insumo*. Indica la unidad (uds, ml, cajas…), el **stock mínimo** para recibir alertas y, opcionalmente, el stock inicial con su costo.
- **Compras:** *Registrar compra* → cantidad, costo unitario, proveedor, lote y vencimiento. El sistema recalcula el **costo promedio** del insumo.
- **Ajustes:** *Ajuste* → salida (pérdida, vencido, rotura) o entrada (sobrante de conteo), siempre con su motivo.
- **Kardex:** haz clic en un insumo para ver todos sus movimientos, con el stock y el costo después de cada uno. Los movimientos no se pueden editar ni borrar. Si te equivocas, corrige con un ajuste.
- El stock y el costo **nunca se escriben a mano**: sólo cambian con compras, ajustes o consumos.

## 5. Recetas de insumos por examen

En *Exámenes* → botón **Insumos** de cada examen, el administrador define qué consume una determinación, por ejemplo "1 tubo morado, 1 inyectadora y 0,5 ml de alcohol". Se muestra el **costo estimado** por examen. En los perfiles, configura la receta de cada examen que lo compone.

## 6. Aprobar una orden con consumo de insumos

Al pulsar **Aprobar y Firmar**, se abre la ventana **Confirmar consumo de insumos**:

- Aparecen los insumos de cada examen según su receta.
- Puedes **ajustar cantidades**; si cambias una, escribe el motivo.
- **Repetir examen** agrega de nuevo los insumos de ese examen, por ejemplo si hubo que repetir la toma.
- **Agregar insumo extra** sirve para gastos imprevistos.
- Si falta stock, la ventana lo indica y no deja confirmar. En ese caso, registra la compra o un ajuste primero.

Al confirmar, en un solo paso se descuenta el inventario, se registra el costo y la orden queda **completada y firmada**.

## 7. Reportes (*Reportes*)

- **Finanzas:** cobrado en el período (comparado con el período anterior), cobrado hoy, cuentas por cobrar y vencidos, cobros por día, por método y por moneda.
- **Rentabilidad:** ingresos menos costo de insumos, margen bruto y rentabilidad por examen. Marca los exámenes con margen menor a 50 %. Sólo cuenta órdenes con consumo confirmado.
- **Cuentas por cobrar:** saldos por antigüedad (por vencer, 1–30, 31–60, 61–90 y más de 90 días) y lista de facturas pendientes.
- **Inventario:** valor total, compras, consumo, pérdidas, insumos bajo mínimo y por vencer.
- **Exportar PDF** descarga el reporte de la pestaña actual. El PDF de inventario incluye una hoja de existencias útil para el conteo físico.

El *Panel de control* muestra además un resumen: lo cobrado hoy y en el mes, lo que está por cobrar y lo vencido, junto con alertas de bajo stock.

## Preguntas frecuentes

**Registré un pago por error.** El administrador lo anula desde la factura, con motivo, mientras la caja de ese día siga abierta.

**La caja no cuadra.** Revisa que cada cobro se haya registrado con el método correcto (efectivo o electrónico) y en la moneda correcta. Explica la diferencia en las notas de cierre.

**Una orden se completó sin descontar insumos.** Pasa con órdenes aprobadas antes de activar el módulo o de configurar sus recetas. Registra la salida con un ajuste de inventario.

**¿Puedo desactivar el módulo?** Sí: soporte puede desactivarlo y el laboratorio vuelve al flujo anterior. Los datos administrativos se conservan.
