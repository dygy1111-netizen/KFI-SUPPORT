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
  const [publishAll, setPublishAll] = useState(true);
  const current = new Map(items.filter(x => x.source_uid).map(x => [x.source_uid, x]));
  const missing = rows.filter(r => !current.has(r.source_uid));
  const exactCaseCount = items.length === 146;
  const allMatched = rows.length === 146 && missing.length === 0 && exactCaseCount;
  const different = rows.filter(r => {
    const found = current.get(r.source_uid);
    return found && (found.action_body !== r.action_body || found.prevention_body !== r.prevention_body);
  });
  const titleChanges = rows.filter(r => {
    const found = current.get(r.source_uid);
    return found && r.title_reference && found.title !== r.title_reference;
  });

  async function save() {
    if (disabled || busy || !allMatched) return;
    if (!window.confirm(
      publishAll
        ? `146건 개선조치·예방대책을 갱신하고 전부 '검토완료·공개'로 설정합니다. 현재 문안과 다른 ${different.length}건이 교체되고, 비공개 사례도 공개됩니다. 법령·사진 확인이 끝나지 않은 사례가 포함되어 있으면 취소하세요. 적용할까요?`
        : `146건 개선조치·예방대책 문안만 갱신합니다. 현재 문안과 다른 ${different.length}건이 교체되며 공개 상태는 유지됩니다. 적용할까요?`
    )) return;
    // Save an editable backup locally before attempting any database changes.
    const snapshot = items.map(item => ({
      source_uid: item.source_uid,
      case_no: item.case_no,
      title: item.title,
      action_body: item.action_body,
      prevention_body: item.prevention_body,
      review_status: item.review_status,
      published: item.published,
      updated_at: item.updated_at,
    }));
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], {type: "application/json"});
    const backupUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = backupUrl;
    link.download = "KFI_품질사례146건_문안및공개상태_변경전백업.json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(backupUrl), 1000);
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
                ...(publishAll ? {review_status: "검토완료", published: true} : {}),
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
        setMessage(publishAll
          ? "146건의 문안 수정과 전체 검토완료·공개 처리를 마쳤습니다. 기존 사진과 사례번호는 보존되었습니다."
          : "146건의 개선조치·예방대책 반영 완료. 사진·사례번호·검토상태·공개상태는 유지되었습니다.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="admin-sheet cb-import" style={{marginBottom: 18}}>
      <h3>개선조치·예방대책 일괄 수정 (146건)</h3>
      <p><strong>문안수정 전용 JSON</strong>을 선택하세요. 최초 등록용 JSON이 아니라
        파일명에 '개선조치예방대책_수정제안'이 들어간 파일입니다.
        사진·사례번호·검사기준·발생사유는 변경하지 않습니다.</p>
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
          <p>파일 {rows.length}건 · 현재 DB 사례 {items.length}건 · DB 식별자 일치 {rows.length - missing.length}건 ·
            문안 변경 예정 {different.length}건 · 제목 불일치 {titleChanges.length}건</p>
          {!exactCaseCount && <p role="alert" style={{color:"#b42318"}}>
            현재 DB의 사례가 146건이 아닙니다. 다른 사례에 영향을 주지 않도록 적용을 중단합니다.
          </p>}
          <label style={{display:"flex",alignItems:"flex-start",gap:10,padding:"10px 0",fontWeight:700}}>
            <input
              type="checkbox" checked={publishAll} disabled={busy}
              onChange={event => setPublishAll(event.target.checked)}
            />
            문안 수정과 함께 146건 모두 검토완료·공개하기
          </label>
          {publishAll && <p role="alert" style={{color:"#8b5316"}}>
            전체 공개 시 현재 비공개 사례도 일반 방문자에게 보입니다.
            사진·검사기준의 개별 검증이 아직 끝나지 않았다면 체크를 해제하세요.
          </p>}
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
            disabled={busy || disabled || !allMatched}
            onClick={() => void save()}>
            {busy ? `적용 중 ${progress}/146` : publishAll
              ? "146건 문안 수정 + 전체 검토완료·공개"
              : "146건 문안만 일괄 반영"}
          </button>
          {disabled && <p role="alert">관리자 DB 검토 스키마가 준비되어야 합니다.</p>}
          {message && <p role="status">{message}</p>}
        </>
      )}
      {error && <p role="alert" style={{color:"#b42318"}}>{error}</p>}
    </section>
  );
}
