const {chromium}=require('playwright-core');
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {randomUUID,randomBytes}=require('node:crypto');
const {execFileSync}=require('node:child_process');
const path=require('node:path');
const {createClient}=require('@supabase/supabase-js');
const root=path.resolve(__dirname,'../../..');
test('pedidos no navegador: cadastro, consulta privada mínima, falha distinta de ausência, aviso bloqueado e retirada',{timeout:100000},async()=>{
 const config=JSON.parse(execFileSync(path.join(root,'node_modules/.bin/supabase'),['status','-o','json'],{cwd:root,env:{...process.env,SUPABASE_HOME:path.join(root,'.local/supabase-home')},encoding:'utf8',stdio:['ignore','pipe','pipe']}));assert.ok(['127.0.0.1','localhost'].includes(new URL(config.API_URL).hostname));
 const options={auth:{persistSession:false,autoRefreshToken:false}};const db=createClient(config.API_URL,config.ANON_KEY,options);const admin=createClient(config.API_URL,config.SERVICE_ROLE_KEY,options);
 const email=`orders-ui-${randomUUID()}@example.test`;const password=randomBytes(24).toString('base64url');const signup=await db.auth.signUp({email,password});assert.equal(signup.error,null);const userId=signup.data.user.id;
 let opticId;const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try{
  const created=await db.rpc('create_optic',{p_name:'Ótica pedidos navegador',p_address:'Rua Teste, 120',p_hours:'Das 9h às 18h',p_payments:'Pix e cartões',p_delivery:'Confirme com atendente'});assert.equal(created.error,null);opticId=created.data;
  const page=await browser.newPage({viewport:{width:1440,height:1000},timezoneId:'Asia/Tokyo'});const errors=[];let metaCalls=0;page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{if(new URL(request.url()).hostname==='graph.facebook.com')metaCalls++;});
  const origin=process.env.LUMI_TEST_URL||'http://127.0.0.1:3000';
  await page.goto(origin+'/conta');await page.getByRole('button',{name:'Entrar',exact:true}).click();await page.getByLabel('E-mail',{exact:true}).fill(email);await page.getByLabel('Senha',{exact:true}).fill(password);await page.getByRole('button',{name:'Entrar na Lumi',exact:true}).click();await page.getByRole('heading',{name:'Bem-vindo à Lumi.'}).waitFor();
  await page.goto(origin+'/pedidos');await page.getByLabel('Código do pedido',{exact:true}).fill('MENU');await page.getByLabel('Nome fictício do cliente',{exact:true}).fill('Nome privado fictício');await page.getByRole('button',{name:'Cadastrar pedido de teste',exact:true}).click();await page.getByRole('alert').filter({hasText:'Informe um código válido'}).waitFor();
  await page.getByLabel('Código do pedido',{exact:true}).fill(' lum-001 ');await page.getByRole('button',{name:'Cadastrar pedido de teste',exact:true}).click();await page.getByRole('status').filter({hasText:'Pedido de teste salvo.'}).waitFor();await page.locator('.orderCard').waitFor();
  const orderId=await page.locator('.orderCard').getAttribute('data-order-id');assert.match(await page.locator('.orderCard').innerText(),/LUM-001/);assert.equal((await db.from('order_notifications').select('id')).data.length,0);
  async function query(code){await page.goto(origin+'/');await page.getByRole('button',{name:'Aceito continuar'}).click();await page.getByRole('button',{name:'Status do pedido',exact:true}).click();await page.getByRole('textbox',{name:'Sua mensagem'}).fill(code);await page.getByRole('button',{name:'Enviar mensagem'}).click();}
  const messages=()=>page.locator('.messages');
  await query('lum-001');await messages().getByText('Pedido de teste LUM-001: em produção.',{exact:false}).waitFor();assert.doesNotMatch(await messages().innerText(),/Nome privado fictício/);
  await page.getByRole('button',{name:'Status do pedido',exact:true}).click();await page.getByRole('textbox',{name:'Sua mensagem'}).fill('LUM-404');await page.getByRole('button',{name:'Enviar mensagem'}).click();await messages().getByText('Não encontrei esse pedido de teste nesta ótica.',{exact:false}).waitFor();
  await page.route('**/rest/v1/rpc/lookup_order_status',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'Test unavailable'})}));
  await page.getByRole('button',{name:'Status do pedido',exact:true}).click();await page.getByRole('textbox',{name:'Sua mensagem'}).fill('LUM-001');await page.getByRole('button',{name:'Enviar mensagem'}).click();await page.getByRole('button',{name:'Tentar consultar pedido novamente',exact:true}).waitFor();
  assert.match(await page.locator('.message.bot').last().innerText(),/Não foi possível consultar/);assert.doesNotMatch(await page.locator('.message.bot').last().innerText(),/Não encontrei/);
  await page.unroute('**/rest/v1/rpc/lookup_order_status');await page.getByRole('button',{name:'Tentar consultar pedido novamente',exact:true}).click();await page.getByRole('button',{name:'Status do pedido',exact:true}).waitFor();
  await page.goto(origin+'/pedidos');await page.getByRole('button',{name:'Marcar pronto para retirar',exact:true}).click();await page.getByRole('status').filter({hasText:'Pedido marcado como pronto.'}).waitFor();await page.getByText('Rascunho de aviso bloqueado',{exact:false}).last().waitFor();
  assert.equal((await db.from('order_notifications').select('state').single()).data.state,'blocked');
  await query('LUM-001');await messages().getByText('Pedido de teste LUM-001: pronto para retirar.',{exact:false}).waitFor();assert.doesNotMatch(await messages().innerText(),/Nome privado fictício/);
  await page.goto(origin+'/pedidos');await page.getByRole('button',{name:'Registrar retirada',exact:true}).click();await page.getByRole('button',{name:'Manter pronto para retirar',exact:true}).click();assert.equal((await db.from('orders').select('status').eq('id',orderId).single()).data.status,'ready');
  await page.getByRole('button',{name:'Registrar retirada',exact:true}).click();await page.getByRole('button',{name:'Confirmar retirada do pedido',exact:true}).click();await page.getByRole('status').filter({hasText:'Retirada registrada.'}).waitFor();await page.reload();await page.getByText('Rascunho de aviso cancelado após a retirada',{exact:false}).waitFor();
  assert.equal((await db.from('order_notifications').select('state').single()).data.state,'cancelled');
  await query('LUM-001');await messages().getByText('Pedido de teste LUM-001: retirado.',{exact:false}).waitFor();
  // Stale operator screen must not roll a collected order back to ready.
  await page.goto(origin+'/pedidos');await page.getByLabel('Código do pedido',{exact:true}).fill('LUM-002');await page.getByLabel('Nome fictício do cliente',{exact:true}).fill('X'.repeat(80));await page.getByRole('button',{name:'Cadastrar pedido de teste',exact:true}).click();await page.getByRole('status').filter({hasText:'Pedido de teste salvo.'}).waitFor();
  const second=page.locator('.orderCard').filter({has:page.getByRole('heading',{name:'LUM-002',exact:true})});await second.waitFor();const secondId=await second.getAttribute('data-order-id');
  const base={p_optic_id:opticId,p_order_id:secondId};assert.equal((await db.rpc('advance_order',{...base,p_expected_status:'in_production',p_status:'ready'})).error,null);assert.equal((await db.rpc('advance_order',{...base,p_expected_status:'ready',p_status:'collected'})).error,null);
  await second.getByRole('button',{name:'Marcar pronto para retirar',exact:true}).click();await page.getByRole('alert').filter({hasText:'O pedido pode ter mudado'}).waitFor();
  assert.equal((await db.from('orders').select('status').eq('id',secondId).single()).data.status,'collected');await page.getByRole('button',{name:'Recarregar pedidos',exact:true}).click();await second.getByText('Retirado',{exact:true}).waitFor();
  await page.getByLabel('Filtrar pedidos por status',{exact:true}).selectOption('ready');await page.getByRole('heading',{name:'Nenhum pedido neste status.'}).waitFor();await page.getByLabel('Filtrar pedidos por status',{exact:true}).selectOption('all');
  await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.equal(metaCalls,0);assert.deepEqual(errors,[]);
  if(process.env.LUMI_SCREENSHOT_DIR){const fs=require('node:fs');fs.mkdirSync(process.env.LUMI_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.LUMI_SCREENSHOT_DIR,'pedidos-mobile.png'),fullPage:true});}
 }finally{await browser.close();if(opticId)assert.equal((await admin.from('optics').delete().eq('id',opticId)).error,null);assert.equal((await admin.auth.admin.deleteUser(userId)).error,null);}
});
