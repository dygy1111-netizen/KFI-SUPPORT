import { Fragment, type ReactNode } from "react";
import type { CasebookCase } from "../lib/casebook";
import { planCasebook, TOC_SECTIONS_PER_PAGE, type PlannedPart, type PlannedSection } from "../lib/casebookBook";
import "./CasebookBook.css";

type Props = {items: CasebookCase[]; renderCase: (item: CasebookCase, page: number) => ReactNode};
function Running({page, label}: {page:number; label:string}) {
  return <footer className="kb-running"><span>한국소방산업기술원 · 위험물검사부</span><span>{label}</span><b>{String(page).padStart(2,"0")}</b></footer>;
}
function Sheet({children,page,label,className=""}: {children:ReactNode;page:number;label:string;className?:string}) {
  return <article className={"cb-a4-page kb-sheet "+className}>
    <div className="kb-body">{children}</div>
    <Running page={page} label={label}/>
  </article>;
}
function Flow({steps}: {steps:string[]}) {
  return <div className="kb-flow">{steps.map((step,i)=><div className="kb-flow-step" key={i}><b>{String(i+1).padStart(2,"0")}</b><span>{step}</span></div>)}</div>;
}
function Intro({part,section}: {part:PlannedPart;section:PlannedSection}) {
  const index=part.sections.indexOf(section)+1;
  return <Sheet page={section.page} label={part.title}>
    <div className="kb-intro-top"><div className="kb-eyebrow">{part.title}</div><div className="kb-section-no">{part.number}.{String(index).padStart(2,"0")}</div></div>
    <h1 className="kb-title">{section.title}</h1>
    <p className="kb-lead">{part.subtitle}</p>
    <div className="kb-rule"/>
    <h2>검사 개요</h2><p className="kb-copy">{section.summary}</p>
    <div className="kb-legal"><b>관련 근거</b><span>{section.basis}</span></div>
    <div className={section.procedure.length>0?"kb-intro-columns":"kb-intro-columns kb-intro-single"}>
      <section><h2>주요 확인사항</h2>
        <div className="kb-checks">{section.checks.map((check,i)=><div key={check}><b>{String(i+1).padStart(2,"0")}</b><span>{check}</span></div>)}</div>
      </section>
      {section.procedure.length>0 && <section><h2>업무 처리 흐름</h2><Flow steps={section.procedure}/></section>}
    </div>
    {section.procedure.length>0 && <p className="kb-note">절차는 업무 이해를 위한 요약이며, 세부 신청서류 및 시험항목은 해당 검사 안내 및 적용 기준 참고</p>}
    <div className="kb-section-count"><span>수록 사례</span><b>{section.cases.length}<small>건</small></b></div>
    <p className="kb-source">참고: 한국소방산업기술원 위험물정보시스템<br/>{section.source}</p>
  </Sheet>;
}

export function CasebookBook({items,renderCase}:Props) {
  const plan=planCasebook(items);
  const entries=plan.parts.flatMap(p=>p.sections.map((s,i)=>({part:p,section:s,first:i===0})));
  return <>
    <article className="cb-a4-page kb-cover">
      <div className="kb-cover-inner">
        <div className="kb-cover-top"><span>위험물 안전관리 기술자료</span><b>2026</b></div>
        <div className="kb-cover-main">
          <p className="kb-cover-year">2026년</p>
          <h1>위험물시설<br/><strong>품질관리 사례집</strong></h1>
          <div className="kb-cover-line"/>
          <p className="kb-cover-deck">검사 현장의 주요 지적 사례와<br/>개선조치 및 재발 방지대책</p>
        </div>
        <div className="kb-cover-bottom"><div><b>한국소방산업기술원</b><span>위험물검사부</span></div><span>2026년 제작</span></div>
      </div>
    </article>
    {Array.from({length:plan.tocPages},(_,i)=><Sheet key={"toc-"+i} page={i+1} label="목차" className="kb-toc">
      <div className="kb-eyebrow">2026년 위험물시설 품질관리 사례집</div><h1 className="kb-title">목차</h1>
      <div className="kb-toc-note">{items.length}건의 사례 · 검사별 개요 및 업무 처리 흐름</div>
      {i===0&&<div className="kb-toc-overview"><b>위험물안전관리 및 검사업무 개요</b><span>{plan.overviewPage}</span></div>}
      <div className="kb-toc-list">{entries.slice(i*TOC_SECTIONS_PER_PAGE,(i+1)*TOC_SECTIONS_PER_PAGE).map(({part,section,first},j)=><div key={section.key}>
        {(first||j===0)&&<div className="kb-toc-part"><b>{part.number}</b><span>{part.title}</span></div>}
        <div className="kb-toc-row"><span>{section.title}</span><small>{section.cases.length}건</small><i/><b>{section.page}</b></div>
      </div>)}</div>
      {i===plan.tocPages-1&&<div className="kb-toc-overview"><b>발간정보</b><span>{plan.finalPage}</span></div>}
    </Sheet>)}
    <Sheet page={plan.overviewPage} label="검사업무 개요">
      <div className="kb-eyebrow">사례집 안내</div><h1 className="kb-title">위험물안전관리 및<br/>검사업무 개요</h1>
      <p className="kb-lead">시설 및 제품의 전 과정에 걸친 안전성 확보</p><div className="kb-rule"/>
      <h2>제작 목적</h2><p className="kb-copy">위험물시설 및 제품의 검사 과정에서 확인된 주요 지적사항을 유형별로 정리하고, 적용 검사기준과 개선·예방대책을 공유하여 현장 품질관리 및 유사 결함의 재발 방지에 활용</p>
      <h2>검사업무 체계</h2>
      <div className="kb-overview-grid">
        <div><b>01 · 위험물탱크</b><p>설계 적합성 검토부터 제작·완공·사용 단계의 안전성 확인</p><small>기술검토 · 안전성능 · 완공 · 정기검사</small></div>
        <div><b>02 · 법정검사 제품</b><p>위험물 저장·운반용 제품의 법정 기준 적합성 확인</p><small>이중벽탱크 · 운반용기</small></div>
        <div><b>03 · 자율인증 제품</b><p>제품 형식 및 양산품의 구조·성능 적합성 확인</p><small>형식인증 · 성능검사</small></div>
      </div>
      <h2>사례집 활용</h2>
      <div className="kb-usage"><p>검사 전 · 해당 검사의 개요와 적용 기준 확인</p><p>검사 중 · 현장 사진과 결함 유형 비교</p><p>검사 후 · 개선조치 및 재발 방지대책 검토</p></div>
      <p className="kb-note">본 자료는 현장 활용을 위한 사례 중심 참고자료이며, 실제 적용 시 해당 시설·제품의 허가조건과 적용 법령·기술기준 확인 필요. 사례가 없는 검사 및 제품은 본문 수록에서 제외.</p>
      <p className="kb-source">참고: 한국소방산업기술원 위험물정보시스템 · https://hits.kfi.or.kr</p>
    </Sheet>
    {plan.parts.flatMap(part=>part.sections.flatMap(section=>[
      <Intro key={"intro-"+section.key} part={part} section={section}/>,
      ...section.cases.map((item,i)=><Fragment key={"case-"+item.id}>{renderCase(item,section.page+i+1)}</Fragment>)
    ]))}
    <Sheet page={plan.finalPage} label="발간정보" className="kb-colophon">
      <div className="kb-eyebrow">2026년 위험물시설 품질관리 사례집</div><h1 className="kb-title">발간정보</h1>
      <div className="kb-rule"/>
      <h2>2026년 위험물시설 품질관리 사례집</h2>
      <dl><dt>제작년도</dt><dd>2026년</dd><dt>제작기관</dt><dd>한국소방산업기술원</dd><dt>담당부서</dt><dd>위험물검사부</dd><dt>수록 범위</dt><dd>{items.length}건</dd><dt>홈페이지</dt><dd>https://www.kfi.or.kr</dd></dl>
      <p className="kb-note">위험물시설 및 제품의 검사 품질 향상을 위한 참고자료. 실제 검사 및 조치 시 적용되는 법령·기술기준을 우선 확인하시기 바랍니다.</p>
      <div className="kb-colophon-end">한국소방산업기술원<br/><b>위험물검사부</b></div>
    </Sheet>
  </>;
}
