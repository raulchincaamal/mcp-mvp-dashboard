# Fase 1: Validación de Amazon Nova Pro - Reporte

**Fecha:** 2025-01-XX  
**Modelo:** `amazon.nova-pro-v1:0`  
**Región:** `us-east-1`  
**Estado:** ✅ VALIDADO

---

## 1. Configuración Actual

### Model ID
```
BEDROCK_MODEL_ID=amazon.nova-pro-v1:0
```
✅ **Correcto** - El model ID es válido para Nova Pro en us-east-1.

### Arquitectura Actual
```
POST /api/generate-ui
    ↓
orchestrate()
    ├── validateIntent()
    ├── normalizeDateExpressions()
    ├── normalizeFieldSynonyms()
    ├── interpretIntent() → Bedrock Call #1 (parse intent → JSON)
    ├── gcpClient.callTool('query_data') → MCP Call
    ├── [special handlers: findExtreme, trendAnalysis, correlation, etc.]
    └── generateUIConfig() → Bedrock Call #2 (data → UIConfig)
```

**Observación:** NO usa tool use nativo de Bedrock. La orquestación es manual.

---

## 2. Métricas de Rendimiento

| Intent | Latencia | Componentes | Observación |
|--------|----------|-------------|-------------|
| "resumen ejecutivo" | 13,989ms | 5 | Template executive completo |
| "ventas de motos por estado" | 10,307ms | 2 | KPIGrid + Chart |
| "ventas de motos" | ~8,000ms | 5 | Cached después |
| "grafica de pastel por categoria" | ~9,000ms | 2 | Pie chart correcto |
| "los 5 mejores vendedores" | ~10,000ms | 2 | TopBottom funciona |
| "tendencia de ventas por mes" | ~11,000ms | 4 | Análisis temporal |
| "correlacion entre edad y monto" | ~9,000ms | 3 | Cálculo estadístico |

**Latencia promedio:** ~10 segundos (sin cache)

### Desglose de Latencia Estimado
- Bedrock Call #1 (interpretIntent): ~2-3s
- MCP query_data: ~0.5s
- Bedrock Call #2 (generateUIConfig): ~6-8s
- Overhead (normalization, handlers): ~0.5s

---

## 3. Funcionalidades Validadas

### ✅ Funcionando Correctamente

| Feature | Test | Resultado |
|---------|------|-----------|
| Intent parsing | "ventas de motos" | `filters: { categoria: "Motos" }` |
| GroupBy detection | "por estado" | `groupBy: "estado"` |
| Chart type | "grafica de pastel" | `chartTypes: ["pie"]` |
| Date normalization | "este mes" | Rango concreto |
| TopBottom | "los 5 mejores" | `topBottom: { type: "top", count: 5 }` |
| Trend analysis | "tendencia" | `trendAnalysis: true` |
| Correlation | "correlacion entre X y Y" | `correlation: { fields: [...] }` |
| Template detection | "resumen ejecutivo" | `template: "executive"` |
| Credit status | "creditos atrasados" | `filters: { estatus_credito: "atrasado" }` |
| Field synonyms | "CDMX" → "Ciudad de México" | ✅ |
| Validation | "hola" (greeting) | Respuesta amigable |

### ⚠️ Áreas de Mejora Identificadas

1. **Latencia alta** (~10s): Dos llamadas a Bedrock secuenciales
2. **No usa tool use nativo**: Orquestación manual en código
3. **Tokens desperdiciados**: System prompt repetido en cada llamada
4. **Sin streaming**: Usuario espera toda la respuesta

---

## 4. Estructura de Respuesta de Nova Pro

### interpretIntent() Response
```json
{
  "filters": { "categoria": "Motos" },
  "groupBy": "estado",
  "metric": "count",
  "metricField": null,
  "chartTypes": ["bar"],
  "template": "chart",
  "limit": 100,
  "title": null
}
```
✅ Nova Pro genera JSON válido consistentemente.

### generateUIConfig() Response
```json
{
  "title": "Ventas de Motos por Estado",
  "layout": "vertical",
  "components": [
    { "component": "KPIGrid", "props": {...} },
    { "component": "Chart", "props": {...} }
  ]
}
```
✅ UIConfig válido, renderizable por DynamicRenderer.

---

## 5. Comparación: Arquitectura Actual vs Tool Use Nativo

| Aspecto | Actual (Manual) | Tool Use Nativo |
|---------|-----------------|-----------------|
| Llamadas Bedrock | 2 (fijas) | 1-3 (dinámicas) |
| Decisión de herramientas | Código | Modelo |
| Flexibilidad | Baja | Alta |
| Latencia | ~10s | ~8-12s (variable) |
| Complejidad código | Alta | Media |
| Encadenamiento | Manual | Automático |

---

## 6. Fase 2: Tool Use Nativo - IMPLEMENTADO

### Archivos Creados/Modificados

| Archivo | Cambio |
|---------|--------|
| `orchestrator-tooluse.ts` | Nuevo orchestrator con tool use nativo |
| `index.ts` | Soporte para alternar entre orchestrators |
| `.env` | Nueva variable `USE_TOOL_USE` |

### Cómo Activar Tool Use Nativo

```bash
# En packages/mcp-main/.env
USE_TOOL_USE=true

# Reiniciar servidor
npm run start
```

### Tools Definidos para Bedrock

```typescript
// query_data
{
  name: 'query_data',
  description: 'Consulta el dataset de ventas a crédito de Macropay',
  inputSchema: {
    filters: { type: 'object' },
    limit: { type: 'number', default: 100 }
  }
}

// generate_dashboard  
{
  name: 'generate_dashboard',
  description: 'Genera un UIConfig JSON para renderizar un dashboard',
  inputSchema: {
    title: { type: 'string' },
    template: { enum: ['executive', 'chart', 'table', 'credit', 'category'] },
    groupBy: { type: 'string' },
    chartType: { enum: ['bar', 'line', 'pie', 'doughnut'] },
    records: { type: 'array' }
  }
}
```

### Flujo del Tool Use Loop

```
1. Usuario envía intent
        ↓
2. Bedrock recibe system prompt + tools
        ↓
3. Nova decide: ¿necesito datos? → tool_use: query_data
        ↓
4. Orchestrator ejecuta query_data → MCP → records
        ↓
5. Nova recibe datos, decide: generar dashboard → tool_use: generate_dashboard
        ↓
6. Orchestrator ejecuta generate_dashboard → UIConfig
        ↓
7. Nova confirma → end_turn
        ↓
8. Retornar UIConfig
```

### Ventajas del Tool Use Nativo

- Nova Pro decide dinámicamente qué herramientas usar
- Puede encadenar múltiples consultas si es necesario
- Más natural para consultas complejas
- Código de orquestación más simple

### Pendiente Validar

- [ ] Latencia comparada con modo manual
- [ ] Calidad de UIConfig generado
- [ ] Manejo de errores en el loop
- [ ] Casos edge (sin resultados, filtros inválidos)

---

## 7. Recomendaciones para Fase 3

### Prioridad Alta
1. **Implementar tool use nativo** para que Nova Pro decida cuándo consultar datos
2. **Reducir llamadas** combinando interpretación + generación en un solo loop
3. **Agregar streaming** para mejor UX

### Prioridad Media
4. **Cache de system prompts** (si Bedrock lo soporta)
5. **Métricas de observabilidad** (tokens, latencia por fase)
6. **Retry con backoff** para errores transitorios

### Prioridad Baja
7. **Multimodalidad** (imágenes de productos)
8. **Comparación con Claude** para casos específicos

---

## 7. Conclusión Fase 1

**Estado:** ✅ VALIDADO

Nova Pro funciona correctamente con la arquitectura actual:
- Interpreta intents en español con alta precisión
- Genera UIConfig válido y rico
- Maneja casos especiales (tendencias, correlaciones, top/bottom)
- Latencia aceptable (~10s) pero mejorable

**Siguiente paso:** Fase 2 - Implementar tool use nativo de Bedrock para optimizar el flujo y reducir latencia.

---

## Anexo: Comandos de Test

```bash
# Health check
curl http://localhost:4000/health

# Test básico
curl -X POST http://localhost:4000/api/generate-ui \
  -H "Content-Type: application/json" \
  -d '{"intent": "ventas de motos por estado"}'

# Test con filtros
curl -X POST http://localhost:4000/api/generate-ui \
  -H "Content-Type: application/json" \
  -d '{"intent": "resumen ejecutivo", "filters": {"categoria": "Motos"}}'
```
