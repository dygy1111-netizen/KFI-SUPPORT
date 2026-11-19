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

// Presentation-only grouping: the stored inspection category, test item, and case
// number remain unchanged. Fixed orders follow the equipment from roof to base
// and then associated installations, or product structure to functional tests.
type TopicRule = { label: string; match: RegExp };
const topic = (label: string, match: RegExp): TopicRule => ({label,match});
const TANK_TOPICS = [
  topic("지붕", /지붕|루프|roof|부상지붕|통기관|화염방지|인화방지망|비상압력배출|대기밸브/i),
  topic("옆판", /옆판|측판|측벽|shell|보온재/i),
  topic("밑판", /밑판|바닥판|저판|annular|애뉼러|환상판/i),
  topic("기초", /기초|지반|침하|전기방식|전위측정/i),
  topic("비파괴시험", /비파괴|용접부.*(?:결함|균열)|침투탐상|자분탐상|방사선투과|초음파탐상/i),
  topic("계단·사다리", /계단|사다리|난간/),
  topic("부속설비", /부속설비|액면계|레벨게이지|압력게이지|배관|밸브/),
  topic("방유제", /방유제|방유턱|간막이둑|배수관/),
  topic("펌프설비", /펌프설비|펌프실|펌프/),
  topic("소화설비", /소화설비|소화전|물분무|폼미형성|폼형성|소방배관/),
  topic("피뢰설비 및 접지시설", /피뢰|접지/),
  topic("표지 및 게시판", /표지|게시판|표시사항/),
  topic("위치·구조 및 설비", /위치|구조|설비|보유공지/),
];
const PRODUCT_TOPICS = [
  topic("구조", /^(?:일반)?구조|형식|구조검사/),
  topic("외관", /외관|외부상태/),
  topic("표시사항", /표시사항|표시검사|표지/),
  topic("두께 및 재료", /^(?:재료|두께측정|판두께|강판두께)/),
  topic("비파괴시험", /비파괴|침투탐상|자분탐상|방사선투과|초음파탐상|용접부검사/),
  topic("도막두께시험", /도막|도장두께/),
  topic("낙하시험", /낙하/),
  topic("기밀·누설시험", /기밀|누설시험|누수시험/),
  topic("수압·내압시험", /수압|내압|압력시험|파열압력/),
  topic("작동·성능시험", /작동|성능|감지센서|개폐|유량|유속|방출/),
];

// Only very clear titles may repair the *display grouping* of a mislabeled
// record. For example, a roof seal is not a nondestructive test.
const TANK_TITLE_OVERRIDES = [
  topic("피뢰설비 및 접지시설", /접지저항|피뢰설비|탱크접지/),
  topic("소화설비", /^폼(?:미형성|형성불량)$|^(?:포|고정포)?소화설비|^물분무설비|^보조포소화전/),
  topic("지붕", /(?:외부|내부)?부상지붕.*(?:실링|실미설치|실파손|씰|seal)/i),
];
const OTHER_SUBTOPICS: TopicRule[] = [];
const SUBTOPICS: Record<string, TopicRule[]> = {
  "지붕": [
    topic("지붕판", /지붕판|두께|천공|관통결함|지붕부적합/),
    topic("부상지붕·실링", /부상지붕|림부분|실링|실미설치|실파손|씰|seal/i),
    topic("통기관·안전장치", /통기관|인화방지망|화염방지|대기밸브|비상압력배출/),
  ],
  "옆판": [
    topic("옆판·부식", /두께|부식|도장|보온재|실링/),
    topic("개구부·플랜지", /개구부|플랜지|노즐/),
    topic("연결부", /연결|용접부|사다리/),
  ],
  "밑판": [topic("부식·두께·관통결함", /두께|부식|관통/)],
  "기초": [topic("전기방식", /전기방식|전위측정/)],
  "비파괴시험": [
    topic("개구부", /개구부|노즐/),
    topic("옆판·밑판 용접부", /옆판|밑판|바닥판/),
    topic("결함", /결함|균열/),
    topic("시험 누락", /누락|미실시/),
  ],
  "방유제": [
    topic("구조·파손", /파손|균열|높이|바닥|이음부/),
    topic("관통배관·마감", /관통|마감|실링|막음/),
    topic("배수·개폐밸브", /개폐밸브|배수관|배수설비/),
    topic("존치물", /존치|미허가|허가받지/),
  ],
  "소화설비": [
    topic("고정포·포소화설비", /고정포|포소화설비|폼|포소화약제탱크/),
    topic("보조포소화전", /보조포소화전/),
    topic("물분무설비", /물분무/),
  ],
  "펌프설비": [
    topic("누설", /누설|누수|seal/i),
    topic("방유턱·설치", /방유턱|펌프실|턱|존치/),
  ],
  "피뢰설비 및 접지시설": [
    topic("접지저항", /접지저항|탱크접지|피뢰설비/),
  ],
  "구조": [
    topic("형식 불일치", /불일치|형식/),
    topic("안전장치", /안전변|안전장치/),
    topic("연결·작동", /가스켓|개폐|표시기/),
  ],
  "외관": [
    topic("파렛트", /파렛트|팔레트|파레트/),
    topic("보호구조", /상부틀|핸드레일|보호틀/),
    topic("부식·도장", /부식|도장/),
    topic("용접부", /용접부/),
  ],
};
const cleanTopic = (s?: string | null) => (s ?? "").trim().replace(/\s+/g,"");
function topicIndex(rules: TopicRule[], value: string) {
  return rules.findIndex(rule => rule.match.test(value));
}
function topicOrder(item: CasebookCase) {
  const sectionKey=bookSectionKey(item.inspection_type);
  const tank=["safety","precision","interim","completion"].includes(sectionKey);
  const rules=tank ? TANK_TOPICS : PRODUCT_TOPICS;
  const title=cleanTopic(item.title);
  const testItem=cleanTopic(item.test_item);
  const facilityTopic=cleanTopic(item.facility?.split("·").slice(1).join("·"));
  const registeredTopic=testItem||facilityTopic;
  // Match specific items before broad "설비" or "배관" patterns.
  const exact=rules.findIndex(rule=>cleanTopic(rule.label)===registeredTopic);
  // Prefer a specific registered area/test over an incidental word in the title.
  const preciseRules=rules.filter(rule=>rule.label!=="위치·구조 및 설비");
  const specific=preciseRules.find(rule=>rule.match.test(registeredTopic));
  let idx=exact>=0?exact:specific?rules.indexOf(specific):-1;
  if(idx<0 && facilityTopic){
    const fromFacility=preciseRules.find(rule=>rule.match.test(facilityTopic));
    if(fromFacility)idx=rules.indexOf(fromFacility);
  }
  if(tank){
    const explicit=TANK_TITLE_OVERRIDES.find(rule=>rule.match.test(title));
    // Only override an unresolved or demonstrably inconsistent legacy grouping.
    if(explicit && (idx<0 || rules[idx].label==="위치·구조 및 설비" ||
      (explicit.label==="지붕" && rules[idx].label==="비파괴시험") ||
      (explicit.label==="피뢰설비 및 접지시설" && ["지붕","옆판","기초","부속설비"].includes(rules[idx].label)))){
      idx=rules.findIndex(rule=>rule.label===explicit.label);
    }
  }
  if(idx<0)idx=topicIndex(rules,title);
  if(idx<0)idx=topicIndex(rules,registeredTopic);
  const label=idx<0?(registeredTopic||"기타"):rules[idx].label;
  const subRules=SUBTOPICS[label]??OTHER_SUBTOPICS;
  const subIndex=topicIndex(subRules,title);
  return {
    rank: idx<0?rules.length:idx,
    label,
    subRank:subIndex<0?subRules.length:subIndex,
  };
}

export function bookCompare(a: CasebookCase, b: CasebookCase): number {
  const keys = BOOK_PARTS.flatMap(p => p.sections.map(s => s.key));
  const rank = (x: CasebookCase) => { const i = keys.indexOf(bookSectionKey(x.inspection_type)); return i < 0 ? keys.length : i; };
  const aSection=bookSectionKey(a.inspection_type),bSection=bookSectionKey(b.inspection_type);
  const sectionDifference=rank(a)-rank(b)||aSection.localeCompare(bSection,"ko");
  if(sectionDifference)return sectionDifference;
  const x=topicOrder(a),y=topicOrder(b);
  return x.rank-y.rank || x.label.localeCompare(y.label,"ko") ||
    x.subRank-y.subRank ||
    a.case_no-b.case_no || a.sort_order-b.sort_order || a.id-b.id;
}

// The same comparator is used after every load, edit and filter. Group headings
// expose the actual display classification without rewriting stored legal fields.
export function groupCasebookCases(items: CasebookCase[]) {
  const groups: {key:string; inspection:string; topic:string; items:CasebookCase[]}[]=[];
  for(const item of [...items].sort(bookCompare)){
    const sectionKey=bookSectionKey(item.inspection_type);
    const topic=topicOrder(item).label;
    const key=sectionKey+"::"+topic;
    const last=groups[groups.length-1];
    if(last?.key===key)last.items.push(item);
    else groups.push({key,inspection:BOOK_PARTS.flatMap(p=>p.sections).find(s=>s.key===sectionKey)?.title??item.inspection_type,topic,items:[item]});
  }
  return groups;
}

// Keep expanded table-of-contents type readable even when all 13 categories are present.
export const TOC_SECTIONS_PER_PAGE = 12;
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
  // Cover unnumbered; TOC page 1, overview page 2. Split TOC at twelve sections.
  const entries = parts.flatMap(p => p.sections);
  const tocPages = Math.max(1, Math.ceil(entries.length / TOC_SECTIONS_PER_PAGE));
  let page = tocPages + 2;
  for(const p of parts) for(const s of p.sections) { s.page=page; page+=1+s.cases.length; }
  return {parts, tocPages, overviewPage:tocPages+1, finalPage:page, total:items.length, unknown, empty:BOOK_PARTS.flatMap(p=>p.sections).filter(s=>!sorted.some(i=>bookSectionKey(i.inspection_type)===s.key)).map(s=>s.title)};
}
