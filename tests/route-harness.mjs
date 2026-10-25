import {readFileSync} from 'node:fs';

// Node's ESM loader needs next/server.js; Next's compiler accepts next/server.
// Keep the route itself unchanged and execute its actual handlers, not a mock.
export async function loadRoute(file=new URL('../app/api/[...path]/route.js',import.meta.url)) {
  const source=readFileSync(file,'utf8').replace(/from (['"])([^'"]+)\1/g,(_,quote,spec)=>
    `from ${quote}${spec.startsWith('.')?new URL(spec,file).href:import.meta.resolve(spec==='next/server'?'next/server.js':spec)}${quote}`);
  return import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
}
