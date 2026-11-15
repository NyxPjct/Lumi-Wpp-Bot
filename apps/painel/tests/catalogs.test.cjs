const {test}=require('node:test');
const assert=require('node:assert/strict');
const {chromium}=require('playwright-core');
const {createClient}=require('@supabase/supabase-js');
const {randomUUID,randomBytes}=require('node:crypto');
const {execFileSync}=require('node:child_process');
const path=require('node:path');
const {fillImport,quoteProduct}=require('./catalog-fixture.cjs');
const root=path.resolve(__dirname,'../../..');
test('tabelas com banco: importa CSV, persiste orçamento com origem, substitui preço e preserva histórico',async()=>{
  const config=JSON.parse(execFileSync(path.join(root,'node_modules/.bin/supabase'),['status','-o','json'],{cwd:root,env:{...process.env,SUPABASE_HOME:path.join(root,'.local/supabase-home')},encoding:'utf8',stdio:['ignore','pipe','pipe']}));assert.ok(['127.0.0.1','localhost'].includes(new URL(config.API_URL).hostname));
  const opts={auth:{persistSession:false,autoRefreshToken:false}};const admin=createClient(config.API_URL,config.SERVICE_ROLE_KEY,opts),db=createClient(config.API_URL,config.ANON_KEY,opts);
  const email=`catalog-browser-${randomUUID()}@example.test`,password=randomBytes(24).toString('base64url');
  const signup=await db.auth.signUp({email,password});assert.equal(signup.error,null);const userId=signup.data.user.id;let opticId;
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
  try{
    const created=await db.rpc('create_optic',{p_name:'Ótica catálogo navegador',p_address:'Rua Teste, 100',p_hours:'9h às 18h',p_payments:'Pix',p_delivery:'A confirmar'});assert.equal(created.error,null);opticId=created.data;
    const page=await browser.newPage({viewport:{width:1440,height:1050}});const errors=[];page.on('pageerror',error=>errors.push(error.message));
    const origin=process.env.LUMI_TEST_URL||'http://127.0.0.1:3000';await page.goto(origin+'/conta');await page.getByRole('button',{name:'Entrar',exact:true}).click();await page.getByLabel('E-mail',{exact:true}).fill(email);await page.getByLabel('Senha',{exact:true}).fill(password);await page.getByRole('button',{name:'Entrar na Lumi',exact:true}).click();await page.getByRole('heading',{name:'Bem-vindo à Lumi.'}).waitFor();
    await page.goto(origin+'/tabelas');await page.getByRole('button',{name:'Importar tabela',exact:false}).click();await fillImport(page);await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Publicar tabela',exact:true}).click();await page.getByRole('status').filter({hasText:'Tabela publicada. Os novos orçamentos'}).waitFor();
    await page.reload();await page.locator('.catalogCard').waitFor();assert.equal(await page.locator('.catalogCard').count(),1);
    await quoteProduct(page,origin);assert.match(await page.locator('.quoteSummary').innerText(),/125,25/);await page.getByRole('button',{name:'Salvar orçamento de teste',exact:true}).click();await page.getByRole('status').filter({hasText:'Orçamento de teste salvo.'}).waitFor();
    await page.goto(origin+'/tabelas');await page.getByRole('button',{name:'Atualizar tabela Tabela de teste',exact:true}).click();await fillImport(page);await page.getByLabel('Os preços do arquivo são',{exact:true}).selectOption('lens');await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Publicar atualização',exact:true}).click();await page.locator('.catalogCard').waitFor();
    await quoteProduct(page,origin);assert.match(await page.locator('.quoteSummary').innerText(),/250,50/);await page.getByRole('button',{name:'Salvar orçamento de teste',exact:true}).click();await page.getByRole('status').filter({hasText:'Orçamento de teste salvo.'}).waitFor();
    await page.goto(origin+'/orcamentos');await page.locator('.quoteCard').first().waitFor();assert.equal(await page.locator('.quoteCard').count(),2);const amounts=await page.locator('.quoteAmount').allTextContents();assert.ok(amounts.some(value=>value.includes('125,25')));assert.ok(amounts.some(value=>value.includes('250,50')));assert.match(await page.locator('.quoteCard').first().innerText(),/Marca própria/);
    const quotes=await db.from('quotes').select('minimum_cents,catalog_source');assert.equal(quotes.error,null);assert.equal(quotes.data.length,2);quotes.data.forEach(quote=>assert.equal(quote.catalog_source.productCode,'TEST-01'));
    assert.deepEqual(errors,[]);
  }finally{await browser.close();if(opticId)assert.equal((await admin.from('optics').delete().eq('id',opticId)).error,null);assert.equal((await admin.auth.admin.deleteUser(userId)).error,null);}
});
