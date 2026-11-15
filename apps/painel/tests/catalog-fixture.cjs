const {zipSync,strToU8}=require('fflate');
const csv='SKU;Descrição;Categoria;Valor de venda;Tratamentos;Índice;Observações\nTEST-01;Lente exemplo premium;Monofocal;125,25;Antirreflexo;1.60;Somente teste, sem armação\nTEST-02;Lente exemplo progressiva;Multifocal;500,00;Antirreflexo;1.67;Demonstração';
function xlsx(){
  const xmlEscape=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
  const sheet=rows=>`<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows.map((row,index)=>`<row r="${index+1}">${row.map((value,col)=>typeof value==='number'?`<c r="${String.fromCharCode(65+col)}${index+1}"><v>${value}</v></c>`:`<c r="${String.fromCharCode(65+col)}${index+1}" t="inlineStr"><is><t>${xmlEscape(value)}</t></is></c>`).join('')}</row>`).join('')}</sheetData></worksheet>`;
  const entries={
    '[Content_Types].xml':'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
    '_rels/.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/workbook.xml':'<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Apresentação" sheetId="1" r:id="rId1"/><sheet name="Produtos" sheetId="2" r:id="rId2"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/></Relationships>',
    'xl/worksheets/sheet1.xml':sheet([['Arquivo demonstrativo. Use a aba Produtos.']]),
    'xl/worksheets/sheet2.xml':sheet([['Planilha teste'],['SKU','Descrição','Categoria','Valor de venda','Tratamentos','Índice','Observações'],['TEST-01','Lente exemplo premium','Monofocal',125.25,'Antirreflexo','1.60','Somente teste, sem armação'],['TEST-02','Lente exemplo progressiva','Multifocal',500,'Antirreflexo','1.67','Demonstração']]),
  };
  return Buffer.from(zipSync(Object.fromEntries(Object.entries(entries).map(([key,value])=>[key,strToU8(value)]))));
}
async function fillImport(page,{name='Tabela de teste',brand='Marca própria',excel=false,expired=false}={}){
  await page.getByLabel('Nome da tabela',{exact:true}).fill(name);
  await page.getByLabel('Marca ou laboratório',{exact:true}).fill(brand);
  await page.getByLabel('Válida a partir de',{exact:true}).fill('2020-01-01');
  if(expired)await page.getByLabel('Válida até (opcional)',{exact:true}).fill('2020-12-31');
  await page.getByLabel('Selecione sua planilha Excel ou CSV',{exact:true}).setInputFiles({name:excel?'teste.xlsx':'teste.csv',mimeType:excel?'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':'text/csv',buffer:excel?xlsx():Buffer.from(csv)});
  if(excel){await page.getByLabel('Aba da planilha',{exact:true}).selectOption({label:'Produtos'});}
  await page.getByRole('status').filter({hasText:'2 produtos prontos'}).waitFor();
}
async function quoteProduct(page,origin){
  await page.goto(origin+'/');await page.getByRole('button',{name:'Aceito continuar',exact:true}).click();
  await page.getByRole('button',{name:'Orçamento de lentes',exact:true}).click();
  async function send(value){await page.getByRole('textbox',{name:'Sua mensagem'}).fill(value);await page.getByRole('button',{name:'Enviar mensagem',exact:true}).click();}
  await send('1');await page.locator('.messages').getByText('Qual tabela deseja consultar',{exact:false}).waitFor();
  await send('1');await page.locator('.messages').getByText('Escolha o produto da tabela.',{exact:false}).waitFor();
  await send('1');await page.locator('.quoteSummary').waitFor();
}
module.exports={csv,xlsx,fillImport,quoteProduct};
