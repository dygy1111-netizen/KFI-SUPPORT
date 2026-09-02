import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";

import { PUBLIC_ASSET_BUCKET } from "../config/site";
import {
  publicAssetUrl,
  removePublicFile,
  supabase,
} from "../lib/supabase";

import "./CasebookManager.css";

type CasebookCase = {
  id: number;
  case_no: number;
  inspection_type: string;
  title: string;
  facility: string;
  photo1_path: string | null;
  photo2_path: string | null;
  photo_caption: string;
  photo_note: string;
  standard_title: string;
  standard_body: string;
  cause_title: string;
  cause_body: string;
  action_body: string;
  prevention_body: string;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
};

type Draft = Omit<
  CasebookCase,
  "id" | "created_at" | "updated_at"
> & {
  id?: number;
};

type PhotoFiles = {
  photo1: File | null;
  photo2: File | null;
};

type LineState = {
  title: number;
  photo: number;
  standard: number;
  cause: number;
  action: number;
  prevention: number;
};

const EMPTY_DRAFT: Draft = {
  case_no: 1,
  inspection_type: "안전성능검사",
  title: "",
  facility: "",
  photo1_path: null,
  photo2_path: null,
  photo_caption: "",
  photo_note: "",
  standard_title: "",
  standard_body: "",
  cause_title: "",
  cause_body: "",
  action_body: "",
  prevention_body: "",
  sort_order: 1,
};

const LINE_LIMITS: LineState = {
  title: 2,
  photo: 3,
  standard: 6,
  cause: 5,
  action: 7,
  prevention: 4,
};

function nextDraft(items: CasebookCase[]): Draft {
  const maxNo = items.reduce(
    (max, item) => Math.max(max, Number(item.case_no) || 0),
    0,
  );

  return {
    ...EMPTY_DRAFT,
    case_no: maxNo + 1,
    sort_order: maxNo + 1,
  };
}

function countLines(element: HTMLElement | null) {
  if (!element) return 1;

  const style = window.getComputedStyle(element);
  const lineHeight = parseFloat(style.lineHeight);
  const fontSize = parseFloat(style.fontSize);

  const unit =
    Number.isFinite(lineHeight) && lineHeight > 0
      ? lineHeight
      : fontSize * 1.55;

  return Math.max(1, Math.round(element.scrollHeight / unit));
}

function splitLines(text: string) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

async function uploadCasebookImage(file: File) {
  const ext =
    file.name
      .split(".")
      .pop()
      ?.toLowerCase()
      .replace(/[^a-z0-9]/g, "") || "jpg";

  // 기존 storage 정책과 최대한 호환되도록 최상위 폴더는 cases를 사용합니다.
  const path = `cases/casebook/${new Date().getFullYear()}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from(PUBLIC_ASSET_BUCKET)
    .upload(path, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

  if (error) throw error;

  return path;
}

function FitBadge({
  current,
  max,
}: {
  current: number;
  max: number;
}) {
  const overflow = current - max;
  const state =
    overflow <= 0 ? "ok" : overflow === 1 ? "warn" : "danger";

  return (
    <span className={`cb-fit ${state}`}>
      {current}/{max}줄
      {overflow > 0 ? ` · ${overflow}줄 초과` : " · 정상"}
    </span>
  );
}

function Field({
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
  fit?: { current: number; max: number };
}) {
  return (
    <label className="cb-field">
      <span className="cb-field-head">
        <b>{label}</b>
        {fit && (
          <FitBadge current={fit.current} max={fit.max} />
        )}
      </span>

      <textarea
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

export function CasebookManager() {
  const [items, setItems] = useState<CasebookCase[]>([]);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [files, setFiles] = useState<PhotoFiles>({
    photo1: null,
    photo2: null,
  });

  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [printItems, setPrintItems] = useState<CasebookCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);

  const [lines, setLines] = useState<LineState>({
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

  const preview1 = files.photo1
    ? URL.createObjectURL(files.photo1)
    : publicAssetUrl(draft.photo1_path);

  const preview2 = files.photo2
    ? URL.createObjectURL(files.photo2)
    : publicAssetUrl(draft.photo2_path);

  const notify = (text: string, error = false) => {
    setMessage(text);
    setFailed(error);
  };

  const load = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("casebook_cases")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("case_no", { ascending: true });

    if (error) {
      notify(error.message, true);
      setItems([]);
      setLoading(false);
      return;
    }

    const next = (data || []) as CasebookCase[];

    setItems(next);
    setDraft((current) =>
      current.id ? current : nextDraft(next),
    );
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    const measure = () => {
      setLines({
        title: countLines(titleRef.current),
        photo: countLines(photoRef.current),
        standard: countLines(standardRef.current),
        cause: countLines(causeRef.current),
        action: countLines(actionRef.current),
        prevention: countLines(preventionRef.current),
      });
    };

    const id = window.requestAnimationFrame(measure);
    window.addEventListener("resize", measure);

    return () => {
      window.cancelAnimationFrame(id);
      window.removeEventListener("resize", measure);
    };
  }, [draft, files]);

  useEffect(() => {
    const clear = () => setPrintItems([]);
    window.addEventListener("afterprint", clear);
    return () => window.removeEventListener("afterprint", clear);
  }, []);

  const overflowCount = useMemo(
    () =>
      (Object.keys(LINE_LIMITS) as Array<keyof LineState>)
        .map((key) =>
          Math.max(0, lines[key] - LINE_LIMITS[key]),
        )
        .reduce((sum, value) => sum + value, 0),
    [lines],
  );

  const edit = (item: CasebookCase) => {
    setDraft({ ...item });
    setFiles({ photo1: null, photo2: null });
    notify("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const createNew = () => {
    setDraft(nextDraft(items));
    setFiles({ photo1: null, photo2: null });
    notify("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const save = async () => {
    if (!draft.title.trim()) {
      notify("사례 제목을 입력해 주세요.", true);
      return;
    }

    setBusy(true);
    notify("");

    try {
      let photo1Path = draft.photo1_path;
      let photo2Path = draft.photo2_path;

      if (files.photo1) {
        const previous = photo1Path;
        photo1Path = await uploadCasebookImage(files.photo1);
        if (previous) await removePublicFile(previous);
      }

      if (files.photo2) {
        const previous = photo2Path;
        photo2Path = await uploadCasebookImage(files.photo2);
        if (previous) await removePublicFile(previous);
      }

      const payload = {
        case_no: Number(draft.case_no) || 1,
        inspection_type: draft.inspection_type.trim(),
        title: draft.title.trim(),
        facility: draft.facility.trim(),
        photo1_path: photo1Path,
        photo2_path: photo2Path,
        photo_caption: draft.photo_caption.trim(),
        photo_note: draft.photo_note.trim(),
        standard_title: draft.standard_title.trim(),
        standard_body: draft.standard_body.trim(),
        cause_title: draft.cause_title.trim(),
        cause_body: draft.cause_body.trim(),
        action_body: draft.action_body.trim(),
        prevention_body: draft.prevention_body.trim(),
        sort_order: Number(draft.sort_order) || Number(draft.case_no) || 1,
        updated_at: new Date().toISOString(),
      };

      const query = draft.id
        ? supabase
            .from("casebook_cases")
            .update(payload)
            .eq("id", draft.id)
        : supabase.from("casebook_cases").insert(payload);

      const { error } = await query;

      if (error) throw error;

      await load();
      setFiles({ photo1: null, photo2: null });
      setDraft(nextDraft(items));
      notify(
        draft.id
          ? "사례집 사례를 수정했습니다."
          : "사례집 사례를 저장했습니다.",
      );
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : "저장하지 못했습니다.",
        true,
      );
    } finally {
      setBusy(false);
    }
  };

  const remove = async (item: CasebookCase) => {
    if (!confirm(`사례 ${item.case_no} '${item.title}'을 삭제할까요?`)) {
      return;
    }

    setBusy(true);

    try {
      await Promise.all([
        removePublicFile(item.photo1_path),
        removePublicFile(item.photo2_path),
      ]);

      const { error } = await supabase
        .from("casebook_cases")
        .delete()
        .eq("id", item.id);

      if (error) throw error;

      setSelectedIds((current) =>
        current.filter((id) => id !== item.id),
      );

      if (draft.id === item.id) {
        setDraft(nextDraft(items.filter((row) => row.id !== item.id)));
        setFiles({ photo1: null, photo2: null });
      }

      await load();
      notify("사례를 삭제했습니다.");
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : "삭제하지 못했습니다.",
        true,
      );
    } finally {
      setBusy(false);
    }
  };

  const removePhoto = async (slot: 1 | 2) => {
    const path =
      slot === 1 ? draft.photo1_path : draft.photo2_path;

    if (!path && !(slot === 1 ? files.photo1 : files.photo2)) {
      return;
    }

    if (slot === 1) {
      setFiles((current) => ({ ...current, photo1: null }));
      setDraft((current) => ({ ...current, photo1_path: null }));
    } else {
      setFiles((current) => ({ ...current, photo2: null }));
      setDraft((current) => ({ ...current, photo2_path: null }));
    }

    // 실제 Storage 삭제는 사례 저장 시 경로 교체 또는 사례 삭제 때 처리됩니다.
  };

  const toggleSelected = (id: number) => {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );
  };

  const selectAll = () => {
    setSelectedIds(
      selectedIds.length === items.length
        ? []
        : items.map((item) => item.id),
    );
  };

  const printCases = (mode: "selected" | "all") => {
    const targets =
      mode === "all"
        ? items
        : items.filter((item) => selectedIds.includes(item.id));

    if (!targets.length) {
      notify("PDF로 출력할 사례를 선택해 주세요.", true);
      return;
    }

    setPrintItems(targets);

    window.setTimeout(() => {
      window.print();
    }, 120);
  };

  const update = <K extends keyof Draft>(
    key: K,
    value: Draft[K],
  ) => {
    setDraft((current) => ({
      ...current,
      [key]: value,
    }));
  };

  return (
    <>
      <div className="cb-manager">
        <div className="cb-head">
          <div>
            <span className="section-kicker">QUALITY CASEBOOK</span>
            <h3>품질관리 사례집 관리</h3>
            <p>
              Word 사례집 양식에 맞춰 사례를 등록하고,
              선택한 사례 또는 전체 사례를 A4 PDF로 출력합니다.
            </p>
          </div>

          <div className="cb-head-actions">
            <span
              className={`cb-page-state ${
                overflowCount === 0
                  ? "ok"
                  : overflowCount <= 2
                    ? "warn"
                    : "danger"
              }`}
            >
              {overflowCount === 0
                ? "● 현재 페이지 적합"
                : `⚠ 권장 분량 ${overflowCount}줄 초과`}
            </span>

            <button
              type="button"
              className="secondary-button"
              onClick={createNew}
            >
              + 새 사례
            </button>
          </div>
        </div>

        {message && (
          <div className={`admin-message ${failed ? "error" : ""}`}>
            {message}
            <button onClick={() => notify("")}>×</button>
          </div>
        )}

        <div className="cb-editor-grid">
          <section className="cb-form admin-sheet">
            <fieldset>
              <legend>사례 기본정보</legend>

              <div className="admin-field-grid">
                <label>
                  사례번호
                  <input
                    type="number"
                    min="1"
                    value={draft.case_no}
                    onChange={(event) =>
                      update("case_no", Number(event.target.value))
                    }
                  />
                </label>

                <label>
                  검사구분
                  <select
                    value={draft.inspection_type}
                    onChange={(event) =>
                      update("inspection_type", event.target.value)
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

                <label>
                  정렬순서
                  <input
                    type="number"
                    min="1"
                    value={draft.sort_order}
                    onChange={(event) =>
                      update("sort_order", Number(event.target.value))
                    }
                  />
                </label>
              </div>

              <Field
                label="사례 제목"
                value={draft.title}
                onChange={(value) => update("title", value)}
                rows={2}
                fit={{
                  current: lines.title,
                  max: LINE_LIMITS.title,
                }}
              />

              <Field
                label="구분"
                value={draft.facility}
                onChange={(value) => update("facility", value)}
                rows={2}
              />
            </fieldset>

            <fieldset>
              <legend>관련 사진</legend>

              <div className="cb-photo-input-grid">
                <PhotoInput
                  label="사진 1"
                  preview={preview1}
                  file={files.photo1}
                  onFile={(file) =>
                    setFiles((current) => ({
                      ...current,
                      photo1: file,
                    }))
                  }
                  onRemove={() => void removePhoto(1)}
                />

                <PhotoInput
                  label="사진 2"
                  preview={preview2}
                  file={files.photo2}
                  onFile={(file) =>
                    setFiles((current) => ({
                      ...current,
                      photo2: file,
                    }))
                  }
                  onRemove={() => void removePhoto(2)}
                />
              </div>

              <Field
                label="사진 설명"
                value={draft.photo_caption}
                onChange={(value) => update("photo_caption", value)}
                rows={2}
                fit={{
                  current: lines.photo,
                  max: LINE_LIMITS.photo,
                }}
              />

              <Field
                label="추가 설명"
                value={draft.photo_note}
                onChange={(value) => update("photo_note", value)}
                rows={2}
              />
            </fieldset>

            <fieldset>
              <legend>검사 기준</legend>

              <Field
                label="관련 법령·기준"
                value={draft.standard_title}
                onChange={(value) => update("standard_title", value)}
                rows={2}
              />

              <Field
                label="기준 내용"
                value={draft.standard_body}
                onChange={(value) => update("standard_body", value)}
                rows={5}
                fit={{
                  current: lines.standard,
                  max: LINE_LIMITS.standard,
                }}
              />
            </fieldset>

            <fieldset>
              <legend>발생 사유</legend>

              <Field
                label="발생 사유 요약"
                value={draft.cause_title}
                onChange={(value) => update("cause_title", value)}
                rows={2}
              />

              <Field
                label="발생 사유 상세"
                value={draft.cause_body}
                onChange={(value) => update("cause_body", value)}
                rows={5}
                fit={{
                  current: lines.cause,
                  max: LINE_LIMITS.cause,
                }}
              />
            </fieldset>

            <fieldset>
              <legend>개선 및 예방</legend>

              <Field
                label="개선 및 보완조치"
                value={draft.action_body}
                onChange={(value) => update("action_body", value)}
                rows={7}
                fit={{
                  current: lines.action,
                  max: LINE_LIMITS.action,
                }}
              />

              <Field
                label="예방 대책"
                value={draft.prevention_body}
                onChange={(value) => update("prevention_body", value)}
                rows={5}
                fit={{
                  current: lines.prevention,
                  max: LINE_LIMITS.prevention,
                }}
              />
            </fieldset>

            <div className="form-actions">
              <button
                type="button"
                className="primary-button"
                disabled={busy}
                onClick={() => void save()}
              >
                {busy
                  ? "저장 중…"
                  : draft.id
                    ? "사례 수정"
                    : "사례 저장"}
              </button>

              {draft.id && (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={createNew}
                >
                  수정 취소
                </button>
              )}
            </div>
          </section>

          <section className="cb-preview-column">
            <div className="cb-preview-head">
              <b>A4 실시간 미리보기</b>
              <span>
                한글 단어 단위 줄바꿈 적용
              </span>
            </div>

            <CasebookPage
              item={{
                id: draft.id || 0,
                ...draft,
              } as CasebookCase}
              preview1={preview1}
              preview2={preview2}
              refs={{
                title: titleRef,
                photo: photoRef,
                standard: standardRef,
                cause: causeRef,
                action: actionRef,
                prevention: preventionRef,
              }}
            />
          </section>
        </div>

        <section className="cb-list">
          <div className="cb-list-head">
            <div>
              <h3>등록된 사례</h3>
              <span>{items.length}건</span>
            </div>

            <div className="cb-list-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={selectAll}
              >
                {selectedIds.length === items.length && items.length
                  ? "전체 선택 해제"
                  : "전체 선택"}
              </button>

              <button
                type="button"
                className="secondary-button"
                onClick={() => printCases("selected")}
              >
                선택 사례 PDF
              </button>

              <button
                type="button"
                className="primary-button"
                onClick={() => printCases("all")}
              >
                전체 사례집 PDF
              </button>
            </div>
          </div>

          {loading ? (
            <div className="empty-list">
              사례집 목록을 불러오는 중입니다.
            </div>
          ) : items.length ? (
            <div className="cb-rows">
              {items.map((item) => (
                <article
                  key={item.id}
                  className={
                    selectedIds.includes(item.id)
                      ? "selected"
                      : ""
                  }
                >
                  <label className="cb-select">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(item.id)}
                      onChange={() => toggleSelected(item.id)}
                    />
                  </label>

                  <div className="cb-row-copy">
                    <span>
                      사례 {String(item.case_no).padStart(2, "0")} ·{" "}
                      {item.inspection_type}
                    </span>
                    <b>{item.title}</b>
                  </div>

                  <div className="cb-row-actions">
                    <button onClick={() => edit(item)}>
                      수정
                    </button>
                    <button
                      className="danger"
                      onClick={() => void remove(item)}
                    >
                      삭제
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-list">
              아직 등록된 사례집 사례가 없습니다.
            </div>
          )}
        </section>
      </div>

      {printItems.length > 0 && (
        <div className="cb-print-only">
          {printItems.map((item) => (
            <CasebookPage
              key={`print-${item.id}`}
              item={item}
            />
          ))}
        </div>
      )}
    </>
  );
}

function PhotoInput({
  label,
  preview,
  file,
  onFile,
  onRemove,
}: {
  label: string;
  preview: string;
  file: File | null;
  onFile: (file: File | null) => void;
  onRemove: () => void;
}) {
  return (
    <div className="cb-photo-input">
      <label>
        <div className="cb-photo-box">
          {preview ? (
            <img src={preview} alt={`${label} 미리보기`} />
          ) : (
            <span>＋ {label} 업로드</span>
          )}

          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              onFile(event.target.files?.[0] || null)
            }
          />
        </div>

        <small>
          {file?.name ||
            (preview ? "기존 사진 유지" : "사진을 선택하세요")}
        </small>
      </label>

      {preview && (
        <button
          type="button"
          className="cb-remove-photo"
          onClick={onRemove}
        >
          사진 제거
        </button>
      )}
    </div>
  );
}

type PreviewRefs = {
  title: React.RefObject<HTMLHeadingElement | null>;
  photo: React.RefObject<HTMLDivElement | null>;
  standard: React.RefObject<HTMLDivElement | null>;
  cause: React.RefObject<HTMLDivElement | null>;
  action: React.RefObject<HTMLDivElement | null>;
  prevention: React.RefObject<HTMLDivElement | null>;
};

function CasebookPage({
  item,
  preview1,
  preview2,
  refs,
}: {
  item: CasebookCase;
  preview1?: string;
  preview2?: string;
  refs?: PreviewRefs;
}) {
  const image1 =
    preview1 !== undefined
      ? preview1
      : publicAssetUrl(item.photo1_path);

  const image2 =
    preview2 !== undefined
      ? preview2
      : publicAssetUrl(item.photo2_path);

  return (
    <article className="cb-a4-page">
      <header className="cb-case-head">
        <span>
          [사례 {String(item.case_no || 0).padStart(2, "0")}] 위험물시설 ·{" "}
          {item.inspection_type || "검사구분"}
        </span>

        <h1 ref={refs?.title}>
          {item.title || "사례 제목을 입력하세요"}
        </h1>
      </header>

      <div className="cb-table">
        <CaseRow label="구 분">
          <p className="cb-bullet">
            {item.facility || "시설 구분을 입력하세요."}
          </p>
        </CaseRow>

        <CaseRow label={"관련 사진\n(현장 사례)"}>
          <div className="cb-photo-area">
            <div
              className={`cb-preview-photos ${
                image1 && image2 ? "two" : "one"
              }`}
            >
              {image1 && <img src={image1} alt="관련 사진 1" />}
              {image2 && <img src={image2} alt="관련 사진 2" />}

              {!image1 && !image2 && (
                <div className="cb-photo-placeholder">
                  관련 사진 삽입 영역
                </div>
              )}
            </div>

            <div className="cb-photo-copy" ref={refs?.photo}>
              {item.photo_caption && (
                <p>{item.photo_caption}</p>
              )}

              {item.photo_note && (
                <small>※ {item.photo_note}</small>
              )}
            </div>
          </div>
        </CaseRow>

        <CaseRow label={"검사 기준\n(관련 법령)"}>
          <div className="cb-copy" ref={refs?.standard}>
            {item.standard_title && (
              <p className="cb-bullet cb-strong">
                {item.standard_title}
              </p>
            )}

            {splitLines(item.standard_body).map(
              (line, index) => (
                <p key={index}>{line}</p>
              ),
            )}
          </div>
        </CaseRow>

        <CaseRow label="발생 사유">
          <div className="cb-copy" ref={refs?.cause}>
            {item.cause_title && (
              <p className="cb-bullet cb-strong">
                {item.cause_title}
              </p>
            )}

            {splitLines(item.cause_body).map(
              (line, index) => (
                <p key={index}>{line}</p>
              ),
            )}
          </div>
        </CaseRow>

        <CaseRow label={"개선 및\n보완조치"}>
          <div className="cb-copy" ref={refs?.action}>
            {splitLines(item.action_body).map(
              (line, index) => (
                <p className="cb-bullet" key={index}>
                  {line}
                </p>
              ),
            )}
          </div>
        </CaseRow>

        <CaseRow label="예방 대책">
          <div className="cb-copy" ref={refs?.prevention}>
            {splitLines(item.prevention_body).map(
              (line, index) => (
                <p className="cb-bullet" key={index}>
                  {line}
                </p>
              ),
            )}
          </div>
        </CaseRow>
      </div>

      <footer className="cb-page-footer">
        <b>한국소방산업기술원 위험물검사부</b>
        <span>
          Page {Number(item.case_no || 1) + 3}
        </span>
      </footer>
    </article>
  );
}

function CaseRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="cb-table-row">
      <div className="cb-table-label">
        {label.split("\n").map((line, index) => (
          <span key={index}>{line}</span>
        ))}
      </div>

      <div className="cb-table-content">{children}</div>
    </div>
  );
}
