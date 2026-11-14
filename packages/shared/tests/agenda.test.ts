import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseBrasiliaTime,formatSlotTime,validTestName} from '../src/index.js';
test('data de Brasília vira instante UTC sem depender do fuso do navegador',()=>{
 assert.equal(parseBrasiliaTime('2027-01-10T15:30'),'2027-01-10T18:30:00.000Z');
 assert.match(formatSlotTime('2027-01-10T18:30:00.000Z'),/15:30/);
 assert.equal(parseBrasiliaTime('2027-01-10T00:00'),'2027-01-10T03:00:00.000Z');
});
test('datas inexistentes e horários malformados não são normalizados silenciosamente',()=>{
 for(const input of ['2027-02-30T15:30','2027-01-10T24:00','2027-13-10T15:30','10/01/2027 15:30','','2027-01-10T15:30Z'])assert.equal(parseBrasiliaTime(input),null,input);
});
test('nome de teste exige tamanho válido após remover espaços nas extremidades',()=>{
 assert.equal(validTestName(' Cliente de teste '),true);
 for(const input of [' ','A','x'.repeat(81)])assert.equal(validTestName(input),false);
});
