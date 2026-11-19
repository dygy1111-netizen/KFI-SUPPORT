import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { createServer } from 'vite';

const server = await createServer({server:{middlewareMode:true},appType:'custom'});
const db = new PGlite();
try {
  const {parseImport,photoWidthPercent,photoHorizontalStretch,casebookPhotoPaths} = await server.ssrLoadModule('/src/lib/casebook.ts');
  const {planCasebook,bookSectionKey,bookCompare,groupCasebookCases,BOOK_PARTS,TOC_SECTIONS_PER_PAGE} = await server.ssrLoadModule('/src/lib/casebookBook.ts');
  assert.equal(bookSectionKey("탱크 완공검사"),"completion");
  assert.equal(bookSectionKey("위치표시밸브"),"indicator");
  const bookRows = [
    {id:1,case_no:4,sort_order:0,inspection_type:"교반기"},
    {id:2,case_no:9,sort_order:0,inspection_type:"정밀정기검사"},
    {id:3,case_no:1,sort_order:0,inspection_type:"새 검사"},
    {id:4,case_no:2,sort_order:0,inspection_type:"정밀정기검사"},
    {id:5,case_no:1,sort_order:0,inspection_type:"운반용기"},
  ];
  const book=planCasebook(bookRows);
  assert.deepEqual(book.parts.flatMap(p=>p.sections.flatMap(s=>s.cases.map(c=>c.id))),[4,2,5,1,3]);
  assert.equal(book.overviewPage,2);
  assert.equal(book.parts[0].sections[0].page,3);
  assert.equal(book.finalPage,12);
  assert.equal(book.unknown.length,1);
  // Interleaved tank areas and product tests must stay together in both
  // list sorting and the book plan, without changing original case numbers.
  const mk=(id,inspection_type,test_item,title)=>({id,case_no:id,sort_order:0,inspection_type,test_item,title,facility:""});
  const groupedRows=[
    mk(1,"정밀정기검사","소화설비","포소화설비 작동불량"),
    mk(2,"정밀정기검사","옆판","개구부 플랜지 누설"),
    mk(3,"정밀정기검사","지붕","통기관에 화염방지장치 미설치"),
    mk(4,"정밀정기검사","밑판","밑판 두께 미달"),
    mk(5,"정밀정기검사","지붕","외부부상지붕 실 파손"),
    mk(6,"정밀정기검사","비파괴시험","외부부상지붕 실 미설치"),
    mk(7,"정밀정기검사","소화설비","물분무설비 노즐 막힘"),
    mk(8,"정밀정기검사","소화설비","포소화설비 배관 파손"),
    mk(9,"정밀정기검사","지붕","접지저항 측정값 기준 초과"),
    mk(10,"운반용기","외관","하부 파렛트 파손"),
    mk(11,"운반용기","기밀시험","운반용기 누설"),
    mk(12,"운반용기","외관","상부틀 파손"),
    mk(13,"운반용기","외관","하부파렛트 파손"),
    mk(14,"정밀정기검사","비파괴시험","개구부 용접부 결함"),
    mk(15,"정밀정기검사","기초","전기방식장치 측정 불가"),
    mk(16,"정밀정기검사","방유제","관통배관 마감 불량"),
  ];
  const expected=[5,6,3,2,4,15,14,16,1,8,7,9,10,13,12,11];
  assert.deepEqual([...groupedRows].sort(bookCompare).map(x=>x.id),expected);
  assert.deepEqual(planCasebook(groupedRows).parts.flatMap(p=>p.sections.flatMap(s=>s.cases.map(c=>c.id))),expected);
  assert.deepEqual(groupedRows.map(x=>x.case_no),Array.from({length:16},(_,i)=>i+1));
  // A current administrator correction must change the order on the next load,
  // even if the previous title or facility still mentions another area.
  const changed=[
    mk(21,"정밀정기검사","비파괴시험","외부부상지붕 씰 미설치"),
    mk(15,"정밀정기검사","옆판","계단 부식에 의한 파손"),
    mk(14,"정밀정기검사","지붕","통기관의 상태 : 화염방지장치 미설치"),
    mk(17,"정밀정기검사","소화설비","폼 미형성"),
    {...mk(24,"정밀정기검사","","외부부상지붕 실 파손"),facility:"정밀정기검사 · 지붕"},
    mk(30,"정밀정기검사","밑판","밑판 차기점검 판정두께 미달"),
  ];
  const groups=groupCasebookCases(changed);
  assert.deepEqual(groups.map(g=>g.topic),["지붕","옆판","밑판","소화설비"]);
  assert.deepEqual(groups.flatMap(g=>g.items.map(x=>x.id)),[21,24,14,15,30,17]);
  assert.deepEqual(planCasebook(changed).parts.flatMap(p=>p.sections.flatMap(s=>s.cases.map(c=>c.id))),[21,24,14,15,30,17]);
  const edited=changed.map(x=>x.id===15?{...x,test_item:"계단"}:x);
  assert.deepEqual(groupCasebookCases(edited).map(g=>g.topic),["지붕","밑판","계단·사다리","소화설비"]);


  const allSections=BOOK_PARTS.flatMap(p=>p.sections).map((s,i)=>({id:i+1,case_no:i+1,sort_order:0,inspection_type:s.title}));
  const fullBook=planCasebook(allSections);
  assert.equal(TOC_SECTIONS_PER_PAGE,12);
  assert.equal(fullBook.tocPages,2);
  assert.equal(fullBook.overviewPage,3);
  assert.equal(fullBook.parts[0].sections[0].page,4);
  assert.equal(fullBook.finalPage,30);
  assert.equal(book.parts.flatMap(p=>p.sections).reduce((n,s)=>n+s.cases.length,0),bookRows.length);

  assert.equal(photoWidthPercent(undefined),100);
  assert.equal(photoWidthPercent(125),100);
  assert.equal(photoWidthPercent(10),45);
  assert.equal(photoWidthPercent(72.4),72);
  assert.equal(photoHorizontalStretch(undefined),100);
  assert.equal(photoHorizontalStretch(0),100);
  assert.equal(photoHorizontalStretch(175.4),175);
  assert.equal(photoHorizontalStretch(450),300);
  assert.deepEqual(casebookPhotoPaths({photo1_path:"first.jpg",photo2_path:null,photo3_path:"third.jpg",photo4_path:"fourth.jpg"}),[
    {slot:1,path:"first.jpg"},{slot:3,path:"third.jpg"},{slot:4,path:"fourth.jpg"}
  ]);
  const input = {source_uid:'test:row:1',source_row:2,source_sheet:'test',inspection_type:'교반기',title:'시험 사례',facility:'',standard_title:'기준',standard_body:'요구사항',cause_title:'',cause_body:'확인사항',action_body:'조치',prevention_body:'예방',finding_type:'부적합',test_item:'시험',review_note:'',published:true,review_status:'검토완료',photo1_path:'untrusted.jpg'};
  const parsed = parseImport([input]);
  assert.equal(parsed.rows.length,1);
  assert.equal(parsed.rows[0].published,false);
  assert.equal(parsed.rows[0].review_status,'검토대기');
  assert.equal(parsed.rows[0].photo1_path,null);
  assert.equal(parseImport([input,input]).errors.length,1);
  assert.equal(parseImport([{...input,inspection_type:'안전성능검사'}]).rows.length,0);
  assert.equal(parseImport([{...input,source_row:1}]).rows.length,0);
  assert.throws(()=>parseImport({}));

  await db.exec(`create role anon; create role authenticated;
    create function public.is_admin() returns boolean language sql as $$ select coalesce(current_setting('test.admin',true),'false')='true' $$;`);
  const sql = await fs.readFile('supabase/migrations/20261006000000_casebook_review.sql','utf8');
  // Simulate the original table and permissive legacy policies.
  const createTable = sql.slice(sql.indexOf('create table'),sql.indexOf('-- Only legacy'));
  await db.exec(createTable);
  await db.exec(`insert into casebook_cases(case_no,title,photo1_path) values(77,'legacy','keep.jpg');
    create policy legacy_open on casebook_cases for all to anon,authenticated using(true) with check(true);`);
  await db.exec(sql);
  await db.exec(sql); // repeat deployment must preserve data and states
  const photoSql = await fs.readFile('supabase/migrations/20261117000000_casebook_photo_size.sql','utf8');
  await db.exec(photoSql);
  await db.exec(photoSql); // additive migration can be safely rerun
  const stretchSql = await fs.readFile('supabase/migrations/20261117001000_casebook_horizontal_stretch.sql','utf8');
  await db.exec(stretchSql);
  await db.exec(stretchSql); // safe to run twice, keeping existing cases
  const fourPhotoSql = await fs.readFile('supabase/migrations/20261117002000_casebook_four_photos.sql','utf8');
  await db.exec(fourPhotoSql);
  await db.exec(fourPhotoSql); // no duplicate columns or default changes
  let legacy=(await db.query('select * from casebook_cases')).rows[0];
  assert.equal(legacy.photo1_path,'keep.jpg'); assert.equal(legacy.published,true);
  assert.equal(legacy.photo1_width_pct,100); assert.equal(legacy.photo2_width_pct,100);
  assert.equal(legacy.photo1_stretch_x_pct,100); assert.equal(legacy.photo2_stretch_x_pct,100);
  assert.equal(legacy.photo3_path,null); assert.equal(legacy.photo4_path,null);
  assert.equal(legacy.photo3_width_pct,100); assert.equal(legacy.photo4_stretch_x_pct,100);
  await db.exec("update casebook_cases set photo3_path='third.webp', photo4_path='fourth.webp' where title='legacy'");
  await db.exec(fourPhotoSql);
  legacy=(await db.query("select * from casebook_cases where title='legacy'")).rows[0];
  assert.equal(legacy.photo3_path,'third.webp'); assert.equal(legacy.photo4_path,'fourth.webp');
  await assert.rejects(db.exec("update casebook_cases set photo3_stretch_x_pct=999 where title='legacy'"));
  await db.exec("update casebook_cases set photo1_stretch_x_pct=180 where title='legacy'");
  await db.exec(stretchSql);
  const kept=(await db.query("select photo1_stretch_x_pct from casebook_cases where title='legacy'")).rows[0];
  assert.equal(kept.photo1_stretch_x_pct,180);
  await assert.rejects(db.exec("update casebook_cases set photo1_stretch_x_pct=301 where title='legacy'"));
  await db.exec(`set role authenticated; set test.admin='true';`);
  const imported = await db.query('select public.import_casebook_cases($1::jsonb) as result',[JSON.stringify([input])]);
  assert.equal(imported.rows[0].result['등록'],1);
  let row=(await db.query('select * from casebook_cases where source_uid=$1',[input.source_uid])).rows[0];
  assert.equal(row.case_no,78); assert.equal(row.published,false);assert.equal(row.photo1_path,null);
  await db.exec(`update casebook_cases set title='reviewed',photo1_path='new.jpg',review_status='검토완료',published=true where source_uid='test:row:1'`);
  const repeated=await db.query('select public.import_casebook_cases($1::jsonb) as result',[JSON.stringify([input])]);
  assert.equal(repeated.rows[0].result['등록'],0);assert.equal(repeated.rows[0].result['원본참조갱신'],1);
  row=(await db.query('select * from casebook_cases where source_uid=$1',[input.source_uid])).rows[0];
  assert.equal(row.title,'reviewed');assert.equal(row.photo1_path,'new.jpg');assert.equal(row.published,true);
  await assert.rejects(db.query('select public.import_casebook_cases($1::jsonb)',[JSON.stringify([{...input,source_uid:'test:rollback:1'},{...input,source_uid:'bad'}])]));
  assert.equal((await db.query("select count(*)::int as n from casebook_cases where source_uid='test:rollback:1'")).rows[0].n,0);
  await db.query('select public.import_casebook_cases($1::jsonb)',[JSON.stringify([{...input,source_uid:'test:private:1'}])]);
  await assert.rejects(db.exec("update casebook_cases set published=true where source_uid='test:private:1'"));
  await db.exec("set test.admin='false'; set role anon;");
  assert.equal((await db.query('select count(*)::int as n from casebook_cases')).rows[0].n,2);
  await assert.rejects(db.query('select public.import_casebook_cases($1::jsonb)',[JSON.stringify([input])]));
  await db.exec('set role authenticated;');
  await assert.rejects(db.exec("insert into casebook_cases(title) values('forbidden')"));
  await assert.rejects(db.query('select public.import_casebook_cases($1::jsonb)',[JSON.stringify([input])]));
  await db.exec("update casebook_cases set title='forbidden'; delete from casebook_cases;");
  await db.exec("reset role; set test.admin='true';");
  assert.equal((await db.query('select count(*)::int as n from casebook_cases')).rows[0].n,3);
  assert.equal((await db.query("select count(*)::int as n from casebook_cases where title='forbidden'")).rows[0].n,0);
  console.log('PASS: parser, legacy retention, migration rerun, private import, idempotency, edited text/photos retention, atomic rollback, review constraint, anonymous/non-admin RLS.');
} finally {await db.close();await server.close();}
