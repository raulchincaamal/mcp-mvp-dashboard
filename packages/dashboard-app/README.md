# @mcp-mvp/dashboard-app

Frontend del pipeline MCP — renderiza UIs dinamicas generadas por el pipeline desde JSON configs declarativos.

## Tecnologias

- **Framework**: Next.js 16 (App Router, Turbopack)
- **React**: 19
- **UI Library**: @macropaytd/lib-front-ui-components
- **Charts**: Chart.js + react-chartjs-2
- **Styling**: Tailwind CSS 4
- **State**: FIFO Orchestrator + Zustand (via @macropaytd/lib-front-fifo-zustand)
- **i18n**: lib-front-i18n-module (es/en)
- **Architecture**: front-template-kiro (Container/View, FIFO events, shared layer)

## Rutas

| Ruta | Descripcion |
|------|-------------|
| `/` | Home page con navegacion al dashboard |
| `/dashboard` | Dashboard estatico con charts de sample data |
| `/dynamic` | UI Dinamica — genera interfaces desde intent + datos via mcp-main |

## Arquitectura de carpetas

```
src/
├── app/
│   ├── layout.tsx              # Root layout + Providers
│   ├── providers.tsx           # FIFO, i18n, loading, monitors
│   ├── globals.css             # Tailwind + CSS variables
│   └── (pages)/
│       ├── layout.tsx          # DashboardLayout (sidebar)
│       ├── page.tsx            # Home
│       ├── dashboard/
│       │   ├── page.tsx
│       │   ├── types/
│       │   ├── store/
│       │   ├── components/     # Container, ChartRenderer, DashboardRenderer
│       │   └── sample-data/
│       └── dynamic/
│           ├── page.tsx        # UI Dinamica (fetch a mcp-main)
│           └── components/
│               └── DynamicRenderer.tsx
└── shared/
    ├── orchestrator.ts
    ├── constants/
    ├── feedback/
    ├── hooks/
    ├── i18n/
    ├── request/
    ├── schemas/
    └── store/
```

## DynamicRenderer

Componente central que mapea `UIConfig` JSON a componentes React reales.

### Componentes soportados

| Componente | Tipo | Descripcion |
|------------|------|-------------|
| `StatCard` | Composite | Metric con valor, tendencia, icono |
| `KPIGrid` | Composite | Grid responsivo de StatCards |
| `ProgressBar` | Composite | Barra con label y porcentaje |
| `ProgressGroup` | Composite | Card con multiples barras |
| `TransactionList` | Composite | Lista de items con monto/fecha |
| `MiniChart` | Composite | Sparkline compacto |
| `DataSummary` | Composite | Tabla estilizada |
| `Chart` | Chart.js | Bar, Line, Pie, Doughnut, Area |
| `Card`, `Text`, `Badge`, `Button`, `Input` | @macropaytd | Componentes base |

### Flujo de datos

```
Usuario escribe intent → fetch POST /api/generate-ui → mcp-main procesa → UIConfig JSON → DynamicRenderer → React components
```

## Configuracion

### Variables de entorno

| Variable | Default | Descripcion |
|----------|---------|-------------|
| `NEXT_PUBLIC_MCP_MAIN_URL` | `http://localhost:4000` | URL del API mcp-main |

### Prerequisitos

- `.npmrc` con token para `@macropaytd` packages (GitHub Packages)
- `mcp-main` corriendo en puerto 4000 (para la pagina /dynamic)

## Build & Run

```bash
npm run dev      # Dev server con Turbopack (puerto 3000)
npm run build    # Build de produccion
npm run start    # Serve produccion build
```

Desde la raiz del monorepo:
```bash
npm run dev:dashboard
```

## i18n

Locales en `public/locales/{es,en}/common.json`. Idioma default: español.

Claves principales:
- `nav.*` — navegacion sidebar
- `home.*` — pagina home
- `dashboard.*` — pagina dashboard
- `dynamic.*` — pagina UI dinamica
