import test from 'node:test';
import assert from 'node:assert/strict';
import {THEMES,validateTheme,themeCSS,assessTheme,contrast,encodeTheme,decodeTheme} from '../ui-theme.mjs';
test('six deterministic themes round trip without arbitrary CSS',()=>{
 assert.equal(Object.keys(THEMES).length,6);
 for(const t of Object.values(THEMES)){assert.deepEqual(decodeTheme(encodeTheme(t)),validateTheme(t));assert.equal(assessTheme(t).length,8);assert.match(themeCSS(t),/\.niko-ui\.niko-custom/);}
 assert.throws(()=>validateTheme({...THEMES.audio,accent:'red;url(https://evil.test)'}));
 assert.throws(()=>validateTheme({...THEMES.audio,motion:301}));
 assert.throws(()=>decodeTheme('{"theme":{}}'));
});
test('contrast uses unrounded ratios and known black/white values',()=>{
 assert.equal(contrast('#ffffff','#000000'),21);assert.equal(contrast('#ffffff','#ffffff'),1);
 assert.ok(assessTheme({...THEMES.minimal,text:'#ffffff'}).some(r=>!r.pass));
});
