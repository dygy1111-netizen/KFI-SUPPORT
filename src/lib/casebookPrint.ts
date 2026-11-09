
/** A4 공간에 맞춰 사진 및 문안 크기를 자동 조정 */
export async function prepareCasebookPrint(pages: HTMLElement[]) {
  await document.fonts.ready;

  // 사진 로딩 완료 후 크기 측정
  await Promise.all(
    pages.flatMap((page) =>
      Array.from(page.querySelectorAll<HTMLImageElement>("img")).map(
        async (img) => {
          if (!img.complete) {
            await new Promise<void>((resolve, reject) => {
              img.onload = () => resolve();
              img.onerror = () => reject(new Error("사진 로딩 실패"));
            });
          }
          if (!img.naturalWidth) {
            throw new Error("사진을 불러올 수 없습니다.");
          }
        },
      ),
    ),
  );

  const oversized: number[] = [];

  pages.forEach((page, index) => {
    const count = page.querySelectorAll(
      ".cb-preview-photos img",
    ).length;

    // 사진 1장인 경우 더 넓은 공간 사용
    const minPhoto = count ? 24 : 0;
    const maxPhoto = count === 1 ? 185 : count >= 2 ? 145 : 0;

    const fits = () => {
      const footer = page.querySelector<HTMLElement>(
        ".cb-page-footer",
      );
      if (!footer) return false;

      const style = getComputedStyle(page);
      const bottom =
        page.getBoundingClientRect().bottom -
        parseFloat(style.paddingBottom);

      return (
        footer.getBoundingClientRect().bottom <= bottom + 0.5 &&
        page.scrollWidth <= page.clientWidth + 1
      );
    };

    let fitted = false;

    // 글자 크기는 최대한 유지하고 사진부터 조정
    for (let step = 0; step <= 6; step++) {
      const font = 11.5 - step * 0.25;
      const pad = 3 - step * 0.15;

      page.style.setProperty("--print-font", `${font}pt`);
      page.style.setProperty("--print-pad", `${pad}mm`);
      page.style.setProperty(
        "--print-photo",
        `${minPhoto}mm`,
      );

      if (!fits()) continue;

      // 남은 공간에 들어가는 최대 사진 높이 탐색
      let low = minPhoto;
      let high = maxPhoto;

      for (let i = 0; i < 12; i++) {
        const mid = (low + high) / 2;
        page.style.setProperty("--print-photo", `${mid}mm`);

        if (fits()) low = mid;
        else high = mid;
      }

      page.style.setProperty(
        "--print-photo",
        `${Math.max(minPhoto, low - 0.2).toFixed(2)}mm`,
      );

      // 사진 크기 결정 후 남는 공간을 표 여백에 분배
      let padLow = pad;
      let padHigh = 6;

      for (let i = 0; i < 10; i++) {
        const mid = (padLow + padHigh) / 2;
        page.style.setProperty("--print-pad", `${mid}mm`);

        if (fits()) padLow = mid;
        else padHigh = mid;
      }

      page.style.setProperty(
        "--print-pad",
        `${Math.max(pad, padLow - 0.05).toFixed(2)}mm`,
      );

      fitted = true;
      break;
    }

    if (!fitted) oversized.push(index + 1);
  });

  if (oversized.length) {
    throw new Error(
      `A4 한 장 분량 초과: ${oversized.join(", ")}쪽. 문안을 줄인 뒤 다시 출력하세요.`,
    );
  }
}
