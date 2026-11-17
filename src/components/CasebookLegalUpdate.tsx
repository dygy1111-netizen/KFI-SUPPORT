import { useState } from "react";
import { supabase } from "../lib/supabase";
import type { CasebookCase } from "../lib/casebook";

type LegalRow = {
  source_uid: string;
  case_no_reference: number;
  title_reference: string;
  standard_title_original: string;
  standard_body_original: string;
  standard_title: string;
  standard_body: string;
  source_url: string;
};

function parseLegalFile(input: unknown): LegalRow[] {
  if (!Array.isArray(input) || input.length < 1 || input.length > 146) {
    throw Error("검사기준 원문 '적용용' JSON(1~146건)만 선택하세요. 146건 전체 검토표는 적용용 파일이 아닙니다.");
  }
  const ids = new Set<string>();
  return input.map((raw, i) => {
    if (!raw || typeof raw !== "object") throw Error(String(i+1) + "행: 형식 오류");
    const r = raw as Record<string, unknown>;
    for (const key of ["source_uid","title_reference","standard_title_original","standard_body_original","standard_title","standard_body","source_url"]) {
      if (typeof r[key] !== "string" || !(r[key] as string).trim()) throw Error(String(i+1) + "행: " + key + " 누락");
    }
    if (!/^kfi-2023-2026:report:\d+$/.test(r.source_uid as string)) throw Error(String(i+1) + "행: 원본 식별자 오류");
    if (ids.has(r.source_uid as string)) throw Error("중복 식별자: " + r.source_uid);
    ids.add(r.source_uid as string);
    if (!/^https:\/\/www\.law\.go\.kr\//.test(r.source_url as string)) throw Error("국가법령정보센터 원문 링크가 없습니다.");
    if ((r.standard_body as string).length > 5000 || (r.standard_title as string).length > 500) throw Error("검사기준 문안이 지나치게 깁니다.");
    return r as LegalRow;
  });
}

function saveBackup(items: CasebookCase[]) {
  const records = items.map(item => ({
    id: item.id, source_uid: item.source_uid, case_no: item.case_no,
    title: item.title, standard_title: item.standard_title,
    standard_body: item.standard_body, updated_at: item.updated_at,
  }));
  const url = URL.createObjectURL(new Blob([JSON.stringify(records, null, 2)], {type:"application/json"}));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "KFI_검사기준_원문적용전_백업.json";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1200);
}

export function CasebookLegalUpdate({
  items, onComplete, disabled=false,
}: {
  items: CasebookCase[];
  onComplete: () => Promise<unknown>;
  disabled?: boolean;
}) {
  const [rows,setRows] = useState<LegalRow[]>([]);
  const [busy,setBusy] = useState(false);
  const [progress,setProgress] = useState(0);
  const [message,setMessage] = useState("");
  const [error,setError] = useState("");
  const current = new Map(items.filter(item => item.source_uid).map(item => [item.source_uid, item]));
  // Never overwrite a manually corrected legal reference or a consolidated case.
  const unchanged = rows.filter(row => {
    const item = current.get(row.source_uid);
    return item && item.title===row.title_reference &&
      item.standard_title===row.standard_title_original &&
      item.standard_body===row.standard_body_original;
  });
  const ready = unchanged.filter(row =>
    row.standard_title!==row.standard_title_original ||
    row.standard_body!==row.standard_body_original);
  const missing = rows.filter(row => !current.has(row.source_uid));
  const conflicting = rows.filter(row => current.has(row.source_uid) && !unchanged.includes(row));

  async function apply() {
    if (busy || disabled || ready.length===0) return;
    const ok = window.confirm(
      "검사기준(관련 법령) " + ready.length +
      "건만 원문 발췌로 교체합니다. 수동수정 또는 병합으로 달라진 " +
      conflicting.length + "건과 삭제된 " + missing.length +
      "건은 건너뜁니다. 사진, 개선조치, 예방대책, 검토/공개 상태는 그대로 유지합니다. 적용할까요?"
    );
    if (!ok) return;
    saveBackup(items);
    setBusy(true); setProgress(0); setMessage(""); setError("");
    let count=0;
    const failures:string[]=[];
    try {
      for(const row of ready) {
        const item=current.get(row.source_uid)!;
        const {data,error:writeError}=await supabase.from("casebook_cases")
          .update({
            standard_title:row.standard_title,
            standard_body:row.standard_body,
            updated_at:new Date().toISOString(),
          })
          .eq("id",item.id)
          .eq("source_uid",row.source_uid)
          .eq("standard_title",row.standard_title_original)
          .eq("standard_body",row.standard_body_original)
          .select("id");
        if (writeError || data?.length!==1) {
          failures.push(String(row.case_no_reference) + "번: " + (writeError?.message ?? "기존 문안이 변경되어 제외"));
        } else count++;
        setProgress(prev=>prev+1);
      }
      await onComplete();
      if (failures.length) setError(count+"건 반영, "+failures.length+"건 보류. "+failures.slice(0,3).join(" / "));
      else setMessage(count+"건 검사기준 원문 반영 완료. 사진과 공개상태 유지.");
    } catch(e) {
      setError(e instanceof Error ? e.message : "검사기준 적용 오류");
    } finally { setBusy(false); }
  }
  return (
    <section className="admin-sheet cb-import" style={{marginBottom:18}}>
      <h3>검사기준(관련 법령) 원문 선택 수정</h3>
      <p>국가법령정보센터에서 대조한 <strong>원문 적용용 JSON</strong>만 업로드합니다.
        원문 불명확 사례는 수정하지 않습니다. 저장 전 현재 검사기준을 JSON으로 백업합니다.</p>
      <input
        type="file" accept=".json,application/json" aria-label="법령 원문 적용용 JSON"
        disabled={busy}
        onChange={async event=>{
          const file=event.target.files?.[0];
          setRows([]);setMessage("");setError("");setProgress(0);
          if (!file) return;
          try {
            if(file.size>2000000) throw Error("2MB 이하 파일만 허용합니다.");
            setRows(parseLegalFile(JSON.parse(await file.text())));
          }catch(e){setError(e instanceof Error?e.message:"JSON 파일을 읽지 못했습니다.");}
          event.target.value="";
        }}
      />
      {rows.length>0 && <>
        <p><b>파일 {rows.length}건 · 수정 가능 {ready.length}건 · 기존 문안 변경 {conflicting.length}건 · 없는 사례 {missing.length}건</b></p>
        {(conflicting.length>0 || missing.length>0) && (
          <p role="note">직접 수정·병합된 사례는 자동 교체하지 않습니다. 검토표를 참고해 개별 수정하세요.</p>
        )}
        <details>
          <summary>원문 교체 내용 미리보기</summary>
          <div style={{maxHeight:340,overflow:"auto"}}>
            {ready.slice(0,12).map(row=><div key={row.source_uid} style={{borderBottom:"1px solid #d7e1ee",padding:"8px 0"}}>
              <b>{row.case_no_reference}번 · {row.title_reference}</b>
              <p>{row.standard_title}</p>
              <p style={{whiteSpace:"pre-wrap"}}>{row.standard_body}</p>
              <a href={row.source_url} target="_blank" rel="noreferrer">공식 법령 원문 확인</a>
            </div>)}
          </div>
        </details>
        <button type="button" className="primary-button" disabled={busy||disabled||ready.length===0}
          onClick={()=>void apply()}>
          {busy ? "검사기준 적용 중 "+progress+"/"+ready.length : "검사기준 "+ready.length+"건만 원문으로 변경"}
        </button>
      </>}
      {message && <p role="status">{message}</p>}
      {error && <p role="alert" style={{color:"#a52828"}}>{error}</p>}
    </section>
  );
}
