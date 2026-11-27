import {readFile,mkdtemp,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {repairVisual} from '../ui-repair.mjs';
const input=process.argv[2];if(!input||(await stat(input)).size>500000)throw Error('Usage: npm run ui:repair -- bundle.json (max 500 Ko)');
const out=await mkdtemp(join(tmpdir(),'niko-ui-repair-'));
console.log(JSON.stringify({out,...await repairVisual(JSON.parse(await readFile(input,'utf8')),out)},null,2));
