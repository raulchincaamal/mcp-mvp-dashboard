# @mcp-mvp/mcp-gcp-mock

MCP Server que simula consultas de datos GCP/SAP usando fixtures JSON locales. Sirve como fuente de datos para el pipeline de generacion de dashboards.

## Rol en el Pipeline

```
mcp-main → [query_data] → mcp-gcp-mock → datos filtrados → mcp-ui
```

En produccion este paquete se reemplaza por un conector real a GCP BigQuery / SAP. La interfaz de tools se mantiene identica.

## Tools

| Tool            | Descripcion                                         |
| --------------- | --------------------------------------------------- |
| `list_datasets` | Lista datasets disponibles con campos y conteo      |
| `query_data`    | Consulta datos con filtros exactos, rangos y limite |

## Dataset: ventas-credito

5,000 registros de ventas a credito generados con `@faker-js/faker` basados en el catalogo real de [macropay.mx/tienda](https://macropay.mx/tienda/).

### Categorias

Motos, Celulares, Bicicletas Electricas, Pantallas/TV, Audio, Tablets, Consolas, Climatizacion, Accesorios

### Campos

| Campo                 | Tipo   | Descripcion                                  |
| --------------------- | ------ | -------------------------------------------- |
| `id`                  | string | ID unico (VTA-00001)                         |
| `fecha_venta`         | string | Fecha YYYY-MM-DD                             |
| `cliente`             | string | Nombre completo                              |
| `edad_cliente`        | number | Edad (18-65)                                 |
| `genero`              | string | M / F                                        |
| `estado`              | string | Estado de Mexico                             |
| `ciudad`              | string | Ciudad                                       |
| `sucursal`            | string | Nombre de sucursal                           |
| `categoria`           | string | Categoria del producto                       |
| `producto`            | string | Nombre completo con color                    |
| `color`               | string | Color del producto                           |
| `precio_contado`      | number | Precio en pesos                              |
| `enganche`            | number | Pago inicial                                 |
| `monto_financiado`    | number | Monto del credito                            |
| `tasa_interes`        | number | Tasa (0-1)                                   |
| `monto_total_credito` | number | Total a pagar                                |
| `plazo_semanas`       | number | Plazo en semanas                             |
| `pago_semanal`        | number | Pago por semana                              |
| `semanas_pagadas`     | number | Semanas ya pagadas                           |
| `estatus_credito`     | string | al_corriente, atrasado, liquidado, cancelado |
| `canal_venta`         | string | tienda_fisica, en_linea, telefono            |
| `vendedor`            | string | Nombre del vendedor                          |

## Filtros soportados

### Exact match

```json
{ "categoria": "Motos" }
```

### Range (fechas y numeros)

```json
{ "fecha_venta": { "gte": "2025-07-01", "lte": "2025-07-31" } }
```

Operadores: `gte` (>=), `lte` (<=), `gt` (>), `lt` (<)

## Regenerar datos

```bash
node scripts/generate-ventas.mjs
```

Requiere `@faker-js/faker` (ya incluido como dependencia).

## Build

```bash
npm run build    # Compila con tsup → dist/index.js
npm run dev      # Watch mode
```

## Configuracion MCP

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

