
export type ReviewStatus =
  | "검토대기"
  | "기준확인필요"
  | "검토완료";

export type CasebookCase = {
  id: number;
  case_no: number;
  inspection_type: string;
  title: string;
  facility: string;

  photo1_path: string | null;
  photo2_path: string | null;
  photo3_path: string | null;
  photo4_path: string | null;
  photo1_width_pct: number;
  photo2_width_pct: number;
  photo3_width_pct: number;
  photo4_width_pct: number;
  /** Extra horizontal stretch of the pixels, independent from the fitted photo height. */
  photo1_stretch_x_pct: number;
  photo2_stretch_x_pct: number;
  photo3_stretch_x_pct: number;
  photo4_stretch_x_pct: number;
  photo_caption: string;
  photo_note: string;

  standard_title: string;
  standard_body: string;
  cause_title: string;
  cause_body: string;

  action_body: string;
  prevention_body: string;
  sort_order: number;

  finding_type: string;
  test_item: string;
  source_uid: string | null;
  source_row: number | null;
  source_sheet: string;
  review_note: string;

  review_status: ReviewStatus;
  published: boolean;

  created_at?: string;
  updated_at?: string;
};

/**
 * Compress completed Korean narrative statements into concise report-style endings.
 * Changes presentation only unless a reviewer explicitly saves the editor fields.
 * Keep measurements, standard names, and legal conditions untouched.
 */
export function compactCasebookProse(input: string): string {
  if (!input) return "";
  const fixed: Array<[RegExp, string]> = [
    [/추정된다$/, "추정"],
    [/판단된다$/, "판단"],
    [/확인된다$/, "확인"],
    [/필요하다$/, "필요"],
    [/요구된다$/, "필요"],
    [/가능하다$/, "가능"],
    [/존재한다$/, "존재"],
    [/발생한다$/, "발생"],
    [/확인할 수 있다$/, "확인 가능"],
    [/해야 한다$/, "필요"],
    [/하여야 한다$/, "필요"],
    [/이력을 남긴다$/, "이력 기록"],
    [/기록을 남긴다$/, "기록 보존"],
    [/남긴다$/, "기록"],
    [/바로잡는다$/, "시정"],
    [/지킨다$/, "준수"],
    [/맞춘다$/, "조정"],
    [/([가-힣]{2,})(?:한다|하였다|했다|된다|되었다)$/, "$1"],
  ];
  const convert = (sentence: string) => {
    const withoutPeriod = sentence.trim().replace(/[.。]\s*$/, "");
    for (const [pattern, replacement] of fixed) {
      if (pattern.test(withoutPeriod)) return withoutPeriod.replace(pattern, replacement);
    }
    return withoutPeriod;
  };
  return input.split(/\r?\n/).map(line =>
    line
      .split(/(?<=[.。])\s+(?=[가-힣])/)
      .map(convert)
      .filter(Boolean)
      .join(" · ")
  ).join("\n");
}

/** Picture order in the editor, public detail page, cards and A4 prints. */
export const PHOTO_SLOTS = [1, 2, 3, 4] as const;
export type PhotoSlot = (typeof PHOTO_SLOTS)[number];

export function casebookPhotoPaths(
  item: Pick<CasebookCase, "photo1_path" | "photo2_path" | "photo3_path" | "photo4_path">,
): Array<{slot: PhotoSlot; path: string}> {
  return PHOTO_SLOTS.flatMap(slot => {
    const path = item[`photo${slot}_path`];
    return path ? [{slot, path}] : [];
  });
}

export type ImportCase = Omit<
  CasebookCase,
  "id" | "created_at" | "updated_at"
>;

/** Clamp a case photograph's displayed width (% of its available column). */
export function photoWidthPercent(input: unknown): number {
  const value = Number(input);
  return Number.isFinite(value) && value > 0 ? Math.min(100, Math.max(45, Math.round(value))) : 100;
}

/** 100% preserves the original photograph. Higher values widen it without changing height. */
export function photoHorizontalStretch(input: unknown): number {
  const value = Number(input);
  return Number.isFinite(value) && value >= 100
    ? Math.max(100, Math.min(300, Math.round(value)))
    : 100;
}

/** 엑셀 report 시트의 원본 순번. 가져오기 사례번호와는 별개입니다. */
export function sourceCaseNumber(
  item: Pick<CasebookCase, "source_row" | "source_sheet">,
): number | null {
  const sourceRow = Number(item.source_row);
  return item.source_sheet === "report" && Number.isInteger(sourceRow) && sourceRow >= 2
    ? sourceRow - 1
    : null;
}

/**
 * 위험물제품 검사 종류
 */
const PRODUCT_INSPECTION_TYPES = new Set([
  "교반기",
  "통기관대기밸브",
  "비상압력배출장치",
  "누설감지설비",
  "운반용기",
  "위치표시형밸브",
  "이중벽탱크",
  "포소화약제탱크",
  "폼챔버",
]);

/**
 * 위험물시설 검사 종류
 *
 * 기존 목록에 안전성능검사 등을 추가
 */
const FACILITY_INSPECTION_TYPES = new Set([
  "기술검토",
  "완공검사",
  "탱크 완공검사",
  "안전성능검사",
  "정기검사",
  "정밀정기검사",
  "중간정기검사",
]);

/**
 * 사례집 상단의 검사 분야 표시
 */
export function casebookGroup(
  inspectionType: string,
): string {
  const normalized = inspectionType.trim();

  if (PRODUCT_INSPECTION_TYPES.has(normalized)) {
    return "위험물제품";
  }

  if (FACILITY_INSPECTION_TYPES.has(normalized)) {
    return "위험물시설";
  }

  // 미등록 검사 종류에 대한 중립적 표시
  return "기타 검사";
}

/**
 * 사례 가져오기 데이터 검증
 */
const textFields = [
  "inspection_type",
  "title",
  "facility",
  "standard_title",
  "standard_body",
  "cause_title",
  "cause_body",
  "action_body",
  "prevention_body",
  "finding_type",
  "test_item",
  "source_sheet",
  "review_note",
] as const;

export function parseImport(
  input: unknown,
): {
  rows: ImportCase[];
  errors: string[];
} {
  if (!Array.isArray(input) || input.length > 2000) {
    throw new Error(
      "최대 2,000건의 JSON 배열을 선택하세요.",
    );
  }

  const rows: ImportCase[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();

  input.forEach((value, index) => {
    try {
      if (!value || typeof value !== "object") {
        throw new Error("객체 형식이 아닙니다.");
      }

      const v = value as Record<string, unknown>;

      if (
        typeof v.source_uid !== "string" ||
        !/^[a-zA-Z0-9:_-]{8,160}$/.test(
          v.source_uid,
        )
      ) {
        throw new Error(
          "source_uid가 올바르지 않습니다.",
        );
      }

      if (seen.has(v.source_uid)) {
        throw new Error(
          "파일 안에서 source_uid가 중복됩니다.",
        );
      }

      const text = Object.fromEntries(
        textFields.map((key) => {
          if (
            typeof v[key] !== "string" ||
            (v[key] as string).length > 10000
          ) {
            throw new Error(
              `${key} 문자열을 확인하세요.`,
            );
          }

          return [
            key,
            (v[key] as string).trim(),
          ];
        }),
      ) as Pick<
        ImportCase,
        (typeof textFields)[number]
      >;

      if (!text.title || !text.inspection_type) {
        throw new Error(
          "제목과 검사구분이 필요합니다.",
        );
      }

      if (text.inspection_type === "안전성능검사") {
        throw new Error(
          "현재 가져오기에서 안전성능검사는 제외합니다.",
        );
      }

      if (
        !["보완", "부적합"].includes(
          text.finding_type,
        )
      ) {
        throw new Error(
          "보완·부적합 구분을 확인하세요.",
        );
      }

      if (
        !Number.isInteger(v.source_row) ||
        Number(v.source_row) < 2
      ) {
        throw new Error(
          "원본 행 번호가 필요합니다.",
        );
      }

      seen.add(v.source_uid);

      rows.push({
        ...text,

        source_uid: v.source_uid,
        source_row: Number(v.source_row),

        case_no: 0,
        sort_order: 0,

        review_status:
          v.review_status === "기준확인필요"
            ? "기준확인필요"
            : "검토대기",

        published: false,

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
      });
    } catch (e) {
      errors.push(
        `${index + 1}행: ${
          e instanceof Error
            ? e.message
            : "잘못된 데이터"
        }`,
      );
    }
  });

  return { rows, errors };
}
