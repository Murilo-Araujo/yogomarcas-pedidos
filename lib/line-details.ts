import type {Flavor, Product} from './portal';
import {BUNDLE_UNITS} from './retention';

export type Preparation = {waterLitres?: number; minutes?: number; title: string; steps: string[]; note?: string};
export type LineDetailsData = {
  description: string;
  hasFlavors: boolean;
  preparation: Preparation | null;
  flavorCount: number;
  weightLabel: string;
  yieldLabel: string | null;
  bundleEnabled: boolean;
  bundleUnits: number;
};

// Preparation is transcribed in docs/catalog/prices-2026-09-05.json.
// Both catalogs use these instructions and the same live weights/yields.
function mixPreparation(waterLitres: number): Preparation {
  return {
    waterLitres, minutes: 2, title: 'Modo de preparo',
    steps: [
      `Misture o conteúdo de 1 pacote com ${waterLitres} litros de água.`,
      'Bata a mistura por 2 minutos.',
      'Utilize a calda na máquina, seguindo as orientações do fabricante para operação e incorporação de ar.',
    ],
  };
}

const PREPARATIONS: Record<string, Preparation> = {
  'YOGO-EI': mixPreparation(4),
  'YOGO-FY': mixPreparation(3),
  'YOGO-IG': mixPreparation(4),
  'YOGO-SAB': {
    title: 'Como usar com a base neutra',
    steps: [
      'Prepare a base neutra Saborize: misture 1 pacote de base com 4 litros de água e bata por 2 minutos.',
      'Adicione o saborizante à calda. A referência do catálogo é 1 colher de chá para cada 300 ml de calda.',
      'Misture e ajuste a dosagem conforme o sabor e o resultado desejado.',
    ],
    note: 'A base neutra é vendida separadamente. O saborizante é utilizado na calda já preparada.',
  },
  'YOGO-SAB-BASE': {
    waterLitres: 4, minutes: 2, title: 'Preparo da base neutra',
    steps: [
      'Misture o conteúdo de 1 pacote de base neutra com 4 litros de água.',
      'Bata a mistura por 2 minutos.',
      'Combine a calda com os saborizantes Saborize. Use como referência 1 colher de chá de saborizante para cada 300 ml de calda, ajustando a dosagem conforme o resultado desejado.',
    ],
    note: 'Os saborizantes são vendidos separadamente. Opere a máquina conforme as orientações do fabricante.',
  },
};

const number = (value: number) => value.toLocaleString('pt-BR', {maximumFractionDigits: 2});

// Only presentation data leaves this function: no prices or internal codes.
export function getLineDetails(product: Product, flavors: Flavor[]): LineDetailsData {
  const activeFlavors = flavors.filter(flavor => flavor.product_id === product.id && flavor.active);
  const weights = (product.has_flavors ? activeFlavors.map(flavor => flavor.package_weight_grams) : [product.package_weight_grams])
    .filter((weight): weight is number => typeof weight === 'number' && Number.isFinite(weight) && weight > 0);
  const minWeight = weights.length ? Math.min(...weights) : null;
  const maxWeight = weights.length ? Math.max(...weights) : null;
  const allWeightsKnown = !product.has_flavors || weights.length === activeFlavors.length;
  const weightLabel = minWeight && maxWeight && allWeightsKnown
    ? minWeight === maxWeight ? `${number(minWeight)} g` : `${number(minWeight)} a ${number(maxWeight)} g, conforme o sabor`
    : 'Consulte o peso na seleção do produto.';
  const maxYield = product.yield_grams, minYield = product.yield_min_grams;
  const showYield = product.sku !== 'YOGO-SAB' && typeof maxYield === 'number' && Number.isFinite(maxYield) && maxYield > 0;
  const yieldLabel = showYield
    ? minYield && minYield > 0 && minYield < maxYield ? `${number(minYield / 1000)} a ${number(maxYield / 1000)} kg` : `Cerca de ${number(maxYield / 1000)} kg`
    : null;
  return {
    description: product.description,
    hasFlavors: !!product.has_flavors,
    preparation: Object.hasOwn(PREPARATIONS, product.sku) ? PREPARATIONS[product.sku] : null,
    flavorCount: activeFlavors.length,
    weightLabel,
    yieldLabel,
    bundleEnabled: product.bundle_enabled !== false,
    bundleUnits: BUNDLE_UNITS,
  };
}
