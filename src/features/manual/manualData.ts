export const MANUAL_REPO_RAW =
  "https://raw.githubusercontent.com/dygy1111-netizen/kfi_manual/main";

export const manualSections: Record<string, string[]> = {
  "1. 위험물탱크 위치, 구조 및 설비의 기준": [
    "1.1 안전거리",
    "1.2 보유공지",
    "1.3 표지 및 게시판",
    "1.4-1 탱크 내부 압력 해소 구조",
    "1.4-2 탱크 부식방지 설비",
    "1.4-3 통기관",
    "1.4-4 자동계량식 유량계",
    "1.4-5 주입구",
    "1.4-6 펌프설비",
    "1.4-7 배관 및 밸브",
    "1.4-8 부상지붕탱크의 설비",
    "1.4-9 전기설비",
    "1.4-10 부속설비",
    "1.5 방유제",
    "1.6 옥외탱크저장소의 특례",
    "1.7 소화설비",
    "1.8 경보설비",
  ],
  "2. 안전성능검사": [
    "2.1 안전성능검사 준비 및 확인사항",
    "2.2 밑판(애뉼러판)",
    "2.3 옆판",
    "2.4 개구부",
    "2.5 충수시험",
    "2.6 구형탱크 및 기타 형상의 탱크",
  ],
  "3. 정기검사": [
    "3.1 정기검사 준비 및 확인사항",
    "3.2 두께측정시험",
    "3.3 자기탐상시험",
    "3.4 수직수평도시험",
    "3.5 외관검사",
  ],
  "4. 부록": [
    "물분무설비 설치기준",
    "부상지붕탱크 구조",
    "내부부상지붕탱크 구조",
    "전기방식설비",
    "위험물제조소등 접지저항기준(소방청 협의사항)",
    "포소화설비 설치기준",
    "자기탐상시험 시험방법 및 판정기준",
    "침투탐상시험 시험방법 및 판정기준",
    "영상초음파탐상시험 시험방법 및 판정기준",
  ],
};

export const manualTitles = Object.values(manualSections).flat();

export const manualImageFiles = [
  "1.1_안전거리_봇.png",
  "1.2_보유공지.png",
  "1.3_표지_및_게시판.png",
  "1.4-1_탱크_내부_압력_해소_구조_비상압력배출장치.png",
  "1.4-2_탱크_부식방지_설비.png",
  "1.4-3_통기관_대기밸브부착_통기관.png",
  "1.4-3_통기관_밸브없는_통기관.png",
  "1.4-4_자동계량식_유량계.png",
  "1.4-5_주입구.png",
  "1.4-5_주입구_접지설비.png",
  "1.4-5_주입구_주입구게시판.png",
  "1.4-6_펌프설비.png",
  "1.4-6_펌프설비_펌프설비 게시판.png",
  "1.4-6_펌프설비_펌프설비 구조.png",
  "1.4-6_펌프설비_펌프실 환기설비.png",
  "1.4-7_배관_및_밸브_배수관.png",
  "1.4-8_부상지붕탱크의_설비.png",
  "1.4-9_전기설비.png",
  "1.5_방유제_용량산정.png",
  "1.5_방유제_이중방유제.png",
  "1.7_소화설비_펌프방식.png",
  "2.2_밑판(애뉼러판)_1.애뉼러판 없는 경우(열영향부포함).jpg",
  "2.2_밑판(애뉼러판)_2.애뉼러판 있는 경우(열영향부포함).jpg",
  "2.2_밑판(애뉼러판)_3.섬프 검사범위.jpg",
  "2.3_옆판_PAUT부위도.jpg",
  "2.4_개구부_검사부위.jpg",
  "3.2_두께측정시험.jpg",
  "3.3_자기탐상시험.jpg",
  "3.4_수직수평도시험.jpg",
  "3.4_수직수평도시험_단별측정.jpg",
  "내부부상지붕탱크_구조.png",
  "부상지붕탱크_구조_더블데크.png",
  "부상지붕탱크_구조_싱글데크.png",
  "영상초음파탐상시험_시험방법_및_판정기준.jpg",
];

export function safeManualName(title: string) {
  return title.replaceAll(" ", "_").replaceAll("/", "_");
}

export function manualContentUrl(title: string) {
  return `${MANUAL_REPO_RAW}/contents/${encodeURIComponent(
    `${safeManualName(title)}.md`,
  )}`;
}

export function manualImageUrl(fileName: string) {
  return `${MANUAL_REPO_RAW}/images/${encodeURIComponent(fileName)}`;
}

export function imagesForManual(title: string) {
  const prefix = safeManualName(title);
  return manualImageFiles.filter(
    (name) =>
      name === `${prefix}.png` ||
      name === `${prefix}.jpg` ||
      name === `${prefix}.jpeg` ||
      name === `${prefix}.webp` ||
      name.startsWith(`${prefix}_`),
  );
}
