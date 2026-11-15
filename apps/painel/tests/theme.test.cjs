const {test}=require('node:test');
const assert=require('node:assert/strict');
const {chromium}=require('playwright-core');
const {fillImport}=require('./catalog-fixture.cjs');
const origin=process.env.LUMI_TEST_URL||'http://127.0.0.1:3000';
const launch=()=>chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const themeIs=(page,value)=>page.waitForFunction(value=>document.documentElement.dataset.theme===value,value);

test('tema: alternância preserva os dados, aplica cores aos produtos e persiste entre telas e recargas no celular',async()=>{
  const browser=await launch();
  try{
    const context=await browser.newContext({colorScheme:'light',viewport:{width:1440,height:1050}});
    const page=await context.newPage();const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('console',message=>{if(message.type()==='error'&&/hydrat/i.test(message.text()))errors.push(message.text());});
    await page.goto(origin+'/tabelas');await themeIs(page,'light');
    await page.getByRole('button',{name:'Importar tabela',exact:false}).click();await fillImport(page);
    const toggle=page.getByRole('button',{name:'Modo escuro',exact:true});await toggle.click();await themeIs(page,'dark');
    assert.equal(await toggle.getAttribute('aria-pressed'),'true');
    assert.equal(await page.getByLabel('Nome da tabela',{exact:true}).inputValue(),'Tabela de teste','Alternar tema preserva o formulário');
    const colors=await page.evaluate(()=>({
      page:getComputedStyle(document.body).backgroundColor,
      card:getComputedStyle(document.querySelector('.importPanel')).backgroundColor,
      input:getComputedStyle(document.querySelector('#table-name')).backgroundColor,
      table:getComputedStyle(document.querySelector('.productTable th')).backgroundColor,
      scheme:getComputedStyle(document.documentElement).colorScheme,
    }));
    assert.equal(colors.page,'rgb(13, 23, 19)');assert.equal(colors.scheme,'dark');
    for(const value of [colors.card,colors.input,colors.table])assert.notEqual(value,'rgb(255, 255, 255)');
    await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Publicar tabela',exact:true}).click();
    await page.getByRole('status').filter({hasText:'Tabela publicada nesta aba'}).waitFor();
    await page.getByRole('button',{name:'Consultar produtos',exact:false}).click();
    await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:'.local/tema-escuro-desktop.png',fullPage:true});
    await page.setViewportSize({width:390,height:844});
    for(const path of ['/','/configuracao','/precos','/agenda','/pedidos','/orcamentos','/conta','/tabelas']){
      await page.goto(origin+path);await themeIs(page,'dark');
      await page.getByRole('button',{name:'Modo escuro',exact:true}).waitFor();
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,path);
    }
    await page.getByRole('button',{name:'Consultar produtos',exact:false}).click();await page.screenshot({path:'.local/tema-escuro-mobile.png',fullPage:true});
    await page.reload();await themeIs(page,'dark');
    await page.getByRole('button',{name:'Modo escuro',exact:true}).click();await themeIs(page,'light');
    await page.reload();await themeIs(page,'light');assert.equal(await page.evaluate(()=>localStorage.getItem('lumi:theme')),'light');
    assert.deepEqual(errors,[]);
  }finally{await browser.close();}
});

test('tema: segue o sistema até haver escolha e sincroniza a preferência entre abas',async()=>{
  const browser=await launch();
  try{
    const context=await browser.newContext({colorScheme:'dark'});const page=await context.newPage();
    await page.goto(origin+'/tabelas');await themeIs(page,'dark');
    await page.emulateMedia({colorScheme:'light'});await themeIs(page,'light');
    await page.emulateMedia({colorScheme:'dark'});await themeIs(page,'dark');
    await page.getByRole('button',{name:'Modo escuro',exact:true}).click();await themeIs(page,'light');
    await page.emulateMedia({colorScheme:'light'});await page.emulateMedia({colorScheme:'dark'});await themeIs(page,'light');
    const other=await context.newPage();await other.goto(origin+'/tabelas');await themeIs(other,'light');
    await other.getByRole('button',{name:'Modo escuro',exact:true}).click();await themeIs(other,'dark');await themeIs(page,'dark');
    await other.evaluate(()=>localStorage.removeItem('lumi:theme'));await page.emulateMedia({colorScheme:'light'});await themeIs(page,'light');
  }finally{await browser.close();}
});

test('tema: preferência escura entra antes da hidratação e armazenamento bloqueado não impede alternar',async()=>{
  const browser=await launch();
  try{
    const context=await browser.newContext({colorScheme:'light',storageState:{cookies:[],origins:[{origin,localStorage:[{name:'lumi:theme',value:'dark'}]}]}});
    const early=await context.newPage();await early.route(/\/_next\/static\/chunks\/.*\.js(?:\?|$)/,route=>route.abort());
    await early.goto(origin+'/tabelas');await themeIs(early,'dark');
    assert.equal(await early.evaluate(()=>getComputedStyle(document.body).backgroundColor),'rgb(13, 23, 19)','O tema não depende do carregamento do React');
    const page=await browser.newPage({colorScheme:'dark'});const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.addInitScript(()=>{
      const originalGet=Storage.prototype.getItem,originalSet=Storage.prototype.setItem;
      Storage.prototype.getItem=function(key){if(key==='lumi:theme')throw new Error('blocked');return originalGet.call(this,key);};
      Storage.prototype.setItem=function(key,value){if(key==='lumi:theme')throw new Error('blocked');return originalSet.call(this,key,value);};
    });
    await page.goto(origin+'/tabelas');await themeIs(page,'dark');await page.getByRole('button',{name:'Modo escuro',exact:true}).click();await themeIs(page,'light');
    await page.emulateMedia({colorScheme:'light'});await page.emulateMedia({colorScheme:'dark'});await themeIs(page,'light');assert.deepEqual(errors,[]);
  }finally{await browser.close();}
});
