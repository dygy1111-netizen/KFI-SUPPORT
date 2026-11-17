import { useState } from "react";
import { supabase } from "../lib/supabase";
import type { CasebookCase } from "../lib/casebook";

type TextRevision = {
  source_uid: string;
  action_body: string;
  prevention_body: string;
  title_reference?: string;
  review_flag?: string;
};

function validateRevisions(input: unknown): TextRevision[] {
  if (!Array.isArray(input) || input.length !== 146) {
    throw new Error("146건의 문안 수정 JSON 배열만 등록할 수 있습니다.");
  }
  const keys = new Set<string>();
  return input.map((raw, i) => {
    if (!raw || typeof raw !== "object") {
      throw new Error(`${i + 1}번: 객체 데이터가 없습니다.`);
    }
    const row = raw as Record<string, unknown>;
    if (typeof row.source_uid !== "string" ||
      !/^[A-Za-z0-9:_-]{8,160}$/.test(row.source_uid)) {
      throw new Error(`${i + 1}번: 원본 식별자가 올바르지 않습니다.`);
    }
    if (keys.has(row.source_uid)) throw new Error(`${i + 1}번: 중복 원본 식별자입니다.`);
    keys.add(row.source_uid);
    if (typeof row.action_body !== "string" || !row.action_body.trim() ||
        typeof row.prevention_body !== "string" || !row.prevention_body.trim() ||
        row.action_body.length > 10000 || row.prevention_body.length > 10000) {
      throw new Error(`${i + 1}번: 개선조치·예방대책 문안이 비어 있거나 너무 깁니다.`);
    }
    return {
      source_uid: row.source_uid,
      action_body: row.action_body.trim(),
      prevention_body: row.prevention_body.trim(),
      title_reference: typeof row.title_reference === "string" ? row.title_reference : "",
      review_flag: typeof row.review_flag === "string" ? row.review_flag : "",
    };
  });
}

export function CasebookTextUpdate({
  items,
  onComplete,
  disabled = false,
}: {
  items: CasebookCase[];
  onComplete: () => Promise<unknown>;
  disabled?: boolean;
}) {
  const [rows, setRows] = useState<TextRevision[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const current = new Map(items.filter(x => x.source_uid).map(x => [x.source_uid, x]));
  const missing = rows.filter(r => !current.has(r.source_uid));
  const different = rows.filter(r => {
    const found = current.get(r.source_uid);
    return found && (found.action_body !== r.action_body || found.prevention_body !== r.prevention_body);
  });
  const titleChanges = rows.filter(r => {
    const found = current.get(r.source_uid);
    return found && r.title_reference && found.title !== r.title_reference;
  });

  async function save() {
    if (disabled || busy || rows.length !== 146 || missing.length !== 0) return;
    if (!window.confirm(
      `146건의 개선조치·예방대책 문안만 갱신합니다. 현재 문안과 다른 ${different.length}건은 수정안으로 교체됩니다. 사진·순번·검사기준·검토상태·공개 여부는 유지됩니다. 적용할까요?`
    )) return;
    setBusy(true);
    setError("");
    setMessage("");
    setProgress(0);
    let successful = 0;
    const failures: string[] = [];
    try {
      // RLS allows writes only for the site's authenticated administrator.
      // Update solely two text fields. Re-running the same file is safe.
      for (let offset = 0; offset < rows.length; offset += 5) {
        const batch = rows.slice(offset, offset + 5);
        const results = await Promise.all(batch.map(async row => {
          try {
            const { data, error: updateError } = await supabase
              .from("casebook_cases")
              .update({
                action_body: row.action_body,
                prevention_body: row.prevention_body,
                updated_at: new Date().toISOString(),
              })
              .eq("source_uid", row.source_uid)
              .select("id");
            if (updateError) throw updateError;
            if ((data?.length ?? 0) !== 1) throw new Error("수정한 사례가 1건이 아닙니다.");
            return null;
          } catch (e) {
            return `${row.source_uid}: ${e instanceof Error ? e.message : String(e)}`;
          }
        }));
        successful += results.filter(x => x === null).length;
        failures.push(...results.filter((x): x is string => x !== null));
        setProgress(offset + batch.length);
      }
      await onComplete();
      if (failures.length > 0) {
        setError(`${successful}건 반영, ${failures.length}건 실패. 재시도해도 이미 반영된 사진·공개상태는 유지됩니다. ${failures.slice(0, 3).join(" / ")}`);
      } else {
        setMessage("146건의 개선조치·예방대책 반영 완료. 사진·사례번호·검토상태·공개상태는 유지되었습니다.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="admin-sheet cb-import" style={{marginBottom: 18}}>
      <h3>개선조치·예방대책 일괄 수정 (146건)</h3>
      <p>수정안 JSON을 선택해 원본 순번·대상 사례·새 문안을 확인한 뒤 적용합니다.
        <strong> 사진·사례번호·검사기준·공개 여부는 변경하지 않습니다.</strong></p>
      <input type="file" accept=".json,application/json" aria-label="146건 문안 수정 JSON 파일"
        disabled={busy} onChange={async event => {
          setRows([]); setError(""); setMessage(""); setProgress(0);
          const file = event.target.files?.[0];
          if (!file) return;
          try {
            if (file.size > 5_000_000) throw new Error("JSON은 5MB 이하여야 합니다.");
            setRows(validateRevisions(JSON.parse(await file.text())));
          } catch (e) {
            setError(e instanceof Error ? e.message : "JSON을 읽지 못했습니다.");
          }
          event.target.value = "";
        }}
      />
      {rows.length > 0 && (
        <>
          <p>파일 {rows.length}건 · DB 식별자 일치 {rows.length - missing.length}건 ·
            문안 변경 예정 {different.length}건 · 제목 불일치 {titleChanges.length}건</p>
          {missing.length > 0 && <p role="alert" style={{color:"#b42318"}}>
            등록되지 않은 원본 식별자 {missing.length}건이 있어 적용하지 않습니다:
            {missing.slice(0, 4).map(x => x.source_uid).join(", ")}
          </p>}
          <details style={{margin: "10px 0"}}>
            <summary>수정 문안 미리보기 (처음 10건 및 검토 메모)</summary>
            <div style={{maxHeight:360,overflow:"auto"}}>
              {rows.slice(0,10).map((row,i) => (
                <div key={row.source_uid} style={{borderBottom:"1px solid #d7e1ee",padding:"8px 0"}}>
                  <b>{i+1}. {row.title_reference || current.get(row.source_uid)?.title || row.source_uid}</b>
                  <p><strong>개선조치</strong> {row.action_body}</p>
                  <p><strong>예방대책</strong> {row.prevention_body}</p>
                  {row.review_flag && <small>검토 메모: {row.review_flag}</small>}
                </div>
              ))}
            </div>
          </details>
          <button type="button" className="primary-button"
            disabled={busy || disabled || rows.length !== 146 || missing.length !== 0}
            onClick={() => void save()}>
            {busy ? `적용 중 ${progress}/146` : "146건 문안만 일괄 반영"}
          </button>
          {disabled && <p role="alert">관리자 DB 검토 스키마가 준비되어야 합니다.</p>}
          {message && <p role="status">{message}</p>}
        </>
      )}
      {error && <p role="alert" style={{color:"#b42318"}}>{error}</p>}
    </section>
  );
}
