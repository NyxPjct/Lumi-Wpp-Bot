const {chromium}=require('playwright-core');
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {randomUUID,randomBytes}=require('node:crypto');
const {execFileSync}=require('node:child_process');
const path=require('node:path');
const {createClient}=require('@supabase/supabase-js');
const root=path.resolve(__dirname,'../../..');
test('agenda no navegador: criar, reservar, remarcar, cancelar e retirar horário no fuso de Brasília',async()=>{
 const config=JSON.parse(execFileSync(path.join(root,'node_modules/.bin/supabase'),['status','-o','json'],{cwd:root,env:{...process.env,SUPABASE_HOME:path.join(root,'.local/supabase-home')},encoding:'utf8',stdio:['ignore','pipe','pipe']}));
 assert.ok(['127.0.0.1','localhost'].includes(new URL(config.API_URL).hostname));
 const options={auth:{persistSession:false,autoRefreshToken:false}};
 const db=createClient(config.API_URL,config.ANON_KEY,options);const admin=createClient(config.API_URL,config.SERVICE_ROLE_KEY,options);
 const email=`agenda-ui-${randomUUID()}@example.test`;const password=randomBytes(24).toString('base64url');
 const signup=await db.auth.signUp({email,password});assert.equal(signup.error,null);const userId=signup.data.user.id;let opticId;
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try{
  const created=await db.rpc('create_optic',{p_name:'Ótica agenda navegador',p_address:'Rua Teste, 120',p_hours:'Das 9h às 18h',p_payments:'Pix e cartões',p_delivery:'Confirme com atendente'});assert.equal(created.error,null);opticId=created.data;
  const page=await browser.newPage({viewport:{width:1440,height:1100},timezoneId:'Asia/Tokyo'});const errors=[];page.on('pageerror',error=>errors.push(error.message));
  const origin=process.env.LUMI_TEST_URL||'http://127.0.0.1:3000';
  await page.goto(origin+'/conta');await page.getByRole('button',{name:'Entrar',exact:true}).click();
  await page.getByLabel('E-mail',{exact:true}).fill(email);await page.getByLabel('Senha',{exact:true}).fill(password);await page.getByRole('button',{name:'Entrar na Lumi',exact:true}).click();
  await page.getByRole('heading',{name:'Bem-vindo à Lumi.'}).waitFor();await page.goto(origin+'/agenda');
  const day=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(Date.now()+3*86400000));
  for(const time of ['10:00','11:00']){
   await page.getByLabel('Data e hora · Brasília',{exact:true}).fill(`${day}T${time}`);
   await page.getByRole('button',{name:'Criar horário',exact:true}).click();
   await page.getByRole('status').filter({hasText:'Horário de teste criado.'}).waitFor();
  }
  await page.waitForFunction(()=>document.querySelectorAll('.agendaSlot').length===2);
  const slots=await db.from('appointment_slots').select('id,starts_at').order('starts_at');assert.equal(slots.error,null);
  assert.equal(new Date(slots.data[0].starts_at).toISOString(),new Date(`${day}T10:00:00-03:00`).toISOString(),'Fuso do navegador não pode deslocar o horário da ótica');
  await page.getByLabel('Horário livre',{exact:true}).selectOption(slots.data[0].id);
  await page.getByLabel('Nome fictício para teste',{exact:true}).fill('Cliente de teste da agenda');
  await page.getByRole('button',{name:'Confirmar agendamento de teste',exact:true}).click();
  await page.getByRole('status').filter({hasText:'Agendamento de teste confirmado.'}).waitFor();
  await page.locator('.appointmentCard').waitFor();assert.match(await page.locator('.appointmentCard').innerText(),/10:00/);
  const appointmentId=await page.locator('.appointmentCard').getAttribute('data-appointment-id');
  await page.getByLabel('Novo horário',{exact:true}).selectOption(slots.data[1].id);
  await page.getByRole('button',{name:'Remarcar',exact:true}).click();
  await page.getByRole('status').filter({hasText:'Agendamento remarcado; o horário anterior foi liberado.'}).waitFor();
  await page.waitForFunction(()=>document.querySelector('.appointmentCard>strong')?.textContent.includes('11:00'));
  await page.reload();await page.locator('.appointmentCard').waitFor();assert.equal(await page.locator('.appointmentCard').getAttribute('data-appointment-id'),appointmentId);assert.match(await page.locator('.appointmentCard').innerText(),/11:00/);
  await page.getByRole('button',{name:'Cancelar agendamento',exact:true}).click();await page.getByRole('button',{name:'Manter agendamento',exact:true}).click();
  assert.equal((await db.from('appointments').select('status').eq('id',appointmentId).single()).data.status,'confirmed');
  await page.getByRole('button',{name:'Cancelar agendamento',exact:true}).click();await page.getByRole('button',{name:'Confirmar cancelamento',exact:true}).click();
  await page.getByRole('status').filter({hasText:'Agendamento cancelado; o horário foi liberado.'}).waitFor();
  await page.waitForFunction(()=>document.querySelector('.appointmentCard .badge')?.textContent.includes('Cancelado'));
  const slot=page.locator(`[data-slot-id="${slots.data[0].id}"]`);
  await slot.getByRole('button',{name:'Retirar horário',exact:true}).click();await slot.getByRole('button',{name:'Confirmar retirada',exact:true}).click();
  await page.getByRole('status').filter({hasText:'Horário retirado da agenda.'}).waitFor();
  await page.reload();await page.locator('.agendaSlot').first().waitFor();
  assert.match(await slot.innerText(),/Retirado/);assert.match(await page.locator('.appointmentCard').innerText(),/Cancelado/);
  await page.getByLabel('Horário livre',{exact:true}).selectOption(slots.data[1].id);
  await page.getByLabel('Nome fictício para teste',{exact:true}).fill('X'.repeat(80));await page.getByRole('button',{name:'Confirmar agendamento de teste',exact:true}).click();
  await page.getByRole('status').filter({hasText:'Agendamento de teste confirmado.'}).waitFor();
  await page.waitForFunction(()=>document.querySelectorAll('.appointmentCard').length===2);
  await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  if(process.env.LUMI_SCREENSHOT_DIR){const fs=require('node:fs');fs.mkdirSync(process.env.LUMI_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.LUMI_SCREENSHOT_DIR,'agenda-mobile.png'),fullPage:true});}
  assert.deepEqual(errors,[]);
 }finally{
  await browser.close();if(opticId)assert.equal((await admin.from('optics').delete().eq('id',opticId)).error,null);assert.equal((await admin.auth.admin.deleteUser(userId)).error,null);
 }
});
