# 🔬 Lab-Harmony: Sistema de Gestión de Laboratorios Clínicos

**Lab-Harmony** es una aplicación SaaS moderna (React + Vite + TypeScript + Supabase) diseñada para la gestión integral de laboratorios clínicos. Permite administrar pacientes, órdenes, pruebas médicas, facturación y generar informes de resultados en formato PDF, además de incluir un portal seguro para que los pacientes consulten sus propios resultados.

---

## 🏗️ Arquitectura y Tecnologías

El proyecto sigue una arquitectura **Frontend (SPA) + BaaS (Backend as a Service)**:

- **Frontend:** React 18, Vite, TypeScript
- **UI & Estilos:** shadcn/ui (Radix), Tailwind CSS, Lucide Icons, react-hook-form + Zod
- **Estado/Fetching:** TanStack Query (React Query)
- **Generación PDF:** `@react-pdf/renderer`
- **Backend & Auth:** Supabase (PostgreSQL, Row Level Security, RPCs, Edge Functions)

---

## 🛡️ Roles y Permisos (RBAC)

El sistema maneja multi-tenancy a través del campo `org_id` y soporta 4 niveles de acceso:

1. **`super_admin`:** Administra organizaciones, suscripciones y roles globales.
2. **`lab_admin`:** Configura el laboratorio (plantillas de pruebas, precios, tasas de cambio), maneja facturación y equipo.
3. **`bioanalyst`:** Acceso a pacientes, órdenes y carga de resultados médicos. No ve facturación.
4. **`secretary`:** Recepción de pacientes, ingreso de órdenes, facturación y cobro. No carga resultados de pruebas médicas.

> *Nota: Todo el acceso a datos está auditado y protegido en la base de datos a través de políticas Row Level Security (RLS) y funciones Security Definer.*

---

## 🚀 Configuración del Entorno Local

Asegúrate de tener instalado **Node.js** (LTS recomendado).

### 1. Variables de Entorno

El proyecto usa Supabase. Necesitas crear un archivo `.env` en la raíz (puedes copiar el esquema de `.env.example`):

```env
VITE_SUPABASE_URL=https://<tu-proyecto>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=tu-anon-public-key
VITE_SUPABASE_PROJECT_ID=tu-project-id
```

### 2. Instalación y Ejecución

El proyecto utiliza **NPM** como gestor canónico de paquetes (no usar bun ni deno).

```bash
# Instalar dependencias
npm install

# Correr en desarrollo
npm run dev

# Compilar para producción
npm run build
```

---

## 🗄️ Base de Datos y Supabase

El backend está definido en la carpeta `supabase/migrations`. Para la configuración inicial o despliegue:

1. Instalar Supabase CLI.
2. Ejecutar las migraciones contra tu proyecto vinculado:
   ```bash
   supabase db push
   ```

*Las tablas principales incluyen: `organizations`, `profiles`, `patients`, `test_templates`, `orders`, `order_items`, `exchange_rates`.*

---

## 🔐 Portal de Pacientes Seguro

El sistema incluye una ruta pública `/portal-paciente` donde los pacientes pueden ver sus informes PDF. 
- **Autenticación:** Requiere número de documento (Cédula) y un PIN alfanumérico generado de forma aleatoria y segura por orden.
- **Seguridad:** Protegido mediante funciones RPC seguras, con rate-limiting en cliente para prevenir ataques de fuerza bruta.

---

## 📡 Observabilidad (Producción)

En entornos de producción, la aplicación está integrada con **Sentry** para la captura de errores en tiempo real. Configura la variable `VITE_SENTRY_DSN` en el deployment para activarlo.
