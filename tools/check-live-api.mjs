// Runs the live-data functions (api/quakes.js, fires.js, clouds.js) here, with a fake request and response, against the real upstreams
// (USGS, NASA FIRMS, NASA GIBS). Prints the status, the size, the time and a sample of each answer, and saves the clouds picture to
// tools/cache/live/clouds.jpg (the answers to tools/cache/live/<name>.json), which is not committed. Usage, from the repository root:
//   node tools/check-live-api.mjs                 all three
//   node tools/check-live-api.mjs fires clouds    just those
// Each is also called a second time (the warm copy, which should answer at once) and with a query string (which must be refused).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url)), OUT = path.join(HERE, 'cache', 'live');
fs.mkdirSync(OUT, { recursive:true });
const names = process.argv.slice(2).length ? process.argv.slice(2) : ['quakes', 'fires', 'clouds'];
// 4.5 MB is Vercel's limit on a function's answer; aim for under 1 MB
const LIMIT = 4.5*1024*1024, AIM = 1024*1024;
function call(handler, url, method = 'GET'){
  return new Promise(resolve => {
    const t0 = Date.now(), headers = {}, res = {
      statusCode:200,
      setHeader(k, v){ headers[k.toLowerCase()] = v; },
      status(c){ this.statusCode = c; return this; },
      json(o){ headers['content-type'] = 'application/json; charset=utf-8'; return this.send(JSON.stringify(o)); },
      send(b){ resolve({ status:this.statusCode, headers, body:Buffer.isBuffer(b) ? b : Buffer.from(String(b ?? '')), ms:Date.now() - t0 }); return this; },
      end(){ return this.send(''); },
    };
    handler({ method, url, headers:{} }, res);
  });
}
const kb = n => (n/1024).toFixed(n < 10240 ? 1 : 0) + ' KB';
let bad = 0;
const fail = msg => { bad++; console.log('  PROBLEM: ' + msg); };
for (const name of names){
  console.log('\n== /api/' + name);
  let handler;
  try { handler = (await import('../api/' + name + '.js')).default; } catch (e){ fail('cannot load: ' + e.message); continue; }
  const a = await call(handler, '/api/' + name);
  console.log(`  ${a.status} ${a.headers['content-type']}  ${kb(a.body.length)}  ${a.ms} ms  cache-control: ${a.headers['cache-control']}`);
  for (const k of Object.keys(a.headers)) if (k.startsWith('x-')) console.log('  header ' + k + ': ' + a.headers[k]);
  if (a.status !== 200){ fail('status ' + a.status + ': ' + a.body.toString().slice(0, 200)); continue; }
  if (a.body.length > LIMIT) fail('over the 4.5 MB limit'); else if (a.body.length > AIM) console.log('  note: over 1 MB');
  if (a.ms > 8000) fail('slow: ' + a.ms + ' ms (the limit is 10 s)');
  if (a.headers['content-type'].startsWith('image/')){
    const f = path.join(OUT, name + '.jpg'); fs.writeFileSync(f, a.body); console.log('  saved ' + f);
  } else {
    fs.writeFileSync(path.join(OUT, name + '.json'), a.body);
    const j = JSON.parse(a.body.toString()), list = j[name] || [];
    const top = Object.fromEntries(Object.entries(j).filter(([, v]) => !Array.isArray(v)));
    console.log('  ' + JSON.stringify(top));
    console.log('  ' + list.length + ' rows, first three: ' + JSON.stringify(list.slice(0, 3)));
    if (name === 'quakes'){
      const mags = list.map(q => q[4]), depths = list.map(q => q[3]);
      console.log(`  magnitude ${Math.min(...mags)} to ${Math.max(...mags)}, depth ${Math.min(...depths)} to ${Math.max(...depths)} km, ${new Date(list[list.length - 1][0]*1000).toISOString()} to ${new Date(list[0][0]*1000).toISOString()}`);
    }
    if (name === 'fires'){
      const f = list.map(c => c[3]);
      console.log(`  power ${Math.min(...f)} to ${Math.max(...f)} MW a cell, total ${Math.round(f.reduce((s, v) => s + v, 0))} MW, ${new Date(j.from*1000).toISOString()} to ${new Date(j.to*1000).toISOString()}`);
    }
  }
  const b = await call(handler, '/api/' + name);
  console.log(`  again: ${b.status}  ${b.ms} ms  (${b.body.equals(a.body) ? 'same answer from the warm copy' : 'DIFFERENT answer'})`);
  if (b.ms > 100) fail('the warm copy was slow');
  const q = await call(handler, '/api/' + name + '?x=1');
  console.log(`  with a query string: ${q.status}`);
  if (q.status !== 404) fail('a query string must be refused');
  const p = await call(handler, '/api/' + name, 'POST');
  if (p.status !== 405) fail('POST must be refused');
}
console.log(bad ? '\n' + bad + ' problem(s)' : '\nall good');
process.exit(bad ? 1 : 0);
