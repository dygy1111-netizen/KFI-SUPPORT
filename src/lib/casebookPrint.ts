/** Fit each case independently, keeping readable text and uncropped photographs. */
export async function prepareCasebookPrint(pages: HTMLElement[]) {
  await document.fonts.ready;
  await Promise.all(pages.flatMap(page => Array.from(page.querySelectorAll('img')).map(async img => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([img.decode(), new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('사진을 불러오지 못했습니다. 다시 시도해 주세요.')), 10000);
      })]);
    } finally { clearTimeout(timer); }
  })));
  const oversized: number[] = [];
  pages.forEach((page, index) => {
    const fits = () => {
      const footer = page.querySelector<HTMLElement>('.cb-page-footer')!;
      const bottom = page.getBoundingClientRect().bottom - parseFloat(getComputedStyle(page).paddingBottom);
      return footer.getBoundingClientRect().bottom <= bottom + 0.5 && page.scrollWidth <= page.clientWidth;
    };
    // Reduce photograph space first, then type and cell spacing, never below 10pt.
    for (let step = 0; step <= 12; step++) {
      page.style.setProperty('--print-photo', `${68 - Math.min(step, 8) * 3.5}mm`);
      page.style.setProperty('--print-font', `${11.5 - Math.max(0, step - 6) * 0.25}pt`);
      page.style.setProperty('--print-pad', `${3 - Math.max(0, step - 6) * 0.15}mm`);
      if (fits()) return;
    }
    oversized.push(index + 1);
  });
  if (oversized.length) throw new Error(`A4 한 장 분량 초과: ${oversized.join(', ')}쪽. 문안을 줄인 뒤 다시 출력하세요.`);
}
