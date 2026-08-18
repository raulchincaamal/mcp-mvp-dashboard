'use client';

import AuroraChart from '@/shared/components/AuroraChart';

// ─── Datasets ──────────────────────────────────────────────

const BAR_DATA = {
  labels: ['Motos', 'Celulares', 'Tablets', 'Audio', 'TV', 'Consolas'],
  datasets: [{ label: 'Ventas', data: [420, 310, 180, 260, 140, 200] }],
};

const MULTI_BAR = {
  labels: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun'],
  datasets: [
    { label: '2025', data: [420, 380, 510, 470, 530, 490] },
    { label: '2024', data: [310, 290, 400, 350, 410, 370] },
  ],
};

const LINE_DATA = {
  labels: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul'],
  datasets: [
    { label: '2025', data: [65, 78, 90, 81, 95, 110, 102] },
    { label: '2024', data: [50, 60, 70, 65, 80, 85, 78] },
  ],
};

const PIE_DATA = {
  labels: ['Motos', 'Celulares', 'Tablets', 'Audio', 'TV', 'Consolas'],
  datasets: [{ data: [420, 310, 180, 260, 140, 200] }],
};

// Scatter: labels = x (precio), data = y (plazo semanas)
const SCATTER_DATA = {
  labels: ['8500','12000','15000','9800','22000','18000','7500','25000','11000','16500'],
  datasets: [
    { label: 'Motos',    data: [52, 78, 104, 65, 130, 91, 39, 156, 65, 104] },
    { label: 'Celulares',data: [26, 39, 52, 32, 65, 45, 20, 78, 32, 52] },
  ],
};

// Radar: categorías en múltiples métricas
const RADAR_DATA = {
  labels: ['Ventas', 'Ticket Prom', 'Créditos', 'Pagos OK', 'Conversión'],
  datasets: [
    { label: 'Motos',    data: [420, 85, 380, 72, 68] },
    { label: 'Celulares',data: [310, 45, 290, 88, 82] },
  ],
};

// Funnel: canal de venta
const FUNNEL_DATA = {
  labels: ['Visitas', 'Interesados', 'Cotizaciones', 'Contratos', 'Pagados'],
  datasets: [{ data: [5000, 2800, 1200, 680, 420] }],
};

// Gauge: % créditos al corriente
const GAUGE_DATA = {
  labels: ['Al corriente'],
  datasets: [{ data: [73] }],
};

// Heatmap: ventas por estado (rows) × mes (cols)
const HEATMAP_DATA = {
  labels: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun'],
  datasets: [
    { label: 'CDMX',       data: [82, 74, 91, 88, 95, 103] },
    { label: 'Jalisco',    data: [61, 58, 72, 69, 78, 84] },
    { label: 'NL',         data: [54, 49, 63, 60, 71, 76] },
    { label: 'Puebla',     data: [38, 35, 44, 42, 50, 55] },
    { label: 'Veracruz',   data: [29, 27, 33, 31, 38, 41] },
  ],
};

// Treemap: monto financiado por categoría
const TREEMAP_DATA = {
  labels: ['Motos', 'Celulares', 'Bicicletas E.', 'Pantallas', 'Audio', 'Tablets', 'Consolas', 'Climatización', 'Accesorios'],
  datasets: [{ data: [4200000, 1860000, 980000, 1540000, 620000, 740000, 890000, 1120000, 310000] }],
};

// ─── Section divider ────────────────────────────────────────

function Section({ label }: { label: string }) {
  return (
    <div style={{ gridColumn: '1 / -1', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.4rem', marginTop: '0.5rem' }}>
      <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
        {label}
      </span>
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────

export default function ChartsDemoPage() {
  return (
    <main style={{ minHeight: '100vh', background: 'var(--bg)', padding: '2rem' }}>
      <h1 style={{ color: 'var(--text)', fontSize: '1.1rem', fontWeight: 700, marginBottom: '2rem', textAlign: 'center' }}>
        Aurora Charts — Todos los tipos
      </h1>

      <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>

        <Section label="Bar" />
        <AuroraChart type="bar" data={BAR_DATA}   title="Bar — single dataset"  gradient="aurora" height={260} />
        <AuroraChart type="bar" data={MULTI_BAR}  title="Bar — multi dataset"   gradient="aurora" height={260} />

        <Section label="Line" />
        <AuroraChart type="line" data={LINE_DATA} title="Line — multi dataset"  gradient="aurora" height={260} />
        <AuroraChart type="line" data={LINE_DATA} title="Line — Neon"           gradient="neon"   height={260} />

        <Section label="Area" />
        <AuroraChart type="area" data={LINE_DATA} title="Area — Aurora"         gradient="aurora" height={260} />
        <AuroraChart type="area" data={LINE_DATA} title="Area — Ocean"          gradient="ocean"  height={260} />

        <Section label="Pie & Doughnut" />
        <AuroraChart type="pie"      data={PIE_DATA} title="Pie"      gradient="aurora" height={300} />
        <AuroraChart type="doughnut" data={PIE_DATA} title="Doughnut" gradient="aurora" height={300} />

        <Section label="Scatter — correlación precio vs plazo" />
        <AuroraChart type="scatter" data={SCATTER_DATA} title="Scatter — Precio vs Semanas" gradient="aurora" height={280} />
        <AuroraChart type="scatter" data={SCATTER_DATA} title="Scatter — Neon"              gradient="neon"   height={280} />

        <Section label="Radar — comparación de métricas por categoría" />
        <AuroraChart type="radar" data={RADAR_DATA} title="Radar — Aurora" gradient="aurora" height={300} />
        <AuroraChart type="radar" data={RADAR_DATA} title="Radar — Ocean"  gradient="ocean"  height={300} />

        <Section label="Funnel — embudo de conversión" />
        <AuroraChart type="funnel" data={FUNNEL_DATA} title="Funnel — Canal de venta" gradient="aurora" height={300} />
        <AuroraChart type="funnel" data={FUNNEL_DATA} title="Funnel — Fire"           gradient="fire"   height={300} />

        <Section label="Gauge — KPI de cumplimiento" />
        <AuroraChart type="gauge" data={GAUGE_DATA} title="Gauge — % Créditos al corriente" gradient="aurora" height={280} />
        <AuroraChart type="gauge" data={{ labels: ['Cobranza'], datasets: [{ data: [58] }] }} title="Gauge — % Cobranza efectiva" gradient="ocean" height={280} />

        <Section label="Heatmap — ventas por estado × mes" />
        <div style={{ gridColumn: '1 / -1' }}>
          <AuroraChart type="heatmap" data={HEATMAP_DATA} title="Heatmap — Ventas por Estado y Mes" gradient="aurora" height={260} />
        </div>

        <Section label="Treemap — distribución de monto financiado" />
        <div style={{ gridColumn: '1 / -1' }}>
          <AuroraChart type="treemap" data={TREEMAP_DATA} title="Treemap — Monto Financiado por Categoría" gradient="aurora" height={320} />
        </div>

      </div>
    </main>
  );
}
