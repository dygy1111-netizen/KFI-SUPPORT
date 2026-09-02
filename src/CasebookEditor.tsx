import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";

import "./CasebookEditor.css";

type CasebookDraft = {
  caseNo: string;
  inspectionType: string;
  title: string;
  facility: string;
  photoCaption: string;
  photoNote: string;
  standardTitle: string;
  standardBody: string;
  causeTitle: string;
  causeBody: string;
  actionBody: string;
  preventionBody: string;
};

type FitState = {
  title: number;
  photo: number;
  standard: number;
  cause: number;
  action: number;
  prevention: number;
};

type LocalCasebookRecord = {
  id: string;
  savedAt: string;
  draft: CasebookDraft;
  photo1?: string;
  photo2?: string;
};

const STORAGE_KEY = "kfi-support-casebook-records";
const LAST_DRAFT_KEY = "kfi-support-casebook-last-draft";

const initialDraft: CasebookDraft = {
  caseNo: "01",
  inspectionType: "안전성능검사",
  title: "옥외탱크저장소 방유제 균열 및 배수밸브 누수",
  facility: "옥외탱크저장소 (방유제 및 배수시설 검사)",
  photoCaption:
    "방유제 콘크리트 벽면 미세 균열 및 드레인 밸브 주변 수밀 마감 누락",
  photoNote:
    "균열 측정기(Crack Monitor) 측정 결과 1.5 mm 초과 크랙 확인",
  standardTitle:
    "위험물안전관리법 시행규칙 [별표 6] 옥외탱크저장소의 위치·구조 및 설비의 기준",
  standardBody:
    "방유제는 위험물이 유출되었을 때 외부 유출을 완전히 방지할 수 있는 수밀성 구조이어야 함.\n방유제 내부의 빗물 등을 배수하기 위해 외부에 조작 가능한 배수밸브를 설치해야 함.",
  causeTitle: "방유제 수밀성 불량 및 배수관로 누수 발생",
  causeBody:
    "콘크리트 타설 후 초기 양생 관리 미비로 방유제 하부 벽면에 관통형 균열이 발생하였으며, 외부 배수밸브 관통 부위의 씰링재 미시공으로 수밀 시험 시 누수 현상 발생.",
  actionBody:
    "균열 V-Cutting 보수: 고장력 에폭시 실링재 인젝션 주입 및 방수 몰탈 재마감 처리.\n배수 밸브 교체: 외부 조작형 황동 밸브 신설 및 관통부 불소 고무 패킹 밀폐.\n수밀성 시험 재실시: 방유제 내 용수 채움 후 24시간 수밀 시험 통과.",
  preventionBody:
    "방유제 콘크리트 시공 시 표준 양생 기간 준수 및 Crack 방지용 수축이음재 적용.\n검사 신청 전 감리자의 ‘사전 수밀성 자가 점검표’ 제출 의무화.",
};

const recommendedLines: FitState = {
  title: 2,
  photo: 3,
  standard: 5,
  cause: 5,
  action: 6,
  prevention: 4,
};

function readRecords(): LocalCasebookRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function countVisualLines(element: HTMLElement | null) {
  if (!element) return 0;

  const style = window.getComputedStyle(element);
  const rawLineHeight = parseFloat(style.lineHeight);
  const lineHeight =
    Number.isFinite(rawLineHeight) && rawLineHeight > 0
      ? rawLineHeight
      : parseFloat(style.fontSize) * 1.6;

  return Math.max(1, Math.round(element.scrollHeight / lineHeight));
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new Error("이미지를 읽지 못했습니다."));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function FitBadge({
  lines,
  max,
}: {
  lines: number;
  max: number;
}) {
  const diff = lines - max;
  const status =
    diff <= 0 ? "ok" : diff === 1 ? "warn" : "danger";

  return (
    <span className={`casebook-fit-badge ${status}`}>
      {lines}/{max}줄
      {diff > 0 ? ` · ${diff}줄 초과` : " · 정상"}
    </span>
  );
}

function InputBlock({
  label,
  value,
  onChange,
  rows = 3,
  fit,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  fit?: { lines: number; max: number };
}) {
  return (
    <label className="casebook-field">
      <span className="casebook-field-head">
        <b>{label}</b>
        {fit && <FitBadge lines={fit.lines} max={fit.max} />}
      </span>

      <textarea
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

export function CasebookEditor() {
  const [draft, setDraft] = useState<CasebookDraft>(() => {
    try {
      const saved = localStorage.getItem(LAST_DRAFT_KEY);
      return saved ? { ...initialDraft, ...JSON.parse(saved) } : initialDraft;
    } catch {
      return initialDraft;
    }
  });

  const [photo1, setPhoto1] = useState<string>("");
  const [photo2, setPhoto2] = useState<string>("");
  const [records, setRecords] = useState<LocalCasebookRecord[]>(readRecords);
  const [message, setMessage] = useState("");

  const [fit, setFit] = useState<FitState>({
    title: 1,
    photo: 1,
    standard: 1,
    cause: 1,
    action: 1,
    prevention: 1,
  });

  const titleRef = useRef<HTMLHeadingElement>(null);
  const photoRef = useRef<HTMLDivElement>(null);
  const standardRef = useRef<HTMLDivElement>(null);
  const causeRef = useRef<HTMLDivElement>(null);
  const actionRef = useRef<HTMLDivElement>(null);
  const preventionRef = useRef<HTMLDivElement>(null);

  const update = <K extends keyof CasebookDraft>(
    key: K,
    value: CasebookDraft[K],
  ) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  useEffect(() => {
    localStorage.setItem(LAST_DRAFT_KEY, JSON.stringify(draft));
  }, [draft]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  }, [records]);

  useEffect(() => {
    const measure = () => {
      setFit({
        title: countVisualLines(titleRef.current),
        photo: countVisualLines(photoRef.current),
        standard: countVisualLines(standardRef.current),
        cause: countVisualLines(causeRef.current),
        action: countVisualLines(actionRef.current),
        prevention: countVisualLines(preventionRef.current),
      });
    };

    const id = window.requestAnimationFrame(measure);
    window.addEventListener("resize", measure);

    return () => {
      window.cancelAnimationFrame(id);
      window.removeEventListener("resize", measure);
    };
  }, [draft, photo1, photo2]);

  const totalOverflow = useMemo(() => {
    return (Object.keys(recommendedLines) as Array<keyof FitState>).reduce(
      (sum, key) => sum + Math.max(0, fit[key] - recommendedLines[key]),
      0,
    );
  }, [fit]);

  const selectPhoto =
    (slot: 1 | 2) => async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      try {
        const url = await fileToDataUrl(file);

        if (slot === 1) {
          setPhoto1(url);
        } else {
          setPhoto2(url);
        }
      } catch {
        setMessage("이미지를 불러오지 못했습니다.");
      }
    };

  const saveLocal = () => {
    const record: LocalCasebookRecord = {
      id: `${Date.now()}`,
      savedAt: new Date().toISOString(),
      draft,
      photo1: photo1 || undefined,
      photo2: photo2 || undefined,
    };

    setRecords((current) => [record, ...current]);
    setMessage("현재 사례를 이 브라우저에 저장했습니다.");
  };

  const loadRecord = (record: LocalCasebookRecord) => {
    setDraft(record.draft);
    setPhoto1(record.photo1 || "");
    setPhoto2(record.photo2 || "");
    setMessage(`사례 ${record.draft.caseNo}을(를) 불러왔습니다.`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const deleteRecord = (id: string) => {
    if (!confirm("저장된 사례를 삭제할까요?")) return;
    setRecords((current) => current.filter((item) => item.id !== id));
    setMessage("저장된 사례를 삭제했습니다.");
  };

  const newDraft = () => {
    if (!confirm("현재 작성 내용을 비우고 새 사례를 작성할까요?")) return;

    const nextNo = String(
      Math.max(
        0,
        ...records.map((item) => Number(item.draft.caseNo) || 0),
      ) + 1,
    ).padStart(2, "0");

    setDraft({
      caseNo: nextNo,
      inspectionType: "안전성능검사",
      title: "",
      facility: "",
      photoCaption: "",
      photoNote: "",
      standardTitle: "",
      standardBody: "",
      causeTitle: "",
      causeBody: "",
      actionBody: "",
      preventionBody: "",
    });

    setPhoto1("");
    setPhoto2("");
    setMessage("새 사례 작성 화면으로 초기화했습니다.");
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(records, null, 2)], {
      type: "application/json;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `KFI_품질관리_사례집_백업_${new Date()
      .toISOString()
      .slice(0, 10)}.json`;

    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    URL.revokeObjectURL(url);
  };

  const importJson = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);

      if (!Array.isArray(parsed)) {
        throw new Error();
      }

      setRecords(parsed);
      setMessage("백업 파일을 불러왔습니다.");
    } catch {
      setMessage("올바른 사례집 백업 파일이 아닙니다.");
    } finally {
      event.target.value = "";
    }
  };

  return (
    <div className="casebook-editor">
      <div className="casebook-toolbar no-print">
        <div>
          <span className="section-kicker">QUALITY CASEBOOK</span>
          <h3>품질관리 사례집 작성</h3>
          <p>
            Supabase 없이 현재 브라우저에 저장하며, 오른쪽에서 A4 결과를
            확인할 수 있습니다.
          </p>
        </div>

        <div className="casebook-toolbar-actions">
          <div
            className={`casebook-page-status ${
              totalOverflow === 0
                ? "ok"
                : totalOverflow <= 2
                  ? "warn"
                  : "danger"
            }`}
          >
            {totalOverflow === 0
              ? "● 페이지 적합"
              : `⚠ 권장 분량 ${totalOverflow}줄 초과`}
          </div>

          <button className="secondary-button" type="button" onClick={newDraft}>
            + 새 사례
          </button>

          <button className="secondary-button" type="button" onClick={saveLocal}>
            브라우저 저장
          </button>

          <button
            className="primary-button"
            type="button"
            onClick={() => window.print()}
          >
            PDF / 인쇄
          </button>
        </div>
      </div>

      {message && (
        <div className="casebook-message no-print">
          <span>{message}</span>
          <button type="button" onClick={() => setMessage("")}>
            ×
          </button>
        </div>
      )}

      <div className="casebook-workspace">
        <section className="casebook-form-panel no-print">
          <div className="casebook-form-section">
            <h4>1. 사례 기본정보</h4>

            <div className="casebook-form-grid">
              <label className="casebook-field">
                <span className="casebook-field-head">
                  <b>사례번호</b>
                </span>
                <input
                  value={draft.caseNo}
                  onChange={(event) => update("caseNo", event.target.value)}
                />
              </label>

              <label className="casebook-field">
                <span className="casebook-field-head">
                  <b>검사구분</b>
                </span>

                <select
                  value={draft.inspectionType}
                  onChange={(event) =>
                    update("inspectionType", event.target.value)
                  }
                >
                  <option>안전성능검사</option>
                  <option>완공검사</option>
                  <option>중간정기검사</option>
                  <option>정밀정기검사</option>
                  <option>기술검토</option>
                  <option>기타</option>
                </select>
              </label>
            </div>

            <InputBlock
              label="사례 제목"
              value={draft.title}
              onChange={(value) => update("title", value)}
              rows={2}
              fit={{ lines: fit.title, max: recommendedLines.title }}
            />

            <InputBlock
              label="구분"
              value={draft.facility}
              onChange={(value) => update("facility", value)}
              rows={2}
            />
          </div>

          <div className="casebook-form-section">
            <h4>2. 관련 사진</h4>

            <div className="casebook-photo-inputs">
              <label className="casebook-photo-input">
                {photo1 ? (
                  <img src={photo1} alt="사진 1 미리보기" />
                ) : (
                  <span>＋ 사진 1</span>
                )}
                <input type="file" accept="image/*" onChange={selectPhoto(1)} />
              </label>

              <label className="casebook-photo-input">
                {photo2 ? (
                  <img src={photo2} alt="사진 2 미리보기" />
                ) : (
                  <span>＋ 사진 2</span>
                )}
                <input type="file" accept="image/*" onChange={selectPhoto(2)} />
              </label>
            </div>

            <InputBlock
              label="사진 설명"
              value={draft.photoCaption}
              onChange={(value) => update("photoCaption", value)}
              rows={2}
              fit={{ lines: fit.photo, max: recommendedLines.photo }}
            />

            <InputBlock
              label="추가 설명"
              value={draft.photoNote}
              onChange={(value) => update("photoNote", value)}
              rows={2}
            />
          </div>

          <div className="casebook-form-section">
            <h4>3. 검사기준</h4>

            <InputBlock
              label="관련 법령·기준"
              value={draft.standardTitle}
              onChange={(value) => update("standardTitle", value)}
              rows={2}
            />

            <InputBlock
              label="기준 내용"
              value={draft.standardBody}
              onChange={(value) => update("standardBody", value)}
              rows={4}
              fit={{ lines: fit.standard, max: recommendedLines.standard }}
            />
          </div>

          <div className="casebook-form-section">
            <h4>4. 발생사유</h4>

            <InputBlock
              label="발생사유 요약"
              value={draft.causeTitle}
              onChange={(value) => update("causeTitle", value)}
              rows={2}
            />

            <InputBlock
              label="발생사유 상세"
              value={draft.causeBody}
              onChange={(value) => update("causeBody", value)}
              rows={5}
              fit={{ lines: fit.cause, max: recommendedLines.cause }}
            />
          </div>

          <div className="casebook-form-section">
            <h4>5. 개선 및 예방</h4>

            <InputBlock
              label="개선 및 보완조치"
              value={draft.actionBody}
              onChange={(value) => update("actionBody", value)}
              rows={6}
              fit={{ lines: fit.action, max: recommendedLines.action }}
            />

            <InputBlock
              label="예방대책"
              value={draft.preventionBody}
              onChange={(value) => update("preventionBody", value)}
              rows={5}
              fit={{
                lines: fit.prevention,
                max: recommendedLines.prevention,
              }}
            />
          </div>

          <div className="casebook-form-section">
            <div className="casebook-saved-head">
              <div>
                <h4>저장된 사례</h4>
                <p>이 컴퓨터의 현재 브라우저에만 저장됩니다.</p>
              </div>

              <div className="casebook-backup-actions">
                <button type="button" onClick={exportJson}>
                  백업 저장
                </button>

                <label>
                  백업 불러오기
                  <input
                    type="file"
                    accept=".json,application/json"
                    onChange={importJson}
                  />
                </label>
              </div>
            </div>

            {records.length ? (
              <div className="casebook-record-list">
                {records.map((record) => (
                  <article key={record.id}>
                    <div>
                      <span>
                        사례 {record.draft.caseNo} ·{" "}
                        {record.draft.inspectionType}
                      </span>
                      <b>{record.draft.title || "제목 없음"}</b>
                      <small>
                        {new Date(record.savedAt).toLocaleString("ko-KR")}
                      </small>
                    </div>

                    <div>
                      <button type="button" onClick={() => loadRecord(record)}>
                        불러오기
                      </button>
                      <button
                        type="button"
                        className="danger"
                        onClick={() => deleteRecord(record.id)}
                      >
                        삭제
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="casebook-empty-record">
                아직 브라우저에 저장된 사례가 없습니다.
              </div>
            )}
          </div>
        </section>

        <section className="casebook-preview-panel">
          <div className="casebook-preview-label no-print">
            <span>A4 실시간 미리보기</span>
            <small>
              한글 단어 단위 줄바꿈을 적용하여 ‘외 / 부’ 같은 분리를
              방지합니다.
            </small>
          </div>

          <article className="casebook-preview-page">
            <header className="casebook-case-header">
              <span>
                [사례 {draft.caseNo || "00"}] 위험물시설 ·{" "}
                {draft.inspectionType}
              </span>

              <h1 ref={titleRef}>{draft.title || "사례 제목을 입력하세요"}</h1>
            </header>

            <div className="casebook-table">
              <CaseRow label="구 분">
                <p className="casebook-bullet">
                  {draft.facility || "시설 구분을 입력하세요."}
                </p>
              </CaseRow>

              <CaseRow label={"관련 사진\n(현장 사례)"} photo>
                <div className="casebook-photo-area">
                  <div
                    className={`casebook-preview-photos ${
                      photo1 && photo2 ? "two" : "one"
                    }`}
                  >
                    {photo1 && <img src={photo1} alt="현장 사례 1" />}
                    {photo2 && <img src={photo2} alt="현장 사례 2" />}

                    {!photo1 && !photo2 && (
                      <div className="casebook-photo-placeholder">
                        관련 사진 삽입 영역
                      </div>
                    )}
                  </div>

                  <div className="casebook-photo-copy" ref={photoRef}>
                    {draft.photoCaption && <p>{draft.photoCaption}</p>}
                    {draft.photoNote && <small>※ {draft.photoNote}</small>}
                  </div>
                </div>
              </CaseRow>

              <CaseRow label={"검사 기준\n(관련 법령)"}>
                <div ref={standardRef} className="casebook-copy">
                  {draft.standardTitle && (
                    <p className="casebook-bullet strong">
                      {draft.standardTitle}
                    </p>
                  )}

                  {draft.standardBody &&
                    draft.standardBody.split("\n").map((line, index) => (
                      <p key={index}>{line}</p>
                    ))}
                </div>
              </CaseRow>

              <CaseRow label="발생 사유">
                <div ref={causeRef} className="casebook-copy">
                  {draft.causeTitle && (
                    <p className="casebook-bullet strong">{draft.causeTitle}</p>
                  )}

                  {draft.causeBody &&
                    draft.causeBody.split("\n").map((line, index) => (
                      <p key={index}>{line}</p>
                    ))}
                </div>
              </CaseRow>

              <CaseRow label={"개선 및\n보완조치"}>
                <div ref={actionRef} className="casebook-copy">
                  {draft.actionBody &&
                    draft.actionBody.split("\n").map((line, index) => (
                      <p className="casebook-bullet" key={index}>
                        {line}
                      </p>
                    ))}
                </div>
              </CaseRow>

              <CaseRow label="예방 대책">
                <div ref={preventionRef} className="casebook-copy">
                  {draft.preventionBody &&
                    draft.preventionBody.split("\n").map((line, index) => (
                      <p className="casebook-bullet" key={index}>
                        {line}
                      </p>
                    ))}
                </div>
              </CaseRow>
            </div>

            <footer className="casebook-page-footer">
              <b>한국소방산업기술원 위험물검사부</b>
              <span>Page {Number(draft.caseNo || 1) + 3}</span>
            </footer>
          </article>
        </section>
      </div>
    </div>
  );
}

function CaseRow({
  label,
  children,
  photo = false,
}: {
  label: string;
  children: React.ReactNode;
  photo?: boolean;
}) {
  return (
    <div className={`casebook-row ${photo ? "photo-row" : ""}`}>
      <div className="casebook-row-label">
        {label.split("\n").map((line, index) => (
          <span key={index}>{line}</span>
        ))}
      </div>

      <div className="casebook-row-content">{children}</div>
    </div>
  );
}
