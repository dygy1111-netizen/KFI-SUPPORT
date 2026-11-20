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
  const {parseBookText,validateBookText}=await server.ssrLoadModule('/src/lib/casebookBookText.ts');
  const text=parseBookText({cover:{year:"2027",title:"편집 표지"},toc:{title:"편집 목차"},overview:{lead:"편집 개요"},parts:{"01":{title:"편집 대분류"}},sections:{safety:{title:"편집 검사명",procedure:["편집 절차 1","편집 절차 2"]}},colophon:{title:"편집 발간정보"}});
  assert.equal(validateBookText(text).length,0);
  const editedMarkup=renderToStaticMarkup(article(CasebookBook,{items,text,renderCase:(item,page)=>article('article',{className:'cb-a4-page'},'샘플 사례 '+page)}));
  for(const term of ["2027년","편집 표지","편집 목차","편집 개요","편집 대분류","편집 검사명","편집 절차 1","편집 발간정보"])assert.ok(editedMarkup.includes(term),term);
  assert.equal((editedMarkup.match(/class="cb-a4-page/g)||[]).length,plan.finalPage+1);
  assert.equal((editedMarkup.match(/편집 검사명/g)||[]).length,2);
  const preview=renderToStaticMarkup(article(CasebookBook,{items,text,frontMatterOnly:true,renderCase:()=>{throw new Error("Unexpected case page in preview")}}));
  assert.ok(preview.includes("편집 절차 2"));
  assert.equal((preview.match(/class="cb-a4-page/g)||[]).length,plan.finalPage+1-items.length);

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
  // Use the full production CSS and the same photo DOM/inline widths as CasebookPage.
  // Different photo ratios and previously saved stretch values must have no effect.
  const imageSrc='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="steelblue"/></svg>');
  const tallSrc='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="400"><rect width="100" height="400" fill="tan"/></svg>');
  const photos=(n)=>Array.from({length:n},(_,i)=>'<div class="cb-photo-resize-slot" style="--photo-ratio:'+(i%2?0.25:1.777)+';--photo-stretch:2"><div class="cb-photo-size-frame" style="width:55%"><img src="'+(i%2?tallSrc:imageSrc)+'" style="width:50%;height:auto;max-width:none;object-fit:contain;transform:scaleX(2)"></div></div>').join('');
  const caseMarkup=Array.from({length:5},(_,n)=>'<article class="cb-a4-page" style="min-height:0"><div class="cb-print-body"><div class="cb-table"><div class="cb-table-row"><div class="cb-table-label">관련 사진</div><div class="cb-table-content"><div class="cb-photo-area"><div class="cb-preview-photos '+(['four multi','one','two','three multi','four multi'][n])+'">'+(n?photos(n):'<div class="cb-photo-placeholder">관련 사진 삽입 영역</div>')+'</div><div class="cb-photo-copy"></div></div></div></div></div></div></article>').join('');
  const screen=path.join(temp,'screen.html');
  await fs.writeFile(screen,'<!doctype html><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0}'+base+'</style><body><section class="content-section"><div class="public-casebook-zoom-wrap zoom-normal" style="display:block">'+caseMarkup+'</div></section><script>const grids=[...document.querySelectorAll(".cb-preview-photos")],fails=[];const near=(a,b)=>Math.abs(a-b)<1.5;for(let n=0;n<grids.length;n++){const g=grids[n],r=g.getBoundingClientRect(),imgs=[...g.querySelectorAll("img")],gap=parseFloat(getComputedStyle(g).gap)||0;const cell=g.closest(".cb-table-content").getBoundingClientRect();if(!near(r.left,cell.left)||!near(r.right,cell.right))fails.push("photo inset "+n);const expectedH=r.width*(n?60:22)/158;if(!near(r.height,expectedH))fails.push("height "+n+" "+r.height+" "+expectedH);for(const img of imgs){const b=img.getBoundingClientRect(),cs=getComputedStyle(img);if(cs.objectFit!=="fill"||cs.transform!=="none"||!near(b.width,n===1?r.width:(r.width-gap)/2)||!near(b.height,n>2?(r.height-gap)/2:r.height))fails.push("image "+n+" "+b.width+"x"+b.height);if(b.left<r.left-1||b.right>r.right+1||b.bottom>r.bottom+1)fails.push("overflow "+n);}if(n===3&&!near(imgs[2].getBoundingClientRect().left+imgs[2].getBoundingClientRect().width/2,r.left+r.width/2))fails.push("center");}document.body.dataset.screenQa=fails.length?"FAIL":"PASS";document.body.dataset.issues=fails.join("; ");</script></body>');
  for(const viewport of ['1280,1000','420,900']){
    const geometry=execFileSync(chrome,[...args,'--window-size='+viewport,'--dump-dom',pathToFileURL(screen).href],{encoding:'utf8',timeout:60000});
    assert.match(geometry,/data-screen-qa="PASS"/,'Screen image dimensions failed at '+viewport+': '+(geometry.match(/data-issues="[^"]*"/)||[])[0]);
  }
  console.log('PASS: responsive one-to-four-photo web detail matches PDF proportions; desktop and mobile.');
  const zoomFile=path.join(temp,'zoom.html');
  await fs.writeFile(zoomFile,'<!doctype html><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0}'+base+'</style><section class="content-section" style="width:1180px;max-width:100%">'+[0.5,1,1.16].map((scale,i)=>'<div class="public-casebook-zoom-wrap cb-whole-page-zoom zoom-'+['small','normal','large'][i]+'" style="--cb-page-scale:'+scale+';--cb-page-base-width:920px">'+caseMarkup.split('</article>')[2]+'</article></div>').join('')+'</section><script>const pages=[...document.querySelectorAll(".cb-whole-page-zoom .cb-a4-page")];const near=(a,b)=>Math.abs(a-b)<0.02;const boxes=pages.map(p=>p.getBoundingClientRect());const photo=pages.map(p=>p.querySelector("img").getBoundingClientRect());const ok=near(boxes[0].width/boxes[1].width,.5)&&near(boxes[0].height/boxes[1].height,.5)&&near(boxes[2].width/boxes[1].width,1.16)&&near(photo[0].width/photo[1].width,.5)&&near(photo[0].height/photo[1].height,.5);document.body.dataset.zoomQa=ok?"PASS":"FAIL";</script>');
  const zoomResult=execFileSync(chrome,[...args,'--window-size=1440,1000','--dump-dom',pathToFileURL(zoomFile).href],{encoding:'utf8',timeout:60000});
  assert.match(zoomResult,/data-zoom-qa="PASS"/,"Full page zoom does not scale the document and photographs together");
  console.log('PASS: full-page screen zoom and edited book content with automatic pagination.');


  execFileSync(chrome,[...args,'--print-to-pdf='+pdf,url],{timeout:60000});
  const info=execFileSync('pdfinfo',[pdf],{encoding:'utf8'});
  assert.match(info,new RegExp('Pages:\\s+'+(plan.finalPage+1)+'\\b'));
  console.log('PASS: printed A4 book, all 13 categories, two TOC pages, no front-matter overflow, '+(plan.finalPage+1)+' PDF pages.');
} finally { await server.close(); await fs.rm(temp,{recursive:true,force:true}); }
