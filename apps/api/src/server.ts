import {buildApp} from './app.js';
// A transport skeleton must never acknowledge customer messages without durable handling.
// Until the queue/storage adapter exists, messages trigger 503 and Meta can retry.
const app = buildApp({
  appSecret: process.env.WA_APP_SECRET ?? '',
  verifyToken: process.env.WA_VERIFY_TOKEN ?? '',
  phoneNumberIds: (process.env.WA_PHONE_NUMBER_IDS ?? '').split(',').map(s => s.trim()).filter(Boolean),
  onMessage: async () => {throw new Error('Durable message queue not configured');},
});
await app.listen({port: Number(process.env.PORT ?? 3001), host: process.env.HOST ?? '127.0.0.1'});
console.log('Lumi: webhook iniciado; processamento real de mensagens ainda não configurado.');
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, async () => {await app.close(); process.exit(0);});
