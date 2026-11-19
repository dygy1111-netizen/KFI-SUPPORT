import type { CasebookCase } from "./casebook";

export type BookSection = {
  key: string;
  title: string;
  aliases: string[];
  summary: string;
  basis: string;
  checks: string[];
  procedure: string[];
  source: string;
};
export type BookPart = { number: string; title: string; subtitle: string; sections: BookSection[] };
const facilitySource = "https://hits.kfi.or.kr/dgst/main/contents.do?menuNo=700034";
const productSource = "https://hits.kfi.or.kr/dgst/main/contents.do?menuNo=700035";
const transportSource = "https://hits.kfi.or.kr/dgst/main/contents.do?menuNo=700036";
const certificationBasis = "위험물시설 및 제품의 성능 등에 관한 규칙 제25조·제38조";
const productProcedure = ["형식인증 신청", "설계·구조 검토 및 시험", "형식인증", "양산품 성능검사", "검사 결과 통보"];
const section = (key: string, title: string, aliases: string[], summary: string, basis: string, checks: string[], procedure: string[], source: string): BookSection =>
  ({ key, title, aliases: [title, ...aliases], summary, basis, checks, procedure, source });
const product = (key: string, title: string, aliases: string[], summary: string, checks: string[]) =>
  section(key, title, aliases, summary, certificationBasis, checks, productProcedure, productSource);

export const BOOK_PARTS: BookPart[] = [
  { number: "01", title: "위험물탱크", subtitle: "시설의 제작·사용·완공 단계별 안전성 확인", sections: [
    section("safety", "안전성능검사", ["탱크 안전성능검사"], "신규 제작 및 구조변경 과정에서 저장탱크의 기초와 본체가 요구되는 안전성능을 갖추었는지 확인", "위험물안전관리법 제8조", ["기초·지반의 적합성", "용접부의 품질", "충수·수압 등 해당 시험"], ["검사 신청", "허가·설계자료 검토", "제작·시공 단계 검사", "적합 여부 확인", "결과 통보"], facilitySource),
    section("precision", "정밀정기검사", ["탱크 정밀정기검사"], "사용 중인 옥외저장탱크의 구조 및 설비 안전성을 정밀하게 확인", "위험물안전관리법 제18조 및 같은 법 시행규칙 제70조", ["탱크 본체의 상태 및 보수이력", "부식·손상 등 구조안전 상태", "부속설비의 유지관리 상태"], ["정기검사 신청", "도면·점검자료 검토", "현장 정밀검사", "결함 확인 및 적합 여부 판정", "결과 통보"], facilitySource),
    section("interim", "중간정기검사", ["탱크 중간정기검사"], "사용 중인 옥외저장탱크의 외관과 구조·설비 상태를 정기적으로 확인", "위험물안전관리법 제18조 및 같은 법 시행규칙 제70조", ["외관·부식·변형 상태", "부속설비 작동 및 관리 상태", "보수·점검이력"], ["정기검사 신청", "관련 자료 검토", "현장 확인", "결함 판정", "결과 통보"], facilitySource),
    section("completion", "완공검사", ["탱크 완공검사", "옥외탱크저장소 완공검사"], "설치가 완료된 탱크의 위치·구조·설비가 허가 및 적용 기술기준에 적합한지 확인", "위험물안전관리법 제9조", ["탱크·방유제·배관 등 설치 상태", "소화설비 및 전기설비", "설계도서 및 시험성적서"], ["완공검사 신청", "허가·시험자료 검토", "설치 상태 현장검사", "적합 여부 확인", "결과 통보"], facilitySource),
  ]},
  { number: "02", title: "법정검사 제품", subtitle: "저장·운반에 사용되는 제품의 안전성능 확인", sections: [
    section("doublewall", "이중벽탱크", ["이중벽 탱크"], "이중벽 구조의 위험물 저장탱크에 대해 적용 기준에 따른 형식 및 성능을 확인", "위험물안전관리법령 및 해당 제품의 기술기준", ["탱크 구조 및 재료", "내·외벽의 건전성 및 기밀성", "누설 확인 기능과 표시"], ["신청", "구조·설계자료 검토", "적용 기준에 따른 시험·검사", "적합 여부 확인", "결과 통보"], "https://hits.kfi.or.kr"),
    section("container", "운반용기", ["위험물운반용기", "위험물 운반용기"], "위험물 운반용기의 구조와 성능 및 사용 중 성능 유지 여부를 확인", "위험물안전관리법 제20조 및 같은 법 시행규칙 제51조", ["용기 구조·재료 및 표시", "용기별 적용 성능시험", "정기성능검사 대상의 유지 상태"], ["신청", "설계·구조자료 검토", "해당 성능 또는 정기성능검사", "적합 여부 판정", "결과 통보"], transportSource),
  ]},
  { number: "03", title: "자율인증 제품", subtitle: "형식인증 및 양산품의 성능 적합성 확인", sections: [
    product("breather", "통기관대기밸브", ["통기관 대기밸브", "통기밸브"], "저장탱크의 압력 변화에 대응하는 통기관대기밸브의 설계·구조·성능을 확인", ["구조와 재료", "압력에 따른 개폐 특성", "기밀성 및 작동 상태"]),
    product("emergency", "비상압력배출장치", ["비상 압력 배출장치"], "비상 압력 상승에 대응하는 배출장치의 구조 및 작동 성능을 확인", ["배출부 구조", "설정 압력 및 작동 특성", "장치의 건전성"]),
    product("foamchamber", "폼챔버", ["폼 챔버"], "저장탱크에 포를 공급하는 장치의 구조와 성능을 확인", ["포 방출부 및 연결부", "포 방출 성능", "기밀·구조 상태"]),
    product("indicator", "위치표시형밸브", ["위치표시밸브", "위치 표시형 밸브"], "밸브의 개폐 위치 표시와 작동 기능이 적용 기준에 적합한지 확인", ["개폐 작동", "위치 표시 기능", "구조 및 연결 상태"]),
    product("foamtank", "포소화약제탱크", ["포소화약제 탱크"], "포소화약제를 저장·공급하는 탱크의 구조 및 성능을 확인", ["재료 및 탱크 구조", "압력·기밀 등 적용 시험", "접속부와 부속설비"]),
    product("leak", "누설감지설비", ["누설감지장치", "누설 감지 설비"], "위험물 누설을 감지하는 설비의 구조와 감지·신호 기능을 확인", ["감지부 상태", "감지 및 경보 기능", "연결부와 설치 조건"]),
    product("agitator", "교반기", [], "위험물의 혼합 등에 사용되는 교반기의 구조와 작동 성능을 확인", ["용접부 및 재료 상태", "회전·작동 상태", "누설 방지 및 연결부"]),
  ]},
];

const normalize = (value: string) => value.trim().replace(/\s+/g, "");
export function bookSectionKey(value: string): string {
  const v = normalize(value);
  return BOOK_PARTS.flatMap(p => p.sections).find(s => s.aliases.some(a => normalize(a) === v))?.key ?? "other:" + v;
}

export function bookCompare(a: CasebookCase, b: CasebookCase): number {
  const keys = BOOK_PARTS.flatMap(p => p.sections.map(s => s.key));
  const rank = (x: CasebookCase) => { const i = keys.indexOf(bookSectionKey(x.inspection_type)); return i < 0 ? keys.length : i; };
  return rank(a) - rank(b) || a.case_no - b.case_no || a.sort_order - b.sort_order || a.id - b.id;
}

export type PlannedSection = BookSection & { cases: CasebookCase[]; page: number };
export type PlannedPart = Omit<BookPart, "sections"> & { sections: PlannedSection[] };
export function planCasebook(items: CasebookCase[]) {
  const sorted = [...items].sort(bookCompare);
  const parts: PlannedPart[] = BOOK_PARTS.map(p => ({...p, sections: p.sections.map(s => ({...s, cases: sorted.filter(i => bookSectionKey(i.inspection_type) === s.key), page: 0})).filter(s => s.cases.length)})).filter(p => p.sections.length);
  const unknown = sorted.filter(i => bookSectionKey(i.inspection_type).startsWith("other:"));
  if (unknown.length) {
    const names = [...new Set(unknown.map(i => i.inspection_type.trim()))];
    parts.push({number:"04",title:"기타 분류",subtitle:"검사구분 확인이 필요한 사례",sections:names.map((name,i)=>({...section("other:"+i,name || "미분류",[],"기존 검사구분을 유지하여 누락 없이 수록","해당 사례의 검사기준 참고",["사례별 적용 기준 및 등록된 검사구분 확인"],[],facilitySource),cases:unknown.filter(x=>x.inspection_type.trim()===name),page:0}))});
  }
  // Cover unnumbered; TOC page 1, overview page 2. Split TOC at 15 sections.
  const entries = parts.flatMap(p => p.sections);
  const tocPages = Math.max(1, Math.ceil(entries.length / 15));
  let page = tocPages + 2;
  for(const p of parts) for(const s of p.sections) { s.page=page; page+=1+s.cases.length; }
  return {parts, tocPages, overviewPage:tocPages+1, finalPage:page, total:items.length, unknown, empty:BOOK_PARTS.flatMap(p=>p.sections).filter(s=>!sorted.some(i=>bookSectionKey(i.inspection_type)===s.key)).map(s=>s.title)};
}
