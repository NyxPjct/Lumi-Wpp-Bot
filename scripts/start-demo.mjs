import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {availableDemoPort,lumiResponding} from './demo-launcher-lib.mjs';
const require=createRequire(import.meta.url);
const root=fileURLToPath(new URL('../',import.meta.url));
let child;let stopping=false;
function stop(){
 if(stopping)return;stopping=true;
 if(child&&child.exitCode===null&&child.signalCode===null){
  if(process.platform==='win32')spawn('taskkill',['/pid',String(child.pid),'/t','/f'],{stdio:'ignore',windowsHide:true}).on('error',()=>child.kill());
  else child.kill('SIGTERM');
 }
}
process.on('SIGINT',stop);process.on('SIGTERM',stop);
try{
 if(Number(process.versions.node.split('.')[0])<22)throw new Error('A Lumi precisa do Node.js 22 ou mais recente. Atualize o Node.js e abra novamente.');
 let next;
 try{next=require.resolve('next/dist/bin/next');}catch{throw new Error('Dependências não instaladas. Execute npm ci na pasta Lumi-Wpp-Bot.');}
 const port=await availableDemoPort();
 console.log('\nLUMI — DEMONSTRAÇÃO SEM DOCKER\n');
 console.log('Configuração, FAQ e orçamento de demonstração estão disponíveis.');
 console.log('Agenda e pedidos com banco exigem Docker + Supabase local.\n');
 child=spawn(process.execPath,[next,'dev','--hostname','127.0.0.1','--port',String(port)],{
  cwd:path.join(root,'apps/painel'),env:{...process.env,NEXT_PUBLIC_LUMI_MODE:'demo'},stdio:'inherit',windowsHide:false,
 });
 let exited=false;let spawnError;
 child.on('error',error=>{spawnError=error;exited=true;});
 child.on('exit',code=>{exited=true;if(!stopping&&code)process.exitCode=code;});
 const deadline=Date.now()+180000;
 while(Date.now()<deadline&&!stopping){
  if(exited)throw new Error(spawnError?'Não foi possível iniciar a Lumi.':'O servidor da Lumi encerrou. Veja a mensagem acima e feche uma instância anterior da mesma pasta, se houver.');
  if(await lumiResponding(port))break;
  await new Promise(resolve=>setTimeout(resolve,300));
 }
 if(!stopping){
  if(!await lumiResponding(port))throw new Error('A Lumi não ficou disponível a tempo. Veja a mensagem do servidor nesta janela.');
  const url=`http://127.0.0.1:${port}/`;
  console.log(`\nLUMI CONFIRMADA: ${url}`);
  console.log('Mantenha esta janela aberta. Para encerrar a Lumi, use Ctrl+C.\n');
  if(process.env.LUMI_OPEN_BROWSER!=='0'){
   const command=process.platform==='win32'?'rundll32.exe':process.platform==='darwin'?'open':'xdg-open';
   const args=process.platform==='win32'?['url.dll,FileProtocolHandler',url]:[url];
   const opener=spawn(command,args,{detached:true,stdio:'ignore',windowsHide:true});
   opener.on('error',()=>console.log('Abra manualmente o endereço LUMI CONFIRMADA mostrado acima.'));opener.unref();
  }
 }
}catch(error){console.error(`\nLumi: ${error.message}`);stop();process.exitCode=1;}
