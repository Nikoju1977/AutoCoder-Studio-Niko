import test from 'node:test';
import assert from 'node:assert/strict';
import { availableProviders,selectProvider,providerBody,extractText } from '../api/providers.mjs';
test('providers coexist and preserve OpenAI default',()=>{
 const env={OPENAI_API_KEY:'a',MISTRAL_API_KEY:'b',AGNES_API_KEY:'c'};
 assert.deepEqual(availableProviders(env),['openai','mistral','agnes']);
 assert.equal(selectProvider({},env).name,'openai');
 assert.equal(selectProvider({provider:'agnes'},env).name,'agnes');
});
test('role configuration and explicit choice',()=>{
 const env={MISTRAL_API_KEY:'b',AGNES_API_KEY:'c',AUTOCODER_ARCHITECT_PROVIDER:'agnes',AUTOCODER_DEFAULT_PROVIDER:'mistral'};
 assert.equal(selectProvider({role:'architect'},env).name,'agnes');
 assert.equal(selectProvider({role:'critic'},env).name,'mistral');
 assert.equal(selectProvider({role:'architect',provider:'mistral'},env).name,'mistral');
 assert.equal(selectProvider({provider:'openai'},env),null);
 assert.equal(selectProvider({provider:'https://example.com'},env),null);
});
test('official endpoint and Mistral JSON output',()=>{
 const c=selectProvider({provider:'mistral'},{MISTRAL_API_KEY:'b'});
 assert.equal(c.url,'https://api.mistral.ai/v1/chat/completions');
 assert.deepEqual(providerBody(c,'system','input',{}).response_format,{type:'json_object'});
 assert.equal(extractText(c,{choices:[{message:{content:'{}'}}]}),'{}');
});
test('Agnes uses compatible chat without unverified JSON parameter',()=>{
 const c=selectProvider({provider:'agnes'},{AGNES_API_KEY:'c'});
 assert.equal(c.url,'https://apihub.agnes-ai.com/v1/chat/completions');
 assert.equal(providerBody(c,'system','input',{}).response_format,undefined);
 assert.equal(extractText(c,{choices:[{message:{content:'{}'}}]}),'{}');
});

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
