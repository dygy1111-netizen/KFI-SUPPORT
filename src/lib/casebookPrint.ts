
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
const PHOTO_MIN = 24;

const EXTRA_BOTTOM_MARGIN = 8;

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
function pageFits(page: HTMLElement): boolean {
  const footer = page.querySelector<HTMLElement>(
    ".cb-page-footer",
  );

  if (!footer) {
    return false;
  }

  const pageStyle = window.getComputedStyle(page);

  const pageBottom =
    page.getBoundingClientRect().bottom -
    parseFloat(pageStyle.paddingBottom) -
    (EXTRA_BOTTOM_MARGIN * 96) / 25.4;

  const footerBottom =
    footer.getBoundingClientRect().bottom;

  const widthFits =
    page.scrollWidth <= page.clientWidth + 1;

  const heightFits =
    footerBottom <= pageBottom + 0.5;

  return widthFits && heightFits;
}

/**
 * 페이지에 들어가는 최대 사진 높이 탐색
 */
function fitPhotoHeight(
  page: HTMLElement,
  minimum: number,
  maximum: number,
): number {
  if (maximum <= 0) {
    page.style.setProperty(
      "--print-photo",
      "0mm",
    );
    return 0;
  }

  let low = minimum;
  let high = maximum;

  for (let i = 0; i < 12; i++) {
    const middle = (low + high) / 2;

    page.style.setProperty(
      "--print-photo",
      `${middle}mm`,
    );

    if (pageFits(page)) {
      low = middle;
    } else {
      high = middle;
    }
  }

  const result = Math.max(
    minimum,
    low - 0.2,
  );

  page.style.setProperty(
    "--print-photo",
    `${result.toFixed(2)}mm`,
  );

  return result;
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
    const count = page.querySelectorAll(
      ".cb-preview-photos img",
    ).length;

    // 사진 수에 따른 최대 높이
    const maxPhoto =
      count === 1
        ? PHOTO_SINGLE_MAX
        : count >= 2
          ? PHOTO_DOUBLE_MAX
          : 0;

    const minPhoto =
      count > 0 ? PHOTO_MIN : 0;

    let fitted = false;

    /*
     * 첫 단계에서 글자 크기와 셀 여백 유지
     *
     * 초과할 때만 조금씩 축소
     */
    for (let step = 0; step <= 6; step++) {
      const fontSize =
        11.5 - step * 0.25;

      const cellPadding =
        2.4 - step * 0.1;

      page.style.setProperty(
        "--print-font",
        `${fontSize}pt`,
      );

      page.style.setProperty(
        "--print-pad",
        `${cellPadding.toFixed(2)}mm`,
      );

      page.style.setProperty(
        "--print-photo",
        `${minPhoto}mm`,
      );

      if (!pageFits(page)) {
        continue;
      }

      /*
       * 페이지에 들어가는 범위에서
       * 사진 크기만 자동 조정
       */
      fitPhotoHeight(
        page,
        minPhoto,
        maxPhoto,
      );

      /*
       * 남는 공간을 표 여백으로
       * 다시 확대하지 않습니다.
       *
       * A4 하단에 여백이 남아도
       * 현재 내용 높이를 유지합니다.
       */
      fitted = true;
      break;
    }

    if (!fitted) {
      oversized.push(index + 1);
    }
  });

  if (oversized.length > 0) {
    throw new Error(
      `A4 한 장 분량 초과: ${oversized.join(", ")}쪽. ` +
      "해당 사례의 문안이나 사진을 조정해 주세요.",
    );
  }
}
