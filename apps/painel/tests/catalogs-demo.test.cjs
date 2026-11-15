const {test}=require('node:test');
const assert=require('node:assert/strict');
const {chromium}=require('playwright-core');
const {fillImport,quoteProduct}=require('./catalog-fixture.cjs');
const origin=process.env.LUMI_TEST_URL||'http://127.0.0.1:3000';
const launch=()=>chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
test('tabelas demo: importa Excel com abas, converte por lente, confere, consulta, atualiza e usa no orçamento',async()=>{
  const browser=await launch();
  try{
    const page=await browser.newPage({viewport:{width:1440,height:1050}});const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto(origin+'/tabelas');
    assert.equal(await page.locator('.logo svg path').count(),5,'Quatro folhas e um caule');
    await page.getByRole('button',{name:'Importar tabela',exact:false}).click();
    await fillImport(page,{excel:true});
    await page.getByLabel('Os preços do arquivo são',{exact:true}).selectOption('lens');
    await page.getByRole('status').filter({hasText:'multiplicados por 2'}).waitFor();
    assert.equal(await page.getByRole('button',{name:'Publicar tabela',exact:true}).isDisabled(),true,'É necessário conferir');
    await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Publicar tabela',exact:true}).click();
    await page.getByRole('status').filter({hasText:'Tabela publicada nesta aba'}).waitFor();
    await page.getByRole('button',{name:'Consultar produtos',exact:false}).click();
    assert.match(await page.locator('.catalogDetail').innerText(),/250,50/);
    await page.reload();await page.locator('.catalogCard').waitFor();assert.equal(await page.locator('.catalogCard').count(),1);
    await quoteProduct(page,origin);assert.match(await page.locator('.quoteSummary').innerText(),/250,50/);assert.match(await page.locator('.quoteSummary').innerText(),/Marca própria/);assert.match(await page.locator('.quoteSummary').innerText(),/Antirreflexo/);
    assert.equal(await page.getByRole('button',{name:'Salvar orçamento de teste',exact:true}).count(),0);
    await page.goto(origin+'/tabelas');await page.getByRole('button',{name:'Atualizar tabela Tabela de teste',exact:true}).click();
    await fillImport(page);await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Publicar atualização',exact:true}).click();
    await page.locator('.catalogCard').waitFor();assert.equal(await page.locator('.catalogCard').count(),1,'Substituição não duplica a tabela');
    await quoteProduct(page,origin);assert.match(await page.locator('.quoteSummary').innerText(),/125,25/);
    await page.setViewportSize({width:390,height:844});await page.goto(origin+'/tabelas');await page.getByRole('button',{name:'Consultar produtos',exact:false}).click();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await page.screenshot({path:'.local/tabelas-mobile.png',fullPage:true});
    await page.setViewportSize({width:1440,height:1050});await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:'.local/tabelas-desktop.png',fullPage:true});
    assert.deepEqual(errors,[]);
  }finally{await browser.close();}
});
test('importação demo bloqueia linhas inválidas e falha de armazenamento sem falsa publicação',async()=>{
  const browser=await launch();
  try{
    const page=await browser.newPage();await page.goto(origin+'/tabelas');await page.getByRole('button',{name:'Importar tabela',exact:false}).click();
    await page.getByLabel('Selecione sua planilha Excel ou CSV',{exact:true}).setInputFiles({name:'invalido.csv',mimeType:'text/csv',buffer:Buffer.from('Produto;Tipo;Preço\nLente;Monofocal;\n')});
    await page.getByRole('alert').filter({hasText:'Preço inválido'}).waitFor();assert.equal(await page.getByRole('button',{name:'Publicar tabela',exact:true}).isDisabled(),true);
    await fillImport(page);await page.getByRole('checkbox').check();
    await page.evaluate(()=>{Storage.prototype.setItem=function(){throw new Error('blocked');};});
    await page.getByRole('button',{name:'Publicar tabela',exact:true}).click();
    await page.getByRole('alert').filter({hasText:'Não foi possível salvar nesta aba'}).waitFor();assert.equal(await page.locator('.catalogCard').count(),0);
    await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  }finally{await browser.close();}
});
