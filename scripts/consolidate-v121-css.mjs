// One-time mechanical migration. Preserves declaration order, specificity and media conditions.
// Historical styles remain in git for older release fixtures; only reachable runtime selectors ship.
import fs from 'node:fs';
import postcss from 'postcss';
import {gzipSync} from 'node:zlib';
const manifest=JSON.parse(fs.readFileSync('runnerbear-v11-assets.json','utf8'));
const sourceFiles=manifest.styles;
if(sourceFiles.length!==28)throw Error('Expected the reviewed 28-source input, refusing to rewrite a different cascade');
const corpus=['index.html',...manifest.core,manifest.ui,...manifest.data].map(f=>fs.readFileSync(f,'utf8')).join('\n');
const prefixes=[...corpus.matchAll(/([a-zA-Z][\w-]*-)\$\{/g)].map(m=>m[1]);
const layers=[['baseline',0,10],['components',10,17],['workflows',17,22],['decisions',22,26],['concept-one',26,28]];
const original=sourceFiles.map(f=>fs.readFileSync(f,'utf8')).join('\n');
const removed=[];
const files=[];
for(const [name,start,end] of layers){
 const tree=postcss.parse(sourceFiles.slice(start,end).map(f=>'/* migrated from '+f+' */\n'+fs.readFileSync(f,'utf8')).join('\n'));
 tree.walkRules(rule=>{
  if(rule.selector.includes(':not(')||rule.selector.includes(':is(')||rule.selector.includes(':where(')||rule.selector.includes(':has('))return;
  const keep=rule.selectors.filter(selector=>{
   const classes=[...selector.replace(/\[[^\]]*\]/g,'').matchAll(/\.([a-zA-Z_][\w-]*)/g)].map(m=>m[1]);
   const unused=classes.some(token=>token!=='quiet'&&!corpus.includes(token)&&!prefixes.some(prefix=>token.startsWith(prefix)));
   if(unused)removed.push(selector);
   return !unused;
  });
  if(!keep.length)rule.remove();else rule.selectors=keep;
 });
 tree.walkAtRules(rule=>{if(rule.nodes&&!rule.nodes.length)rule.remove()});
 tree.walkComments(comment=>comment.remove());
 const file='runnerbear-v121-'+name+'.css';
 fs.writeFileSync(file,'/* Concept 1 · '+name+' · ordered cascade, no specificity changes. */\n'+tree.toString().trim()+'\n');files.push(file);
}
const output=files.map(f=>fs.readFileSync(f,'utf8')).join('\n');
manifest.styles=files;fs.writeFileSync('runnerbear-v11-assets.json',JSON.stringify(manifest,null,2)+'\n');
fs.writeFileSync('tests/fixtures/v121-css-pruning.json',JSON.stringify({method:'Only selectors requiring a class absent from all shipped JS and HTML; dynamic prefixes and functional selectors retained.',sources:sourceFiles,files,removed,originalGzip:gzipSync(original,{level:9}).length,outputGzip:gzipSync(output,{level:9}).length},null,2)+'\n');
console.log(JSON.stringify({removed:removed.length,before:gzipSync(original,{level:9}).length,after:gzipSync(output,{level:9}).length,layers:files.length}));
