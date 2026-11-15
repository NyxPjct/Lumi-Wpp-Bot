import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {randomUUID,randomBytes} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createClient} from '@supabase/supabase-js';
const root=fileURLToPath(new URL('../../',import.meta.url));
test('tabelas reais: RLS, publicação atômica, versões, vigência, orçamento e preços históricos',async()=>{
  const {stdout}=await promisify(execFile)(path.join(root,'node_modules/.bin/supabase'),['status','-o','json'],{cwd:root,env:{...process.env,SUPABASE_HOME:path.join(root,'.local/supabase-home')}});
  const config=JSON.parse(stdout);assert.ok(['127.0.0.1','localhost'].includes(new URL(config.API_URL).hostname));
  const options={auth:{persistSession:false,autoRefreshToken:false}};
  const admin=createClient(config.API_URL,config.SERVICE_ROLE_KEY,options);
  const client=()=>createClient(config.API_URL,config.ANON_KEY,options);
  const optics=[],users=[];
  async function account(){
    const db=client();const signup=await db.auth.signUp({email:`catalog-${randomUUID()}@example.test`,password:randomBytes(24).toString('base64url')});assert.equal(signup.error,null);users.push(signup.data.user.id);
    const created=await db.rpc('create_optic',{p_name:'Ótica tabelas teste',p_address:'Rua Teste, 100',p_hours:'9h às 18h',p_payments:'Pix',p_delivery:'A confirmar'});assert.equal(created.error,null);optics.push(created.data);return {db,id:created.data,user:signup.data.user.id};
  }
  try{
    const a=await account(),b=await account();
    const products=[{code:'DEMO-1',name:'Lente teste',lensType:'single',minimumCents:25000,maximumCents:30000,treatments:'Antirreflexo',refractiveIndex:'1.60',notes:'Preço demonstrativo'}];
    const payload={p_optic_id:a.id,p_catalog_id:randomUUID(),p_expected_revision:null,p_revision:randomUUID(),p_name:'Tabela demonstrativa',p_brand:'Marca de teste',p_valid_from:'2020-01-01',p_valid_until:null,p_source_file:'teste.csv',p_products:products};
    const publish=await a.db.rpc('set_price_catalog',payload);assert.equal(publish.error,null);assert.equal(publish.data.products[0].minimumCents,25000);
    assert.equal((await a.db.rpc('set_price_catalog',payload)).error,null,'Reenvio de publicação idêntica funciona');
    assert.ok((await a.db.rpc('set_price_catalog',{...payload,p_products:[{...products[0],minimumCents:1}]})).error,'Mesma revisão não pode representar outra tabela');
    assert.deepEqual((await b.db.from('price_catalogs').select('id').eq('id',payload.p_catalog_id)).data,[]);
    assert.ok((await b.db.rpc('set_price_catalog',{...payload,p_optic_id:b.id})).error,'Não se apropriar do ID de outra ótica');
    assert.ok((await b.db.rpc('set_price_catalog',payload)).error);
    assert.ok((await a.db.from('price_catalogs').update({products:[]}).eq('id',payload.p_catalog_id)).error);
    for(const broken of [null,[],[...products,...products],[{...products[0],minimumCents:1.5}],[{...products[0],minimumCents:'1'}],[{...products[0],lensType:'fake'}],[{...products[0],maximumCents:1}]]){
      assert.ok((await a.db.rpc('set_price_catalog',{...payload,p_expected_revision:payload.p_revision,p_revision:randomUUID(),p_products:broken})).error);
    }
    assert.equal((await a.db.from('price_catalogs').select('revision').single()).data.revision,payload.p_revision,'Falhas não alteram tabela anterior');
    const quoteArgs={p_optic_id:a.id,p_request_id:randomUUID(),p_catalog_id:payload.p_catalog_id,p_revision:payload.p_revision,p_product_code:'DEMO-1'};
    const concurrent=await Promise.all([a.db.rpc('create_catalog_quote',quoteArgs),a.db.rpc('create_catalog_quote',quoteArgs)]);
    concurrent.forEach(result=>assert.equal(result.error,null));const quote=concurrent[0].data;assert.equal(quote.id,concurrent[1].data.id);assert.equal(quote.minimum_cents,25000);assert.equal(quote.catalog_source.brand,'Marca de teste');assert.equal(quote.catalog_source.treatments,'Antirreflexo');assert.deepEqual(quote.treatments,[]);
    assert.ok((await b.db.rpc('create_catalog_quote',quoteArgs)).error);assert.deepEqual((await b.db.from('quotes').select('id').eq('id',quote.id)).data,[]);
    assert.ok((await a.db.from('quotes').update({catalog_source:{}}).eq('id',quote.id)).error);
    assert.ok((await a.db.rpc('create_catalog_quote',{...quoteArgs,p_product_code:'unknown'})).error);
    assert.ok((await a.db.rpc('create_quote',{p_optic_id:a.id,p_request_id:quoteArgs.p_request_id,p_lens_type:'single',p_treatments:[]})).error,'Chave de orçamento não pode cruzar fluxos');
    assert.ok((await a.db.rpc('create_quote',{p_optic_id:a.id,p_request_id:randomUUID(),p_lens_type:'single',p_treatments:[]})).error,'Tabelas publicadas impedem fallback para faixas gerais');
    const update={...payload,p_expected_revision:payload.p_revision,p_revision:randomUUID(),p_products:[{...products[0],minimumCents:40000,maximumCents:45000}]};
    const race=await Promise.all([a.db.rpc('set_price_catalog',update),a.db.rpc('set_price_catalog',{...update,p_revision:randomUUID()})]);
    assert.equal(race.filter(result=>result.error===null).length,1,'Atualizações concorrentes não sobrescrevem outra versão');
    const latest=race.find(result=>result.error===null).data;
    assert.equal((await a.db.rpc('create_catalog_quote',quoteArgs)).data.minimum_cents,25000,'Retry retorna valor histórico');
    assert.ok((await a.db.rpc('create_catalog_quote',{...quoteArgs,p_request_id:randomUUID()})).error,'Rascunho antigo exige nova estimativa');
    const next=await a.db.rpc('create_catalog_quote',{...quoteArgs,p_request_id:randomUUID(),p_revision:latest.revision});assert.equal(next.error,null);assert.equal(next.data.minimum_cents,40000);
    assert.equal((await a.db.from('quotes').select('minimum_cents,catalog_source').eq('id',quote.id).single()).data.minimum_cents,25000);
    for(const dates of [{p_valid_from:'2020-01-01',p_valid_until:'2020-12-31'},{p_valid_from:'2099-01-01',p_valid_until:null}]){
      const result=await a.db.rpc('set_price_catalog',{...update,p_expected_revision:latest.revision,p_revision:randomUUID(),...dates});
      assert.equal(result.error,null);latest.revision=result.data.revision;
      assert.ok((await a.db.rpc('create_catalog_quote',{...quoteArgs,p_request_id:randomUUID(),p_revision:latest.revision})).error,'Não cotar tabela vencida ou futura');
    }
    assert.equal((await admin.from('optic_memberships').update({role:'attendant'}).eq('user_id',a.user)).error,null);
    assert.ok((await a.db.rpc('set_price_catalog',{...update,p_expected_revision:latest.revision,p_revision:randomUUID()})).error,'Atendente não publica preços');
    assert.equal((await a.db.from('price_catalogs').select('id')).data.length,1,'Atendente pode consultar');
    assert.ok((await client().from('price_catalogs').select('id')).error);assert.ok((await client().rpc('set_price_catalog',payload)).error);assert.ok((await client().rpc('create_catalog_quote',quoteArgs)).error);
  }finally{
    if(optics.length)assert.equal((await admin.from('optics').delete().in('id',optics)).error,null);
    for(const id of users)assert.equal((await admin.auth.admin.deleteUser(id)).error,null);
  }
});
