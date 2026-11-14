const {test}=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const {once}=require('node:events');
test('iniciador pula porta ocupada sem encerrar o projeto que já está nela',async()=>{
 const {availableDemoPort}=await import('../demo-launcher-lib.mjs');
 const old=http.createServer((req,res)=>res.end('Projeto antigo'));old.listen(0,'127.0.0.1');await once(old,'listening');
 try{const port=old.address().port;const chosen=await availableDemoPort(port,10);assert.notEqual(chosen,port);assert.equal(old.listening,true);}finally{await new Promise(resolve=>old.close(resolve));}
});
test('iniciador só reconhece a resposta identificada como Lumi',async()=>{
 const {lumiResponding}=await import('../demo-launcher-lib.mjs');let lumi=false;
 const server=http.createServer((req,res)=>{if(lumi)res.setHeader('X-Lumi-App','lumi-wpp-bot');res.end('Lumi ou outro texto');});server.listen(0,'127.0.0.1');await once(server,'listening');
 try{assert.equal(await lumiResponding(server.address().port),false);lumi=true;assert.equal(await lumiResponding(server.address().port),true);}finally{await new Promise(resolve=>server.close(resolve));}
});
