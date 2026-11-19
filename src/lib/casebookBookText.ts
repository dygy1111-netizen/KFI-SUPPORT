import { BOOK_PARTS, type BookSection } from "./casebookBook";

export type SectionText = Pick<BookSection,"title"|"summary"|"basis"|"checks"|"procedure"|"source">;
export type BookText = {
  cover: {label:string; year:string; title:string; subtitle:string; deck:string; organization:string; department:string};
  toc: {title:string; description:string};
  overview: {title:string; lead:string; purpose:string; systems:{title:string;description:string;detail:string}[]; usage:string[]; note:string; source:string};
  colophon: {title:string; website:string; note:string};
  sections: Record<string,SectionText>;
};
export const DEFAULT_BOOK_TEXT: BookText = {
  cover:{label:"위험물 안전관리 기술자료",year:"2026",title:"위험물시설",subtitle:"품질관리 사례집",deck:"검사 현장의 주요 지적 사례와\n개선조치 및 재발 방지대책",organization:"한국소방산업기술원",department:"위험물검사부"},
  toc:{title:"목차",description:"검사별 개요 및 업무 처리 흐름"},
  overview:{
    title:"위험물안전관리 및\n검사업무 개요",lead:"시설 및 제품의 전 과정에 걸친 안전성 확보",
    purpose:"위험물시설 및 제품의 검사 과정에서 확인된 주요 지적사항을 유형별로 정리하고, 적용 검사기준과 개선·예방대책을 공유하여 현장 품질관리 및 유사 결함의 재발 방지에 활용",
    systems:[
      {title:"01 · 위험물탱크",description:"설계 적합성 검토부터 제작·완공·사용 단계의 안전성 확인",detail:"기술검토 · 안전성능 · 완공 · 정기검사"},
      {title:"02 · 법정검사 제품",description:"위험물 저장·운반용 제품의 법정 기준 적합성 확인",detail:"이중벽탱크 · 운반용기"},
      {title:"03 · 자율인증 제품",description:"제품 형식 및 양산품의 구조·성능 적합성 확인",detail:"형식인증 · 성능검사"}],
    usage:["검사 전 · 해당 검사의 개요와 적용 기준 확인","검사 중 · 현장 사진과 결함 유형 비교","검사 후 · 개선조치 및 재발 방지대책 검토"],
    note:"본 자료는 현장 활용을 위한 사례 중심 참고자료이며, 실제 적용 시 해당 시설·제품의 허가조건과 적용 법령·기술기준 확인 필요. 사례가 없는 검사 및 제품은 본문 수록에서 제외.",
    source:"참고: 한국소방산업기술원 위험물정보시스템 · https://hits.kfi.or.kr"
  },
  colophon:{title:"발간정보",website:"https://www.kfi.or.kr",note:"위험물시설 및 제품의 검사 품질 향상을 위한 참고자료. 실제 검사 및 조치 시 적용되는 법령·기술기준을 우선 확인하시기 바랍니다."},
  sections:Object.fromEntries(BOOK_PARTS.flatMap(p=>p.sections).map(({key,title,summary,basis,checks,procedure,source})=>[key,{title,summary,basis,checks,procedure,source}]))
};
const object=(value:unknown):Record<string,unknown> => value && typeof value==="object" && !Array.isArray(value) ? value as Record<string,unknown> : {};
function mergeDefaults<T>(defaults:T,value:unknown):T{
  if(typeof defaults==="string")return (typeof value==="string"?value:defaults) as T;
  if(Array.isArray(defaults)){
    if(!Array.isArray(value))return defaults;
    if(defaults.length && typeof defaults[0]==="string")return value.filter(x=>typeof x==="string") as T;
    return defaults.map((d,i)=>mergeDefaults(d,value[i])) as T;
  }
  if(defaults && typeof defaults==="object"){
    const v=object(value);
    return Object.fromEntries(Object.entries(defaults).map(([key,d])=>[key,mergeDefaults(d,v[key])])) as T;
  }
  return defaults;
}
export const parseBookText=(value:unknown):BookText=>mergeDefaults(DEFAULT_BOOK_TEXT,value);
export const bookTitle=(text:BookText)=>text.cover.year+"년 "+text.cover.title+" "+text.cover.subtitle;
export function validateBookText(text:BookText){
  const errors:string[]=[];
  if(!/^\d{4}$/.test(text.cover.year))errors.push("제작년도는 네 자리 숫자로 입력하세요.");
  for(const key of ["label","title","subtitle","organization","department"] as const)if(!text.cover[key].trim())errors.push("표지 필수 문구를 입력하세요: "+key);
  for(const [key,s] of Object.entries(text.sections)){
    if(!s.title.trim())errors.push(key+" 검사명은 필수입니다.");
    if(s.checks.length>6||s.procedure.length>8)errors.push(s.title+" 확인사항은 6개, 절차는 8단계까지 입력하세요.");
  }
  if(JSON.stringify(text).length>45000)errors.push("전체 편집 문안이 너무 깁니다.");
  return errors;
}
