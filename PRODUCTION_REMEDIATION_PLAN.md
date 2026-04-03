# Plan De Remediacion Tecnica Para Llevar GitMed A Un Nivel Produccion

## Resumen
- Prioridad 1: consistencia de datos, mutaciones atómicas y query keys estables.
- Prioridad 2: reducción de complejidad en pantallas críticas y menor costo de render.
- Prioridad 3: menos sobre-fetching, mejor carga inicial y configuración de producción más segura.

## Implementado En Esta Remediacion
- Hook unificado `useCurrentOrgContext` para consolidar `profile`, `organization`, `role`, `permissions` y `orgId`.
- Factory central de `queryKeys` para evitar colisiones de cache en React Query.
- Capa inicial de hooks de dominio para órdenes, pacientes y templates.
- Migración SQL con funciones atómicas para crear órdenes y guardar perfiles.
- Dashboard corregido para depender de datos controlados y no de `fetch` externo en runtime.
- `BrandContext` simplificado para eliminar estado derivado innecesario.
- Lazy loading de rutas principales.
- Configuración de Sentry movida a un módulo de entorno con sampling más conservador.

## Pendiente Prioritario
1. Terminar la migración de todas las páginas y features a `useCurrentOrgContext` y `queryKeys`.
2. Sustituir completamente el guardado manual de perfiles en `TestsPage` por `upsert_exam_profile`.
3. Refactorizar `OrderDetailPage` en subcomponentes y extraer `useOrderResultsEditor`.
4. Reemplazar clones profundos y cálculos dentro del render de edición de resultados.
5. Mover más agregaciones cliente a SQL/RPCs donde siga habiendo sobre-fetching.
6. Añadir tests unitarios, de integración y regresión para las rutas críticas.

## Checklist De Verificacion
- No deben existir más queries de `profile` con distintas formas bajo la misma key.
- La creación de órdenes debe ocurrir mediante `create_lab_order`.
- La tasa de cambio debe salir de Supabase y no de un tercero desde el cliente.
- Las rutas pesadas deben cargarse por `lazy`.
- Sentry no debe inicializarse fuera de escenarios habilitados.

## Archivos Clave A Revisar
- `src/hooks/useCurrentOrgContext.ts`
- `src/lib/queryKeys.ts`
- `src/features/orders/useOrders.ts`
- `src/features/dashboard/useDashboardData.ts`
- `supabase/migrations/20260329233000_production_remediation.sql`
