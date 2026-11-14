import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseMoney,estimateQuote,demoPriceTable,initialConversation,transition,readPriceTable,completePriceTable,emptyPriceTable} from '../src/index.js';

test('valores em reais são convertidos exatamente em centavos, sem arredondar entrada inválida', () => {
  for (const [input,cents] of [['0,00',0],['10,01',1001],['12,3',1230],[' 250 ',25000],['1000000,00',100000000]] as const) assert.equal(parseMoney(input),cents);
  for (const input of ['-1','NaN','Infinity','1.234,56','1.5','1,234','1e3','','1,','1000000,01']) assert.equal(parseMoney(input),null,input);
});
test('estimativa soma somente os adicionais selecionados, sem alterar a tabela original', () => {
  const original = JSON.stringify(demoPriceTable);
  const result = estimateQuote(demoPriceTable,'single',['antireflective','blue_filter']);
  assert.deepEqual(result,{lensType:'single',treatments:['antireflective','blue_filter'],minimumCents:28000,maximumCents:60000});
  assert.equal(JSON.stringify(demoPriceTable),original);
  assert.deepEqual(estimateQuote(demoPriceTable,'single',[])?.minimumCents,15000);
});
test('faixas inválidas, tratamentos duplicados ou ausentes não produzem estimativa inventada', () => {
  assert.equal(estimateQuote(emptyPriceTable(),'single',[]),null);
  assert.equal(estimateQuote({lenses:demoPriceTable.lenses,treatments:{}},'single',['antireflective']),null);
  assert.equal(estimateQuote(demoPriceTable,'single',['antireflective','antireflective']),null);
  assert.equal(readPriceTable({lenses:{single:{minimumCents:3,maximumCents:1}},treatments:{}}),null);
  assert.equal(completePriceTable(emptyPriceTable()),false);
  assert.equal(completePriceTable(demoPriceTable),true);
});
function quoteStart() {
  const accepted = transition(initialConversation(),'aceito').conversation;
  return transition(accepted,'1',undefined,null,demoPriceTable).conversation;
}
test('orçamento exige consentimento e percorre tipo, tratamentos e confirmação humana', () => {
  assert.equal(transition(initialConversation(),'1').conversation.state,'privacidade');
  const start = quoteStart(); assert.equal(start.state,'quote_lens');
  const lens = transition(start,'1',undefined,null,demoPriceTable).conversation;
  assert.equal(lens.state,'quote_treatments'); assert.equal(start.quoteLens,undefined);
  const result = transition(lens,'1, 2',undefined,null,demoPriceTable);
  assert.equal(result.conversation.state,'humano');
  assert.equal(result.conversation.quoteResult?.minimumCents,28000);
  assert.match(result.replies.join(' '),/Não inclui armação/);
  assert.deepEqual(transition(result.conversation,'oi',undefined,null,demoPriceTable).replies,[]);
});
test('sem preços cadastrados, encaminha ao humano sem gerar valor', () => {
  const lens = transition(quoteStart(),'2').conversation;
  const result = transition(lens,'0',undefined,null,emptyPriceTable());
  assert.equal(result.conversation.state,'humano'); assert.equal(result.conversation.quoteResult,undefined);
  assert.match(result.replies[0],/Não há uma faixa/);
});
test('opções inválidas não avançam; três tentativas pausam e menu cancela o rascunho', () => {
  let lens = transition(quoteStart(),'1').conversation;
  assert.equal(transition(lens,'1,1').conversation.state,'quote_treatments');
  for (const value of ['4','x','1,1']) lens = transition(lens,value).conversation;
  assert.equal(lens.state,'humano'); assert.equal(lens.quoteResult,undefined);
  const cancelled = transition(transition(quoteStart(),'1').conversation,'menu').conversation;
  assert.equal(cancelled.state,'menu'); assert.equal(cancelled.quoteLens,undefined);
  assert.equal(transition(quoteStart(),'quero um atendente').conversation.state,'humano');
});
