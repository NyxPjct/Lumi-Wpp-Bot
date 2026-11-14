import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initialConversation, transition} from '@lumi/shared';
const accepted = () => transition(initialConversation(), 'aceito', '2026-11-14T12:00:00.000Z').conversation;
test('consentimento explícito libera menu e registra data', () => {
  const result = transition(initialConversation(), 'ACEITO', '2026-11-14T12:00:00.000Z');
  assert.equal(result.conversation.state, 'menu');
  assert.equal(result.conversation.consentedAt, '2026-11-14T12:00:00.000Z');
  assert.match(result.replies.join(' '), /Orçamento de lentes/);
});
test('recusa encerra sem consentimento e não permite pular para menu', () => {
  const result = transition(initialConversation(), 'não aceito');
  assert.equal(result.conversation.state, 'encerrado');
  assert.equal(result.conversation.consentedAt, undefined);
  assert.equal(transition(result.conversation, 'menu').conversation.state, 'encerrado');
});
test('menu e FAQ exigem consentimento', () => {
  for (const text of ['menu', '5', '1']) assert.equal(transition(initialConversation(), text).conversation.state, 'privacidade');
});
test('FAQ responde e retorna ao menu sem mutar estado anterior', () => {
  const original = accepted();
  const selected = transition(original, '5');
  assert.equal(original.state, 'menu');
  assert.equal(selected.conversation.state, 'faq');
  const answer = transition(selected.conversation, '1');
  assert.match(answer.replies[0], /segunda a sexta/);
  assert.equal(answer.conversation.state, 'menu');
});
test('palavras de transbordo pausam o bot em qualquer fluxo ativo', () => {
  for (const word of ['atendente', 'Quero uma pessoa', 'humano']) {
    const result = transition(initialConversation(), word);
    assert.equal(result.conversation.state, 'humano');
    assert.deepEqual(transition(result.conversation, 'oi').replies, []);
  }
});
test('três respostas inválidas encaminham para humano', () => {
  let state = accepted();
  for (const text of ['x', 'y', 'z']) state = transition(state, text).conversation;
  assert.equal(state.state, 'humano');
});
test('resposta válida zera tentativas inválidas', () => {
  const invalid = transition(accepted(), 'x').conversation;
  const valid = transition(invalid, '5').conversation;
  assert.equal(valid.invalidAttempts, 0);
});
test('fluxos pendentes não inventam orçamento nem status', () => {
  for (const text of ['2','4']) assert.match(transition(accepted(), text).replies[0], /em desenvolvimento/);
});
