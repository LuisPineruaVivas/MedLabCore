# Guía de uso — Módulo Administrativo (ERP)

Esta guía explica, paso a paso, cómo usar el módulo administrativo de MedLabCore: cuentas y su dinero, cobros, gastos, cuentas por cobrar y por pagar, inventario, consumo de insumos y reportes. El módulo sólo aparece en laboratorios donde MedLabCore lo activó. Si no ves la sección *Administración* en el menú, pide la activación a soporte.

**Dónde está cada cosa.** En computadora, el menú lateral agrupa todo lo financiero en **Administración**: al hacer clic en el nombre se abre el resumen; con la flecha se despliegan *Resumen, Por cobrar, Por pagar, Movimientos, Facturas, Cuentas* y *Reportes*. *Inventario* tiene su propia entrada. En el teléfono, la barra inferior tiene *Panel, Pacientes, Órdenes, Administración* y **Menú**, que abre todas las secciones.

## ¿Quién puede hacer qué?

| Tarea | Administrador | Secretaria | Bioanalista |
|---|:---:|:---:|:---:|
| Crear y editar cuentas (saldo inicial) | ✅ | | |
| Ver saldos de las cuentas, resumen y ganancia | ✅ | | |
| Cobrar órdenes y cuotas | ✅ | ✅ | |
| Registrar gastos y otros ingresos | ✅ | ✅ | |
| Transferencias entre cuentas y ajustes de saldo | ✅ | | |
| Anular pagos y movimientos | ✅ | | |
| Crear planes de cuotas | ✅ | | |
| Ver *Por cobrar* y *Por pagar*; registrar y pagar deudas | ✅ | ✅ | |
| Anular una cuenta por pagar | ✅ | | |
| Inventario: insumos, compras, ajustes | ✅ | | ✅ |
| Pagar una compra desde una cuenta | ✅ | | (queda *por pagar*) |
| Recetas de insumos por examen | ✅ (edita) | | ✅ (consulta) |
| Confirmar consumo al aprobar una orden | ✅ | | ✅ |
| Reportes | ✅ | | |

## 1. Primeros pasos (administrador)

1. **Cuentas** (*Administración → Cuentas*): crea una por cada lugar donde el laboratorio tiene dinero, por ejemplo "Caja USD", "Caja Bs", "Banesco Bs", "Zelle" o "Binance". Indica la **moneda**, el **saldo inicial** (el dinero que hay hoy en esa cuenta) y la **fecha del saldo inicial**. Los cobros desde esa fecha se suman al saldo; los anteriores ya están incluidos en el saldo inicial.
2. **Tasa de cambio** (*Configuración*): los montos en bolívares usan la tasa del día, que puedes corregir en cada cobro o gasto.
3. **Órdenes anteriores** (*Configuración → Módulo Administrativo*): si el laboratorio ya tenía órdenes, puedes generar sus facturas con **Generar facturas retroactivas**.
4. **Inventario**: crea tus insumos (sección 6) y luego las **recetas** de cada examen (sección 7).

## 2. Cobrar órdenes

- Cada orden nueva genera su **factura** automáticamente, y al crear la orden puedes cobrarla en el momento.
- **Cobrar:** desde la factura (*Registrar pago*) o desde *Por cobrar* (botón **Cobrar**). Elige la **cuenta donde entra el dinero**. Puedes combinar varias cuentas en un mismo cobro, por ejemplo una parte en Caja USD y otra en pago móvil en bolívares. El sistema convierte a USD con la tasa del día y no deja cobrar más que el saldo.
- **Pagos en cuotas** (administrador): en la factura, *Plan de cuotas* → reparte el saldo en fechas. Si ya había abonos, aparecen como una primera cuota pagada.
- **Anular un pago** (administrador): ícono 🚫 junto al pago en la factura → escribe el motivo. El pago queda en el historial, tachado, y el saldo de la orden y de la cuenta vuelve atrás.

## 3. Por cobrar

*Administración → Por cobrar* muestra lo que los pacientes deben, sin tener que entrar a cada orden:

- Arriba: total por cobrar, **cuotas vencidas**, cuotas de los próximos 7 días y saldos sin plan de cuotas. Al tocar una tarjeta se filtra la lista.
- **Cuotas:** todas las cuotas pendientes de todas las órdenes, por fecha (filtros: todas, vencidas, próximos 7 días, este mes), con el teléfono del paciente y el botón **Cobrar**, que ya trae el monto de la cuota.
- **Saldos pendientes:** todas las órdenes con saldo, indicando si tienen plan de cuotas.
- La antigüedad de saldos está en *Reportes*.

## 4. Cuentas, gastos y movimientos

- **Saldos:** *Administración → Cuentas* muestra el dinero de cada cuenta y el total aproximado en USD.
- **Registrar un gasto:** botón *Gasto* → cuenta de donde sale el dinero, **qué se está pagando** (servicios, alquiler, nómina, materiales de oficina, insumos, etc.), monto, fecha y referencia. El administrador puede crear categorías nuevas desde la misma lista.
- **Otro ingreso:** botón *Ingreso*, para dinero que no viene de una orden (aporte de socios, etc.).
- **Transferencia** (administrador): de una cuenta a otra. Si las monedas son distintas, escribes el monto que **salió** y el que **llegó**, y el sistema guarda la tasa del cambio (por ejemplo, 50 USD → 44 800 Bs = 896 Bs/USD).
- **Ajuste de saldo** (administrador): cuando el saldo real no coincide con el del sistema, con motivo obligatorio.
- **Movimientos:** la lista de todo lo que entró y salió, filtrable por fecha, cuenta y tipo. Al filtrar por una cuenta, el administrador ve el saldo después de cada movimiento (estado de cuenta). Los movimientos no se editan: se **anulan** con motivo y se registran de nuevo.

## 5. Por pagar

*Administración → Por pagar* guarda las deudas del laboratorio: facturas de proveedores, servicios, alquiler, etc.

- **Nueva cuenta por pagar:** qué se debe (categoría y descripción), a quién, monto (USD o Bs), fecha límite y número de factura.
- **Pagar:** elige la cuenta y el monto; se permiten abonos parciales. Si la deuda y la cuenta tienen monedas distintas, se convierte con la tasa del día. El pago aparece en *Movimientos* como gasto.
- Las compras de inventario no pagadas llegan aquí solas (sección 6).
- Las vencidas se marcan en rojo. **Anular** (administrador) deja de cobrar lo pendiente; lo ya pagado queda registrado.

## 6. Inventario

- **Nuevo insumo:** *Inventario* → *Nuevo insumo*. Indica:
  - la **unidad de medida**: la unidad en que se lleva el stock y se gasta en cada examen (uds, ml, tubos…);
  - las **unidades por empaque**: cuántas de esas unidades trae el empaque en que lo compras (por ejemplo, una caja de 10 inyectadoras = 10). Si lo compras suelto, deja 1;
  - el **stock mínimo** para recibir alertas y, opcionalmente, el stock inicial con su costo (la carga inicial no mueve dinero).
- **Compras:** *Registrar compra* → cantidad, costo, proveedor, lote y vencimiento. Puedes **comprar por empaques** (por ejemplo, 2 empaques de 10 a $5 = 20 uds a $0,50 c/u). El sistema recalcula el **costo promedio**. En **Pago de la compra**:
  - el administrador elige **Pagada desde una cuenta** (sale el dinero de esa cuenta como gasto de *Insumos y reactivos*) o **Queda por pagar** (con fecha límite opcional);
  - si la registra el bioanalista, queda siempre *por pagar* para que el administrador la pague.
- **Ajustes:** *Ajuste* → salida (pérdida, vencido, rotura) o entrada (sobrante de conteo), siempre con su motivo.
- **Kardex:** haz clic en un insumo para ver todos sus movimientos, con el stock y el costo después de cada uno. Los movimientos no se pueden editar ni borrar. Si te equivocas, corrige con un ajuste.
- El stock y el costo **nunca se escriben a mano**: sólo cambian con compras, ajustes o consumos.

## 7. Recetas de insumos por examen

En *Exámenes* → botón **Insumos** de cada examen, el administrador define qué consume una determinación, por ejemplo "1 tubo morado, 1 inyectadora y 0,5 ml de alcohol". Se muestra el **costo estimado** por examen. En los perfiles, configura la receta de cada examen que lo compone.

## 8. Aprobar una orden con consumo de insumos

Al pulsar **Aprobar y Firmar**, se abre la ventana **Confirmar consumo de insumos**:

- Aparecen los insumos de cada examen según su receta.
- Puedes **ajustar cantidades**; si cambias una, escribe el motivo.
- **Repetir examen** agrega de nuevo los insumos de ese examen, por ejemplo si hubo que repetir la toma.
- **Agregar insumo extra** sirve para gastos imprevistos.
- Si falta stock, la ventana lo indica y no deja confirmar. En ese caso, registra la compra o un ajuste primero.

Al confirmar, en un solo paso se descuenta el inventario, se registra el costo y la orden queda **completada y firmada**.

## 9. Resumen financiero y reportes

Sólo el administrador ve esta sección.

- **Resumen** (*Administración*, también en el *Panel de control*): ingresos del período (cobros de órdenes y otros ingresos), egresos (gastos, compras y deudas pagadas), **ganancia**, dinero disponible en cuentas, gráfico de ingresos y egresos de los últimos 6 meses, gastos por categoría, por cobrar, por pagar y últimos movimientos. Es en base caja: cuenta lo que entró y salió de verdad; las transferencias y ajustes no son ingresos ni gastos.
- **Reportes → Finanzas:** facturado vs. cobrado en el período, cobros por día, por cuenta y por moneda.
- **Rentabilidad:** ingresos menos costo de insumos, margen bruto y rentabilidad por examen. Marca los exámenes con margen menor a 50 %. Sólo cuenta órdenes con consumo confirmado.
- **Cuentas por cobrar:** saldos por antigüedad (por vencer, 1–30, 31–60, 61–90 y más de 90 días).
- **Inventario:** valor total, compras, consumo, pérdidas, insumos bajo mínimo y por vencer.
- **Exportar PDF** descarga el reporte de la pestaña actual. El PDF de inventario incluye una hoja de existencias útil para el conteo físico.

## Preguntas frecuentes

**Registré un pago o un gasto por error.** El administrador lo anula (el pago desde la factura, el gasto desde *Movimientos*), con motivo, y se registra de nuevo bien.

**El saldo de una cuenta no coincide con el banco o la gaveta.** Revisa en *Movimientos*, filtrando por esa cuenta, que cada cobro y gasto esté en la cuenta y moneda correctas. Si la diferencia es real, el administrador registra un **ajuste de saldo** con su motivo.

**¿Qué pasó con la apertura y el cierre de caja?** Se retiraron: el efectivo es ahora una cuenta más (por ejemplo "Caja USD") con su saldo siempre visible.

**Una orden se completó sin descontar insumos.** Pasa con órdenes aprobadas antes de activar el módulo o de configurar sus recetas. Registra la salida con un ajuste de inventario.

**¿Puedo desactivar el módulo?** Sí: soporte puede desactivarlo y el laboratorio vuelve al flujo anterior. Los datos administrativos se conservan.
