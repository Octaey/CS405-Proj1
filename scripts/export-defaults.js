import { writeFileSync, mkdirSync } from 'node:fs';
import { defaultCurves } from '../src/scene/curveDefaults.js';
import { curveToJSON } from '../src/scene/curveExport.js';

const painting = 'kavunlu';
const c = defaultCurves(painting);
mkdirSync('exports', { recursive: true });
const write = (name, obj) => writeFileSync(`exports/${name}`, JSON.stringify(obj, null, 2) + '\n');
write(`${painting}-bezier-c1.json`, curveToJSON({ painting, kind: 'bezier-c1', segments: c.bezier }));
write(`${painting}-catmull-rom.json`, curveToJSON({ painting, kind: 'catmull-rom', points: c.cr }));
console.log('wrote exports/');
