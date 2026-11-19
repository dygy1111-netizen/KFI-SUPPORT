import { prepareCasebookPrint } from '../lib/casebookPrint';
import { createPortal } from "react-dom";
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

import { casebookGroup, compactCasebookProse, photoWidthPercent, photoHorizontalStretch, sourceCaseNumber, PHOTO_SLOTS, type PhotoSlot, type CasebookCase } from "../lib/casebook";
import { loadCasebook } from '../lib/casebookQuery';
import { CasebookImport } from "./CasebookImport";
import { CasebookTextUpdate } from "./CasebookTextUpdate";
import { CasebookLegalUpdate } from "./CasebookLegalUpdate";
import { CasebookBook, validateBookLayout } from "./CasebookBook";
import { CasebookTextEditor } from "./CasebookTextEditor";
import { DEFAULT_BOOK_TEXT, type BookText } from "../lib/casebookBookText";
import { loadBookText } from "../lib/casebookBookTextStore";
import { bookCompare } from "../lib/casebookBook";

type Draft = Omit<
  CasebookCase,
  "id" | "created_at" | "updated_at"
> & {
  id?: number;
};

type PhotoFiles = {
  photo1: File | null;
  photo2: File | null;
  photo3: File | null;
  photo4: File | null;
};

const EMPTY_FILES: PhotoFiles = {
  photo1: null, photo2: null, photo3: null, photo4: null,
};

type LineState = {
  title: number;
  photo: number;
  standard: number;
  cause: number;
  action: number;
  prevention: number;
};

type EditorSection =
  | "basic"
  | "photos"
  | "standard"
  | "cause"
  | "action";

const EMPTY_DRAFT: Draft = {
  finding_type: "보완", test_item: "", source_uid: null, source_row: null, source_sheet: "", review_note: "", review_status: "검토대기", published: false,
  case_no: 1,
  inspection_type: "안전성능검사",
  title: "",
  facility: "",
  photo1_path: null,
  photo2_path: null,
  photo3_path: null,
  photo4_path: null,
  photo1_width_pct: 100,
  photo2_width_pct: 100,
  photo3_width_pct: 100,
  photo4_width_pct: 100,
  photo1_stretch_x_pct: 100,
  photo2_stretch_x_pct: 100,
  photo3_stretch_x_pct: 100,
  photo4_stretch_x_pct: 100,
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

const EDITOR_SECTIONS: Array<[EditorSection, string]> = [
  ["basic", "기본정보"],
  ["photos", "사진"],
  ["standard", "검사기준"],
  ["cause", "발생사유"],
  ["action", "개선·예방"],
];

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
    .map((line) => line.trim().replace(/^[○◦•]\s*/, ""))
    .filter(Boolean);
}

function splitStandardLines(text: string) {
  return text
    .split(/(?:\r?\n|[;；])+/)
    .map((line) => line.trim().replace(/^[○◦•]\s*/, ""))
    .filter(Boolean);
}

async function normalizeCasebookImage(file: File) {
  if (!file.type.startsWith("image/")) {
    throw new Error("사진 파일만 첨부할 수 있습니다.");
  }

  if (file.size > 30 * 1024 * 1024) {
    throw new Error("사진 한 장의 원본 크기는 30MB 이하여야 합니다.");
  }

  try {
    const bitmap = await createImageBitmap(file, {
      imageOrientation: "from-image",
    });
    const maxEdge = 2000;
    const scale = Math.min(
      1,
      maxEdge / bitmap.width,
      maxEdge / bitmap.height,
    );
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) {
      bitmap.close();
      return file;
    }

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", 0.9),
    );

    if (!blob || (scale === 1 && blob.size >= file.size)) {
      return file;
    }

    const baseName = file.name.replace(/\.[^.]+$/, "") || "case-photo";
    return new File([blob], `${baseName}.webp`, {
      type: "image/webp",
      lastModified: Date.now(),
    });
  } catch {
    return file;
  }
}

async function uploadCasebookImage(file: File) {
  const optimizedFile = await normalizeCasebookImage(file);
  const ext =
    optimizedFile.name
      .split(".")
      .pop()
      ?.toLowerCase()
      .replace(/[^a-z0-9]/g, "") || "jpg";

  // 기존 storage 정책과 최대한 호환되도록 최상위 폴더는 cases를 사용합니다.
  const path = `cases/casebook/${new Date().getFullYear()}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from(PUBLIC_ASSET_BUCKET)
    .upload(path, optimizedFile, {
      contentType: optimizedFile.type || "application/octet-stream",
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

type CasebookManagerProps = {
  initialCaseId?: number;
  showImport?: boolean;
  showList?: boolean;
  onClose?: () => void;
  onSaved?: () => void | Promise<void>;
  onDeleted?: () => void | Promise<void>;
};

export function CasebookManager({
  initialCaseId,
  showImport = true,
  showList = false,
  onClose,
  onSaved,
  onDeleted,
}: CasebookManagerProps = {}) {
  const [items, setItems] = useState<CasebookCase[]>([]);
  const [reviewFilter,setReviewFilter] = useState("전체");
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [files, setFiles] = useState<PhotoFiles>(EMPTY_FILES);

  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const originalTitle = useRef<string | null>(null);
  const [printItems, setPrintItems] = useState<CasebookCase[]>([]);
  const [printText,setPrintText]=useState<BookText>(DEFAULT_BOOK_TEXT);
  const [bookEditor,setBookEditor]=useState(false);
  const [legacySchema, setLegacySchema] = useState(false);
  const [photoSizeReady, setPhotoSizeReady] = useState(false);
  const [photoStretchReady, setPhotoStretchReady] = useState(false);
  const [extraPhotosReady, setExtraPhotosReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const [editorSection, setEditorSection] =
    useState<EditorSection>("basic");

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
  const editorRef = useRef<HTMLElement>(null);
  const initialSelectionRef = useRef<number | null>(null);

  const orderedItems = useMemo(
    () =>
      [...items].sort(bookCompare),
    [items],
  );

  const shownItems = orderedItems.filter(item=>reviewFilter==="전체"||item.review_status===reviewFilter);

  const currentIndex = draft.id
    ? orderedItems.findIndex((item) => item.id === draft.id)
    : -1;

  const previousItem =
    currentIndex > 0 ? orderedItems[currentIndex - 1] : null;

  const nextItem =
    currentIndex >= 0 && currentIndex < orderedItems.length - 1
      ? orderedItems[currentIndex + 1]
      : null;

  const preview1 = useMemo(() => files.photo1 ? URL.createObjectURL(files.photo1) : publicAssetUrl(draft.photo1_path), [files.photo1, draft.photo1_path]);
  useEffect(() => () => { if (files.photo1) URL.revokeObjectURL(preview1); }, [files.photo1, preview1]);

  const preview2 = useMemo(() => files.photo2 ? URL.createObjectURL(files.photo2) : publicAssetUrl(draft.photo2_path), [files.photo2, draft.photo2_path]);
  useEffect(() => () => { if (files.photo2) URL.revokeObjectURL(preview2); }, [files.photo2, preview2]);
  const preview3 = useMemo(() => files.photo3 ? URL.createObjectURL(files.photo3) : publicAssetUrl(draft.photo3_path), [files.photo3, draft.photo3_path]);
  useEffect(() => () => { if (files.photo3) URL.revokeObjectURL(preview3); }, [files.photo3, preview3]);
  const preview4 = useMemo(() => files.photo4 ? URL.createObjectURL(files.photo4) : publicAssetUrl(draft.photo4_path), [files.photo4, draft.photo4_path]);
  useEffect(() => () => { if (files.photo4) URL.revokeObjectURL(preview4); }, [files.photo4, preview4]);

  const notify = (text: string, error = false) => {
    setMessage(text);
    setFailed(error);
  };

  const load = async () => {
    setLoading(true);

    const { data, error, legacy, photoSizeReady: supported, photoStretchReady: stretchSupported, extraPhotosReady: extrasSupported } = await loadCasebook(false);
    setLegacySchema(legacy);
    setPhotoSizeReady(supported === true);
    setPhotoStretchReady(stretchSupported === true);
    setExtraPhotosReady(extrasSupported === true);

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
    return next;
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (
      !initialCaseId ||
      !items.length ||
      initialSelectionRef.current === initialCaseId
    ) {
      return;
    }

    const selected = items.find((item) => item.id === initialCaseId);
    if (!selected) return;

    initialSelectionRef.current = initialCaseId;
    setDraft({ ...selected });
    setFiles(EMPTY_FILES);
    notify("");
  }, [initialCaseId, items]);

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
    const clear = () => { setPrintItems([]); if (originalTitle.current !== null) { document.title = originalTitle.current; originalTitle.current = null; } };
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

  const edit = (item: CasebookCase, scroll = true) => {
    setDraft({
      ...item,
      photo1_width_pct: photoWidthPercent(item.photo1_width_pct),
      photo2_width_pct: photoWidthPercent(item.photo2_width_pct),
      photo3_width_pct: photoWidthPercent(item.photo3_width_pct),
      photo4_width_pct: photoWidthPercent(item.photo4_width_pct),
      photo1_stretch_x_pct: photoHorizontalStretch(item.photo1_stretch_x_pct),
      photo2_stretch_x_pct: photoHorizontalStretch(item.photo2_stretch_x_pct),
      photo3_stretch_x_pct: photoHorizontalStretch(item.photo3_stretch_x_pct),
      photo4_stretch_x_pct: photoHorizontalStretch(item.photo4_stretch_x_pct),
    });
    setFiles(EMPTY_FILES);
    notify("");
    if (scroll) {
      window.requestAnimationFrame(() =>
        editorRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        }),
      );
    }
  };

  const createNew = () => {
    setDraft(nextDraft(items));
    setFiles(EMPTY_FILES);
    setEditorSection("basic");
    notify("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const changeReviewStatus = (reviewStatus: Draft["review_status"]) => {
    setDraft((current) => ({
      ...current,
      review_status: reviewStatus,
      published: reviewStatus === "검토완료",
    }));
  };

  const save = async (advance = false, closeAfter = false) => {
    if (legacySchema) { notify("먼저 Supabase SQL Editor에서 사례 검토 마이그레이션을 적용하세요.", true); return; }
    if (!draft.title.trim()) {
      notify("사례 제목을 입력해 주세요.", true);
      return;
    }

    setBusy(true);
    notify("");

    const savedId = draft.id;

    try {
      if (!extraPhotosReady && (files.photo3 || files.photo4)) {
        throw new Error("먼저 Supabase에서 사진 4장 확장 SQL을 실행하세요.");
      }
      const uploadedPaths: string[] = [];
      let photo1Path = draft.photo1_path;
      let photo2Path = draft.photo2_path;
      let photo3Path = draft.photo3_path;
      let photo4Path = draft.photo4_path;
      try {
        if (files.photo1) {
          photo1Path = await uploadCasebookImage(files.photo1);
          uploadedPaths.push(photo1Path);
        }
        if (files.photo2) {
          photo2Path = await uploadCasebookImage(files.photo2);
          uploadedPaths.push(photo2Path);
        }
        if (extraPhotosReady && files.photo3) {
          photo3Path = await uploadCasebookImage(files.photo3);
          uploadedPaths.push(photo3Path);
        }
        if (extraPhotosReady && files.photo4) {
          photo4Path = await uploadCasebookImage(files.photo4);
          uploadedPaths.push(photo4Path);
        }
      } catch (uploadError) {
        await Promise.allSettled(uploadedPaths.map(path => removePublicFile(path)));
        throw uploadError;
      }

      const payload = {
        finding_type: draft.finding_type, test_item: draft.test_item, review_note: draft.review_note, review_status: draft.review_status, published: draft.review_status === "검토완료",
        case_no: Number(draft.case_no) || 1,
        inspection_type: draft.inspection_type.trim(),
        title: draft.title.trim(),
        facility: draft.facility.trim(),
        photo1_path: photo1Path,
        photo2_path: photo2Path,
        ...(extraPhotosReady ? {
          photo3_path: photo3Path,
          photo4_path: photo4Path,
          photo3_width_pct: photoWidthPercent(draft.photo3_width_pct),
          photo4_width_pct: photoWidthPercent(draft.photo4_width_pct),
          photo3_stretch_x_pct: photoHorizontalStretch(draft.photo3_stretch_x_pct),
          photo4_stretch_x_pct: photoHorizontalStretch(draft.photo4_stretch_x_pct),
        } : {}),
        ...(photoSizeReady ? {
          photo1_width_pct: photoWidthPercent(draft.photo1_width_pct),
          photo2_width_pct: photoWidthPercent(draft.photo2_width_pct),
        } : {}),
        ...(photoStretchReady ? {
          photo1_stretch_x_pct: photoHorizontalStretch(draft.photo1_stretch_x_pct),
          photo2_stretch_x_pct: photoHorizontalStretch(draft.photo2_stretch_x_pct),
        } : {}),
        photo_caption: draft.photo_caption.trim(),
        photo_note: draft.photo_note.trim(),
        standard_title: draft.standard_title.trim(),
        standard_body: draft.standard_body.trim(),
        cause_title: draft.cause_title.trim(),
        cause_body: compactCasebookProse(draft.cause_body.trim()),
        action_body: compactCasebookProse(draft.action_body.trim()),
        prevention_body: compactCasebookProse(draft.prevention_body.trim()),
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

      if (error) {
        await Promise.allSettled(uploadedPaths.map(path => removePublicFile(path)));
        throw error;
      }
      const old = items.find(item => item.id === draft.id);
      await Promise.allSettled([
        ...PHOTO_SLOTS.map(slot => {
          const oldPath = old?.[`photo${slot}_path`];
          const newPath = ({1:photo1Path, 2:photo2Path, 3:photo3Path, 4:photo4Path} as const)[slot];
          return oldPath && oldPath !== newPath
            ? removePublicFile(oldPath)
            : Promise.resolve();
        }),
      ]);

      const loaded = await load();
      setFiles(EMPTY_FILES);
      if (loaded) {
        const ordered = [...loaded].sort(bookCompare);

        if (savedId) {
          const savedIndex = ordered.findIndex((item) => item.id === savedId);
          const target = advance
            ? ordered[savedIndex + 1] || ordered[savedIndex]
            : ordered[savedIndex];

          if (target) setDraft({ ...target });
        } else {
          setDraft(nextDraft(loaded));
        }
      }

      await onSaved?.();
      notify(
        savedId
          ? advance && nextItem
            ? "저장하고 다음 사례로 이동했습니다."
            : "사례집 사례를 수정했습니다."
          : "사례집 사례를 저장했습니다.",
      );

      if (closeAfter) onClose?.();
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

  /**
   * The user is consolidating duplicate cases. Always download a restorable
   * row snapshot and KEEP Supabase Storage objects so photographs can be
   * attached to the surviving case. Only the DB row is removed.
   */
  const remove = async (item: CasebookCase) => {
    if (busy) return;
    const answer = window.prompt(
      `사례 ${String(item.case_no).padStart(2, "0")} · ${item.title}\n\n삭제하면 목록과 공개 화면에서 사라집니다. 첨부 사진 파일은 병합을 위해 보관합니다.\n삭제하려면 사례번호 ${item.case_no}를 입력하세요.`,
    );
    if (answer === null || answer.trim() !== String(item.case_no)) {
      if (answer !== null) notify("사례번호가 일치하지 않아 삭제하지 않았습니다.", true);
      return;
    }
    if (!window.confirm(
      `사례 ${item.case_no} '${item.title}'을 삭제할까요?\n\n삭제 전 사례의 문안·사진 경로를 JSON으로 내려받습니다. 사진 원본은 삭제하지 않습니다.`,
    )) return;

    setBusy(true);
    notify("");
    try {
      // A local snapshot is important before a destructive database action.
      // Blob downloads need to originate in the click action.
      const blob = new Blob([JSON.stringify(item, null, 2)], {type:"application/json"});
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `KFI_삭제전_사례${String(item.case_no).padStart(2,"0")}_${item.id}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);

      const {data, error} = await supabase
        .from("casebook_cases")
        .delete()
        .eq("id", item.id)
        .select("id");
      if (error) throw error;
      if (data?.length !== 1) {
        throw new Error("삭제된 사례가 확인되지 않습니다. 관리자 목록을 새로고침해 확인하세요.");
      }

      // Do not delete files: they may be reused by another case when merging.
      setSelectedIds(current => current.filter(id => id !== item.id));
      if (draft.id === item.id) {
        setDraft(nextDraft(items.filter(row => row.id !== item.id)));
        setFiles(EMPTY_FILES);
      }
      await load();
      notify(`사례 ${item.case_no} 삭제 완료. 사진 파일은 보관했습니다.`);
      await onDeleted?.();
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "사례를 삭제하지 못했습니다.",
        true,
      );
    } finally {
      setBusy(false);
    }
  };

  const removePhoto = (slot: PhotoSlot) => {
    const fileKey = `photo${slot}` as const;
    const pathKey = `photo${slot}_path` as const;
    if (!draft[pathKey] && !files[fileKey]) return;
    setFiles(current => ({...current, [fileKey]: null}));
    setDraft(current => ({...current, [pathKey]: null}));
    // Storage 원본은 저장 완료 후에만 삭제합니다.
  };

  const toggleSelected = (id: number) => {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );
  };

  const selectAll = () => {
    const ids=shownItems.map(item=>item.id);
    setSelectedIds(current=>ids.length>0&&ids.every(id=>current.includes(id))
      ? current.filter(id=>!ids.includes(id)) : [...new Set([...current,...ids])]);
  };

  const printCases = async (mode: "selected" | "all") => {
    const targets =
      mode === "all"
        ? items
        : items.filter((item) => selectedIds.includes(item.id));

    if (!targets.length) {
      notify("PDF로 출력할 사례를 선택해 주세요.", true);
      return;
    }

    try {setPrintText((await loadBookText()).text);}catch(e){notify(e instanceof Error?e.message:"사례집 설정을 불러오지 못했습니다.",true);return;}
    originalTitle.current = document.title;
    document.title = `위험물시설_품질관리_사례_${mode === "all" ? "전체" : "선택"}`;
    setPrintItems([...targets].sort(bookCompare));

    // Wait for React commit, fonts and pictures before measuring the A4 layout.
    window.setTimeout(async () => {
      await document.fonts.ready;
      const pages = Array.from(document.querySelectorAll<HTMLElement>('.cb-print-only .cb-a4-page:not(.kb-sheet):not(.kb-cover)'));
      try {
        const root=document.querySelector<HTMLElement>(".cb-print-only");
        if(!root)throw new Error("출력 준비에 실패했습니다.");
        validateBookLayout(root);
        await prepareCasebookPrint(pages);
        window.print();
      } catch(error) {
        notify(error instanceof Error ? error.message : '출력을 준비하지 못했습니다.', true);
        setPrintItems([]);
        if(originalTitle.current !== null) {document.title=originalTitle.current;originalTitle.current=null;}
      }
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
        {!initialCaseId && (
          <div className="cb-head">
            <div>
              <span className="section-kicker">QUALITY CASEBOOK</span>
              <h3>품질사례 등록</h3>
              <p>JSON으로 일괄 등록하거나 새 사례를 직접 추가합니다.</p>
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
        )}

        {message && (
          <div className={`admin-message ${failed ? "error" : ""}`}>
            {message}
            <button onClick={() => notify("")}>×</button>
          </div>
        )}

        {showImport && (
          <>
            <button type="button" className="secondary-button" onClick={()=>setBookEditor(true)}>사례집 구성 편집 (표지·목차·개요)</button>
            <CasebookTextUpdate
              items={items}
              onComplete={load}
              disabled={legacySchema || loading}
            />
            <CasebookLegalUpdate
              items={items}
              onComplete={load}
              disabled={legacySchema || loading}
            />
            <CasebookImport
              items={items}
              onComplete={load}
              disabled={legacySchema}
            />
          </>
        )}

        <div className="cb-editor-grid">
          <section className="cb-form admin-sheet" ref={editorRef}>
            <div className="cb-edit-toolbar">
              <div className="cb-edit-current">
                <span>
                  {draft.id
                    ? `사례 ${String(draft.case_no).padStart(2, "0")}`
                    : "새 사례"}
                </span>
                <b>{draft.title || "제목을 입력해 주세요"}</b>
                {sourceCaseNumber(draft) !== null && (
                  <small style={{ color: "#0f766e", fontWeight: 800 }}>
                    사진 연결용 원본 순번: {sourceCaseNumber(draft)}
                  </small>
                )}
              </div>

              {draft.id && (
                <div className="cb-edit-navigation">
                  <button
                    type="button"
                    disabled={!previousItem || busy}
                    onClick={() => previousItem && edit(previousItem, false)}
                  >
                    ← 이전
                  </button>
                  <span>
                    {currentIndex + 1}/{orderedItems.length}
                  </span>
                  <button
                    type="button"
                    disabled={!nextItem || busy}
                    onClick={() => nextItem && edit(nextItem, false)}
                  >
                    다음 →
                  </button>
                </div>
              )}

              <label className="cb-review-control">
                <span>검토상태</span>
                <select
                  value={draft.review_status}
                  disabled={busy}
                  onChange={(event) =>
                    changeReviewStatus(
                      event.target.value as Draft["review_status"],
                    )
                  }
                >
                  <option>검토대기</option>
                  <option>기준확인필요</option>
                  <option>검토완료</option>
                </select>
                <small>
                  {draft.review_status === "검토완료"
                    ? "저장 시 자동 공개"
                    : "저장 시 비공개"}
                </small>
              </label>

              <div className="cb-edit-save-actions">
                <button
                  type="button"
                  className="primary-button"
                  disabled={busy}
                  onClick={() => void save(false, false)}
                >
                  {busy ? "저장 중…" : "저장"}
                </button>

                {draft.id && nextItem && (
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={busy}
                    onClick={() => void save(true, false)}
                  >
                    저장 후 다음
                  </button>
                )}

              </div>
            </div>

            <nav className="cb-editor-tabs" aria-label="사례 수정 항목">
              {EDITOR_SECTIONS.map(([key, label], index) => (
                <button
                  type="button"
                  key={key}
                  className={editorSection === key ? "active" : ""}
                  onClick={() => setEditorSection(key)}
                >
                  <span>{index + 1}</span>
                  {label}
                </button>
              ))}
            </nav>

            <fieldset hidden={editorSection !== "basic"}>
              <legend>사례 기본정보</legend>
              <Field label="시험항목" value={draft.test_item} onChange={v=>update('test_item',v)} rows={1}/>
              <Field label="기준확인필요 사유·검토 메모" value={draft.review_note} onChange={v=>update('review_note',v)}/>
              {draft.source_uid && (
                <p>
                  원본 순번 <strong>{sourceCaseNumber(draft) ?? "미확인"}</strong>
                  {" · "}{draft.source_sheet} 시트 {draft.source_row}행
                  {" · "}사이트 사례번호 {draft.case_no}
                </p>
              )}

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
                    {[...new Set(items.map(x=>x.inspection_type))].filter(x=>!["안전성능검사","완공검사","중간정기검사","정밀정기검사","기술검토","기타"].includes(x)).map(x=><option key={x}>{x}</option>)}
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

            <fieldset hidden={editorSection !== "photos"}>
              <legend>관련 사진</legend>
              {sourceCaseNumber(draft) !== null && (
                <div
                  role="note"
                  style={{
                    background: "#fff7db",
                    border: "1px solid #f0d78a",
                    borderRadius: 8,
                    padding: "12px 14px",
                    marginBottom: 12,
                    lineHeight: 1.6,
                  }}
                >
                  <strong>사진 파일 확인: 엑셀 원본 순번 {sourceCaseNumber(draft)}</strong>
                  <div style={{ fontSize: 13 }}>
                    예: 원본 {sourceCaseNumber(draft)}번이면 이름이 {sourceCaseNumber(draft)}.jpg인 사진을 직접 선택해 첨부하세요.
                    사이트 사례번호 {draft.case_no}와는 다른 번호입니다. 사진은 자동 첨부되지 않습니다.
                  </div>
                </div>
              )}

              {!photoSizeReady && (
                <p role="alert" className="cb-photo-resize-help">
                  사진 크기 저장 기능은 데이터베이스 준비 후 사용할 수 있습니다.
                  Supabase에 사진 크기 저장용 SQL을 먼저 적용하세요.
                  사진 첨부 및 기존 사례 수정은 계속 가능합니다.
                </p>
              )}
              {!photoStretchReady && (
                <p role="note" className="cb-photo-resize-help">
                  가로만 늘이기는 새 사진 가로 조절 SQL 적용 후 사용할 수 있습니다.
                  기존 사례의 사진 첨부와 전체 크기 조절은 계속 가능합니다.
                </p>
              )}
              <p className="cb-photo-resize-help">
                세로형 사진은 높이를 그대로 두고 <strong>가로만 늘이기</strong>로 실제 사진 폭을 조절하세요.
                사진 아래 가로 조절 막대 또는 오른쪽 A4 미리보기의 파란 ↔ 손잡이를 드래그합니다.
                기본값 100%는 원본 비율을 유지합니다.
              </p>
              {!extraPhotosReady && (
                <p role="note" className="cb-photo-resize-help">
                  사진 3·4를 사용하려면 Supabase의 <strong>20261117002000_casebook_four_photos.sql</strong>을
                  한 번 실행하세요. 적용 전에도 사진 1·2는 정상 작동합니다.
                </p>
              )}
              <div className="cb-photo-input-grid">
                <PhotoInput
                  label="사진 1"
                  preview={preview1}
                  file={files.photo1}
                  originalNumber={sourceCaseNumber(draft)}
                  widthPct={photoWidthPercent(draft.photo1_width_pct)}
                  stretchPct={photoHorizontalStretch(draft.photo1_stretch_x_pct)}
                  onWidthChange={photoSizeReady
                    ? (value) => update("photo1_width_pct", value)
                    : undefined}
                  onStretchChange={photoStretchReady
                    ? (value) => update("photo1_stretch_x_pct", value)
                    : undefined}
                  onFile={(file) => {
                    setFiles((current) => ({...current, photo1: file}));
                    if (file) {
                      update("photo1_width_pct", 100);
                      update("photo1_stretch_x_pct", 100);
                    }
                  }}
                  onRemove={() => void removePhoto(1)}
                />

                <PhotoInput
                  label="사진 2"
                  preview={preview2}
                  file={files.photo2}
                  originalNumber={sourceCaseNumber(draft)}
                  widthPct={photoWidthPercent(draft.photo2_width_pct)}
                  stretchPct={photoHorizontalStretch(draft.photo2_stretch_x_pct)}
                  onWidthChange={photoSizeReady
                    ? (value) => update("photo2_width_pct", value)
                    : undefined}
                  onStretchChange={photoStretchReady
                    ? (value) => update("photo2_stretch_x_pct", value)
                    : undefined}
                  onFile={(file) => {
                    setFiles((current) => ({...current, photo2: file}));
                    if (file) {
                      update("photo2_width_pct", 100);
                      update("photo2_stretch_x_pct", 100);
                    }
                  }}
                  onRemove={() => removePhoto(2)}
                />
                {extraPhotosReady && (
                  <>
                    <PhotoInput
                      label="사진 3"
                      preview={preview3}
                      file={files.photo3}
                      originalNumber={sourceCaseNumber(draft)}
                      widthPct={photoWidthPercent(draft.photo3_width_pct)}
                      stretchPct={photoHorizontalStretch(draft.photo3_stretch_x_pct)}
                      onWidthChange={value => update("photo3_width_pct", value)}
                      onStretchChange={value => update("photo3_stretch_x_pct", value)}
                      onFile={file => {
                        setFiles(current => ({...current, photo3:file}));
                        if (file) setDraft(current => ({...current, photo3_width_pct:100, photo3_stretch_x_pct:100}));
                      }}
                      onRemove={() => removePhoto(3)}
                    />
                    <PhotoInput
                      label="사진 4"
                      preview={preview4}
                      file={files.photo4}
                      originalNumber={sourceCaseNumber(draft)}
                      widthPct={photoWidthPercent(draft.photo4_width_pct)}
                      stretchPct={photoHorizontalStretch(draft.photo4_stretch_x_pct)}
                      onWidthChange={value => update("photo4_width_pct", value)}
                      onStretchChange={value => update("photo4_stretch_x_pct", value)}
                      onFile={file => {
                        setFiles(current => ({...current, photo4:file}));
                        if (file) setDraft(current => ({...current, photo4_width_pct:100, photo4_stretch_x_pct:100}));
                      }}
                      onRemove={() => removePhoto(4)}
                    />
                  </>
                )}
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

            <fieldset hidden={editorSection !== "standard"}>
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

            <fieldset hidden={editorSection !== "cause"}>
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

            <fieldset hidden={editorSection !== "action"}>
              <legend>개선 및 예방</legend>

              <Field
                label="개선 조치"
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
                onClick={() => void save(false, false)}
              >
                {busy
                  ? "저장 중…"
                  : draft.id
                    ? "사례 수정"
                    : "사례 저장"}
              </button>

              {draft.id && (
                <>
                  {nextItem && (
                    <button
                      type="button"
                      className="secondary-button"
                      disabled={busy}
                      onClick={() => void save(true, false)}
                    >
                      저장 후 다음 사례
                    </button>
                  )}
                  {onClose ? (
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={onClose}
                      disabled={busy}
                    >
                      닫기
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={createNew}
                    >
                      수정 취소
                    </button>
                  )}
                  <button
                    type="button"
                    className="cb-delete-case-button"
                    disabled={busy}
                    onClick={() => {
                      const current = items.find(item => item.id === draft.id);
                      if (current) void remove(current);
                      else notify("삭제할 사례를 불러오지 못했습니다. 새로고침하세요.", true);
                    }}
                  >
                    사례 삭제
                  </button>
                </>
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
              preview3={preview3}
              preview4={preview4}
              onPhotoStretchChange={(slot, width) => {
                if (slot >= 3 ? extraPhotosReady : photoStretchReady) {
                  setDraft(current => ({...current, [`photo${slot}_stretch_x_pct`]: width}));
                }
              }}
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

        {showList && <section className="cb-list">
          <div className="cb-list-head">
            <div>
              <h3>등록된 사례</h3>
              <span>{shownItems.length}건 / 전체 {items.length}건</span>
            </div>

            <div className="cb-list-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={selectAll}
              >
                {shownItems.length>0 && shownItems.every(item=>selectedIds.includes(item.id))
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
                전체 사례 PDF
              </button>
            </div>
          </div>

          <div className="cb-review-filter" aria-label="검토상태 필터">
            {["전체","검토완료","검토대기","기준확인필요"].map(status=>
              <button type="button" key={status} aria-pressed={status===reviewFilter}
                onClick={()=>setReviewFilter(status)}>{status} ({status==="전체"?items.length:items.filter(item=>item.review_status===status).length})</button>)}
          </div>
          {loading ? (
            <div className="empty-list">
              사례집 목록을 불러오는 중입니다.
            </div>
          ) : shownItems.length ? (
            <div className="cb-rows">
              {shownItems.map((item) => (
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
                      {casebookGroup(item.inspection_type)} · {item.inspection_type}
                      {sourceCaseNumber(item) !== null && ` · 원본 순번 ${sourceCaseNumber(item)}`}
                    </span>
                    <b>{item.title}</b>
                    <small>{item.test_item} · {item.review_status} · {item.published?'공개':'비공개'} · {PHOTO_SLOTS.some(slot => item[`photo${slot}_path`])?'사진 있음':'사진 없음'}</small>
                    {item.review_note && <p>{item.review_note}</p>}
                  </div>

                  <div className="cb-row-actions">
                    <button onClick={() => edit(item)}>
                      수정
                    </button>
                    <button
                      type="button"
                      className="danger"
                      disabled={busy}
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
        </section>}
      </div>

      {showImport && bookEditor && createPortal(<CasebookTextEditor items={items} onClose={()=>setBookEditor(false)}/>,document.body)}
      {showList && printItems.length > 0 && createPortal(
        <div className="cb-print-only">
          <CasebookBook items={printItems} text={printText}
            renderCase={(item,page)=><CasebookPage item={item} pageNumber={page}/>}/>
        </div>, document.body
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
  originalNumber,
  widthPct,
  onWidthChange,
  stretchPct,
  onStretchChange,
}: {
  label: string;
  preview: string;
  file: File | null;
  onFile: (file: File | null) => void;
  onRemove: () => void;
  originalNumber: number | null;
  widthPct: number;
  onWidthChange?: (value: number) => void;
  stretchPct: number;
  onStretchChange?: (value: number) => void;
}) {
  return (
    <div className="cb-photo-input">
      {originalNumber !== null && (
        <div className="cb-photo-original-number">
          {label} · <strong>엑셀 원본 {originalNumber}번</strong>
        </div>
      )}
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
        <small className="cb-photo-optimize-note">
          원본 비율 유지 · 큰 사진은 긴 변 2,000px 이하로 자동 최적화
        </small>
      </label>

      {preview && onWidthChange && (
        <div className="cb-photo-size-control">
          <label>
            <span>사진칸 폭 {widthPct}%</span>
            <input
              type="range" min="45" max="100" step="1"
              value={widthPct}
              aria-label={`${label} 표시 크기`}
              onChange={(event) => onWidthChange(Number(event.target.value))}
            />
          </label>
          <button type="button" onClick={() => onWidthChange(100)}>자동 맞춤</button>
        </div>
      )}

      {preview && onStretchChange && (
        <div className="cb-photo-size-control cb-photo-stretch-control">
          <label>
            <span>실제 사진 가로만 늘이기 {stretchPct}% (세로 고정)</span>
            <input
              type="range" min="100" max="300" step="5"
              value={stretchPct}
              aria-label={`${label} 가로만 늘이기`}
              onChange={(event) => onStretchChange(Number(event.target.value))}
            />
          </label>
          <button type="button" onClick={() => onStretchChange(100)}>원본 비율</button>
        </div>
      )}

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

function ResizableCasePhoto({
  src,
  alt,
  percent,
  horizontalStretch,
  onHorizontalStretch,
}: {
  src: string;
  alt: string;
  percent: number;
  horizontalStretch: number;
  onHorizontalStretch?: (width: number) => void;
}) {
  const slot = useRef<HTMLDivElement>(null);
  const drag = useRef<{startX: number; startStretch: number; slotWidth: number} | null>(null);
  return (
    <div
      className="cb-photo-resize-slot"
      ref={slot}
      style={{
        "--photo-ratio": "1",
        "--photo-stretch": photoHorizontalStretch(horizontalStretch) / 100,
      } as React.CSSProperties}
    >
      <div className="cb-photo-size-frame" style={{width: `${photoWidthPercent(percent)}%`}}>
        <img
          src={src}
          alt={alt}
          onLoad={(event) => {
            const img = event.currentTarget;
            if (img.naturalWidth > 0 && img.naturalHeight > 0) {
              const ratio = img.naturalWidth / img.naturalHeight;
              slot.current?.style.setProperty("--photo-ratio", ratio.toFixed(6));
            }
          }}
          style={{
            width: `${100 / (photoHorizontalStretch(horizontalStretch) / 100)}%`,
            height: "auto",
            maxWidth: "none",
            objectFit: "contain",
            transform: `scaleX(${photoHorizontalStretch(horizontalStretch) / 100})`,
            transformOrigin: "center center",
          }}
        />
        {onHorizontalStretch && (
          <button
            type="button"
            className="cb-photo-drag-handle"
            aria-label={`${alt} 가로만 늘이기`}
            title="좌우로 드래그하여 실제 사진의 가로 폭만 조절 (높이 유지)"
            onPointerDown={(event) => {
              drag.current = {
                startX: event.clientX,
                startStretch: photoHorizontalStretch(horizontalStretch),
                slotWidth: slot.current?.getBoundingClientRect().width || 1,
              };
              event.currentTarget.setPointerCapture(event.pointerId);
              event.preventDefault();
            }}
            onPointerMove={(event) => {
              if (!drag.current) return;
              onHorizontalStretch(photoHorizontalStretch(drag.current.startStretch +
                (event.clientX - drag.current.startX) * 250 / drag.current.slotWidth));
            }}
            onPointerUp={(event) => {
              drag.current = null;
              if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                event.currentTarget.releasePointerCapture(event.pointerId);
              }
            }}
            onPointerCancel={() => {drag.current = null;}}
          >↔</button>
        )}
      </div>
    </div>
  );
}

export function CasebookPage({
  item,
  preview1,
  preview2,
  preview3,
  preview4,
  pageNumber = 1,
  refs,
  onPhotoStretchChange,
}: {
  item: CasebookCase;
  pageNumber?: number;
  preview1?: string;
  preview2?: string;
  preview3?: string;
  preview4?: string;
  refs?: PreviewRefs;
  onPhotoStretchChange?: (slot: PhotoSlot, percent: number) => void;
}) {
  const overrides: Array<string | undefined> = [preview1, preview2, preview3, preview4];
  const images = PHOTO_SLOTS.map((slot, index) => ({
    slot,
    src: overrides[index] !== undefined
      ? overrides[index]!
      : publicAssetUrl(item[`photo${slot}_path`]),
  })).filter(x => x.src);
  const count = images.length;

  return (
    <article className="cb-a4-page">
      <div className="cb-print-body">
      <header className="cb-case-head">
        <span>
          {casebookGroup(item.inspection_type)} ·{" "}
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
            <div className={`cb-preview-photos ${
              count === 1 ? "one" : count === 2 ? "two" : count === 3 ? "three multi" : "four multi"
            }`}>
              {images.map(({slot, src}) => (
                <ResizableCasePhoto
                  key={slot}
                  src={src}
                  alt={`관련 사진 ${slot}`}
                  percent={photoWidthPercent(item[`photo${slot}_width_pct`])}
                  horizontalStretch={photoHorizontalStretch(item[`photo${slot}_stretch_x_pct`])}
                  onHorizontalStretch={onPhotoStretchChange
                    ? (width) => onPhotoStretchChange(slot, width)
                    : undefined}
                />
              ))}
              {count === 0 && (
                <div className="cb-photo-placeholder">관련 사진 삽입 영역</div>
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
          <div className="cb-copy cb-standard-copy" ref={refs?.standard}>
            {splitStandardLines(item.standard_title).map(
              (line, index) => (
                <p className="cb-bullet cb-strong" key={`title-${index}`}>
                  {line}
                </p>
              ),
            )}

            {splitStandardLines(item.standard_body).map(
              (line, index) => (
                <p className="cb-bullet" key={`body-${index}`}>
                  {line}
                </p>
              ),
            )}
          </div>
        </CaseRow>

        <CaseRow label="발생 사유">
          <div className="cb-copy" ref={refs?.cause}>
            {splitLines(compactCasebookProse(item.cause_title)).map((line, index) => (
              <p className="cb-bullet cb-strong" key={`title-${index}`}>
                {line}
              </p>
            ))}

            {splitLines(compactCasebookProse(item.cause_body)).map(
              (line, index) => (
                <p className="cb-bullet" key={`body-${index}`}>
                  {line}
                </p>
              ),
            )}
          </div>
        </CaseRow>

        <CaseRow label="개선조치">
          <div className="cb-copy" ref={refs?.action}>
            {splitLines(compactCasebookProse(item.action_body)).map(
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
            {splitLines(compactCasebookProse(item.prevention_body)).map(
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
          Page {pageNumber}
        </span>
      </footer>
      </div>
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
