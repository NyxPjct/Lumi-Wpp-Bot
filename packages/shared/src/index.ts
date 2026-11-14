import {lensTypes, treatmentTypes, lensLabels, treatmentLabels, estimateQuote, formatRange, type PriceTable, type LensType, type QuoteEstimate} from './pricing';
export * from './pricing';
import {faqForSettings, type BusinessSettings} from './business';
export * from './business';
export type State = 'privacidade' | 'menu' | 'faq' | 'quote_lens' | 'quote_treatments' | 'humano' | 'encerrado';
export interface Conversation {
  state: State;
  consentedAt?: string;
  invalidAttempts: number;
  quoteLens?: LensType;
  quoteResult?: QuoteEstimate;
}
export const initialConversation = (): Conversation => ({state: 'privacidade', invalidAttempts: 0});
export const welcome = 'Olá! Sou a Lumi, assistente da ótica. Para continuar, você autoriza o uso dos seus dados para este atendimento? Responda “aceito” ou “não aceito”. Não envie receitas nesta demonstração.';
export const menu = 'Como posso ajudar?\n1. Orçamento de lentes\n2. Armações\n3. Agendar exame ou ajuste\n4. Status do pedido\n5. Dúvidas frequentes\n6. Falar com atendente';
export const faq = [
  {question: 'Horário de atendimento', answer: 'Exemplo: segunda a sexta, das 9h às 18h. Confirme os horários com a sua ótica.'},
  {question: 'Formas de pagamento', answer: 'Exemplo: Pix e cartões. Confirme condições e parcelamento com a sua ótica.'},
  {question: 'Prazo dos óculos', answer: 'O prazo depende das lentes e do laboratório. Um atendente pode confirmar a previsão do seu pedido.'},
];
export const welcomeForSettings = (settings?: BusinessSettings | null) => settings
  ? `Olá! Sou a Lumi, assistente da ${settings.name}. Para continuar, você autoriza o uso dos seus dados para este atendimento? Responda “aceito” ou “não aceito”. Não envie receitas nesta demonstração.`
  : welcome;
export function transition(current: Conversation, input: string, now = new Date().toISOString(), settings?: BusinessSettings | null, prices?: PriceTable): {conversation: Conversation; replies: string[]} {
  const conversation = {...current};
  const answers = settings ? faqForSettings(settings) : faq;
  const text = input.trim().toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const respond = (...replies: string[]) => ({conversation, replies});
  const handoff = () => {conversation.state = 'humano'; conversation.invalidAttempts = 0; return respond('Encaminhei sua conversa para um atendente. A Lumi está pausada.');};
  if (conversation.state === 'humano') return respond();
  if (/\b(atendente|humano|pessoa)\b/.test(text)) return handoff();
  if (conversation.state === 'encerrado') return respond('Atendimento encerrado. Para recomeçar, inicie uma nova demonstração.');
  if (conversation.state === 'privacidade') {
    if (['aceito', 'sim'].includes(text)) {
      conversation.consentedAt = now; conversation.state = 'menu'; conversation.invalidAttempts = 0;
      return respond('Obrigada! Você pode solicitar a exclusão dos seus dados à ótica.', menu);
    }
    if (['nao', 'nao aceito'].includes(text)) {conversation.state = 'encerrado'; return respond('Tudo bem. O atendimento automático foi encerrado. Entre em contato diretamente com a ótica para atendimento humano.');}
    return respond(welcomeForSettings(settings));
  }
  if (text === 'menu' || text === 'voltar') {conversation.state = 'menu'; conversation.invalidAttempts = 0; delete conversation.quoteLens; delete conversation.quoteResult; return respond(menu);}
  if (conversation.state === 'quote_lens') {
    if (/^[1-3]$/.test(text)) {
      conversation.quoteLens = lensTypes[Number(text) - 1];
      conversation.state = 'quote_treatments'; conversation.invalidAttempts = 0;
      return respond('Quais tratamentos deseja? Digite os números separados por vírgula, ou 0 para nenhum.\n' + treatmentTypes.map((key, i) => `${i + 1}. ${treatmentLabels[key]}`).join('\n') + '\nOs adicionais são somados ao valor do par de lentes.');
    }
  } else if (conversation.state === 'quote_treatments') {
    if (text === '0' || /^[1-3](?:\s*[,;]\s*[1-3])*$/.test(text)) {
      const selected = text === '0' ? [] : text.split(/[,;]/).map(item => treatmentTypes[Number(item.trim()) - 1]);
      if (new Set(selected).size === selected.length && conversation.quoteLens) {
        const estimate = estimateQuote(prices, conversation.quoteLens, selected);
        conversation.state = 'humano'; conversation.invalidAttempts = 0;
        if (!estimate) return respond('Não há uma faixa de preços cadastrada para essa combinação. Um atendente precisa confirmar o orçamento. A Lumi está pausada.');
        conversation.quoteResult = estimate;
        return respond(`Estimativa para o par de lentes: ${formatRange(estimate)}.\n${lensLabels[estimate.lensType]} · ${selected.length ? selected.map(key => treatmentLabels[key]).join(', ') : 'Sem tratamentos adicionais'}.\nNão inclui armação. O valor final depende de confirmação humana. Nesta simulação não recebemos nem interpretamos receitas.`, 'Preferências reunidas para confirmação de um atendente. A Lumi está pausada.');
      }
    }
  } else if (conversation.state === 'faq') {
    const answer = answers[Number(text) - 1];
    if (/^[1-9]\d*$/.test(text) && answer) {conversation.state = 'menu'; conversation.invalidAttempts = 0; return respond(answer.answer, menu);}
  } else if (conversation.state === 'menu') {
    if (text === '1') {
      conversation.state = 'quote_lens'; conversation.invalidAttempts = 0;
      delete conversation.quoteResult; delete conversation.quoteLens;
      return respond('Vamos estimar o par de lentes. Use somente dados fictícios e não envie receita. Qual tipo deseja?\n' + lensTypes.map((key, i) => `${i + 1}. ${lensLabels[key]}`).join('\n'));
    }
    if (text === '6') return handoff();
    if (text === '5') {conversation.state = 'faq'; conversation.invalidAttempts = 0; return respond(answers.map((item, i) => `${i + 1}. ${item.question}`).join('\n') + '\nDigite menu para voltar.');}
    if (['2', '3', '4'].includes(text)) {conversation.invalidAttempts = 0; return respond('Este fluxo ainda está em desenvolvimento. Digite 6 para falar com um atendente ou 5 para consultar dúvidas frequentes.');}
  }
  conversation.invalidAttempts++;
  if (conversation.invalidAttempts >= 3) return handoff();
  return respond('Não entendi. Escolha uma opção da lista ou digite menu.');
}
export * from './agenda';
