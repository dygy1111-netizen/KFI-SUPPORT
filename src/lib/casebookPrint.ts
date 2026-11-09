
/**
 * KFI 품질관리 사례집 A4 PDF 출력
 *
 * - 기존 사례집 표 양식 유지
 * - 사진 1장: 최대 높이 80mm
 * - 사진 2장: 최대 높이 58mm
 * - 원본 사진 비율 유지
 * - 문안이 길면 사진 자동 축소
 * - 본문 글씨 최소 10pt 유지
 * - 하단 여유 공간 8mm 추가 확보
 */

export async function prepareCasebookPrint(
  pages: HTMLElement[],
) {
  await document.fonts.ready;

  // 사진 로딩 완료 대기
  await Promise.all(
    pages.flatMap((page) =>
      Array.from(
        page.querySelectorAll<HTMLImageElement>(
          ".cb-preview-photos img",
        ),
      ).map(async (img) => {
        if (img.complete && img.naturalWidth > 0) return;

        await new Promise<void>((resolve, reject) => {
          const timer = window.setTimeout(() => {
            cleanup();
            reject(new Error("사진 로딩 시간이 초과되었습니다."));
          }, 10000);

          const cleanup = () => {
            window.clearTimeout(timer);
            img.removeEventListener("load", onLoad);
            img.removeEventListener("error", onError);
          };

          const onLoad = () => {
            cleanup();
            resolve();
          };

          const onError = () => {
            cleanup();
            reject(new Error("사진을 불러오지 못했습니다."));
          };

          img.addEventListener("load", onLoad);
          img.addEventListener("error", onError);

          if (img.complete) {
            if (img.naturalWidth > 0) onLoad();
            else onError();
          }
        });
      }),
    ),
  );

  const oversized: number[] = [];

  // PDF 사진 크기 설정(mm)
  const PHOTO_SINGLE_MAX = 80;
  const PHOTO_DOUBLE_MAX = 58;
  const PHOTO_MIN = 24;

  // A4 하단 기본 여백 외 추가 확보(mm)
  const EXTRA_BOTTOM_MARGIN = 8;

  pages.forEach((page, index) => {
    const photos = page.querySelectorAll(
      ".cb-preview-photos img",
    );

    const count = photos.length;

    const minPhoto = count > 0 ? PHOTO_MIN : 0;

    const maxPhoto =
      count === 1
        ? PHOTO_SINGLE_MAX
        : count >= 2
          ? PHOTO_DOUBLE_MAX
          : 0;

    // A4 한 페이지 안에 들어가는지 확인
    const fits = () => {
      const footer = page.querySelector<HTMLElement>(
        ".cb-page-footer",
      );

      if (!footer) return false;

      const pageStyle = getComputedStyle(page);

      const pageBottom =
        page.getBoundingClientRect().bottom -
        parseFloat(pageStyle.paddingBottom) -
        (EXTRA_BOTTOM_MARGIN * 96) / 25.4;

      const footerBottom =
        footer.getBoundingClientRect().bottom;

      const widthFits =
        page.scrollWidth <= page.clientWidth + 1;

      return (
        footerBottom <= pageBottom + 0.5 &&
        widthFits
      );
    };

    let fitted = false;

    // 글자 크기는 유지하고 사진을 우선 조정
    for (let step = 0; step <= 6; step++) {
      const fontSize = 11.5 - step * 0.25;
      const cellPadding = 3 - step * 0.15;

      page.style.setProperty(
        "--print-font",
        `${fontSize}pt`,
      );

      page.style.setProperty(
        "--print-pad",
        `${cellPadding}mm`,
      );

      page.style.setProperty(
        "--print-photo",
        `${minPhoto}mm`,
      );

      if (!fits()) continue;

      // 사진 최대 크기 자동 계산
      let low = minPhoto;
      let high = maxPhoto;

      for (let i = 0; i < 12; i++) {
        const middle = (low + high) / 2;

        page.style.setProperty(
          "--print-photo",
          `${middle}mm`,
        );

        if (fits()) {
          low = middle;
        } else {
          high = middle;
        }
      }

      const finalPhoto = Math.max(
        minPhoto,
        low - 0.2,
      );

      page.style.setProperty(
        "--print-photo",
        `${finalPhoto.toFixed(2)}mm`,
      );

      // 남은 공간에 맞춰 표 내부 여백 조정
      let padLow = cellPadding;
      let padHigh = 6;

      for (let i = 0; i < 10; i++) {
        const middle = (padLow + padHigh) / 2;

        page.style.setProperty(
          "--print-pad",
          `${middle}mm`,
        );

        if (fits()) {
          padLow = middle;
        } else {
          padHigh = middle;
        }
      }

      page.style.setProperty(
        "--print-pad",
        `${Math.max(cellPadding, padLow - 0.05).toFixed(2)}mm`,
      );

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
      "문안을 줄인 뒤 다시 출력하세요.",
    );
  }
}
 
