/**
 * Generates 5,000 mock sales records based on Macropay's full product catalog (macropay.mx/tienda).
 * Categories: motos, celulares, bicicletas eléctricas, pantallas, audio, tablets, consolas, climatización, accesorios.
 * Output: packages/mcp-gcp-mock/data/ventas-credito.json
 */

import { faker } from '@faker-js/faker/locale/es_MX';
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = join(__dirname, '../data/ventas-credito.json');

// ─── Product Catalog (from macropay.mx/tienda — all pages) ─

const CATEGORIAS = {
  motos: {
    productos: [
      { nombre: 'MOTO BDS RHINO 200CC', precio: 45999 },
      { nombre: 'MOTO BAJAJ PULSAR N 125CC', precio: 42999 },
      { nombre: 'MOTO BAJAJ PULSAR N 160CC', precio: 47999 },
      { nombre: 'MOTO BDS MAGMA 150CC', precio: 29999 },
      { nombre: 'MOTO VELOCI NOVAK EVO SPORT 150CC', precio: 22999 },
      { nombre: 'MOTO VELOCI BREAKSTORM SPORT 330CC', precio: 41999 },
      { nombre: 'MOTO DINAMO MOTO-TX 200CC', precio: 82999 },
      { nombre: 'MOTO VELOCI RUBAK EVO SPORT 220CC', precio: 23999 },
      { nombre: 'MOTO VELOCI SNAKE GT TRAIL 250CC', precio: 36999 },
      { nombre: 'MOTO VELOCI BOXTER RT3 220CC', precio: 19999 },
      { nombre: 'MOTO BDS CASTORO 180CC', precio: 31499 },
      { nombre: 'MOTO VELOCI THYRON EVO SPORT 200CC', precio: 27999 },
    ],
    colores: [
      'Rojo',
      'Azul',
      'Negro',
      'Gris',
      'Blanco',
      'Amarillo',
      'Naranja',
      'Morado',
      'Verde',
      'Citrus',
      'Purpura',
    ],
  },
  celulares: {
    productos: [
      { nombre: 'SAMSUNG A57 256GB', precio: 12299 },
      { nombre: 'SAMSUNG A37 256GB', precio: 9799 },
      { nombre: 'SAMSUNG A07 128GB', precio: 2999 },
      { nombre: 'TECNO SPARK GO3 4GB 128GB', precio: 2799 },
      { nombre: 'MOTO EDGE60 FSN 256GB', precio: 8499 },
      { nombre: 'HONOR X5C PLUS 256GB', precio: 3799 },
    ],
    colores: [
      'Azul',
      'Gris',
      'Blanco',
      'Morado',
      'Verde',
      'Rosa',
      'Negro',
      'Lila',
      'Marino',
      'Plata',
    ],
  },
  bicicletas_electricas: {
    productos: [
      { nombre: 'BICICLETA ELEC KIWO SH801 NACIONAL', precio: 7299 },
      { nombre: 'BICICLETA ELECTRICA YADEA TEENA', precio: 11999 },
    ],
    colores: ['Blanco', 'Negro', 'Rosa', 'Verde', 'Azul'],
  },
  pantallas: {
    productos: [
      { nombre: 'PANTALLA SMART TV MORA 32" 32D4N', precio: 2699 },
      { nombre: 'PANTALLA SMART TV MORA 40" 40D4N', precio: 4299 },
      { nombre: 'PANTALLA SMART TV MORA 50" 50D4N', precio: 6499 },
    ],
    colores: ['Negro'],
  },
  audio: {
    productos: [
      { nombre: 'BOCINA BT RESISTENTE AL AGUA VE2025', precio: 799 },
      { nombre: 'BOCINA BT LUCES BB-S77262 BILLBOARD', precio: 1499 },
      { nombre: 'BAFLE BT KAISER MSA-7515MX', precio: 2399 },
      { nombre: 'BAFLE RECARGABLE KAISER MSA-2016 SR', precio: 3799 },
      { nombre: 'MINI BAFLE BLOCK KSW-3008 KAISER', precio: 999 },
      { nombre: 'BAFLE RECARGABLE KSB4220 KAISER', precio: 3799 },
      { nombre: 'BARRA DE SONIDO TORRE STF ST-S75121', precio: 2399 },
    ],
    colores: ['Negro', 'Azul'],
  },
  tablets: {
    productos: [{ nombre: 'TABLETA TCL 10 GEN3 64GB', precio: 3499 }],
    colores: ['Grafito', 'Plateado'],
  },
  consolas: {
    productos: [{ nombre: 'NINTENDO SWITCH 2 MARIO KART', precio: 12499 }],
    colores: ['Negro Neon'],
  },
  climatizacion: {
    productos: [
      { nombre: 'AC PRIME EMPRC121 12BTU 110V', precio: 6999 },
      { nombre: 'AC PRIME EMPRC181 18BTU 220V', precio: 9499 },
      { nombre: 'AC MIRAGE NEX 12BTU 110V SETCHF120T', precio: 6999 },
      { nombre: 'VENTILADOR PEDESTAL 16 PULG PRKT16', precio: 799 },
    ],
    colores: ['Blanco'],
  },
  accesorios: {
    productos: [
      { nombre: 'BOLSA TELEFONO MUNDIAL PPF26BK01', precio: 299 },
      { nombre: 'HIELERA PARRILLA 2 EN 1 MUNDIAL SMHR5', precio: 649 },
      { nombre: 'HIELERA BOLSO CAP 36 LATAS MUNDIAL SMHR2', precio: 649 },
      { nombre: 'BANCO HIELERA 20L MUNDIAL SMFCG', precio: 649 },
      { nombre: 'PULSERA MUNDIAL WF26WH04', precio: 39 },
      { nombre: 'TERMO PLAST MUNDIAL PBF26MEXGR6204', precio: 249 },
    ],
    colores: ['Negro', 'Blanco', 'Verde'],
  },
};

const ESTADOS_MEXICO = [
  'Aguascalientes',
  'Baja California',
  'Baja California Sur',
  'Campeche',
  'Chiapas',
  'Chihuahua',
  'Ciudad de México',
  'Coahuila',
  'Colima',
  'Durango',
  'Estado de México',
  'Guanajuato',
  'Guerrero',
  'Hidalgo',
  'Jalisco',
  'Michoacán',
  'Morelos',
  'Nayarit',
  'Nuevo León',
  'Oaxaca',
  'Puebla',
  'Querétaro',
  'Quintana Roo',
  'San Luis Potosí',
  'Sinaloa',
  'Sonora',
  'Tabasco',
  'Tamaulipas',
  'Tlaxcala',
  'Veracruz',
  'Yucatán',
  'Zacatecas',
];

const SUCURSALES = [
  'Centro',
  'Norte',
  'Sur',
  'Plaza Principal',
  'Outlet',
  'Express',
];
const PLAZOS_SEMANAS = [12, 24, 36, 48, 52, 78];

// ─── Generator ─────────────────────────────────────────────

function generateRecord(id) {
  const categoriaKeys = Object.keys(CATEGORIAS);
  // Weighted: motos/celulares most popular, accesorios least
  const weights = [28, 28, 10, 7, 8, 4, 4, 5, 6];
  const categoriaKey = weightedRandom(categoriaKeys, weights);
  const categoria = CATEGORIAS[categoriaKey];

  const producto = faker.helpers.arrayElement(categoria.productos);
  const color = faker.helpers.arrayElement(categoria.colores);
  const estado = faker.helpers.arrayElement(ESTADOS_MEXICO);
  const ciudad = faker.location.city();
  const sucursal = `${ciudad} ${faker.helpers.arrayElement(SUCURSALES)}`;

  const plazoSemanas = faker.helpers.arrayElement(PLAZOS_SEMANAS);
  const enganche = Math.round(
    producto.precio *
      faker.number.float({ min: 0.1, max: 0.3, fractionDigits: 2 }),
  );
  const montoFinanciado = producto.precio - enganche;
  const tasaInteres = faker.number.float({
    min: 0.15,
    max: 0.45,
    fractionDigits: 2,
  });
  const montoTotal = Math.round(montoFinanciado * (1 + tasaInteres));
  const pagoSemanal = Math.round(montoTotal / plazoSemanas);

  const fechaVenta = faker.date.between({
    from: '2024-01-01',
    to: '2025-07-31',
  });
  const semanasTranscurridas = Math.floor(
    (new Date('2025-08-01').getTime() - fechaVenta.getTime()) /
      (7 * 24 * 60 * 60 * 1000),
  );

  const estatusCredito = determineStatus(plazoSemanas, semanasTranscurridas);
  const semanasPagadas = calculatePaidWeeks(
    estatusCredito,
    plazoSemanas,
    semanasTranscurridas,
  );

  return {
    id: `VTA-${String(id).padStart(5, '0')}`,
    fecha_venta: fechaVenta.toISOString().split('T')[0],
    cliente: faker.person.fullName(),
    edad_cliente: faker.number.int({ min: 18, max: 65 }),
    genero: faker.helpers.arrayElement(['M', 'F']),
    estado,
    ciudad,
    sucursal,
    categoria: formatCategoria(categoriaKey),
    producto: `${producto.nombre} ${color.toUpperCase()}`,
    color,
    precio_contado: producto.precio,
    enganche,
    monto_financiado: montoFinanciado,
    tasa_interes: tasaInteres,
    monto_total_credito: montoTotal,
    plazo_semanas: plazoSemanas,
    pago_semanal: pagoSemanal,
    semanas_pagadas: semanasPagadas,
    estatus_credito: estatusCredito,
    canal_venta: faker.helpers.weightedArrayElement([
      { value: 'tienda_fisica', weight: 70 },
      { value: 'en_linea', weight: 20 },
      { value: 'telefono', weight: 10 },
    ]),
    vendedor: faker.person.fullName(),
  };
}

function determineStatus(plazoSemanas, semanasTranscurridas) {
  if (semanasTranscurridas >= plazoSemanas) {
    return faker.helpers.weightedArrayElement([
      { value: 'liquidado', weight: 75 },
      { value: 'atrasado', weight: 15 },
      { value: 'cancelado', weight: 10 },
    ]);
  }
  return faker.helpers.weightedArrayElement([
    { value: 'al_corriente', weight: 70 },
    { value: 'atrasado', weight: 20 },
    { value: 'cancelado', weight: 10 },
  ]);
}

function calculatePaidWeeks(estatus, plazoSemanas, semanasTranscurridas) {
  if (semanasTranscurridas <= 0) return 0;
  switch (estatus) {
    case 'liquidado':
      return plazoSemanas;
    case 'cancelado':
      return faker.number.int({
        min: 1,
        max: Math.max(1, Math.min(semanasTranscurridas, plazoSemanas - 1)),
      });
    case 'atrasado':
      return Math.max(
        0,
        Math.min(semanasTranscurridas, plazoSemanas) -
          faker.number.int({ min: 2, max: 8 }),
      );
    default: // al_corriente
      return Math.min(semanasTranscurridas, plazoSemanas);
  }
}

function weightedRandom(items, weights) {
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  let random = Math.random() * totalWeight;
  for (let i = 0; i < items.length; i++) {
    random -= weights[i];
    if (random <= 0) return items[i];
  }
  return items[items.length - 1];
}

function formatCategoria(key) {
  const map = {
    motos: 'Motos',
    celulares: 'Celulares',
    bicicletas_electricas: 'Bicicletas Eléctricas',
    pantallas: 'Pantallas/TV',
    audio: 'Audio',
    tablets: 'Tablets',
    consolas: 'Consolas',
    climatizacion: 'Climatización',
    accesorios: 'Accesorios',
  };
  return map[key] || key;
}

// ─── Main ──────────────────────────────────────────────────

console.log(
  'Generating 5,000 sales records from macropay.mx/tienda catalog...',
);
const records = [];

for (let i = 1; i <= 5000; i++) {
  records.push(generateRecord(i));
}

writeFileSync(OUTPUT_PATH, JSON.stringify(records, null, 2), 'utf-8');
console.log(`Done! Written to ${OUTPUT_PATH}`);
console.log(`Records: ${records.length}`);
console.log(
  `File size: ${(Buffer.byteLength(JSON.stringify(records)) / 1024 / 1024).toFixed(2)} MB`,
);

// Quick stats
const categoryCounts = {};
records.forEach((r) => {
  categoryCounts[r.categoria] = (categoryCounts[r.categoria] || 0) + 1;
});
console.log('\nDistribution by category:');
Object.entries(categoryCounts)
  .sort((a, b) => b[1] - a[1])
  .forEach(([cat, count]) =>
    console.log(`  ${cat}: ${count} (${((count / 5000) * 100).toFixed(1)}%)`),
  );

