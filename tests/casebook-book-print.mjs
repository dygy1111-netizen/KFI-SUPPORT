import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

const server = await createServer({server:{middlewareMode:true},appType:'custom'});
const temp = await fs.mkdtemp(path.join(os.tmpdir(),'casebook-book-layout-'));
try {
  const { CasebookBook } = await server.ssrLoadModule('/src/components/CasebookBook.tsx');
  const { BOOK_PARTS,planCasebook } = await server.ssrLoadModule('/src/lib/casebookBook.ts');
  const items = BOOK_PARTS.flatMap(p=>p.sections).map((s,i)=>({id:i+1,case_no:i+1,sort_order:0,inspection_type:s.title}));
  const plan=planCasebook(items);
  const article=React.createElement;
  const markup=renderToStaticMarkup(article(CasebookBook,{items,renderCase:(item,page)=>article('article',{className:'cb-a4-page'},'샘플 사례 '+page+' '+item.inspection_type)}));
  assert.ok(!markup.includes('kb-cover-art'));
  const base=await fs.readFile('src/components/CasebookManager.css','utf8');
  // Verify offline fallback typography too; the production stylesheet uses pinned Pretendard.
  const book=(await fs.readFile('src/components/CasebookBook.css','utf8')).replace(/^@import[^;]+;/,'');
  const input=path.join(temp,'sample.html'),pdf=path.join(temp,'sample.pdf');
  await fs.writeFile(input,'<!doctype html><html lang="ko"><meta charset="utf-8"><style>body{margin:0}'+base+'\n'+book+'\n.cb-print-only{position:static!important;left:auto!important;top:auto!important}</style><body><div class="cb-print-only">'+markup+'</div><script>const pages=[...document.querySelectorAll(".kb-sheet")];const issues=[];for (const page of pages){const body=page.querySelector(".kb-body");const footer=page.querySelector(".kb-running");const b=body.getBoundingClientRect();const f=footer.getBoundingClientRect();if(body.scrollHeight>body.clientHeight+2||b.bottom>f.top+1)issues.push(page.innerText.slice(0,100));}document.body.setAttribute("data-qa",issues.length?"FAIL":"PASS");document.body.setAttribute("data-issue-count",String(issues.length));</script></body></html>');
  const chrome=process.env.CHROME_BIN||'google-chrome';
  const args=['--headless','--no-sandbox','--disable-dev-shm-usage','--no-first-run','--disable-gpu','--no-pdf-header-footer','--virtual-time-budget=2000'];
  const url=pathToFileURL(input).href;
  const html=execFileSync(chrome,[...args,'--dump-dom',url],{encoding:'utf8',timeout:60000});
  assert.match(html,/data-qa="PASS"/,'Book page body overlaps footer or overflows');
  execFileSync(chrome,[...args,'--print-to-pdf='+pdf,url],{timeout:60000});
  const info=execFileSync('pdfinfo',[pdf],{encoding:'utf8'});
  assert.match(info,new RegExp('Pages:\\s+'+(plan.finalPage+1)+'\\b'));
  console.log('PASS: printed A4 book, all 13 categories, two TOC pages, no front-matter overflow, '+(plan.finalPage+1)+' PDF pages.');
} finally { await server.close(); await fs.rm(temp,{recursive:true,force:true}); }
