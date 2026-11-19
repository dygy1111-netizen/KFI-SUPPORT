import { useEffect, useState } from "react";
import { BOOK_PARTS } from "../lib/casebookBook";
import { DEFAULT_BOOK_TEXT, parseBookText, validateBookText, type BookText } from "../lib/casebookBookText";
import { loadBookText, saveBookText } from "../lib/casebookBookTextStore";
import type { CasebookCase } from "../lib/casebook";
import { CasebookBook } from "./CasebookBook";

function Field({label,value,change,lines=1}:{label:string;value:string;change:(s:string)=>void;lines?:number}){
  return <label className="kb-edit-field"><span>{label}</span>{lines===1?<input value={value} onChange={e=>change(e.target.value)}/>:<textarea rows={lines} value={value} onChange={e=>change(e.target.value)}/>}</label>;
}
export function CasebookTextEditor({items,onClose}:{items:CasebookCase[];onClose:()=>void}){
  const [text,setText]=useState<BookText>(parseBookText(null));
  const [revision,setRevision]=useState("");
  const [tab,setTab]=useState("cover");
  const [sectionKey,setSectionKey]=useState(BOOK_PARTS[0].sections[0].key);
  const [busy,setBusy]=useState(true);
  const [dirty,setDirty]=useState(false);
  const [preview,setPreview]=useState(false);
  const [message,setMessage]=useState("");
  const [failed,setFailed]=useState(false);
  const sections=BOOK_PARTS.flatMap(p=>p.sections);
  const patch=(next:BookText)=>{setText(next);setDirty(true);setMessage("");};
  const reload=async()=>{setBusy(true);setFailed(false);try{const result=await loadBookText();setText(result.text);setRevision(result.revision);setDirty(false);setMessage("");}catch(e){setFailed(true);setMessage(e instanceof Error?e.message:String(e));}finally{setBusy(false);}};
  useEffect(()=>{void reload();},[]);
  const close=()=>{if(!dirty||confirm("저장하지 않은 수정 내용을 닫으시겠습니까?"))onClose();};
  const save=async()=>{setBusy(true);setFailed(false);try{const errors=validateBookText(text);if(errors.length)throw new Error(errors.join("\n"));setRevision(await saveBookText(text,revision));setDirty(false);setMessage("저장 완료. 다음 PDF 출력부터 반영됩니다.");}catch(e){setFailed(true);setMessage(e instanceof Error?e.message:String(e));}finally{setBusy(false);}};
  const lines=(value:string)=>value.split("\n");
  const se=text.sections[sectionKey];
  const sectionField=(key:keyof typeof se,value:string|string[])=>patch({...text,sections:{...text.sections,[sectionKey]:{...se,[key]:value}}});
  const coverLabels={label:"상단 문구",year:"제작년도 (숫자 4자리)",title:"제목 첫 줄",subtitle:"제목 둘째 줄",deck:"표지 설명",organization:"제작기관",department:"담당부서"};
  return <div className="kb-editor-backdrop" role="dialog" aria-modal="true" aria-label="사례집 구성 편집"><div className="kb-editor">
    <header><div><h2>사례집 구성 편집</h2><p>저장한 내용은 표지·목차·개요·발간정보에 함께 적용됩니다.</p></div><button className="secondary-button" onClick={close}>닫기 ×</button></header>
    <nav aria-label="편집 항목">{[["cover","표지"],["toc","목차"],["overview","전체 개요"],["section","검사별 개요"],["colophon","발간정보"]].map(([k,label])=><button key={k} type="button" aria-pressed={tab===k} onClick={()=>setTab(k)}>{label}</button>)}</nav>
    <div className="kb-edit-tools"><button className="secondary-button" disabled={busy} onClick={()=>{if(!dirty||confirm("저장하지 않은 문안을 버리고 다시 불러올까요?"))void reload();}}>다시 불러오기</button><button className="secondary-button" disabled={busy||!revision} onClick={()=>{if(confirm("기본 문안으로 초기화할까요? 저장 전까지 기존 설정은 유지됩니다."))patch(parseBookText(DEFAULT_BOOK_TEXT));}}>기본값 복원</button><button className="secondary-button" onClick={()=>setPreview(!preview)}>{preview?"미리보기 닫기":"전체 구성 미리보기"}</button><button className="primary-button" disabled={busy||!revision||!dirty} onClick={()=>void save()}>저장</button></div>
    {message&&<p role="status" className={failed?"kb-edit-error":"kb-edit-success"}>{message}</p>}
    {!revision?<p>{busy?"설정을 불러오는 중입니다.":"설정을 불러오지 못했습니다. 다시 불러오기를 눌러 주세요."}</p>:<div className="kb-edit-fields">
      {tab==="cover"&&(Object.keys(coverLabels) as (keyof typeof coverLabels)[]).map(key=><Field key={key} label={coverLabels[key]} value={text.cover[key]} lines={key==="deck"?3:1} change={v=>patch({...text,cover:{...text.cover,[key]:v}})}/>)}
      {tab==="toc"&&<><Field label="목차 제목" value={text.toc.title} change={title=>patch({...text,toc:{...text.toc,title}})}/><Field label="목차 안내 문구" value={text.toc.description} change={description=>patch({...text,toc:{...text.toc,description}})}/><p>검사별 이름은 검사별 개요 탭에서 수정합니다. 사례 건수·목차 순서·쪽번호는 실제 수록 사례에 따라 자동 계산됩니다.</p></>}
      {tab==="overview"&&<><Field label="전체 개요 제목" lines={2} value={text.overview.title} change={title=>patch({...text,overview:{...text.overview,title}})}/><Field label="한 줄 소개" value={text.overview.lead} change={lead=>patch({...text,overview:{...text.overview,lead}})}/><Field label="제작 목적" lines={4} value={text.overview.purpose} change={purpose=>patch({...text,overview:{...text.overview,purpose}})}/>{text.overview.systems.map((system,i)=><fieldset key={i}><legend>업무 체계 {i+1}</legend>{(["title","description","detail"] as const).map(k=><Field key={k} label={{title:"제목",description:"설명",detail:"세부 검사 종류"}[k]} value={system[k]} change={v=>patch({...text,overview:{...text.overview,systems:text.overview.systems.map((x,j)=>i===j?{...x,[k]:v}:x)}})}/>)}</fieldset>)}<Field label="활용 방법 (한 줄에 한 항목)" lines={4} value={text.overview.usage.join("\n")} change={v=>patch({...text,overview:{...text.overview,usage:lines(v)}})}/><Field label="유의사항" lines={4} value={text.overview.note} change={note=>patch({...text,overview:{...text.overview,note}})}/><Field label="출처" value={text.overview.source} change={source=>patch({...text,overview:{...text.overview,source}})}/></>}
      {tab==="section"&&<><label className="kb-edit-field"><span>검사 종류 선택</span><select value={sectionKey} onChange={e=>setSectionKey(e.target.value)}>{sections.map(s=><option key={s.key} value={s.key}>{s.title}</option>)}</select></label><Field label="표시 제목 (목차에도 반영)" value={se.title} change={v=>sectionField("title",v)}/><Field label="검사 개요" lines={4} value={se.summary} change={v=>sectionField("summary",v)}/><Field label="관련 근거" lines={2} value={se.basis} change={v=>sectionField("basis",v)}/><Field label="주요 확인사항 (한 줄에 하나)" lines={6} value={se.checks.join("\n")} change={v=>sectionField("checks",lines(v))}/><Field label="업무 처리절차 (한 줄에 한 단계)" lines={8} value={se.procedure.join("\n")} change={v=>sectionField("procedure",lines(v))}/><Field label="참고 출처" value={se.source} change={v=>sectionField("source",v)}/></>}
      {tab==="colophon"&&<><Field label="발간정보 제목" value={text.colophon.title} change={title=>patch({...text,colophon:{...text.colophon,title}})}/><Field label="홈페이지" value={text.colophon.website} change={website=>patch({...text,colophon:{...text.colophon,website}})}/><Field label="안내문" lines={5} value={text.colophon.note} change={note=>patch({...text,colophon:{...text.colophon,note}})}/><p>제작년도·기관·부서는 표지 설정과 연동됩니다.</p></>}
    </div>}
    {preview&&<div className="kb-editor-preview"><p>현재 수정 문안 미리보기 · 검토완료·공개 사례 기준. 실제 사례 페이지는 생략합니다.</p><div className="kb-book-preview"><CasebookBook items={items.filter(x=>x.published&&x.review_status==="검토완료")} text={text} frontMatterOnly renderCase={()=>null}/></div></div>}
  </div></div>;
}
