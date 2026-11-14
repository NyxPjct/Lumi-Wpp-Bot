import Fastify from 'fastify';
import {createHmac, timingSafeEqual} from 'node:crypto';

export interface InboundMessage {tenantId: string; from: string; id: string; type: string; text?: string}
interface Options {
  appSecret: string;
  verifyToken: string;
  phoneNumberIds: string[];
  // Resolve an allowlisted phone ID to a tenant. Persistence/queue adapter is the next stage.
  onMessage: (message: InboundMessage) => Promise<void>;
}
export function buildApp(options: Options) {
  if (!options.appSecret || !options.verifyToken || !options.phoneNumberIds.length) throw new Error('Configure WA_APP_SECRET, WA_VERIFY_TOKEN e WA_PHONE_NUMBER_IDS.');
  const app = Fastify({logger: false, bodyLimit: 256 * 1024});
  app.removeContentTypeParser('application/json');
  app.addContentTypeParser('application/json', {parseAs: 'buffer'}, (_req, body, done) => done(null, body));
  app.get('/health', async () => ({name: 'Lumi', status: 'ok', mode: 'webhook-foundation'}));
  app.get<{Querystring: Record<string, string>}>('/webhook', async (req, reply) => {
    if (req.query['hub.mode'] !== 'subscribe' || req.query['hub.verify_token'] !== options.verifyToken || !req.query['hub.challenge']) return reply.code(403).send({error: 'Verificação recusada'});
    return reply.type('text/plain').send(req.query['hub.challenge']);
  });
  app.post('/webhook', async (req, reply) => {
    const raw = req.body;
    const signature = req.headers['x-hub-signature-256'];
    if (!Buffer.isBuffer(raw) || typeof signature !== 'string' || !/^sha256=[a-f0-9]{64}$/.test(signature)) return reply.code(401).send({error: 'Assinatura inválida'});
    const expected = createHmac('sha256', options.appSecret).update(raw).digest();
    if (!timingSafeEqual(expected, Buffer.from(signature.slice(7), 'hex'))) return reply.code(401).send({error: 'Assinatura inválida'});
    let payload: any;
    try {payload = JSON.parse(raw.toString('utf8'));} catch {return reply.code(400).send({error: 'JSON inválido'});}
    if (payload?.object !== 'whatsapp_business_account' || !Array.isArray(payload.entry)) return reply.code(400).send({error: 'Evento inválido'});
    try {
      for (const entry of payload.entry) {
        if (!Array.isArray(entry?.changes)) continue;
        for (const change of entry.changes) {
          const value = change?.value;
          const phoneId = value?.metadata?.phone_number_id;
          if (!options.phoneNumberIds.includes(phoneId)) continue;
          if (!Array.isArray(value?.messages)) continue;
          for (const message of value.messages) {
            if (typeof message?.id !== 'string' || typeof message?.from !== 'string' || typeof message?.type !== 'string') continue;
            await options.onMessage({tenantId: phoneId, from: message.from, id: message.id, type: message.type, text: typeof message.text?.body === 'string' ? message.text.body : undefined});
          }
        }
      }
    } catch {return reply.code(503).send({error: 'Processamento indisponível'});}
    return {received: true};
  });
  return app;
}
