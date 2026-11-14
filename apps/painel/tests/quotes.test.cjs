const {chromium}=require('playwright-core');
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {randomUUID,randomBytes}=require('node:crypto');
const {execFileSync}=require('node:child_process');
const path=require('node:path');
const {createClient}=require('@supabase/supabase-js');
const root=path.resolve(__dirname,'../../..');

test('orçamento: tabela vazia, validação, cálculo, recálculo ao salvar, lista e status persistidos',async()=>{
 const config=JSON.parse(execFileSync(path.join(root,'node_modules/.bin/supabase'),['status','-o','json'],{cwd:root,env:{...process.env,SUPABASE_HOME:path.join(root,'.local/supabase-home')},encoding:'utf8',stdio:['ignore','pipe','pipe']}));
 assert.ok(['127.0.0.1','localhost'].includes(new URL(config.API_URL).hostname));
 const options={auth:{persistSession:false,autoRefreshToken:false}};
 const db=createClient(config.API_URL,config.ANON_KEY,options);const admin=createClient(config.API_URL,config.SERVICE_ROLE_KEY,options);
 const email=`quote-browser-${randomUUID()}@example.test`;const password=randomBytes(24).toString('base64url');
 const signup=await db.auth.signUp({email,password});assert.equal(signup.error,null);
 const userId=signup.data.user.id;let opticId;
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try{
  const created=await db.rpc('create_optic',{p_name:'Ótica orçamentos',p_address:'Rua Teste, 120',p_hours:'Das 9h às 18h',p_payments:'Pix e cartões',p_delivery:'Confirmar com atendente'});
  assert.equal(created.error,null);opticId=created.data;
  const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',error=>errors.push(error.message));
  const origin=process.env.LUMI_TEST_URL||'http://127.0.0.1:3000';
  await page.goto(origin+'/conta');await page.getByRole('button',{name:'Entrar',exact:true}).click();
  await page.getByLabel('E-mail',{exact:true}).fill(email);await page.getByLabel('Senha',{exact:true}).fill(password);
  await page.getByRole('button',{name:'Entrar na Lumi',exact:true}).click();await page.getByRole('heading',{name:'Bem-vindo à Lumi.'}).waitFor();
  await page.goto(origin+'/precos');
  assert.equal(await page.getByLabel('Visão simples · Mínimo',{exact:true}).inputValue(),'','Não deve haver preços inventados para nova ótica');
  await page.getByRole('button',{name:'Salvar tabela de preços'}).click();
  await page.getByText('Informe valores válidos, com mínimo menor ou igual ao máximo.',{exact:false}).first().waitFor();
  const values=[['Visão simples','100,00','200,00'],['Multifocal','300,00','500,00'],['Ocupacional','200,00','400,00'],['Antirreflexo','10,00','20,00'],['Filtro de luz azul','15,00','25,00'],['Fotossensível','50,00','100,00']];
  for(const[label,min,max]of values){await page.getByLabel(`${label} · Mínimo`,{exact:true}).fill(min);await page.getByLabel(`${label} · Máximo`,{exact:true}).fill(max);}
  await page.getByLabel('Visão simples · Mínimo',{exact:true}).fill('201,00');
  await page.getByRole('button',{name:'Salvar tabela de preços'}).click();
  assert.equal(await page.getByLabel('Visão simples · Mínimo',{exact:true}).getAttribute('aria-invalid'),'true');
  await page.getByLabel('Visão simples · Mínimo',{exact:true}).fill('100,00');
  await page.getByRole('button',{name:'Salvar tabela de preços'}).click();
  await page.getByRole('status').filter({hasText:'Tabela de preços salva na sua ótica.'}).waitFor();
  await page.reload();assert.equal(await page.getByLabel('Visão simples · Mínimo',{exact:true}).inputValue(),'100,00');
  await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.goto(origin+'/');await page.getByRole('button',{name:'Aceito continuar'}).click();
  await page.getByRole('button',{name:'Orçamento de lentes',exact:true}).click();
  async function send(text){await page.getByRole('textbox',{name:'Sua mensagem'}).fill(text);await page.getByRole('button',{name:'Enviar mensagem'}).click();}
  await send('1');await send('1, 2');
  await page.getByRole('button',{name:'Salvar orçamento de teste',exact:true}).waitFor();
  assert.match(await page.locator('.quoteSummary').innerText(),/125,00/);
  assert.equal(await page.locator('.quoteCard').count(),0);
  // Change the server price after the on-screen estimate. The save must recalculate.
  const rows=await db.from('lens_prices').select('kind,minimum_cents,maximum_cents');
  const addons=await db.from('treatment_prices').select('kind,minimum_cents,maximum_cents');
  assert.equal((await db.rpc('set_price_table',{p_optic_id:opticId,p_lenses:rows.data.map(row=>({...row,minimum_cents:row.minimum_cents+1000,maximum_cents:row.maximum_cents+1000})),p_treatments:addons.data})).error,null);
  await page.getByRole('button',{name:'Salvar orçamento de teste',exact:true}).click();
  await page.getByRole('status').filter({hasText:'Orçamento de teste salvo.'}).waitFor();
  assert.match(await page.locator('.quoteSummary').innerText(),/135,00/);
  await page.getByText('A tabela mudou. A faixa acima foi recalculada pelo banco ao salvar.',{exact:true}).waitFor();
  await page.getByRole('link',{name:'Ver orçamentos',exact:false}).click();
  await page.locator('.quoteCard').waitFor();assert.equal(await page.locator('.quoteCard').count(),1);
  assert.match(await page.locator('.quoteAmount').innerText(),/135,00/);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.locator('.quoteStatus select').selectOption('in_service');
  await page.waitForFunction(()=>document.querySelector('.quoteStatus select')?.disabled===false);
  await page.reload();await page.locator('.quoteStatus select').waitFor();assert.equal(await page.locator('.quoteStatus select').inputValue(),'in_service');
  await page.getByLabel('Filtrar por status',{exact:true}).selectOption('won');
  await page.getByRole('heading',{name:'Nenhum orçamento neste status.'}).waitFor();
  await page.getByLabel('Filtrar por status',{exact:true}).selectOption('all');
  await page.locator('.quoteCard').waitFor();
  assert.equal((await db.from('quotes').select('id')).data.length,1);
  assert.deepEqual(errors,[]);
 }finally{
  await browser.close();
  if(opticId)assert.equal((await admin.from('optics').delete().eq('id',opticId)).error,null);
  assert.equal((await admin.auth.admin.deleteUser(userId)).error,null);
 }
});
