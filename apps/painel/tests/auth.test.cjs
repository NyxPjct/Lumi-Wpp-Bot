const {chromium} = require('playwright-core');
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {randomUUID,randomBytes} = require('node:crypto');
const {execFileSync} = require('node:child_process');
const path = require('node:path');
const {createClient} = require('@supabase/supabase-js');
const root = path.resolve(__dirname,'../../..');

test('conta real: cadastro, configuração, reload, logout, login e edição', async () => {
  const config=JSON.parse(execFileSync(path.join(root,'node_modules/.bin/supabase'),['status','-o','json'],{
    cwd:root,env:{...process.env,SUPABASE_HOME:path.join(root,'.local/supabase-home')},encoding:'utf8',stdio:['ignore','pipe','pipe'],
  }));
  assert.ok(['127.0.0.1','localhost'].includes(new URL(config.API_URL).hostname));
  const email=`lumi-browser-${randomUUID()}@example.test`; const password=randomBytes(24).toString('base64url');
  const admin=createClient(config.API_URL,config.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  let userId; let opticId;
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',headless:true,args:['--no-sandbox']});
  try {
    const page=await browser.newPage({viewport:{width:1280,height:900}}); const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    const origin=process.env.LUMI_TEST_URL || 'http://127.0.0.1:3000';
    await page.goto(origin+'/configuracao');
    await page.getByRole('heading',{name:'Comece pela sua conta.'}).waitFor();
    await page.getByRole('link',{name:'Entrar ou criar conta',exact:false}).last().click();
    await page.getByLabel('E-mail',{exact:true}).fill(email);
    await page.getByLabel('Senha',{exact:true}).fill(password);
    await page.getByRole('button',{name:'Criar minha conta',exact:true}).click();
    await page.getByRole('heading',{name:'Bem-vindo à Lumi.'}).waitFor();
    // Track only this test account for reliable cleanup even if a later UI assertion fails.
    const lookup=await admin.auth.admin.listUsers({page:1,perPage:1000});
    userId=lookup.data.users.find(u=>u.email===email)?.id;
    assert.ok(userId);
    await page.getByRole('link',{name:'Configurar minha ótica',exact:false}).last().click();
    await page.getByLabel('Nome da ótica').fill('Ótica persistente');
    await page.getByLabel('Endereço',{exact:false}).fill('Rua de Teste, 20');
    await page.getByRole('button',{name:'Continuar',exact:false}).click();
    await page.getByLabel('Horário de atendimento').fill('Segunda a sábado, das 8h às 17h.');
    await page.getByLabel('Formas de pagamento').fill('Pix e débito.');
    await page.getByLabel('Prazo dos óculos').fill('Confirme com um atendente.');
    await page.getByRole('button',{name:'Continuar',exact:false}).click();
    assert.equal(await page.getByRole('button',{name:'Conectar meu WhatsApp',exact:true}).isDisabled(),true);
    await page.getByRole('button',{name:'Salvar configurações',exact:true}).click();
    await page.getByRole('heading',{name:'Configurações salvas na sua ótica.'}).waitFor();
    opticId=(await admin.from('optic_memberships').select('optic_id').eq('user_id',userId).single()).data.optic_id;
    await page.getByRole('link',{name:'Testar atendimento',exact:false}).click();
    await page.getByRole('button',{name:'Aceito continuar'}).click();
    await page.getByRole('button',{name:'Dúvidas frequentes',exact:true}).click();
    await page.getByRole('textbox',{name:'Sua mensagem'}).fill('1');
    await page.getByRole('button',{name:'Enviar mensagem'}).click();
    await page.getByText('Segunda a sábado, das 8h às 17h.',{exact:true}).waitFor();
    await page.goto(origin+'/conta');
    await page.getByRole('button',{name:'Sair da conta',exact:true}).click();
    await page.getByRole('button',{name:'Entrar',exact:true}).click();
    await page.getByLabel('E-mail',{exact:true}).fill(email);
    await page.getByLabel('Senha',{exact:true}).fill('invalid-password-for-test');
    await page.getByRole('button',{name:'Entrar na Lumi',exact:true}).click();
    await page.getByRole('alert').filter({hasText:'Não foi possível entrar'}).waitFor();
    await page.getByLabel('Senha',{exact:true}).fill(password);
    await page.getByRole('button',{name:'Entrar na Lumi',exact:true}).click();
    await page.getByRole('heading',{name:'Bem-vindo à Lumi.'}).waitFor();
    await page.goto(origin+'/configuracao');
    await page.getByLabel('Nome da ótica').waitFor();
    assert.equal(await page.getByLabel('Nome da ótica').inputValue(),'Ótica persistente');
    await page.getByLabel('Nome da ótica').fill('Ótica atualizada');
    await page.getByRole('button',{name:'Continuar',exact:false}).click();
    await page.getByRole('button',{name:'Continuar',exact:false}).click();
    await page.getByRole('button',{name:'Salvar configurações',exact:true}).click();
    await page.getByRole('heading',{name:'Configurações salvas na sua ótica.'}).waitFor();
    await page.reload();
    await page.getByLabel('Nome da ótica').waitFor();
    assert.equal(await page.getByLabel('Nome da ótica').inputValue(),'Ótica atualizada');
    assert.equal(await page.getByRole('button',{name:'Apagar configuração desta aba'}).count(),0);
    await page.setViewportSize({width:390,height:844});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    assert.deepEqual(errors,[]);
  } finally {
    await browser.close();
    if (userId) {
      if (!opticId) opticId=(await admin.from('optic_memberships').select('optic_id').eq('user_id',userId).maybeSingle()).data?.optic_id;
      if (opticId) assert.equal((await admin.from('optics').delete().eq('id',opticId)).error,null);
      assert.equal((await admin.auth.admin.deleteUser(userId)).error,null);
    }
  }
});
