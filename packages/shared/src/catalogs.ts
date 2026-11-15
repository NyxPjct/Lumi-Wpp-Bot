import {lensTypes, validRange, type LensType, type PriceRange} from './pricing';

export interface CatalogProduct extends PriceRange {
  code: string;
  name: string;
  lensType: LensType;
  treatments: string;
  refractiveIndex: string;
  notes: string;
}
export interface PriceCatalog {
  id: string;
  revision: string;
  name: string;
  brand: string;
  validFrom: string;
  validUntil: string | null;
  updatedAt: string;
  sourceFile: string;
  products: CatalogProduct[];
}
export interface CatalogQuoteSource {
  catalogId: string;
  revision: string;
  tableName: string;
  brand: string;
  productCode: string;
  productName: string;
  treatments: string;
  refractiveIndex: string;
  notes: string;
}
export const catalogLimit = 1000;
export function validDate(value: unknown): value is string {
  return typeof value === 'string' && /^20\d{2}-\d{2}-\d{2}$/.test(value)
    && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
}
export function businessDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
  return ['year','month','day'].map(type => parts.find(part => part.type === type)!.value).join('-');
}
export function catalogStatus(table: PriceCatalog, today = businessDate()): 'active' | 'scheduled' | 'expired' {
  return table.validFrom > today ? 'scheduled' : table.validUntil && table.validUntil < today ? 'expired' : 'active';
}
const text = (value: unknown, min: number, max: number): value is string => typeof value === 'string' && value === value.trim() && value.length >= min && value.length <= max;
export function readCatalog(input: unknown): PriceCatalog | null {
  if (!input || typeof input !== 'object') return null;
  const row = input as PriceCatalog;
  if (!text(row.id,1,80) || !text(row.revision,1,80) || !text(row.name,2,100) || !text(row.brand,2,80)
    || !validDate(row.validFrom) || (row.validUntil !== null && (!validDate(row.validUntil) || row.validUntil < row.validFrom))
    || typeof row.updatedAt !== 'string' || Number.isNaN(Date.parse(row.updatedAt)) || !text(row.sourceFile,1,180)
    || !Array.isArray(row.products) || !row.products.length || row.products.length > catalogLimit) return null;
  const codes = new Set<string>();
  for (const item of row.products) {
    if (!item || !text(item.code,1,80) || !text(item.name,1,160) || !lensTypes.includes(item.lensType) || !validRange(item) || item.minimumCents <= 0
      || !text(item.treatments,0,300) || !text(item.refractiveIndex,0,30) || !text(item.notes,0,500) || codes.has(item.code)) return null;
    codes.add(item.code);
  }
  return row;
}
export function catalogSource(table: PriceCatalog, item: CatalogProduct): CatalogQuoteSource {
  return {catalogId:table.id,revision:table.revision,tableName:table.name,brand:table.brand,productCode:item.code,productName:item.name,treatments:item.treatments,refractiveIndex:item.refractiveIndex,notes:item.notes};
}
