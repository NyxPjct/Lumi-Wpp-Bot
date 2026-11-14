const {chromium}=require('playwright-core');
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {randomUUID,randomBytes}=require('node:crypto');
const {execFileSync}=require('node:child_process');
const path=require('node:path');
const {createClient}=require('@supabase/supabase-js');
const root=path.resolve(__dirname,'../../..');
const origin=process.env.LUMI_TEST_URL||'http://127.0.0.1:3000';
async function fixture(run){
 const config=JSON.parse(execFileSync(path.join(root,'node_modules/.bin/supabase'),['status','-o','json'],{cwd:root,env:{...process.env,SUPABASE_HOME:path.join(root,'.local/supabase-home')},encoding:'utf8',stdio:['ignore','pipe','pipe']}));
 assert.ok(['127.0.0.1','localhost'].includes(new URL(config.API_URL).hostname));
 const opts={auth:{persistSession:false,autoRefreshToken:false}};
 const db=createClient(config.API_URL,config.ANON_KEY,opts);const admin=createClient(config.API_URL,config.SERVICE_ROLE_KEY,opts);
 const email=`chat-ui-${randomUUID()}@example.test`;const password=randomBytes(24).toString('base64url');
 const signup=await db.auth.signUp({email,password});assert.equal(signup.error,null);const userId=signup.data.user.id;
 let opticId;let browser;
 try{
  const optic=await db.rpc('create_optic',{p_name:'Ótica conversa agenda',p_address:'Rua Teste, 120',p_hours:'Das 9h às 18h',p_payments:'Pix e cartões',p_delivery:'Confirme com atendente'});assert.equal(optic.error,null);opticId=optic.data;
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
  const browserContext=await browser.newContext({viewport:{width:1280,height:1000},timezoneId:'Asia/Tokyo'});const page=await browserContext.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(origin+'/conta');await page.getByRole('button',{name:'Entrar',exact:true}).click();await page.getByLabel('E-mail',{exact:true}).fill(email);await page.getByLabel('Senha',{exact:true}).fill(password);await page.getByRole('button',{name:'Entrar na Lumi',exact:true}).click();await page.getByRole('heading',{name:'Bem-vindo à Lumi.'}).waitFor();
  const makeSlot=async(index,service='exam')=>{const result=await db.rpc('create_appointment_slot',{p_optic_id:opticId,p_starts_at:new Date(Date.now()+(48+index)*3600000).toISOString(),p_duration_minutes:30,p_service:service});assert.equal(result.error,null);return result.data;};
  await run({db,page,opticId,userId,makeSlot});assert.deepEqual(errors,[]);
 }finally{
  if(browser)await browser.close();if(opticId)assert.equal((await admin.from('optics').delete().eq('id',opticId)).error,null);assert.equal((await admin.auth.admin.deleteUser(userId)).error,null);
 }
}
async function send(page,text){await page.getByRole('textbox',{name:'Sua mensagem'}).fill(text);await page.getByRole('button',{name:'Enviar mensagem'}).click();}
async function openAgenda(page){await page.goto(origin+'/');await page.getByRole('button',{name:'Aceito continuar'}).click();await page.getByRole('button',{name:'Agendar exame ou ajuste',exact:true}).click();await page.getByRole('button',{name:'Novo agendamento',exact:true}).waitFor();}
const firstOption=page=>page.getByRole('button',{name:/^Opção 1:/});
async function bookUntilConfirm(page,name){await page.getByRole('button',{name:'Novo agendamento',exact:true}).click();await page.getByRole('button',{name:'Exame',exact:true}).click();await firstOption(page).click();await send(page,name);await page.getByRole('button',{name:'Sim, confirmar',exact:true}).waitFor();}
const messages=page=>page.locator('.messages');

test('conversa agenda: confirmar, recuperar na aba, remarcar e cancelar sem listar reservas de outras sessões',{timeout:100000},async()=>fixture(async({db,page,opticId})=>{
 const manualSlot=await makeManual();
 async function makeManual(){const result=await db.rpc('create_appointment_slot',{p_optic_id:opticId,p_starts_at:new Date(Date.now()+47*3600000).toISOString(),p_duration_minutes:30,p_service:'exam'});assert.equal(result.error,null);return result.data;}
 const slots=[];for(let i=0;i<2;i++){const result=await db.rpc('create_appointment_slot',{p_optic_id:opticId,p_starts_at:new Date(Date.now()+(49+i)*3600000).toISOString(),p_duration_minutes:30,p_service:'exam'});assert.equal(result.error,null);slots.push(result.data);}
 assert.equal((await db.rpc('book_appointment',{p_optic_id:opticId,p_slot_id:manualSlot.id,p_customer_name:'Nome privado de reserva manual',p_request_id:randomUUID()})).error,null);
 await openAgenda(page);await bookUntilConfirm(page,'Cliente Fictício da Conversa');
 assert.equal((await db.from('appointments').select('id')).data.length,1,'Antes da confirmação só existe a reserva manual');
 await page.getByRole('button',{name:'Não, voltar',exact:true}).click();
 assert.equal((await db.from('appointments').select('id')).data.length,1);
 await bookUntilConfirm(page,'Cliente Fictício da Conversa');await page.getByRole('button',{name:'Sim, confirmar',exact:true}).click();
 await messages(page).getByText('Agendamento de teste confirmado pelo banco.',{exact:false}).waitFor();
 const stored=await db.from('appointments').select('id,slot_id,simulation_id').not('simulation_id','is',null).single();assert.equal(stored.error,null);assert.equal(stored.data.slot_id,slots[0].id);
 // Same operator account, another tab: it receives a different simulation group.
 const other=await page.context().newPage();await openAgenda(other);await other.getByRole('button',{name:'Cancelar agendamento',exact:true}).click();
 await messages(other).getByText('Não há agendamentos de teste futuros e confirmados',{exact:false}).waitFor();assert.doesNotMatch(await messages(other).innerText(),/Cliente Fictício da Conversa|Nome privado/);await other.close();
 await openAgenda(page);await page.getByRole('button',{name:'Remarcar agendamento',exact:true}).click();assert.doesNotMatch(await messages(page).innerText(),/Nome privado/);
 await firstOption(page).click();await firstOption(page).click();await page.getByRole('button',{name:'Sim, confirmar',exact:true}).click();
 await messages(page).getByText('Remarcação de teste confirmada pelo banco.',{exact:false}).waitFor();
 assert.equal((await db.from('appointments').select('slot_id').eq('id',stored.data.id).single()).data.slot_id,slots[1].id);
 await page.getByRole('button',{name:'Cancelar agendamento',exact:true}).click();await firstOption(page).click();await page.getByRole('button',{name:'Sim, confirmar',exact:true}).click();
 await messages(page).getByText('Cancelamento de teste confirmado pelo banco.',{exact:false}).waitFor();assert.equal((await db.from('appointments').select('status').eq('id',stored.data.id).single()).data.status,'cancelled');
 await page.getByRole('button',{name:'Cancelar agendamento',exact:true}).click();await messages(page).getByText('Não há agendamentos de teste futuros e confirmados',{exact:false}).waitFor();
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 if(process.env.LUMI_SCREENSHOT_DIR){const fs=require('node:fs');fs.mkdirSync(process.env.LUMI_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.LUMI_SCREENSHOT_DIR,'conversa-agenda-mobile.png'),fullPage:true});}
}));

test('conversa agenda: resposta perdida não anuncia sucesso nem duplica; vaga concorrente mantém reserva anterior',{timeout:100000},async()=>fixture(async({db,page,opticId,makeSlot})=>{
 const slots=[];for(let i=0;i<3;i++)slots.push(await makeSlot(i));
 await openAgenda(page);await bookUntilConfirm(page,'Cliente de teste com resposta perdida');
 let loseResponse=true;const observed=[];
 await page.route('**/rest/v1/rpc/book_conversation_appointment',async route=>{
  observed.push(route.request().postDataJSON().p_request_id);
  if(loseResponse){await route.fetch();await route.fulfill({status:502,contentType:'application/json',body:JSON.stringify({message:'Test: response unavailable'})});}
  else await route.continue();
 });
 await page.getByRole('button',{name:'Sim, confirmar',exact:true}).click();await page.getByRole('button',{name:'Tentar novamente',exact:true}).waitFor();
 assert.doesNotMatch(await messages(page).innerText(),/Agendamento de teste confirmado pelo banco/);
 const saved=await db.from('appointments').select('id,slot_id').single();assert.equal(saved.error,null);assert.equal(saved.data.slot_id,slots[0].id);
 loseResponse=false;await page.getByRole('button',{name:'Tentar novamente',exact:true}).click();await messages(page).getByText('Agendamento de teste confirmado pelo banco.',{exact:false}).waitFor();
 assert.equal(new Set(observed).size,1,'Reenvio deve conservar request_id');assert.equal((await db.from('appointments').select('id')).data.length,1);
 await page.getByRole('button',{name:'Remarcar agendamento',exact:true}).click();await firstOption(page).click();await firstOption(page).waitFor();
 assert.equal((await db.rpc('book_appointment',{p_optic_id:opticId,p_slot_id:slots[1].id,p_customer_name:'Reserva concorrente fictícia',p_request_id:randomUUID()})).error,null);
 await firstOption(page).click();await page.getByRole('button',{name:'Sim, confirmar',exact:true}).click();await page.getByRole('button',{name:'Consultar agenda novamente',exact:true}).waitFor();
 assert.doesNotMatch(await messages(page).innerText(),/Remarcação de teste confirmada pelo banco/);assert.equal((await db.from('appointments').select('slot_id').eq('id',saved.data.id).single()).data.slot_id,slots[0].id,'Sem troca automática para outra vaga');
 await page.getByRole('button',{name:'Consultar agenda novamente',exact:true}).click();await page.getByRole('button',{name:'Remarcar agendamento',exact:true}).click();await firstOption(page).click();await firstOption(page).click();await page.getByRole('button',{name:'Sim, confirmar',exact:true}).click();
 await messages(page).getByText('Remarcação de teste confirmada pelo banco.',{exact:false}).waitFor();assert.equal((await db.from('appointments').select('slot_id').eq('id',saved.data.id).single()).data.slot_id,slots[2].id);
 await page.route('**/rest/v1/rpc/get_conversation_agenda',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'Test unavailable'})}));
 await page.getByRole('button',{name:'Novo agendamento',exact:true}).click();await messages(page).getByText('Não foi possível consultar a agenda.',{exact:false}).waitFor();
 assert.doesNotMatch(await messages(page).innerText(),/Não há vagas livres/);
 await send(page,'menu');await page.getByRole('button',{name:'Orçamento de lentes',exact:true}).waitFor();
}));
