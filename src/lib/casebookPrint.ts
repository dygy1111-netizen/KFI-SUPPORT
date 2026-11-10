/**
 * KFI 품질관리 사례집 인쇄용 A4 자동 배치.
 * 관리자(선택/전체 PDF)와 공개 화면 PDF가 공통으로 사용합니다.
 *
 * A4 용지는 그대로 두고 제목/표/사진/쪽번호만 함께 축소합니다.
 * 내용이 짧으면 하단 약 25%를 비우고, 긴 사례는 가독성과 한 페이지 수록을 우선합니다.
 */

const SINGLE_PHOTO_MAX_MM = 80;
const DOUBLE_PHOTO_MAX_MM = 58;
const PHOTO_MIN_MM = 20;
const TARGET_CONTENT_RATIO = 0.75;
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

/** 인쇄 너비는 210mm - 좌우 여백 12mm * 2 = 186mm. */
function applyScale(page: HTMLElement, scale: number, photoMm: number) {
  page.style.setProperty("--print-scale", scale.toFixed(4));
  page.style.setProperty("--print-body-width", (186 / scale).toFixed(3) + "mm");
  page.style.setProperty("--print-photo", photoMm.toFixed(2) + "mm");
  // 실제 인쇄되는 표 본문은 최소 10pt 유지합니다.
  page.style.setProperty(
    "--print-font",
    Math.max(11.5, 10 / scale).toFixed(3) + "pt",
  );
  page.style.setProperty("--print-pad", "2.1mm");
}

function fits(page: HTMLElement, target: FitTarget): boolean {
  const body = page.querySelector<HTMLElement>(".cb-print-body");
  const footer = page.querySelector<HTMLElement>(".cb-page-footer");
  if (!body || !footer) return false;

  const paper = page.getBoundingClientRect();
  const content = body.getBoundingClientRect();
  const footerRect = footer.getBoundingClientRect();

  const availableBottom =
    target === "quarter"
      ? paper.top + paper.height * TARGET_CONTENT_RATIO
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
    const photoMax =
      count === 1 ? SINGLE_PHOTO_MAX_MM :
      count >= 2 ? DOUBLE_PHOTO_MAX_MM : 0;
    const photoMin = count ? PHOTO_MIN_MM : 0;

    let fitted = false;

    // 1순위: A4 하단 약 25% 여백을 확보합니다.
    for (const scale of scales) {
      applyScale(page, scale, photoMin);
      if (!fits(page, "quarter")) continue;

      maximizePhoto(page, scale, photoMin, photoMax, "quarter");
      fitted = true;
      break;
    }

    // 내용이 매우 긴 경우에만 하단 여백을 양보합니다.
    if (!fitted) {
      for (const scale of scales) {
        applyScale(page, scale, photoMin);
        if (!fits(page, "page")) continue;

        maximizePhoto(page, scale, photoMin, photoMax, "page");
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
