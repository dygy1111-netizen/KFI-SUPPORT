/**
 * KFI 품질관리 사례집 인쇄용 A4 자동 배치.
 * 관리자(선택/전체 PDF)와 공개 화면 PDF가 공통으로 사용합니다.
 *
 * A4 용지는 그대로 두고 제목/표/사진/쪽번호만 함께 축소합니다.
 * 내용이 짧으면 하단 약 25%를 비우고, 긴 사례는 가독성과 한 페이지 수록을 우선합니다.
 */

const SINGLE_PHOTO_MAX_MM = 80;
const DOUBLE_PHOTO_MAX_MM = 58;
// 검토완료 사례 PDF 사진 높이: 종전 최대 높이의 70% (115×0.7, 88×0.7).
const REVIEWED_SINGLE_PHOTO_MAX_MM = 80.5;
const REVIEWED_DOUBLE_PHOTO_MAX_MM = 61.6;
const PHOTO_MIN_MM = 20;
const TARGET_CONTENT_RATIO = 0.75;
// '품질사례 > 검토완료 사례 PDF'는 하단 약 13.5%를 남기는 것을 우선합니다.
const REVIEWED_TARGET_CONTENT_RATIO = 0.865;
const MIN_PRINT_PAD_MM = 2.1;
const MIN_REVIEWED_PRINT_PAD_MM = 2.7;
const MAX_REVIEWED_PRINT_PAD_MM = 6.5;
const EXTRA_BOTTOM_MM = 8;
const PRINT_STYLE_ID = "kfi-casebook-scaled-print";

type FitTarget = "quarter" | "page";

function ensurePrintStyle() {
  let sheet = document.getElementById(PRINT_STYLE_ID) as HTMLStyleElement | null;
  if (!sheet) {
    sheet = document.createElement("style");
    sheet.id = PRINT_STYLE_ID;
    document.head.appendChild(sheet);
  }

  sheet.textContent = `
    /* A4 크기와 페이지 나눔은 기존 CasebookManager.css 설정을 유지 */
    .cb-print-only .cb-a4-page {
      position: relative;
    }

    /*
     * 인쇄할 내용 전체를 하나의 블록으로 배치합니다.
     * 부모 A4는 축소하지 않으므로 용지 크기와 페이지 나눔은 유지됩니다.
     */
    .cb-print-only .cb-print-body {
      position: absolute;
      top: 12mm;
      left: 12mm;
      width: var(--print-body-width, 186mm);
      transform: scale(var(--print-scale, 1));
      transform-origin: top left;
    }

    .cb-print-only .cb-table-content:has(.cb-photo-area) {
      justify-content: flex-start;
      padding-top: 2mm;
      padding-bottom: 2mm;
    }

    .cb-print-only .cb-preview-photos.one {
      display: flex;
      justify-content: center;
      align-items: flex-start;
      gap: 0;
    }

    .cb-print-only .cb-preview-photos.two {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      align-items: start;
      justify-items: center;
      gap: 2mm;
    }

    /*
     * 검토완료 사례 출력: 가로형/세로형 사진이 섞여도 원본을 자르지 않고
     * 두 칸의 가운데에 각각 배치합니다.
     * 세로형은 조금 높고 가로형은 조금 넓어 비슷한 면적으로 보입니다.
     */
    .cb-print-only[data-print-mode="reviewed"] .cb-preview-photos.two {
      align-items: center;
      gap: 2mm;
    }

    /*
     * 검토완료 사례 PDF만 사진칸의 좌우 내부 여백 축소.
     * 표의 다른 칸에는 영향을 주지 않습니다.
     */
    .cb-print-only[data-print-mode="reviewed"]
    .cb-table-content:has(.cb-photo-area) {
      padding-left: 1mm;
      padding-right: 1mm;
    }

    .cb-print-only[data-print-mode="reviewed"] .cb-preview-photos {
      width: 100%;
      gap: 2mm;
    }

    /*
     * 사진 1장: 가용 사진칸 너비를 모두 사용.
     * 사진 2장: 같은 크기의 두 프레임에 나란히 표시.
     * 원본을 변형하지 않고 중앙 기준으로 가장자리만 일부 잘라냅니다.
     */
    .cb-print-only[data-print-mode="reviewed"]
    .cb-preview-photos.one img,
    .cb-print-only[data-print-mode="reviewed"]
    .cb-preview-photos.two img {
      box-sizing: border-box;
      width: 100%;
      height: var(--print-photo, 61.6mm);
      min-width: 0;
      min-height: 0;
      max-width: 100%;
      max-height: var(--print-photo, 61.6mm);
      object-fit: cover;
      object-position: center;
      margin: 0;
      background: transparent;
      border: 0;
    }

    /* 고정 높이 사진 상자를 사용하지 않아 원본 비율과 실제 높이가 일치합니다. */
    .cb-print-only .cb-preview-photos img {
      display: block;
      width: auto;
      height: auto;
      min-width: 0;
      max-width: 100%;
      max-height: var(--print-photo, 80mm);
      object-fit: contain;
      object-position: center;
      margin: 0 auto;
      padding: 0;
      background: transparent;
      border: 0;
      border-radius: 0;
    }

    .cb-print-only .cb-photo-area { gap: 1mm; }
    .cb-print-only .cb-photo-copy:empty { display: none; }

    /* 검사기준의 굵은 항목만 한 줄 표시하고, 넘치면 JS가 글씨 폭을 조절합니다. */
    .cb-print-only[data-print-mode="reviewed"]
    .cb-standard-copy > p.cb-strong {
      white-space: nowrap;
      letter-spacing: -0.02em;
      overflow: visible;
      transform-origin: left center;
    }

    .cb-print-only .cb-table-content p { margin-bottom: 1mm; }
    .cb-print-only .cb-table-content p:last-child { margin-bottom: 0; }
  `;
}

async function waitForPhoto(img: HTMLImageElement): Promise<void> {
  let timeout: number | undefined;
  try {
    await Promise.race([
      img.decode(),
      new Promise<never>((_, reject) => {
        timeout = window.setTimeout(
          () => reject(new Error("사진 로딩 시간이 초과되었습니다.")),
          10000,
        );
      }),
    ]);
    if (!img.naturalWidth) throw new Error("사진을 불러올 수 없습니다.");
  } finally {
    if (timeout !== undefined) window.clearTimeout(timeout);
  }
}

/**
 * 검토완료 사례 PDF의 검사기준 제목(굵은 글씨)만 한 줄에 맞춤.
 *
 * 1. 기본 글씨 크기 유지 시도
 * 2. 공간이 부족하면 최대 10pt까지 축소
 * 3. 그래도 긴 문장은 가로 폭만 압축하여 잘림·줄바꿈 방지
 *
 * 일반 검사기준 본문과 다른 표 항목에는 적용하지 않습니다.
 */
function fitStandardBoldLines(page: HTMLElement): void {
  if (!page.closest('.cb-print-only[data-print-mode="reviewed"]')) return;

  const headings = page.querySelectorAll<HTMLElement>(
    ".cb-standard-copy > p.cb-strong",
  );

  headings.forEach((line) => {
    // 크기 조정 재계산 전 기존 인라인 값을 초기화합니다.
    line.style.fontSize = "";
    line.style.transform = "";
    line.style.transformOrigin = "left center";
    line.style.whiteSpace = "nowrap";
    line.style.letterSpacing = "-0.02em";

    const available = line.clientWidth;
    if (available <= 0 || line.scrollWidth <= available + 1) return;

    const computedPx = Number.parseFloat(getComputedStyle(line).fontSize);
    if (!Number.isFinite(computedPx) || computedPx <= 0) return;

    const basePt = computedPx * 72 / 96;
    const minPt = Math.min(basePt, 10);

    line.style.fontSize = minPt.toFixed(2) + "pt";

    if (line.scrollWidth <= available + 1) {
      let low = minPt;
      let high = basePt;

      for (let i = 0; i < 10; i++) {
        const mid = (low + high) / 2;
        line.style.fontSize = mid.toFixed(3) + "pt";
        if (line.scrollWidth <= available + 1) low = mid;
        else high = mid;
      }

      line.style.fontSize = Math.max(minPt, low - 0.1).toFixed(2) + "pt";
    } else {
      // 가장 긴 법령명도 가로로 잘리지 않게 마지막으로 폭만 조절합니다.
      line.style.fontSize = minPt.toFixed(2) + "pt";
      const ratio = Math.min(1, (available - 2) / line.scrollWidth);
      line.style.transform = "scaleX(" + Math.max(0.1, ratio).toFixed(4) + ")";
    }
  });
}

/** 인쇄 너비는 210mm - 좌우 여백 12mm * 2 = 186mm. */
function applyScale(
  page: HTMLElement,
  scale: number,
  photoMm: number,
  padMm?: number,
) {
  page.style.setProperty("--print-scale", scale.toFixed(4));
  const oldWidth = page.style.getPropertyValue("--print-body-width");
  const newWidth = (186 / scale).toFixed(3) + "mm";
  page.style.setProperty("--print-body-width", newWidth);
  page.style.setProperty("--print-photo", photoMm.toFixed(2) + "mm");

  const reviewed = page.closest(
    '.cb-print-only[data-print-mode="reviewed"]',
  ) !== null;

  // 사진 높이를 줄인 만큼 검토완료 사례의 표 글씨를 키웁니다.
  // 페이지 전체를 축소하더라도 최종 본문 크기는 약 11.25pt 이상으로 유지합니다.
  const fontSize = reviewed
    ? Math.max(12.5, 11.25 / scale)
    : Math.max(11.5, 10 / scale);

  page.style.setProperty("--print-font", fontSize.toFixed(3) + "pt");
  const effectivePad = padMm ?? (
    reviewed ? MIN_REVIEWED_PRINT_PAD_MM : MIN_PRINT_PAD_MM
  );
  page.style.setProperty("--print-pad", effectivePad.toFixed(2) + "mm");
  // 사진 높이 변경 시에는 반복 계산하지 않고, 인쇄 너비가 바뀔 때만 측정.
  if (oldWidth !== newWidth) fitStandardBoldLines(page);
}

function fits(page: HTMLElement, target: FitTarget): boolean {
  const body = page.querySelector<HTMLElement>(".cb-print-body");
  const footer = page.querySelector<HTMLElement>(".cb-page-footer");
  if (!body || !footer) return false;

  const paper = page.getBoundingClientRect();
  const content = body.getBoundingClientRect();
  const footerRect = footer.getBoundingClientRect();

  const reviewed = page.closest(
    '.cb-print-only[data-print-mode="reviewed"]',
  ) !== null;
  const preferredRatio = reviewed
    ? REVIEWED_TARGET_CONTENT_RATIO
    : TARGET_CONTENT_RATIO;

  const availableBottom =
    target === "quarter"
      ? paper.top + paper.height * preferredRatio
      : paper.bottom - ((10 + EXTRA_BOTTOM_MM) * 96) / 25.4;

  const rightLimit = paper.right - (12 * 96) / 25.4;

  return (
    footerRect.bottom <= availableBottom + 0.5 &&
    content.right <= rightLimit + 1 &&
    content.left >= paper.left - 1
  );
}

/** 설정된 비율 안에서 원본 사진을 자르지 않고 가능한 크게 표시합니다. */
function maximizePhoto(
  page: HTMLElement,
  scale: number,
  minMm: number,
  maxMm: number,
  target: FitTarget,
) {
  if (maxMm <= 0) return;

  let low = minMm;
  let high = maxMm;

  for (let i = 0; i < 12; i++) {
    const mid = (low + high) / 2;
    applyScale(page, scale, mid);
    if (fits(page, target)) low = mid;
    else high = mid;
  }

  applyScale(page, scale, Math.max(minMm, low - 0.1));
}

/**
 * 검토완료 사례 PDF: 사진을 먼저 충분히 키운 다음,
 * 셀 위아래 여백을 일정 범위에서 늘려 표가 지나치게 위에 몰리지 않게 합니다.
 */
function fillRemainingWithPadding(
  page: HTMLElement,
  scale: number,
  photoMm: number,
) {
  let low = MIN_REVIEWED_PRINT_PAD_MM;
  let high = MAX_REVIEWED_PRINT_PAD_MM;

  for (let i = 0; i < 12; i++) {
    const mid = (low + high) / 2;
    applyScale(page, scale, photoMm, mid);

    if (fits(page, "quarter")) low = mid;
    else high = mid;
  }

  applyScale(page, scale, photoMm, Math.max(MIN_REVIEWED_PRINT_PAD_MM, low - 0.02));
}

export async function prepareCasebookPrint(
  pages: HTMLElement[],
): Promise<void> {
  if (!pages.length) {
    throw new Error("인쇄할 사례 페이지를 찾지 못했습니다.");
  }

  ensurePrintStyle();
  await document.fonts.ready;

  await Promise.all(
    pages.flatMap(page =>
      Array.from(
        page.querySelectorAll<HTMLImageElement>(".cb-preview-photos img"),
      ).map(waitForPhoto),
    ),
  );

  const oversized: number[] = [];
  const scales = [
    1, 0.98, 0.96, 0.94, 0.92, 0.90,
    0.88, 0.86, 0.84, 0.82, 0.80,
  ];

  pages.forEach((page, index) => {
    const count = page.querySelectorAll(".cb-preview-photos img").length;
    const reviewed = page.closest(
      '.cb-print-only[data-print-mode="reviewed"]',
    ) !== null;
    const photoMax =
      count === 1
        ? (reviewed ? REVIEWED_SINGLE_PHOTO_MAX_MM : SINGLE_PHOTO_MAX_MM)
        : count >= 2
          ? (reviewed ? REVIEWED_DOUBLE_PHOTO_MAX_MM : DOUBLE_PHOTO_MAX_MM)
          : 0;
    const photoMin = count ? PHOTO_MIN_MM : 0;
    const initialPad = reviewed ? MIN_REVIEWED_PRINT_PAD_MM : MIN_PRINT_PAD_MM;

    let fitted = false;

    // 1순위: 검토완료 사례는 하단 약 13.5%, 기타 출력은 기존 25%를 우선합니다.
    for (const scale of scales) {
      applyScale(page, scale, photoMin, initialPad);
      if (!fits(page, "quarter")) continue;

      maximizePhoto(page, scale, photoMin, photoMax, "quarter");
      if (reviewed) {
        page.style.setProperty(
          "--print-pad",
          MIN_REVIEWED_PRINT_PAD_MM.toFixed(2) + "mm",
        );
      }

      // 이미지에 빈 고정 상자를 만들지 않고 표의 상하 간격으로 남는 영역 조절
      if (reviewed && count > 0) {
        const photoMm = Number.parseFloat(
          page.style.getPropertyValue("--print-photo"),
        );
        fillRemainingWithPadding(page, scale, photoMm);
      }

      fitted = true;
      break;
    }

    // 내용이 매우 긴 경우에만 하단 여백을 양보합니다.
    if (!fitted) {
      for (const scale of scales) {
        applyScale(page, scale, photoMin, initialPad);
        if (!fits(page, "page")) continue;

        maximizePhoto(page, scale, photoMin, photoMax, "page");
        if (reviewed) {
          page.style.setProperty(
            "--print-pad",
            MIN_REVIEWED_PRINT_PAD_MM.toFixed(2) + "mm",
          );
        }
        fitted = true;
        break;
      }
    }

    if (!fitted) oversized.push(index + 1);
  });

  if (oversized.length) {
    throw new Error(
      "A4 한 장을 초과하는 사례: " +
      oversized.join(", ") +
      "쪽. 해당 사례의 문안을 줄여주세요.",
    );
  }
}
