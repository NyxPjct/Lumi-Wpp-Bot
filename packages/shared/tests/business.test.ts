import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateSettings, initialConversation, transition, welcomeForSettings, type BusinessSettings} from '../src/index.js';

const business: BusinessSettings = {
  name: 'Ótica Boa Vista', address: 'Rua Teste, 120 · Cidade exemplo',
  hours: 'Segunda a sábado, das 8h às 17h.', payments: 'Pix e débito.',
  delivery: 'Prazo confirmado pelo atendente após a escolha das lentes.',
};

test('configuração normaliza espaços e descarta propriedades desconhecidas', () => {
  const result = validateSettings({...business, name: '  Ótica Boa Vista  ', token: 'not-stored'});
  assert.equal(result.ok, true);
  if (result.ok) assert.deepEqual(result.value, business);
});

test('campos ausentes, tipos errados e textos fora do limite são rejeitados', () => {
  for (const invalid of [null, [], false, {name: ' '}]) assert.equal(validateSettings(invalid).ok, false);
  for (const field of Object.keys(business)) {
    for (const value of ['', '  ', 123, {}, 'x'.repeat(field === 'name' ? 81 : 301)]) {
      const result = validateSettings({...business, [field]: value});
      assert.equal(result.ok, false, `${field}: ${typeof value}`);
      if (!result.ok) assert.ok(result.errors[field as keyof BusinessSettings]);
    }
  }
});

test('simulador usa respostas da ótica configurada e mantém isolamento de conteúdo', () => {
  const another = {...business, hours: 'Somente às terças, das 10h às 16h.'};
  for (const settings of [business, another]) {
    const accepted = transition(initialConversation(), 'aceito', undefined, settings);
    const selected = transition(accepted.conversation, '5', undefined, settings);
    assert.match(selected.replies[0], /4\. Endereço da ótica/);
    const answer = transition(selected.conversation, '1', undefined, settings);
    assert.equal(answer.replies[0], settings.hours);
    assert.equal(transition(selected.conversation, '4', undefined, settings).replies[0], settings.address);
    assert.equal(transition(selected.conversation, '5', undefined, settings).conversation.state, 'faq');
  }
  assert.match(welcomeForSettings(business), /Ótica Boa Vista/);
});

test('personalização mantém a exigência de consentimento e a pausa humana', () => {
  assert.equal(transition(initialConversation(), '5', undefined, business).conversation.state, 'privacidade');
  const human = transition(initialConversation(), 'humano', undefined, business).conversation;
  assert.deepEqual(transition(human, 'horário', undefined, business).replies, []);
});
