import type {SupabaseClient} from '@supabase/supabase-js';
import {normalizeOrderCode,orderStatuses,validTestName,type OrderStatus,type PublicOrder} from '@lumi/shared';
export interface StoredOrder {
  id:string;optic_id:string;code:string;customer_name:string;status:OrderStatus;is_demo:true;created_at:string;notice_state:'blocked'|'cancelled'|null;
}
export function readOrder(input:unknown):StoredOrder{
  const row=input as StoredOrder|null;
  if(!row||typeof row.id!=='string'||typeof row.optic_id!=='string'||typeof row.code!=='string'||normalizeOrderCode(row.code)!==row.code
    ||typeof row.customer_name!=='string'||!validTestName(row.customer_name)||!orderStatuses.includes(row.status)||row.is_demo!==true
    ||typeof row.created_at!=='string'||!Number.isFinite(Date.parse(row.created_at))
    ||row.notice_state!=null&&!['blocked','cancelled'].includes(row.notice_state))throw new Error('Pedido inválido retornado pelo banco.');
  return {id:row.id,optic_id:row.optic_id,code:row.code,customer_name:row.customer_name,status:row.status,is_demo:true,created_at:row.created_at,notice_state:row.notice_state??null};
}
export async function lookupOrderStatus(db:SupabaseClient,opticId:string,code:string):Promise<PublicOrder|null>{
  const result=await db.rpc('lookup_order_status',{p_optic_id:opticId,p_code:code}).abortSignal(AbortSignal.timeout(15000));
  if(result.error)throw new Error('Não foi possível consultar o pedido.');
  if(result.data===null)return null;
  const row=result.data as PublicOrder;
  if(row.code!==code||!orderStatuses.includes(row.status))throw new Error('Resposta de consulta inválida.');
  // Drop any unexpected fields; the conversation only receives code + status.
  return {code:row.code,status:row.status};
}
