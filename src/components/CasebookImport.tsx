import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { parseImport, type CasebookCase, type ImportCase } from '../lib/casebook';

export function CasebookImport({items, onComplete, disabled=false}: {items:CasebookCase[]; onComplete:()=>Promise<unknown>; disabled?:boolean}) {
  const [rows,setRows]=useState<ImportCase[]>([]), [errors,setErrors]=useState<string[]>([]);
  const [result,setResult]=useState(''), [busy,setBusy]=useState(false);
  const existing=new Map(items.filter(x=>x.source_uid).map(x=>[x.source_uid,x]));
  const updates=rows.filter(x=>existing.has(x.source_uid)).length;
  async function save() {
    if (disabled) return;
    setBusy(true); setResult('');
    try {
      // Database function serializes imports and preserves reviewed text and photographs.
      const {data,error}=await supabase.rpc('import_casebook_cases',{entries:rows});
      if(error) throw error;
      setResult(`등록 결과: ${JSON.stringify(data)}`);
      setRows([]); await onComplete();
    } catch(e) {setResult(`저장 실패: ${e instanceof Error ? e.message : (e as {message?:string}).message || '연결을 확인하세요.'} 원본 행 목록은 유지됩니다. 재시도해도 source_uid로 중복을 방지합니다.`);}
    finally {setBusy(false);}
  }
  return <section className="admin-sheet cb-import"><h3>사례 일괄 가져오기</h3>
    {disabled && <p role="alert">DB 준비가 필요합니다. Supabase SQL Editor에서 20261006000000_casebook_review.sql을 실행한 뒤 새로고침하세요. 파일 미리보기는 지금도 가능합니다.</p>}
    <p>JSON을 검토한 뒤 한 번에 저장합니다. 신규 사례는 비공개이며, 기존 사례의 문안·사진·검토 상태는 보존하고 원본 참조만 갱신합니다.</p>
    <input aria-label="사례 JSON 파일" type="file" accept=".json,application/json" disabled={busy} onChange={async e=>{
      setRows([]);setErrors([]);setResult('');const f=e.target.files?.[0];if(!f)return;
      try {if(f.size>10_000_000)throw new Error('파일은 10MB 이하만 가능합니다.');const parsed=parseImport(JSON.parse(await f.text()));setRows(parsed.rows);setErrors(parsed.errors);}
      catch(err){setErrors([err instanceof Error ? err.message : '파일을 읽지 못했습니다.']);}
      e.target.value='';
    }}/>
    {!!rows.length && <><p>등록 예정 {rows.length-updates}건 · 원본 참조 갱신 예정 {updates}건 · 제외 예정 {errors.length}건</p>
      <div style={{maxHeight:320,overflow:'auto'}}><table><thead><tr><th>원본 행</th><th>검사구분</th><th>제목</th><th>상태</th><th>처리</th></tr></thead><tbody>{rows.map(r=><tr key={r.source_uid}><td>{r.source_sheet}:{r.source_row}</td><td>{r.inspection_type}</td><td>{r.title}<small style={{display:'block'}}>{r.review_note}</small><details><summary>기준·조치 내용 검토</summary><p>{r.standard_title}</p><p>{r.standard_body}</p><p>{r.cause_body}</p><p>{r.action_body}</p><p>{r.prevention_body}</p></details></td><td>{r.review_status}</td><td>{existing.has(r.source_uid)?'원본 참조 갱신':'신규'}</td></tr>)}</tbody></table></div>
      <button className="primary-button" disabled={busy || disabled} onClick={()=>void save()}>{busy?'저장 중…':'미리보기 승인 및 일괄 저장'}</button></>}
    {!!errors.length && <details open><summary>제외·오류 {errors.length}건</summary>{errors.map((e,i)=><p key={i}>{e}</p>)}</details>}
    {result && <p role="status">{result}</p>}
  </section>;
}
