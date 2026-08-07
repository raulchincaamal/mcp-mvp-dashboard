<!-- @mcp-mvp/mcp-gcp-mock/AGENTS.md -->

## GLOBAL IMPERATIVE

- **NEVER** manually edit `package-lock.json` — use npm commands
- **ALWAYS** update docs when functionality changes
- **ALWAYS** regenerate mock data after modifying the product catalog

## [QUICK-REF] — MCP Server

Simula consultas de datos GCP/SAP usando fixtures JSON locales. Sirve como fuente de datos para el pipeline de generación de dashboards.

- **Package**: `@mcp-mvp/mcp-gcp-mock`
- **Entry**: `node dist/index.js`
- **Transport**: stdio
- **Tools**: `list_datasets`, `query_data`

### Configuración IDE

```json
{
  "mcpServers": {
    "mcp-gcp-mock": {
      "command": "node",
      "args": ["packages/mcp-gcp-mock/dist/index.js"]
    }
  }
}
```

### Datasets disponibles

| Dataset          | Records | Descripción                                                                                                                           |
| ---------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `ventas-credito` | 5,000   | Ventas a crédito de productos Macropay (motos, celulares, bicicletas, audio, pantallas, tablets, consolas, climatización, accesorios) |

### Campos del dataset `ventas-credito`

| Campo                 | Tipo                | Ejemplo                                                                                                                      |
| --------------------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `id`                  | string              | `VTA-00001`                                                                                                                  |
| `fecha_venta`         | string (YYYY-MM-DD) | `2025-07-14`                                                                                                                 |
| `cliente`             | string              | `Uriel Lucio Cardona`                                                                                                        |
| `edad_cliente`        | number              | `55`                                                                                                                         |
| `genero`              | string              | `M` / `F`                                                                                                                    |
| `estado`              | string              | `Hidalgo`                                                                                                                    |
| `ciudad`              | string              | `San Juan del Río`                                                                                                           |
| `sucursal`            | string              | `San Juan del Río Express`                                                                                                   |
| `categoria`           | string              | `Motos`, `Celulares`, `Bicicletas Eléctricas`, `Pantallas/TV`, `Audio`, `Tablets`, `Consolas`, `Climatización`, `Accesorios` |
| `producto`            | string              | `SAMSUNG A07 128GB AZUL`                                                                                                     |
| `color`               | string              | `Azul`                                                                                                                       |
| `precio_contado`      | number              | `2999`                                                                                                                       |
| `enganche`            | number              | `360`                                                                                                                        |
| `monto_financiado`    | number              | `2639`                                                                                                                       |
| `tasa_interes`        | number              | `0.29`                                                                                                                       |
| `monto_total_credito` | number              | `3404`                                                                                                                       |
| `plazo_semanas`       | number              | `48`                                                                                                                         |
| `pago_semanal`        | number              | `71`                                                                                                                         |
| `semanas_pagadas`     | number              | `11`                                                                                                                         |
| `estatus_credito`     | string              | `al_corriente`, `atrasado`, `liquidado`, `cancelado`                                                                         |
| `canal_venta`         | string              | `tienda_fisica`, `en_linea`, `telefono`                                                                                      |
| `vendedor`            | string              | `Cristobal Carrillo`                                                                                                         |

## [ON-DEMAND] Tools Reference

### list_datasets

Lista todos los datasets disponibles con sus campos y conteo de registros.

**Params**: ninguno

**Returns**: Texto con nombre, campo y conteo por dataset.

### query_data

Consulta datos de un dataset con filtros opcionales y límite.

**Params**:

```typescript
{
  dataset: string;            // Nombre del dataset (e.g. "ventas-credito")
  filters?: {                 // Filtros (exact match o range)
    [campo]: valor            // Exact: { "categoria": "Motos" }
    [campo]: {                // Range: { "fecha_venta": { "gte": "2025-07-01", "lte": "2025-07-31" } }
      gte?: string | number;
      lte?: string | number;
      gt?: string | number;
      lt?: string | number;
    }
  };
  limit?: number;             // Máximo de registros a retornar
}
```

**Returns**: `{ dataset, records, totalRecords, fields }`

## [ON-DEMAND] Data Generation

Para regenerar los datos mock:

```bash
node packages/mcp-gcp-mock/scripts/generate-ventas.mjs
```

El catálogo de productos se basa en el catálogo real de [macropay.mx/tienda](https://macropay.mx/tienda/).

## [ON-DEMAND] Production Path

En producción este MCP se reemplaza por un conector real a GCP BigQuery / SAP. La interfaz de tools (`list_datasets`, `describe_dataset`, `query_data`) se mantiene idéntica.

