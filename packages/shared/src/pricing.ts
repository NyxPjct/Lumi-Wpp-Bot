export const lensTypes = ['single', 'multifocal', 'occupational'] as const;
export const treatmentTypes = ['antireflective', 'blue_filter', 'photochromic'] as const;
export type LensType = typeof lensTypes[number];
export type Treatment = typeof treatmentTypes[number];
export const lensLabels: Record<LensType, string> = {single: 'Visão simples', multifocal: 'Multifocal', occupational: 'Ocupacional'};
export const treatmentLabels: Record<Treatment, string> = {antireflective: 'Antirreflexo', blue_filter: 'Filtro de luz azul', photochromic: 'Fotossensível'};
export interface PriceRange {minimumCents: number; maximumCents: number}
export interface PriceTable {
  lenses: Partial<Record<LensType, PriceRange>>;
  treatments: Partial<Record<Treatment, PriceRange>>;
}
export interface QuoteEstimate extends PriceRange {lensType: LensType; treatments: Treatment[]}
export const maxPriceCents = 100_000_000;
export const emptyPriceTable = (): PriceTable => ({lenses: {}, treatments: {}});
export const demoPriceTable: PriceTable = {
  lenses: {single: {minimumCents:15000, maximumCents:30000}, multifocal:{minimumCents:45000,maximumCents:90000}, occupational:{minimumCents:35000,maximumCents:65000}},
  treatments: {antireflective:{minimumCents:5000,maximumCents:12000}, blue_filter:{minimumCents:8000,maximumCents:18000}, photochromic:{minimumCents:15000,maximumCents:35000}},
};
export const formatMoney = (cents: number) => new Intl.NumberFormat('pt-BR', {style:'currency',currency:'BRL'}).format(cents / 100);
export const formatRange = (range: PriceRange) => `${formatMoney(range.minimumCents)} a ${formatMoney(range.maximumCents)}`;
export function validRange(input: unknown): input is PriceRange {
  if (!input || typeof input !== 'object') return false;
  const value = input as PriceRange;
  return Number.isSafeInteger(value.minimumCents) && Number.isSafeInteger(value.maximumCents)
    && value.minimumCents >= 0 && value.maximumCents <= maxPriceCents && value.maximumCents >= value.minimumCents;
}
export function completePriceTable(table: PriceTable): boolean {
  return lensTypes.every(key => validRange(table.lenses[key])) && treatmentTypes.every(key => validRange(table.treatments[key]));
}
// Accept Brazilian decimals without using floating-point arithmetic or rounding.
export function parseMoney(input: string): number | null {
  const text = input.trim();
  if (!/^\d{1,7}(?:,\d{1,2})?$/.test(text)) return null;
  const [whole, fraction = ''] = text.split(',');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2,'0'));
  return cents <= maxPriceCents ? cents : null;
}
export function estimateQuote(table: PriceTable | undefined, lensType: LensType, treatments: Treatment[]): QuoteEstimate | null {
  if (!lensTypes.includes(lensType) || treatments.length > 3 || new Set(treatments).size !== treatments.length || treatments.some(key => !treatmentTypes.includes(key))) return null;
  const base = table?.lenses[lensType];
  if (!validRange(base)) return null;
  let minimumCents = base.minimumCents; let maximumCents = base.maximumCents;
  for (const key of treatments) {
    const addon = table?.treatments[key];
    if (!validRange(addon)) return null;
    minimumCents += addon.minimumCents; maximumCents += addon.maximumCents;
  }
  return {lensType,treatments:[...treatments].sort(),minimumCents,maximumCents};
}
export const quoteStatuses = ['new','in_service','won','lost'] as const;
export type QuoteStatus = typeof quoteStatuses[number];
export const statusLabels: Record<QuoteStatus,string> = {new:'Novo',in_service:'Em atendimento',won:'Fechado',lost:'Perdido'};
export function readPriceTable(input: unknown): PriceTable | null {
  if (!input || typeof input !== 'object') return null;
  const raw = input as Record<string, unknown>;
  if (!raw.lenses || typeof raw.lenses !== 'object' || !raw.treatments || typeof raw.treatments !== 'object') return null;
  const table = emptyPriceTable();
  for (const key of lensTypes) {
    const range = (raw.lenses as Record<string, unknown>)[key];
    if (range !== undefined) {if (!validRange(range)) return null; table.lenses[key] = {minimumCents:range.minimumCents,maximumCents:range.maximumCents};}
  }
  for (const key of treatmentTypes) {
    const range = (raw.treatments as Record<string, unknown>)[key];
    if (range !== undefined) {if (!validRange(range)) return null; table.treatments[key] = {minimumCents:range.minimumCents,maximumCents:range.maximumCents};}
  }
  return table;
}
