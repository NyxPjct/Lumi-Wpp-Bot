import type {SupabaseClient} from '@supabase/supabase-js';
import {lensTypes, treatmentTypes, quoteStatuses, type LensType, type Treatment, type QuoteStatus, type QuoteEstimate,type CatalogQuoteSource} from '@lumi/shared';
export interface StoredQuote {
  id: string;
  optic_id: string;
  request_id: string;
  lens_type: LensType;
  treatments: Treatment[];
  minimum_cents: number;
  maximum_cents: number;
  status: QuoteStatus;
  is_demo: true;
  created_at: string;
  catalog_source: CatalogQuoteSource | null;
}
export const quoteColumns = 'id,optic_id,request_id,lens_type,treatments,minimum_cents,maximum_cents,status,is_demo,created_at,catalog_source';
export function readQuote(input: unknown): StoredQuote {
  const row = input as StoredQuote | null;
  if (!row || typeof row.id !== 'string' || typeof row.optic_id !== 'string' || typeof row.request_id !== 'string' || typeof row.created_at !== 'string'
    || !lensTypes.includes(row.lens_type) || !Array.isArray(row.treatments) || row.treatments.some(key => !treatmentTypes.includes(key))
    || !quoteStatuses.includes(row.status) || row.is_demo !== true || !(Number.isSafeInteger(row.minimum_cents) && Number.isSafeInteger(row.maximum_cents) && row.minimum_cents >= 0 && row.maximum_cents >= row.minimum_cents && row.maximum_cents <= 4 * 100_000_000)) {
    throw new Error('O orçamento retornado pelo banco é inválido. Recarregue a lista.');
  }
  if(row.catalog_source!==null&&row.catalog_source!==undefined){
    const source=row.catalog_source;
    if(['catalogId','revision','tableName','brand','productCode','productName','treatments','refractiveIndex','notes'].some(key=>typeof source[key as keyof CatalogQuoteSource]!=='string'))throw new Error('Origem do orçamento inválida.');
  }
  return row;
}
export async function createTestQuote(db: SupabaseClient, opticId: string, requestId: string, estimate: QuoteEstimate): Promise<StoredQuote> {
  // Never send client-supplied amounts. The database prices the preferences itself.
  const {data,error} = estimate.source?await db.rpc('create_catalog_quote',{p_optic_id:opticId,p_request_id:requestId,p_catalog_id:estimate.source.catalogId,p_revision:estimate.source.revision,p_product_code:estimate.source.productCode}):await db.rpc('create_quote',{p_optic_id:opticId,p_request_id:requestId,p_lens_type:estimate.lensType,p_treatments:estimate.treatments});
  if (error) throw new Error(error.code==='40001'?'A tabela foi atualizada. Reinicie a conversa para conferir o novo preço antes de salvar.':'Não foi possível salvar o orçamento. Confira a vigência da tabela e sua conexão; tente novamente.');
  return readQuote(data);
}
