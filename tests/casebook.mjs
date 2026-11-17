import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { createServer } from 'vite';

const server = await createServer({server:{middlewareMode:true},appType:'custom'});
const db = new PGlite();
try {
  const {parseImport,photoWidthPercent,photoHorizontalStretch,casebookPhotoPaths} = await server.ssrLoadModule('/src/lib/casebook.ts');
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
