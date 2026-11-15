import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseCsv,importMoney,suggestColumns,suggestHeader,productsFromGrid,readCatalog,catalogStatus,businessDate,initialConversation,transition,demoPriceTable,type PriceCatalog,type Spreadsheet} from '../src/index.js';

const grid:Spreadsheet=[['Tabela de demonstração'],['Código','Produto','Tipo','Preço','Preço máximo','Tratamentos','Índice','Observações'],['DEMO-1','Lente demonstrativa','Monofocal','R$ 1.234,56','1.450,00','Antirreflexo','1.60','Não inclui armação']];
function table():PriceCatalog{return {id:'catalog-a',revision:'revision-a',name:'Tabela teste',brand:'Marca teste',validFrom:'2026-01-01',validUntil:'2026-12-31',updatedAt:'2026-11-14T19:00:00Z',sourceFile:'teste.csv',products:productsFromGrid(grid,1,suggestColumns(grid[1]),'pair').products};}
const now='2026-11-14T20:00:00Z';
test('CSV lê UTF-8 BOM, separadores brasileiros, aspas e observações multilinha sem executar fórmulas',()=>{
  assert.deepEqual(parseCsv('\uFEFFProduto;Preço;Observações\r\n"Lente; A";"250,00";"Texto ""especial""\nsegunda linha"\r\n'),[['Produto','Preço','Observações'],['Lente; A','250,00','Texto "especial"\nsegunda linha']]);
  assert.deepEqual(parseCsv('Produto,Tipo,Preço\nLente,Simples,250.50'),[['Produto','Tipo','Preço'],['Lente','Simples','250.50']]);
  assert.throws(()=>parseCsv('Produto;Preço\n"Lente;200'));
  assert.throws(()=>parseCsv('Produto;Preço\n=HYPERLINK("x");200'));
  assert.equal(parseCsv('Produto;Preço\n=SUM(A1:A2);200')[1][0],'=SUM(A1:A2)');
});
test('preços importados respeitam os centavos e a unidade declarada',()=>{
  for(const [raw,expected] of [['R$ 1.234,56',123456],['250.50',25050],['1.000',100000],[1234.56,123456],[0.1,10]] as const)assert.equal(importMoney(raw),expected);
  for(const raw of ['',null,true,'1,005',1.005,-1,'NaN','=SUM(A1:A2)','1e3','1,234.56'])assert.equal(importMoney(raw),null);
  assert.equal(suggestHeader(grid),1);
  const map=suggestColumns(grid[1]);
  const result=productsFromGrid(grid,1,map,'lens');assert.deepEqual(result.errors,[]);assert.equal(result.products[0].minimumCents,246912);assert.equal(result.products[0].maximumCents,290000);
});
test('importação não publica silenciosamente linhas inválidas, tipos desconhecidos ou códigos duplicados',()=>{
  const map=suggestColumns(grid[1]);
  assert.match(productsFromGrid([...grid,grid[2]],1,map,'pair').errors[0],/duplicado/);
  assert.match(productsFromGrid([grid[1],['X','Lente','Bifocal','50']],0,map,'pair').errors[0],/Tipo desconhecido/);
  assert.match(productsFromGrid([grid[1],['X','Lente','Simples','50','40']],0,map,'pair').errors[0],/Preço inválido/);
  assert.match(productsFromGrid(grid,1,{...map,minimum:map.name},'pair').errors[0],/dois campos/);
  const malformed=parseCsv('Produto,Tipo,Preço\nLente,Monofocal,125,25');
  assert.match(productsFromGrid(malformed,0,suggestColumns(malformed[0]),'pair').errors[0],/mais valores/);
  const simple=[['Produto','Preço'],['Lente','250,50']];
  assert.equal(productsFromGrid(simple,0,suggestColumns(simple[0]),'pair','single').products[0].lensType,'single');
});
test('tabelas validadas usam vigência inclusiva em Brasília e rejeitam datas impossíveis',()=>{
  const value=table();assert.ok(readCatalog(value));
  assert.equal(businessDate(new Date('2026-11-15T01:00:00Z')),'2026-11-14');
  assert.equal(catalogStatus(value,'2026-12-31'),'active');assert.equal(catalogStatus(value,'2027-01-01'),'expired');assert.equal(catalogStatus(value,'2025-12-31'),'scheduled');
  assert.equal(readCatalog({...value,validFrom:'2026-02-30'}),null);
  assert.equal(readCatalog({...value,products:[...value.products,...value.products]}),null);
});
function send(current:ReturnType<typeof initialConversation>,input:string,tables:PriceCatalog[]|null){return transition(current,input,now,null,demoPriceTable,undefined,undefined,tables);}
function lensSelected(tables:PriceCatalog[]|null){let current=send(initialConversation(),'aceito',tables).conversation;current=send(current,'1',tables).conversation;return send(current,'1',tables);}
test('orçamento usa produto e preço importados sem somar novamente os tratamentos',()=>{
  const tables=[table()];let result=lensSelected(tables);assert.equal(result.conversation.state,'quote_catalog');assert.match(result.replies[0],/Marca teste/);
  result=send(result.conversation,'1',tables);assert.match(result.replies[0],/Lente demonstrativa/);
  result=send(result.conversation,'1',tables);assert.equal(result.conversation.state,'humano');
  assert.equal(result.conversation.quoteResult?.minimumCents,123456);assert.deepEqual(result.conversation.quoteResult?.treatments,[]);
  assert.equal(result.conversation.quoteResult?.source?.productCode,'DEMO-1');assert.match(result.replies[0],/Antirreflexo/);
});
test('erro, vencimento e atualização não caem nos preços gerais nem trocam uma escolha silenciosamente',()=>{
  assert.equal(lensSelected(null).conversation.quoteResult,undefined);assert.equal(lensSelected(null).conversation.state,'humano');
  const expired={...table(),validUntil:'2026-10-01'};assert.equal(lensSelected([expired]).conversation.state,'humano');
  const tables=[table()];const listing=send(lensSelected(tables).conversation,'1',tables);
  const changed=send(listing.conversation,'1',[{...table(),revision:'new'}]);assert.equal(changed.conversation.quoteResult,undefined);assert.match(changed.replies[0],/atualizada/);
});
test('consulta permite paginação e busca por nome, índice ou tratamento sem inventar produtos',()=>{
  const priceTable=table();priceTable.products=Array.from({length:8},(_,i)=>({...priceTable.products[0],code:`P${i}`,name:`Produto ${i}`}));
  const tables=[priceTable];let result=send(lensSelected(tables).conversation,'1',tables);
  result=send(result.conversation,'próxima',tables);assert.match(result.replies[0],/Página 2 de 2/);assert.match(result.replies[0],/Produto 7/);
  result=send(result.conversation,'Produto 7',tables);assert.equal(result.conversation.catalogFlow?.options.length,1);
  result=send(result.conversation,'1',tables);assert.equal(result.conversation.quoteResult?.source?.productCode,'P7');
});
