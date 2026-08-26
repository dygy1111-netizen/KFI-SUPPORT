import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { AdminPanel } from "./components/AdminPanel";
import { defaultContent, defaultConfig } from "./defaults";
import { isSupabaseConfigured, publicAssetUrl, supabase } from "./lib/supabase";
import type { CaseItem, ManualItem, PortalContent, ResourceItem, SiteConfig, View } from "./types";

const validViews: View[] = ["home", "schedule", "procedure", "cases", "manual", "resources", "admin"];

export default function App() {
  const [view, setView] = useState<View>("home");
  const [content, setContent] = useState<PortalContent>(defaultContent);
  const [notice, setNotice] = useState("");

  const reload = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setNotice("Supabase 연결값을 입력하기 전이라 기본 화면을 표시하고 있습니다.");
      return;
    }

    const [configResult, casesResult, manualsResult, resourcesResult] = await Promise.all([
      supabase.from("site_config").select("config").eq("id", 1).maybeSingle(),
      supabase.from("cases").select("*").order("id", { ascending: false }),
      supabase.from("manuals").select("*").order("id", { ascending: true }),
      supabase.from("resources").select("*").order("id", { ascending: false }),
    ]);

    const error = configResult.error || casesResult.error || manualsResult.error || resourcesResult.error;
    if (error) {
      setNotice(`Supabase 내용을 불러오지 못했습니다: ${error.message}`);
      return;
    }

    setContent({
      config: { ...defaultConfig, ...((configResult.data?.config || {}) as Partial<SiteConfig>) },
      cases: (casesResult.data || []) as CaseItem[],
      manuals: (manualsResult.data || []) as ManualItem[],
      resources: (resourcesResult.data || []) as ResourceItem[],
    });
    setNotice("");
  }, []);

  useEffect(() => {
    void reload();
    const syncView = () => {
      const next = window.location.hash.replace("#", "") as View;
      setView(validViews.includes(next) ? next : "home");
    };
    syncView();
    window.addEventListener("hashchange", syncView);
    return () => window.removeEventListener("hashchange", syncView);
  }, [reload]);

  const move = (next: View) => {
    window.location.hash = next;
    setView(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const config = content.config;
  return (
    <div className="site-shell">
      <Header config={config} active={view} move={move} />
      {notice && <div className="system-notice">{notice}</div>}
      {view === "home" && <HomeView config={config} move={move} />}
      {view === "schedule" && <PlaceholderPage eyebrow="검사 전" title={config.scheduleTitle} text={config.scheduleText} kind="schedule" />}
      {view === "procedure" && <PlaceholderPage eyebrow="검사 전" title={config.procedureTitle} text={config.procedureText} kind="procedure" />}
      {view === "cases" && <CasesView config={config} items={content.cases} />}
      {view === "manual" && <ManualView config={config} items={content.manuals} />}
      {view === "resources" && <ResourcesView config={config} items={content.resources} />}
      {view === "admin" && <AdminPanel content={content} reload={reload} />}
      <footer className="footer">
        <div><strong>{config.organization}</strong><span>{config.siteTitle}</span></div>
        <p>{config.footerNotice}</p>
      </footer>
    </div>
  );
}

function Header({ config, active, move }: { config: SiteConfig; active: View; move: (view: View) => void }) {
  const items: Array<[View, string]> = [
    ["home", config.navHome],
    ["schedule", config.navSchedule],
    ["procedure", config.navProcedure],
    ["cases", config.navCases],
    ["manual", config.navManual],
    ["resources", config.navResources],
    ["admin", config.navAdmin],
  ];
  return (
    <>
      <header className="topbar">
        <button className="brand" onClick={() => move("home")} aria-label="홈으로 이동">
          <span className="brand-mark">K</span><span><b>KFI</b> {config.siteTitle}</span>
        </button>
        <nav className="main-nav" aria-label="주요 메뉴">
          {items.map(([key, label]) => <button key={key} className={active === key ? "active" : ""} onClick={() => move(key)}>{label}</button>)}
        </nav>
      </header>
      <nav className="mobile-nav" aria-label="모바일 메뉴">
        {items.map(([key, label]) => <button key={key} className={active === key ? "active" : ""} onClick={() => move(key)}>{label}</button>)}
      </nav>
    </>
  );
}

function PageHero({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) {
  return <section className="page-hero"><div className="hero-inner"><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{text}</p></div></section>;
}

function HomeView({ config, move }: { config: SiteConfig; move: (view: View) => void }) {
  const cards: Array<{ key: View; step: string; no: string; title: string; text: string; tone: string }> = [
    { key: "schedule", step: "검사 전", no: "01", title: config.scheduleTitle, text: config.scheduleCardText, tone: "blue" },
    { key: "procedure", step: "검사 전", no: "02", title: config.procedureTitle, text: config.procedureCardText, tone: "indigo" },
    { key: "cases", step: "검사 후", no: "03", title: config.casesTitle, text: config.casesCardText, tone: "orange" },
    { key: "manual", step: "전 과정", no: "04", title: config.manualTitle, text: config.manualCardText, tone: "teal" },
    { key: "resources", step: "자료 활용", no: "05", title: config.resourcesTitle, text: config.resourcesCardText, tone: "slate" },
  ];
  return (
    <>
      <section className="home-hero">
        <div className="hero-inner home-hero-grid">
          <div><span className="eyebrow">{config.heroEyebrow}</span><h1>{config.heroTitle}<br /><em>{config.heroAccent}</em></h1><p>{config.heroText}</p><div className="hero-actions"><button className="primary-button" onClick={() => move("cases")}>품질사례 보기</button><button className="secondary-button" onClick={() => move("resources")}>양식자료 받기</button></div></div>
          <div className="journey-card"><div><span>BEFORE</span><b>미리 준비하고</b><p>검사대상·서류·기한 확인</p></div><i>→</i><div><span>DURING</span><b>쉽게 이해하고</b><p>절차·방법·현장사항 안내</p></div><i>→</i><div><span>AFTER</span><b>함께 개선합니다</b><p>사례·조치방법·기술지원</p></div></div>
        </div>
      </section>
      <section className="content-section">
        <div className="section-heading"><div><span className="section-kicker">QUICK SERVICE</span><h2>어떤 도움이 필요하신가요?</h2></div><p>현재 상황에 맞는 서비스를 선택해 주세요.</p></div>
        <div className="service-grid">{cards.map((card) => <button className={`service-card ${card.tone}`} key={card.key} onClick={() => move(card.key)}><span className="service-step">{card.step}</span><span className="service-icon">{card.no}</span><h3>{card.title}</h3><p>{card.text}</p><b>바로가기 →</b></button>)}</div>
      </section>
    </>
  );
}

function PlaceholderPage({ eyebrow, title, text, kind }: { eyebrow: string; title: string; text: string; kind: "schedule" | "procedure" }) {
  return (
    <>
      <PageHero eyebrow={eyebrow} title={title} text={text} />
      <section className="content-section compact">
        <div className="module-placeholder"><span className="module-number">{kind === "schedule" ? "01" : "02"}</span><div><span className="section-kicker">MODULE READY</span><h2>후배 직원 코드 연결 자리</h2><p>{kind === "schedule" ? "검사시기 기능이 완성되면 src/features/schedule 폴더에 코드를 넣고 이 화면과 교체하면 됩니다. 업체정보는 Supabase RLS를 적용해 로그인한 업체 자료만 조회하도록 연결합니다." : "검사절차 판정 코드가 완성되면 현재 디자인을 유지한 채 입력·판정 로직만 연결합니다."}</p><div className="module-flow"><span>기존 코드</span><i>→</i><span>입력·판정 로직</span><i>→</i><span>현재 디자인 적용</span></div></div></div>
      </section>
    </>
  );
}

function CasesView({ config, items }: { config: SiteConfig; items: CaseItem[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("전체");
  const [selected, setSelected] = useState<CaseItem | null>(null);
  const categories = useMemo(() => ["전체", ...new Set(items.map((item) => item.category))], [items]);
  const filtered = items.filter((item) => (category === "전체" || item.category === category) && `${item.title} ${item.summary} ${item.cause} ${item.action}`.includes(query));
  return (
    <>
      <PageHero eyebrow="검사 후" title={config.casesTitle} text={config.casesText} />
      <section className="content-section compact">
        <Toolbar query={query} setQuery={setQuery} placeholder="사례명, 원인, 개선방법 검색" categories={categories} category={category} setCategory={setCategory} />
        <div className="case-count"><b>{filtered.length}</b>개의 품질관리 사례</div>
        {filtered.length ? <div className="case-grid">{filtered.map((item) => <button className="case-card" key={item.id} onClick={() => setSelected(item)}><div className="case-visual">{item.before_image_path ? <img src={publicAssetUrl(item.before_image_path)} alt="사례 사진" /> : <i>!</i>}<span>{item.category}</span><b>{item.status}</b></div><div className="case-copy"><span>CASE {String(item.id).padStart(2, "0")}</span><h3>{item.title}</h3><p>{item.summary}</p><b>자세히 보기 →</b></div></button>)}</div> : <Empty title="게시된 사례가 없습니다" text="관리자 화면에서 첫 사례를 등록해 주세요." />}
      </section>
      {selected && <Modal close={() => setSelected(null)}><span className="result-label">{selected.category} · {selected.status}</span><h2>{selected.title}</h2><p className="modal-lead">{selected.summary}</p>{(selected.before_image_path || selected.after_image_path) && <div className="case-photo-pair">{selected.before_image_path && <figure><img src={publicAssetUrl(selected.before_image_path)} alt="개선 전" /><figcaption>개선 전</figcaption></figure>}{selected.after_image_path && <figure><img src={publicAssetUrl(selected.after_image_path)} alt="개선 후" /><figcaption>개선 후</figcaption></figure>}</div>}<dl><dt>발생 원인</dt><dd>{selected.cause}</dd><dt>개선 방법</dt><dd>{selected.action}</dd><dt>관련 기준</dt><dd>{selected.standard}</dd></dl></Modal>}
    </>
  );
}

function ManualView({ config, items }: { config: SiteConfig; items: ManualItem[] }) {
  const [faq, setFaq] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<ManualItem | null>(null);
  const filtered = items.filter((item) => item.faq === faq && `${item.title} ${item.summary} ${item.body}`.includes(query));
  return (
    <><PageHero eyebrow="전 과정" title={config.manualTitle} text={config.manualText} /><section className="content-section compact"><div className="manual-launch"><button className={!faq ? "active" : ""} onClick={() => { setFaq(false); setSelected(null); }}><span>📘</span><div><b>매뉴얼 시작하기</b><p>검사 단계별 업무안내</p></div></button><button className={faq ? "active" : ""} onClick={() => { setFaq(true); setSelected(null); }}><span>💡</span><div><b>자주 묻는 질문</b><p>고객 문의 빠른 확인</p></div></button></div><div className="manual-layout"><aside><div className="search-box"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="매뉴얼 검색" /></div>{filtered.map((item) => <button className={selected?.id === item.id ? "active" : ""} onClick={() => setSelected(item)} key={item.id}><span>{item.category}</span>{item.title}</button>)}</aside><article className="manual-content">{selected ? <><span className="result-label">{selected.category}</span><h2>{selected.title}</h2><p className="manual-summary">{selected.summary}</p><div className="manual-body">{selected.body.split("\n").map((line, index) => <p key={index}>{line || <br />}</p>)}</div></> : <Empty title={filtered.length ? "확인할 내용을 선택하세요" : "게시된 내용이 없습니다"} text="왼쪽 목록에서 항목을 선택해 주세요." />}</article></div></section></>
  );
}

function ResourcesView({ config, items }: { config: SiteConfig; items: ResourceItem[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("전체");
  const categories = useMemo(() => ["전체", ...new Set(items.map((item) => item.category))], [items]);
  const filtered = items.filter((item) => (category === "전체" || item.category === category) && `${item.title} ${item.description} ${item.file_name}`.includes(query));
  return (
    <><PageHero eyebrow="자료 활용" title={config.resourcesTitle} text={config.resourcesText} /><section className="content-section compact"><Toolbar query={query} setQuery={setQuery} placeholder="양식명, 설명, 파일명 검색" categories={categories} category={category} setCategory={setCategory} />{filtered.length ? <div className="resource-list">{filtered.map((item) => <article key={item.id}><span className="file-icon">{item.file_name.split(".").pop()?.toUpperCase()}</span><div><span>{item.category}</span><h3>{item.title}</h3><p>{item.description}</p><small>{item.file_name} · {formatSize(item.file_size)}</small></div><a href={publicAssetUrl(item.file_path)} download={item.file_name} target="_blank" rel="noreferrer">다운로드 ↓</a></article>)}</div> : <Empty title="게시된 양식이 없습니다" text="관리자 화면에서 양식과 참고자료를 게시해 주세요." />}</section></>
  );
}

function Toolbar({ query, setQuery, placeholder, categories, category, setCategory }: { query: string; setQuery: (value: string) => void; placeholder: string; categories: string[]; category: string; setCategory: (value: string) => void }) {
  return <div className="toolbar"><div className="search-box"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={placeholder} /></div><div className="filter-row">{categories.map((item) => <button key={item} className={category === item ? "active" : ""} onClick={() => setCategory(item)}>{item}</button>)}</div></div>;
}

function Modal({ close, children }: { close: () => void; children: ReactNode }) {
  return <div className="modal-backdrop" onClick={close}><article className="case-modal" onClick={(event) => event.stopPropagation()}><button className="modal-close" onClick={close} aria-label="닫기">×</button>{children}</article></div>;
}

function Empty({ title, text }: { title: string; text: string }) {
  return <div className="empty-state"><span>⌕</span><b>{title}</b><p>{text}</p></div>;
}

function formatSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}
