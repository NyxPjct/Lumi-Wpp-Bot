import net from 'node:net';
import http from 'node:http';
export const lumiAppId='lumi-wpp-bot';
export async function availableDemoPort(start=3010,attempts=11){
 for(let port=start;port<start+attempts;port++){
  const free=await new Promise((resolve,reject)=>{
   const server=net.createServer();
   server.once('error',error=>error.code==='EADDRINUSE'?resolve(false):reject(error));
   server.listen({host:'127.0.0.1',port,exclusive:true},()=>server.close(()=>resolve(true)));
  });
  if(free)return port;
 }
 throw new Error('As portas de demonstração 3010 a 3020 estão ocupadas. Feche uma instância anterior da Lumi e tente novamente.');
}
export function lumiResponding(port){
 return new Promise(resolve=>{
  const request=http.get({hostname:'127.0.0.1',port,path:'/',timeout:1500},response=>{
   response.resume();resolve(response.statusCode===200&&response.headers['x-lumi-app']===lumiAppId);
  });
  request.on('error',()=>resolve(false));request.on('timeout',()=>{request.destroy();resolve(false);});
 });
}
