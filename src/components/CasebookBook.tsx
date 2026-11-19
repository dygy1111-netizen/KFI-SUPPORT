import { Fragment, type ReactNode } from "react";
import type { CasebookCase } from "../lib/casebook";
import { planCasebook, TOC_SECTIONS_PER_PAGE, type PlannedPart, type PlannedSection } from "../lib/casebookBook";
import "./CasebookBook.css";
import { DEFAULT_BOOK_TEXT, bookTitle, type BookText } from "../lib/casebookBookText";

type Props = {items: CasebookCase[]; renderCase: (item: CasebookCase, page: number) => ReactNode; text?:BookText; frontMatterOnly?:boolean};
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
  const index=part.sections.findIndex(s=>s.key===section.key)+1;
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

export function CasebookBook({items,renderCase,text=DEFAULT_BOOK_TEXT,frontMatterOnly=false}:Props) {
  const plan=planCasebook(items);
  const {cover,toc,overview,colophon}=text;
  const title=bookTitle(text);
  const sectionText=(section:PlannedSection)=>({...section,...text.sections[section.key]});
  const entries=plan.parts.flatMap(p=>p.sections.map((s,i)=>({part:p,section:s,first:i===0})));
  return <>
    <article className="cb-a4-page kb-cover">
      <div className="kb-cover-inner">
        <div className="kb-cover-top"><span>{cover.label}</span><b>{cover.year}</b></div>
        <div className="kb-cover-main">
          <p className="kb-cover-year">{cover.year}년</p>
          <h1>{cover.title}<br/><strong>{cover.subtitle}</strong></h1>
          <div className="kb-cover-line"/>
          <p className="kb-cover-deck kb-edit-lines">{cover.deck}</p>
        </div>
        <div className="kb-cover-bottom"><div><b>{cover.organization}</b><span>{cover.department}</span></div><span>{cover.year}년 제작</span></div>
      </div>
    </article>
    {Array.from({length:plan.tocPages},(_,i)=><Sheet key={"toc-"+i} page={i+1} label={toc.title} className="kb-toc">
      <div className="kb-eyebrow">{title}</div><h1 className="kb-title">{toc.title}</h1>
      <div className="kb-toc-note">{items.length}건의 사례 · {toc.description}</div>
      {i===0&&<div className="kb-toc-overview"><b>{overview.title.replace(/\n/g," ")}</b><span>{plan.overviewPage}</span></div>}
      <div className="kb-toc-list">{entries.slice(i*TOC_SECTIONS_PER_PAGE,(i+1)*TOC_SECTIONS_PER_PAGE).map(({part,section,first},j)=><div key={section.key}>
        {(first||j===0)&&<div className="kb-toc-part"><b>{part.number}</b><span>{part.title}</span></div>}
        <div className="kb-toc-row"><span>{sectionText(section).title}</span><small>{section.cases.length}건</small><i/><b>{section.page}</b></div>
      </div>)}</div>
      {i===plan.tocPages-1&&<div className="kb-toc-overview"><b>{colophon.title}</b><span>{plan.finalPage}</span></div>}
    </Sheet>)}
    <Sheet page={plan.overviewPage} label="검사업무 개요">
      <div className="kb-eyebrow">사례집 안내</div><h1 className="kb-title kb-edit-lines">{overview.title}</h1>
      <p className="kb-lead">{overview.lead}</p><div className="kb-rule"/>
      <h2>제작 목적</h2><p className="kb-copy kb-edit-lines">{overview.purpose}</p>
      <h2>검사업무 체계</h2>
      <div className="kb-overview-grid">
        {overview.systems.map((system,i)=><div key={i}><b>{system.title}</b><p>{system.description}</p><small>{system.detail}</small></div>)}
      </div>
      <h2>사례집 활용</h2>
      <div className="kb-usage">{overview.usage.map((line,i)=><p key={i}>{line}</p>)}</div>
      <p className="kb-note kb-edit-lines">{overview.note}</p>
      <p className="kb-source kb-edit-lines">{overview.source}</p>
    </Sheet>
    {plan.parts.flatMap(part=>part.sections.flatMap(section=>[
      <Intro key={"intro-"+section.key} part={part} section={sectionText(section)}/>,
      ...(frontMatterOnly?[]:section.cases.map((item,i)=><Fragment key={"case-"+item.id}>{renderCase(item,section.page+i+1)}</Fragment>))
    ]))}
    <Sheet page={plan.finalPage} label={colophon.title} className="kb-colophon">
      <div className="kb-eyebrow">{title}</div><h1 className="kb-title">{colophon.title}</h1>
      <div className="kb-rule"/>
      <h2>{title}</h2>
      <dl><dt>제작년도</dt><dd>{cover.year}년</dd><dt>제작기관</dt><dd>{cover.organization}</dd><dt>담당부서</dt><dd>{cover.department}</dd><dt>수록 범위</dt><dd>{items.length}건</dd><dt>홈페이지</dt><dd>{colophon.website}</dd></dl>
      <p className="kb-note kb-edit-lines">{colophon.note}</p>
      <div className="kb-colophon-end">{cover.organization}<br/><b>{cover.department}</b></div>
    </Sheet>
  </>;
}
