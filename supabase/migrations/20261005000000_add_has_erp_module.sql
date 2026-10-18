-- Migration: 20261005000000_add_has_erp_module.sql
-- Description: Agrega la columna has_erp_module a la tabla organizations para soportar Feature Flagging del Módulo ERP

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS has_erp_module BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.organizations.has_erp_module IS
  'Feature flag: activa módulos de facturación detallada, inventario Kardex y costeo de exámenes. Por defecto false.';
