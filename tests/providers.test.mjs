import test from 'node:test';
import assert from 'node:assert/strict';
import {availableProviders, selectProvider, providerBody, extractText} from '../api/providers.mjs';

test('Agnes works as the sole configured provider', () => {
  const env = {AGNES_API_KEY: 'mock-key', AUTOCODER_DEFAULT_PROVIDER: 'agnes'};
  assert.deepEqual(availableProviders(env), ['agnes']);
  const config = selectProvider({}, env);
  assert.equal(config.url, 'https://apihub.agnes-ai.com/v1/chat/completions');
  const body = providerBody(config, 'system', 'input', {});
  assert.equal(body.model, 'agnes-2.5-flash');
  assert.equal(body.messages[1].content, 'input');
  assert.equal(extractText(config, {choices: [{message: {content: '{"files":[]}'}}]}), '{"files":[]}');
});

test('Agnes receives the expected artifact in the role-specific response example', () => {
  const config = selectProvider({provider: 'agnes'}, {AGNES_API_KEY: 'mock-key'});
  for (const name of ['plan.md', 'review.json']) {
    const body = providerBody(config, 'consigne', '{}', {}, 1024, name);
    assert.ok(body.messages[0].content.includes('"name":"' + name + '"'));
    assert.ok(!body.messages[0].content.includes('main.py'));
  }
});
