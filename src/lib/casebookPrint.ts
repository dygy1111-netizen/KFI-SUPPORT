
/**
 * KFI 품질관리 사례집 A4 PDF 출력
 *
 * - 기존 사례집 양식 유지
 * - 사진의 원본 가로세로 비율 유지
 * - 사진 1장 최대 높이 80mm
 * - 사진 2장 각각 최대 높이 58mm
 * - 사진 주변의 고정 높이 빈 공간 제거
 * - 표 내부 여백을 불필요하게 확대하지 않음
 * - 문안이 길면 사진부터 축소
 * - 최소 본문 글씨 크기 10pt
 */

const PHOTO_SINGLE_MAX = 80;
const PHOTO_DOUBLE_MAX = 58;
const PHOTO_MIN = 22;

const EXTRA_BOTTOM_MARGIN = 8;
// 사례의 본문과 쪽번호가 A4 상단 75% 안에 들도록 우선 배치
const TARGET_CONTENT_RATIO = 0.75;

const PRINT_STYLE_ID = "kfi-casebook-compact-print";

/**
 * 기존 CSS는 유지하면서,
 * PDF 출력용 사진 영역만 덮어씁니다.
 *
 * 화면과 PDF의 사진 배치를 구분하기 위해
 * .cb-print-only 내부에만 적용합니다.
 */
function ensureCompactPrintStyle(): void {
  if (document.getElementById(PRINT_STYLE_ID)) {
    return;
  }

  const style = document.createElement("style");
  style.id = PRINT_STYLE_ID;

  style.textContent = `
    /*
     * 사진칸 내부 여백 최소화
     */
    .cb-print-only
    .cb-table-content:has(.cb-photo-area) {
      justify-content: flex-start;
      padding-top: 2mm;
      padding-bottom: 2mm;
    }

    /*
     * 사진 1장
     */
    .cb-print-only .cb-preview-photos.one {
      display: flex;
      flex-direction: row;
      justify-content: center;
      align-items: flex-start;
      gap: 0;
    }

    /*
     * 사진 2장
     */
    .cb-print-only .cb-preview-photos.two {
      display: grid;
      grid-template-columns:
        repeat(2, minmax(0, 1fr));
      align-items: center;
      justify-items: center;
      gap: 2mm;
    }

    /*
     * 사진 실제 크기에 맞게 표시
     *
     * 기존 CSS의 고정 height 제거
     * 원본 사진 비율 유지
     * 필요 이상의 빈 사진 박스 제거
     */
    .cb-print-only .cb-preview-photos img {
      display: block;
      width: auto;
      height: auto;
      max-width: 100%;
      max-height: var(--print-photo);
      min-width: 0;

      object-fit: contain;
      object-position: center;

      margin: 0 auto;
      padding: 0;

      border: none;
      border-radius: 0;
      background: transparent;
    }

    /*
     * 사진 설명 간격
     */
    .cb-print-only .cb-photo-area {
      gap: 1mm;
    }

    /*
     * 사진 설명이 없으면 빈 영역 삭제
     */
    .cb-print-only .cb-photo-copy:empty {
      display: none;
    }

    /*
     * 표 내부 문장 간격
     */
    .cb-print-only .cb-table-content p {
      margin-bottom: 1mm;
    }

    .cb-print-only .cb-table-content p:last-child {
      margin-bottom: 0;
    }
  `;

  document.head.appendChild(style);
}

/**
 * 이미지가 완전히 로딩될 때까지 대기
 */
async function waitForImage(
  img: HTMLImageElement,
): Promise<void> {
  let timer: number | undefined;

  try {
    await Promise.race([
      img.decode(),

      new Promise<never>((_, reject) => {
        timer = window.setTimeout(() => {
          reject(
            new Error(
              "사진 로딩 시간이 초과되었습니다.",
            ),
          );
        }, 10000);
      }),
    ]);

    if (img.naturalWidth <= 0) {
      throw new Error("사진을 불러올 수 없습니다.");
    }
  } finally {
    if (timer !== undefined) {
      window.clearTimeout(timer);
    }
  }
}

/**
 * 페이지 내용이 A4 영역 안에 들어가는지 확인
 */
type FitTarget = "quarter" | "a4";

function pageFits(page: HTMLElement, target: FitTarget): boolean {
  const footer = page.querySelector<HTMLElement>(".cb-page-footer");
  if (!footer) return false;

  const pageRect = page.getBoundingClientRect();
  const pageStyle = window.getComputedStyle(page);

  // 긴 사례는 실제 A4 인쇄 가능 영역까지 허용합니다.
  const safeBottom =
    pageRect.bottom -
    parseFloat(pageStyle.paddingBottom) -
    (EXTRA_BOTTOM_MARGIN * 96) / 25.4;

  // 가능하면 A4 하단 약 1/4을 비워 둡니다.
  const quarterBottom =
    pageRect.top + pageRect.height * TARGET_CONTENT_RATIO;

  const allowedBottom =
    target === "quarter"
      ? Math.min(quarterBottom, safeBottom)
      : safeBottom;

  return (
    footer.getBoundingClientRect().bottom <= allowedBottom + 0.5 &&
    page.scrollWidth <= page.clientWidth + 1
  );
}

/**
 * 페이지에 들어가는 최대 사진 높이 탐색
 */
function fitPhotoHeight(
  page: HTMLElement,
  minimum: number,
  maximum: number,
  target: FitTarget,
): void {
  if (maximum <= 0) {
    page.style.setProperty("--print-photo", "0mm");
    return;
  }

  let low = minimum;
  let high = maximum;

  // 사진을 잘라내거나 늘리지 않고, 목표 영역에 들어가는 최대 높이 탐색
  for (let i = 0; i < 12; i++) {
    const middle = (low + high) / 2;
    page.style.setProperty("--print-photo", middle.toFixed(2) + "mm");

    if (pageFits(page, target)) low = middle;
    else high = middle;
  }

  page.style.setProperty(
    "--print-photo",
    Math.max(minimum, low - 0.2).toFixed(2) + "mm",
  );
}

/**
 * 실제 A4 PDF 출력 전 레이아웃 조정
 */
export async function prepareCasebookPrint(
  pages: HTMLElement[],
): Promise<void> {
  // 기존 출력용 CSS 위에 수정 규칙 적용
  ensureCompactPrintStyle();

  // 폰트 로딩 완료
  await document.fonts.ready;

  // 사진 로딩 완료
  const images = pages.flatMap((page) =>
    Array.from(
      page.querySelectorAll<HTMLImageElement>(
        ".cb-preview-photos img",
      ),
    ),
  );

  await Promise.all(
    images.map(waitForImage),
  );

  const oversized: number[] = [];

  pages.forEach((page, index) => {
    const count = page.querySelectorAll(".cb-preview-photos img").length;
    const minPhoto = count > 0 ? PHOTO_MIN : 0;
    const maxPhoto =
      count === 1 ? PHOTO_SINGLE_MAX :
      count >= 2 ? PHOTO_DOUBLE_MAX : 0;

    // 글씨를 무조건 줄이지 않고 사진과 셀 상하 간격부터 조절
    const settings = [
      { font: 11.5, pad: 2.4 },
      { font: 11.25, pad: 2.0 },
      { font: 11.0, pad: 1.7 },
      { font: 10.5, pad: 1.4 },
      { font: 10.0, pad: 1.2 },
    ];

    let fitted = false;

    // 1차 목표: 표·사진·쪽번호가 A4 높이의 약 75% 안에 들어오게 조정
    for (const setting of settings) {
      page.style.setProperty("--print-font", setting.font + "pt");
      page.style.setProperty("--print-pad", setting.pad + "mm");
      page.style.setProperty("--print-photo", minPhoto + "mm");

      if (!pageFits(page, "quarter")) continue;

      fitPhotoHeight(page, minPhoto, maxPhoto, "quarter");
      fitted = true;
      break;
    }

    // 문안이 긴 사례는 임의로 잘라내지 않고 A4 한 쪽을 우선 보장
    if (!fitted) {
      for (const setting of settings) {
        page.style.setProperty("--print-font", setting.font + "pt");
        page.style.setProperty("--print-pad", setting.pad + "mm");
        page.style.setProperty("--print-photo", minPhoto + "mm");

        if (!pageFits(page, "a4")) continue;

        // 25% 여백 확보가 불가능한 사례는 사진을 최소한으로 유지
        fitted = true;
        break;
      }
    }

    if (!fitted) oversized.push(index + 1);
  });

  if (oversized.length > 0) {
    throw new Error(
      `A4 한 장 분량 초과: ${oversized.join(", ")}쪽. ` +
      "해당 사례의 문안이나 사진을 조정해 주세요.",
    );
  }
}
