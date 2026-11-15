import {catalogLimit,parseCsv,type Spreadsheet,type SpreadsheetCell} from '@lumi/shared';
export interface WorkbookSheet {name:string;grid:Spreadsheet}
export async function readPriceFile(file:File):Promise<WorkbookSheet[]>{
  if(file.size>5*1024*1024)throw new Error('Use um arquivo de até 5 MB e no máximo 1.000 produtos por tabela.');
  const extension=file.name.split('.').pop()?.toLowerCase();
  let sheets:WorkbookSheet[];
  if(extension==='csv'){
    const bytes=await file.arrayBuffer();let content:string;
    try{content=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{content=new TextDecoder('windows-1252').decode(bytes);}
    sheets=[{name:'CSV',grid:parseCsv(content)}];
  }else if(extension==='xlsx'){
    const {default:readXlsx}=await import('read-excel-file/browser');
    try{
      const cellValue=(cell:unknown):SpreadsheetCell=>{
        if(cell===null||typeof cell==='string'||typeof cell==='number'||typeof cell==='boolean'||cell instanceof Date)return cell;
        throw new Error('Célula não reconhecida.');
      };
      sheets=(await readXlsx(file)).map(sheet=>({name:sheet.sheet,grid:sheet.data.map(row=>row.map(cellValue))}));
    }catch{throw new Error('Não foi possível ler o Excel. Use .xlsx sem senha, com uma linha por produto. Arquivos .xls antigos devem ser salvos como .xlsx.');}
  }else throw new Error('Formato não suportado. Escolha Excel (.xlsx) ou CSV.');
  sheets=sheets.filter(sheet=>sheet.grid.length);
  if(!sheets.length||sheets.length>30)throw new Error('A planilha deve ter entre 1 e 30 abas com dados.');
  if(sheets.some(sheet=>sheet.grid.length>catalogLimit+25||sheet.grid.some(row=>row.length>100||row.some(cell=>String(cell??'').length>2000))))throw new Error('A planilha excede o limite de linhas, colunas ou tamanho das células. Separe em tabelas de até 1.000 produtos.');
  return sheets;
}
