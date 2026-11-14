const {test} = require('node:test');
const assert = require('node:assert/strict');
const {adaptDockerArgs} = require('../docker-local.cjs');
test('ajuste preserva o health check e só altera wget para loopback da autenticação', () => {
 const cmd='wget --no-verbose --tries=1 --spider http://127.0.0.1:9999/health';
 const input=['run','--health-cmd',cmd,'test-image'];
 assert.deepEqual(adaptDockerArgs(input),['run','--health-cmd',cmd.replace('wget ','wget -Y off '),'test-image']);
 assert.equal(input[2],cmd);
 assert.equal(adaptDockerArgs(['create','--health-cmd',cmd])[2],cmd.replace('wget ','wget -Y off '));
 assert.equal(adaptDockerArgs(['container','create','--health-cmd',cmd])[3],cmd.replace('wget ','wget -Y off '));
 assert.deepEqual(adaptDockerArgs(['run','--health-cmd='+cmd]),['run','--health-cmd='+cmd.replace('wget ','wget -Y off ')]);
});
test('ajuste não altera proxy externo nem argumentos de outros comandos', () => {
 for(const input of [
  ['run','--health-cmd','wget https://example.com/health'],
  ['run','--health-cmd','wget http://127.0.0.1:8888/health'],
  ['exec','container','wget','http://127.0.0.1:9999/health'],
  ['pull','ghcr.io/supabase/postgres:17.11.0.018'],
 ]) assert.deepEqual(adaptDockerArgs(input),input);
});
