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
