const {chromium} = require('playwright-core');
const assert = require('node:assert/strict');
const {test} = require('node:test');
const origin = process.env.LUMI_TEST_URL || 'http://127.0.0.1:3000';
const launch = () => chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless:true,args:['--no-sandbox']});

async function fillBusiness(page) {
  await page.getByLabel('Nome da ótica').fill('  Ótica Boa Vista  ');
  await page.getByLabel('Endereço', {exact:false}).fill('Rua Teste, 120 · Cidade exemplo');
  await page.getByRole('button', {name:'Continuar',exact:false}).click();
  await page.getByLabel('Horário de atendimento').fill('Segunda a sábado, das 8h às 17h.');
  await page.getByLabel('Formas de pagamento').fill('Pix e débito.');
  await page.getByLabel('Prazo dos óculos').fill('Confirme o prazo com um atendente.');
  await page.getByRole('button', {name:'Continuar',exact:false}).click();
}

test('onboarding valida, preserva edições, personaliza FAQ e permite apagar os dados locais', async () => {
  const browser = await launch();
  try {
    const page = await browser.newPage({viewport:{width:1440,height:1000}});
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(origin + '/configuracao');
    await page.getByRole('button', {name:'Continuar',exact:false}).click();
    await page.getByText('Nome da ótica deve ter entre', {exact:false}).waitFor();
    await page.getByLabel('Nome da ótica').fill('  ');
    await page.getByRole('button', {name:'Continuar',exact:false}).click();
    assert.equal(await page.getByLabel('Nome da ótica').getAttribute('aria-invalid'), 'true');
    await fillBusiness(page);
    assert.equal(await page.getByRole('button', {name:'Conectar meu WhatsApp',exact:true}).isDisabled(), true);
    await page.getByRole('button', {name:'Voltar',exact:true}).click();
    assert.equal(await page.getByLabel('Horário de atendimento').inputValue(), 'Segunda a sábado, das 8h às 17h.');
    await page.getByRole('button', {name:'Continuar',exact:false}).click();
    await page.getByRole('button', {name:'Salvar e testar demonstração'}).click();
    await page.getByRole('heading', {name:'Sua demonstração está personalizada.'}).waitFor();
    await page.getByRole('link', {name:'Testar atendimento',exact:false}).click();
    await page.getByText('Atendimento da Ótica Boa Vista',{exact:true}).waitFor();
    await page.getByRole('button', {name:'Aceito continuar'}).click();
    await page.getByRole('button', {name:'Dúvidas frequentes',exact:true}).click();
    await page.getByRole('textbox', {name:'Sua mensagem'}).fill('1');
    await page.getByRole('button', {name:'Enviar mensagem'}).click();
    await page.getByText('Segunda a sábado, das 8h às 17h.', {exact:true}).waitFor();
    await page.goto(origin + '/configuracao');
    assert.equal(await page.getByLabel('Nome da ótica').inputValue(), 'Ótica Boa Vista');
    await page.setViewportSize({width:390,height:844});
    await page.getByLabel('Nome da ótica').fill('X'.repeat(80));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.getByRole('button', {name:'Apagar configuração desta aba'}).click();
    await page.getByRole('button', {name:'Cancelar',exact:true}).click();
    assert.equal(await page.getByRole('button', {name:'Apagar configuração desta aba'}).count(), 1);
    await page.getByRole('button', {name:'Apagar configuração desta aba'}).click();
    await page.getByRole('button', {name:'Confirmar exclusão local'}).click();
    assert.equal(await page.getByLabel('Nome da ótica').inputValue(), '');
    assert.equal(await page.evaluate(() => sessionStorage.getItem('lumi:demo:settings:v1')), null);
    await page.getByRole('link', {name:'Simulador',exact:true}).click();
    await page.getByText('Vamos dar a sua cara à Lumi?', {exact:true}).waitFor();
    assert.deepEqual(errors, []);
  } finally {await browser.close();}
});

test('configuração corrompida não quebra o painel', async () => {
  const browser = await launch();
  try {
    const page = await browser.newPage();
    await page.addInitScript(() => sessionStorage.setItem('lumi:demo:settings:v1', '{invalid'));
    await page.goto(origin + '/configuracao');
    await page.getByRole('status').filter({hasText:'Não foi possível acessar'}).waitFor();
    assert.equal(await page.getByLabel('Nome da ótica').inputValue(), '');
  } finally {await browser.close();}
});

test('falha de armazenamento não apresenta configuração como salva', async () => {
  const browser = await launch();
  try {
    const page = await browser.newPage();
    await page.addInitScript(() => {Storage.prototype.setItem = function() {throw new Error('storage blocked');};});
    await page.goto(origin + '/configuracao');
    await fillBusiness(page);
    await page.getByRole('button', {name:'Salvar e testar demonstração'}).click();
    await page.getByRole('alert').filter({hasText:'Não foi possível salvar nesta aba'}).waitFor();
    assert.equal(await page.getByRole('heading', {name:'Sua demonstração está personalizada.'}).count(), 0);
    assert.equal(await page.getByRole('button', {name:'Salvar e testar demonstração'}).isEnabled(), true);
  } finally {await browser.close();}
});
