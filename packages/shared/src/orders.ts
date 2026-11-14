export const orderStatuses=['in_production','ready','collected'] as const;
export type OrderStatus=typeof orderStatuses[number];
export const orderStatusLabels:Record<OrderStatus,string>={in_production:'Em produção',ready:'Pronto para retirar',collected:'Retirado'};
export type OrdersAvailability={kind:'available'|'demo'|'unavailable'};
export interface OrderLookup {code:string}
export interface PublicOrder {code:string;status:OrderStatus}
export function normalizeOrderCode(input:string):string|null {
  const code=input.trim().toUpperCase();
  if(code.length<3||code.length>30||!/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/.test(code)
    ||['MENU','VOLTAR'].includes(code)||/\b(ATENDENTE|HUMANO|PESSOA)\b/.test(code))return null;
  return code;
}
export function orderStatusReply(code:string,result:PublicOrder|null):string {
  if(!result)return 'Não encontrei esse pedido de teste nesta ótica. Confira o código ou fale com um atendente.';
  const detail=result.status==='in_production'?'A ótica confirmará a previsão de retirada.'
    :result.status==='ready'?'Combine a retirada com a ótica.'
    :'A retirada já foi registrada pela ótica.';
  return `Pedido de teste ${code}: ${orderStatusLabels[result.status].toLowerCase()}. ${detail}`;
}
export const orderRetryMessage='Não foi possível consultar o pedido agora. Isso não significa que o pedido não existe.\n1. Tentar novamente\n2. Informar outro código\n0. Voltar ao menu principal';
