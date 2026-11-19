/**
 * KFI 품질관리 사례집 인쇄용 A4 자동 배치.
 * 관리자(선택/전체 PDF)와 공개 화면 PDF가 공통으로 사용합니다.
 *
 * A4 용지는 그대로 두고 제목/표/사진/쪽번호만 함께 축소합니다.
 * 사진 크기는 고정하고 다른 표 행을 세로로 늘려 하단 약 5%를 남깁니다.
 * 긴 사례는 가독성과 한 페이지 수록을 우선합니다.
 */

// Fixed physical size on A4, independent of editor widths, image ratio,
// amount of text, and the scaling used to fit a page.
export const PRINT_PHOTO_HEIGHT_MM = 60;
const PRINT_PHOTO_GAP_MM = 2;
export const TARGET_CONTENT_RATIO = 0.95;
const MIN_PRINT_PAD_MM = 2.1;
const MIN_REVIEWED_PRINT_PAD_MM = 2.7;
const MIN_BOTTOM_MM = 10;
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
      overflow: hidden;
      break-inside: avoid;
      page-break-inside: avoid;
    }

    /*
     * 인쇄할 내용 전체를 하나의 블록으로 배치합니다.
     * 부모 A4는 축소하지 않으므로 용지 크기와 페이지 나눔은 유지됩니다.
     */
    .cb-print-only .cb-print-body {
      position: absolute;
      /* CSS zoom changes layout dimensions as well as visible size.
         A transform alone makes Chromium paginate the unscaled height. */
      top: calc(12mm / var(--print-scale, 1));
      left: calc(12mm / var(--print-scale, 1));
      width: var(--print-body-width, 186mm);
      zoom: var(--print-scale, 1);
      transform: none;
    }

    /*
     * 셀마다 CSS 테두리를 그리지 않습니다.
     * 실제 PDF의 표 선은 A4 위에 얹는 단일 SVG 경로로만 그립니다.
     * 이렇게 하면 페이지 축소와 소수점 반올림으로 선 굵기가 달라지는
     * 현상을 줄일 수 있습니다.
     */
    .cb-print-only[data-print-mode="reviewed"] .cb-table,
    .cb-print-only[data-print-mode="reviewed"] .cb-table-label,
    .cb-print-only[data-print-mode="reviewed"] .cb-table-content {
      border: 0 !important;
    }

    .cb-print-only[data-print-mode="reviewed"] .cb-table-label,
    .cb-print-only[data-print-mode="reviewed"] .cb-table-content {
      box-sizing: border-box;
    }

    .cb-print-only[data-print-mode="reviewed"] .cb-print-table-lines {
      position: absolute;
      top: 0;
      left: 0;
      width: 210mm;
      height: 297mm;
      overflow: visible;
      pointer-events: none;
      z-index: 2;
    }

    /* The same physical label column and photo-cell padding on every A4 page. */
    .cb-print-only .cb-table-row {
      grid-template-columns: var(--print-label-width, 28mm) minmax(0, 1fr);
    }
    .cb-print-only .cb-table-content:has(.cb-photo-area) {
      min-width: 0;
      justify-content: flex-start;
      padding: var(--print-photo-pad, 2mm) !important;
    }

    /* Stretch only non-photo table rows. The photo cell and its label are
       unchanged, so the fixed 60mm photo and surrounding row stay intact. */
    .cb-print-only .cb-a4-page .cb-table-row:not(:has(.cb-photo-area)) > .cb-table-content,
    .cb-print-only .cb-a4-page .cb-table-row:not(:has(.cb-photo-area)) > .cb-table-label {
      padding-top: calc(var(--print-pad) + var(--print-extra-row-pad, 0mm));
      padding-bottom: calc(var(--print-pad) + var(--print-extra-row-pad, 0mm));
    }
    /* Slightly more open text leading, without affecting the photo row. */
    .cb-print-only .cb-a4-page .cb-table-row:not(:has(.cb-photo-area)) > .cb-table-content,
    .cb-print-only .cb-a4-page .cb-table-row:not(:has(.cb-photo-area)) > .cb-table-label {
      line-height: 1.65;
    }

    /* Fixed cells: one photo fills the entire photo width; two share it
       evenly. Keep all source pixels visible, deliberately allowing aspect
       ratio changes in the PDF only. Never crop inspection evidence. */
    .cb-print-only .cb-a4-page .cb-preview-photos.one,
    .cb-print-only .cb-a4-page .cb-preview-photos.two,
    .cb-print-only .cb-a4-page .cb-preview-photos.multi {
      display: grid !important;
      width: 100%;
      height: var(--print-photo, 60mm);
      gap: var(--print-photo-gap, 2mm);
      grid-template-columns: repeat(2, minmax(0, 1fr));
      grid-template-rows: minmax(0, 1fr);
      align-items: stretch;
      justify-items: stretch;
      box-sizing: border-box;
    }
    .cb-print-only .cb-a4-page .cb-preview-photos.one {
      grid-template-columns: minmax(0, 1fr);
      gap: 0;
    }
    .cb-print-only .cb-a4-page .cb-preview-photos.multi {
      grid-template-rows: repeat(2, minmax(0, 1fr));
    }
    .cb-print-only .cb-a4-page .cb-preview-photos:has(.cb-photo-placeholder) {
      height: 22mm;
      grid-template-columns: minmax(0, 1fr);
      grid-template-rows: minmax(0, 1fr);
    }
    .cb-print-only .cb-a4-page .cb-preview-photos .cb-photo-resize-slot,
    .cb-print-only .cb-a4-page .cb-preview-photos .cb-photo-size-frame {
      display: block !important;
      width: 100% !important;
      height: 100% !important;
      max-width: 100% !important;
      max-height: 100% !important;
      min-width: 0;
      min-height: 0;
      overflow: hidden;
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    .cb-print-only .cb-a4-page .cb-preview-photos.three .cb-photo-resize-slot:last-child {
      grid-column: 1 / -1;
      width: calc((100% - var(--print-photo-gap, 2mm)) / 2) !important;
      justify-self: center;
    }
    .cb-print-only .cb-a4-page .cb-preview-photos .cb-photo-size-frame img {
      display: block !important;
      width: 100% !important;
      height: 100% !important;
      max-width: 100% !important;
      max-height: 100% !important;
      min-width: 0;
      min-height: 0;
      object-fit: fill !important;
      transform: none !important;
      margin: 0 !important;
      padding: 0 !important;
      border: none !important;
      border-radius: 0 !important;
      box-sizing: border-box;
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

/**
 * '검토완료 사례 PDF'의 표 선을 하나의 벡터 SVG로 그립니다.
 * CSS grid 선의 소수점 반올림 및 transform 축소를 피해,
 * A4에서 모든 선을 실물 0.26mm 굵기로 동일하게 출력합니다.
 *
 * 이 SVG는 cb-print-body의 transform 밖에서 A4 용지 좌표를 사용합니다.
 * 원본 표의 셀은 배경색과 텍스트만 담당합니다.
 */
function drawUniformTableLines(page: HTMLElement): void {
  if (!page.closest('.cb-print-only[data-print-mode="reviewed"]')) return;

  const table = page.querySelector<HTMLElement>(".cb-table");
  if (!table) return;
  const rows = Array.from(
    table.querySelectorAll<HTMLElement>(":scope > .cb-table-row"),
  );
  if (!rows.length) return;

  const firstLabel = rows[0].querySelector<HTMLElement>(".cb-table-label");
  if (!firstLabel) return;

  // print 미디어 적용 전후 어느 경우에도 mm 기반 좌표로 재측정합니다.
  const pageRect = page.getBoundingClientRect();
  const tableRect = table.getBoundingClientRect();
  const labelRect = firstLabel.getBoundingClientRect();
  if (pageRect.width <= 0 || pageRect.height <= 0) return;

  const x = (value: number) =>
    ((value - pageRect.left) * 210) / pageRect.width;
  const y = (value: number) =>
    ((value - pageRect.top) * 297) / pageRect.height;
  const fmt = (value: number) => value.toFixed(4);

  const left = fmt(x(tableRect.left));
  const right = fmt(x(tableRect.right));
  const top = fmt(y(tableRect.top));
  const bottom = fmt(y(tableRect.bottom));
  const divider = fmt(x(labelRect.right));

  // 외곽선, 세로 구분선, 각 행 사이 가로 구분선을 한 번씩만 생성.
  const segments = [
    `M ${left} ${top} H ${right} V ${bottom} H ${left} Z`,
    `M ${divider} ${top} V ${bottom}`,
    ...rows.slice(0, -1).map(row =>
      `M ${left} ${fmt(y(row.getBoundingClientRect().bottom))} H ${right}`,
    ),
  ];

  const svgNs = "http://www.w3.org/2000/svg";
  let overlay = page.querySelector<SVGSVGElement>(
    ":scope > svg.cb-print-table-lines",
  );
  if (!overlay) {
    overlay = document.createElementNS(svgNs, "svg");
    overlay.classList.add("cb-print-table-lines");
    overlay.setAttribute("aria-hidden", "true");
    overlay.setAttribute("viewBox", "0 0 210 297");
    overlay.setAttribute("width", "210mm");
    overlay.setAttribute("height", "297mm");
    page.appendChild(overlay);
  }

  let path = overlay.querySelector<SVGPathElement>("path");
  if (!path) {
    path = document.createElementNS(svgNs, "path");
    overlay.appendChild(path);
  }
  path.setAttribute("d", segments.join(" "));
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "#65758b");
  path.setAttribute("stroke-width", "0.26");
  path.setAttribute("stroke-linejoin", "miter");
  path.setAttribute("stroke-linecap", "butt");
  path.setAttribute("shape-rendering", "geometricPrecision");
}

/** 인쇄 너비는 210mm - 좌우 여백 12mm * 2 = 186mm. */
function applyScale(
  page: HTMLElement,
  scale: number,
  padMm?: number,
) {
  page.style.setProperty("--print-scale", scale.toFixed(4));
  const oldWidth = page.style.getPropertyValue("--print-body-width");
  const newWidth = (186 / scale).toFixed(3) + "mm";
  page.style.setProperty("--print-body-width", newWidth);
  // Compensate for the transform on the body so the physical printed
  // photo size does not vary when text needs to be fitted.
  page.style.setProperty("--print-photo", (PRINT_PHOTO_HEIGHT_MM / scale).toFixed(4) + "mm");
  page.style.setProperty("--print-label-width", (28 / scale).toFixed(4) + "mm");
  page.style.setProperty("--print-photo-pad", (2 / scale).toFixed(4) + "mm");
  page.style.setProperty("--print-photo-gap", (PRINT_PHOTO_GAP_MM / scale).toFixed(4) + "mm");

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

  const availableBottom =
    target === "quarter"
      ? paper.top + paper.height * TARGET_CONTENT_RATIO
      : paper.bottom - (MIN_BOTTOM_MM * 96) / 25.4;

  const rightLimit = paper.right - (12 * 96) / 25.4;

  return (
    footerRect.bottom <= availableBottom + 0.5 &&
    content.right <= rightLimit + 1 &&
    content.left >= paper.left - 1
  );
}

/** Fill the remaining vertical budget with even padding in non-photo rows.
 * Measure the actual footer after each adjustment rather than guessing line
 * heights. Compensate for page scale so the physical padding is consistent.
 */
function expandNonPhotoRows(page: HTMLElement, scale: number): void {
  const rows = page.querySelectorAll(".cb-table-row:not(:has(.cb-photo-area))");
  if (!rows.length || !fits(page, "quarter")) return;
  const paper = page.getBoundingClientRect();
  const footer = page.querySelector<HTMLElement>(".cb-page-footer");
  if (!footer) return;
  const remainingPx = paper.top + paper.height * TARGET_CONTENT_RATIO -
    footer.getBoundingClientRect().bottom;
  if (remainingPx <= 0.5) return;

  const setPad = (mm: number) => page.style.setProperty(
    "--print-extra-row-pad", (mm / scale).toFixed(4) + "mm",
  );
  let low = 0;
  // The extra padding acts on top and bottom; the conservative upper bound
  // also allows for a row in which its original label was taller than its text.
  let high = remainingPx * 25.4 / 96 + 2;
  for (let i = 0; i < 16; i++) {
    const candidate = (low + high) / 2;
    setPad(candidate);
    if (fits(page, "quarter")) low = candidate;
    else high = candidate;
  }
  setPad(Math.max(0, low - 0.025));
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
    const reviewed = page.closest(
      '.cb-print-only[data-print-mode="reviewed"]',
    ) !== null;
    const initialPad = reviewed ? MIN_REVIEWED_PRINT_PAD_MM : MIN_PRINT_PAD_MM;

    let fitted = false;
    page.style.setProperty("--print-extra-row-pad", "0mm");
    // Keep the photo dimensions fixed. Prefer an unscaled readable page with
    // a 5% bottom margin; exceptionally long content may use the last 4.85mm.
    for (const target of ["quarter", "page"] as const) {
      for (const scale of scales) {
        applyScale(page, scale, initialPad);
        if (!fits(page, target)) continue;
        if (target === "quarter") expandNonPhotoRows(page, scale);
        fitted = true;
        break;
      }
      if (fitted) break;
    }

    if (!fitted) oversized.push(index + 1);
  });

  if (oversized.length) {
    throw new Error(
      "A4 한 장을 초과하는 사례: " +
      oversized.join(", ") +
      "쪽. 사진 높이 60mm를 유지하면 A4에 맞지 않습니다. 해당 사례의 문안을 확인해주세요.",
    );
  }

  // 레이아웃 확정 뒤 외곽선과 구분선을 그립니다.
  pages.forEach(drawUniformTableLines);

  // Chromium 인쇄 미디어에서 측정 좌표가 달라질 수 있어 인쇄 직전에 재계산.
  window.addEventListener(
    "beforeprint",
    () => pages.filter(page => page.isConnected).forEach(drawUniformTableLines),
    { once: true },
  );
}
