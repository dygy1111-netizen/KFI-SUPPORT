import { prepareCasebookPrint } from '../lib/casebookPrint';
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

import {
  publicAssetUrl,
  supabase,
} from "../lib/supabase";

import type {
  SiteConfig,
} from "../types";

import "./CasebookManager.css";


import { loadCasebook } from '../lib/casebookQuery';
import { sourceCaseNumber, type CasebookCase } from "../lib/casebook";
import { CasebookManager, CasebookPage } from "./CasebookManager";
import { CasebookBook, validateBookLayout } from "./CasebookBook";
import { CasebookTextEditor } from "./CasebookTextEditor";
import { DEFAULT_BOOK_TEXT, type BookText } from "../lib/casebookBookText";
import { loadBookText } from "../lib/casebookBookTextStore";
import { bookCompare, groupCasebookCases, planCasebook } from "../lib/casebookBook";

type ZoomLevel =
  | "small"
  | "normal"
  | "large";


export function PublicCasebookView({
  config,
}: {
  config: SiteConfig;
}) {
  const [
    items,
    setItems,
  ] = useState<CasebookCase[]>([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  const [
    query,
    setQuery,
  ] = useState("");

  const [
    category,
    setCategory,
  ] = useState("전체");

  const [
    selected,
    setSelected,
  ] = useState<CasebookCase | null>(null);

  const [
    zoom,
    setZoom,
  ] = useState<ZoomLevel>("small");


  const [retry, setRetry] = useState(0);
  const [authReady, setAuthReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [reviewFilter,setReviewFilter] = useState("전체");
  const [editing, setEditing] = useState<CasebookCase | null>(null);
  const [printItems, setPrintItems] = useState<CasebookCase[]>([]);
  const [printText,setPrintText]=useState<BookText>(DEFAULT_BOOK_TEXT);
  const [bookEditor,setBookEditor]=useState(false);
  const originalTitle = useRef<string | null>(null);
  const detailRef = useRef<HTMLElement>(null);
  const zoomWrapRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [pageScale, setPageScale] = useState(1);
  const [baseWidth, setBaseWidth] = useState(920);

  // CSS zoom scales the entire page AND its layout box, unlike a transform
  // or changing only the text. Measure the current case, including late
  // photo/font loads, and fit the complete page into the usable viewport.
  useLayoutEffect(() => {
    if (!selected) return;
    const wrap = zoomWrapRef.current;
    const toolbar = toolbarRef.current;
    if (!wrap || !toolbar) return;
    const page = wrap.querySelector<HTMLElement>(".cb-a4-page");
    if (!page) return;
    let frame = 0;
    let cancelled = false;
    const update = () => {
      if (cancelled) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (cancelled || !page.isConnected) return;
        const availableWidth = wrap.clientWidth;
        if (availableWidth <= 0) return;
        const width = Math.min(920, availableWidth);
        setBaseWidth(old => Math.abs(old-width) > 0.5 ? width : old);
        // Read the unscaled page height using the actual current CSS zoom.
        const applied = parseFloat(getComputedStyle(page).zoom) || 1;
        const height = page.getBoundingClientRect().height / applied;
        const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
        const toolbarHeight = toolbar.getBoundingClientRect().height;
        // Reserve space for the site's navigation, the toolbar and bottom gap.
        const topOfPage = Math.max(0, detailRef.current?.getBoundingClientRect().top ?? 0);
        const usableHeight = Math.max(200, viewportHeight - toolbarHeight - topOfPage - 28);
        const widthLimit = availableWidth / width;
        const scale = zoom === "small"
          ? Math.min(0.78, usableHeight / Math.max(1,height), widthLimit)
          : Math.min(zoom === "large" ? 1.16 : 1, widthLimit);
        const rounded = Math.max(0.05, Math.floor(scale*1000)/1000);
        setPageScale(old => Math.abs(old-rounded) >= 0.002 ? rounded : old);
      });
    };
    const observer = new ResizeObserver(update);
    observer.observe(wrap);
    observer.observe(page);
    observer.observe(toolbar);
    window.addEventListener("resize", update);
    window.visualViewport?.addEventListener("resize", update);
    wrap.addEventListener("load", update, true);
    void document.fonts.ready.then(update);
    update();
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("resize", update);
      wrap.removeEventListener("load", update, true);
    };
  }, [selected, zoom]);

  // Case details omit the tall landing-page hero; start with the toolbar.
  useLayoutEffect(() => {
    if (!selected) return;
    const frame = requestAnimationFrame(() => {
      window.scrollTo({top:0, behavior:"instant"});
    });
    return () => cancelAnimationFrame(frame);
  }, [selected?.id]);

  useEffect(() => {
    let active = true;

    const checkAdmin = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!active) return;

      if (!session) {
        setIsAdmin(false);
        setAuthReady(true);
        setEditing(null);
        setBookEditor(false);
        return;
      }

      const { data, error: adminError } = await supabase.rpc("is_admin");
      if (!active) return;

      setIsAdmin(Boolean(data) && !adminError);
      setAuthReady(true);
    };

    void checkAdmin();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      window.setTimeout(() => void checkAdmin(), 0);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!authReady) return;

    let active = true;

    async function load() {
      setLoading(true);

      setError("");

      const {
        data,
        error: loadError,
      } = await loadCasebook(!isAdmin);

      if (!active) {
        return;
      }

      if (loadError) {
        setError("사례를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
        if (retry === 0) window.setTimeout(() => { if(active) setRetry(1); }, 700);

        setItems([]);

        setLoading(false);

        return;
      }

      const nextItems = ((data || []) as CasebookCase[]).slice().sort(bookCompare);
      setItems(nextItems);
      setSelected((current) =>
        current
          ? nextItems.find((item) => item.id === current.id) || null
          : null,
      );

      setLoading(false);
    }

    void load();

    return () => {
      active = false;
    };
  }, [retry, isAdmin, authReady]);

  useEffect(() => {
    if (!printItems.length) return;

    const finish = () => {
      setPrintItems([]);
      if (originalTitle.current !== null) {
        document.title = originalTitle.current;
        originalTitle.current = null;
      }
    };

    window.addEventListener("afterprint", finish, { once: true });
    return () => window.removeEventListener("afterprint", finish);
  }, [printItems.length]);


  const categories = useMemo(
    () => [
      "전체",

      ...new Set(
        items.map(
          (item) =>
            item.inspection_type,
        ),
      ),
    ],
    [items],
  );


  const normalizedQuery =
    query
      .trim()
      .toLowerCase();


  const filtered = useMemo(
    () =>
      items.filter((item) => {
        const categoryMatch =
          category === "전체" ||
          item.inspection_type ===
            category;

        const searchText = [
          item.title, item.inspection_type, item.test_item,
          item.facility,
          item.photo_caption,
          item.standard_title,
          item.standard_body,
          item.cause_title,
          item.cause_body,
          item.action_body,
          item.prevention_body,
        ]
          .join(" ")
          .toLowerCase();

        const originalNumberQuery =
          isAdmin && /^\d+$/.test(normalizedQuery)
            ? Number(normalizedQuery)
            : null;

        const queryMatch =
          originalNumberQuery !== null
            ? sourceCaseNumber(item) === originalNumberQuery
            : !normalizedQuery || searchText.includes(normalizedQuery);

        return (
          categoryMatch &&
          queryMatch &&
          (!isAdmin || reviewFilter === "전체" || item.review_status === reviewFilter)
        );
      }).sort(bookCompare),
    [
      items,
      category,
      normalizedQuery,
      isAdmin,
      reviewFilter,
    ],
  );

  const printReviewedCases = async () => {
    const targets = items
      .filter(
        (item) => item.review_status === "검토완료" && item.published,
      )
      .sort(bookCompare);

    if (!targets.length) {
      setError("PDF로 출력할 검토완료 사례가 없습니다.");
      return;
    }

    try { setPrintText((await loadBookText()).text); } catch (error) {setError(error instanceof Error ? error.message : "사례집 설정을 불러오지 못했습니다.");return;}
    originalTitle.current = document.title;
    document.title = "위험물시설_품질관리_사례집";
    setPrintItems(targets);

    window.setTimeout(async () => {
      await document.fonts.ready;

      // '품질사례 > 검토완료 사례 PDF'가 생성한 인쇄 페이지만 사용합니다.
      const printRoot = document.querySelector<HTMLElement>(
        '.cb-print-only[data-print-mode="reviewed"]',
      );
      const pages = Array.from(
        printRoot?.querySelectorAll<HTMLElement>(".cb-a4-page:not(.kb-sheet):not(.kb-cover)") ?? [],
      );

      try {
        if (pages.length !== targets.length) {
          throw new Error("검토완료 사례 PDF 페이지를 준비하지 못했습니다.");
        }
        const plan = planCasebook(targets);
        if (printRoot?.querySelectorAll(".cb-a4-page").length !== plan.finalPage + 1) {
          throw new Error("사례집 목차와 실제 인쇄 페이지가 일치하지 않습니다.");
        }
        validateBookLayout(printRoot!);
        await prepareCasebookPrint(pages);
      } catch (error) {
        setError(error instanceof Error ? error.message : "출력을 준비하지 못했습니다.");
        setPrintItems([]);
        if (originalTitle.current !== null) {
          document.title = originalTitle.current;
          originalTitle.current = null;
        }
        return;
      }

      window.print();
    }, 150);
  };

  const overlays = (
    <>
      {isAdmin && bookEditor && createPortal(<CasebookTextEditor items={items} onClose={()=>setBookEditor(false)}/>,document.body)}
      {editing &&
        createPortal(
          <div
            className="cb-quick-edit-backdrop"
            role="dialog"
            aria-modal="true"
            aria-label="품질사례 바로 수정"
          >
            <div className="cb-quick-edit-panel">
              <div className="cb-quick-edit-head">
                <div>
                  <b>품질사례 바로 수정</b>
                  <span>문안·사진·검토상태를 이 화면에서 수정합니다.</span>
                </div>
                <button
                  type="button"
                  aria-label="수정 화면 닫기"
                  onClick={() => setEditing(null)}
                >
                  ×
                </button>
              </div>

              <CasebookManager
                initialCaseId={editing.id}
                showImport={false}
                showList={false}
                onClose={() => setEditing(null)}
                onSaved={() => setRetry((current) => current + 1)}
                onDeleted={() => {
                  setEditing(null);
                  setSelected(null);
                  setRetry(current => current + 1);
                }}
              />
            </div>
          </div>,
          document.body,
        )}

      {printItems.length > 0 &&
        createPortal(
          <div className="cb-print-only" data-print-mode="reviewed">
            <CasebookBook items={printItems} text={printText}
              renderCase={(item,page)=><CasebookPage item={item} pageNumber={page}/>}/>
          </div>,
          document.body,
        )}
    </>
  );


  if (selected) {
    return (
      <>
        <section
          className="content-section compact cb-detail-section"
          ref={detailRef}
          style={{
            maxWidth: "1180px",
          }}
        >
          <div className="public-casebook-toolbar" ref={toolbarRef}>
            <div className="public-casebook-toolbar-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  setSelected(null);

                  window.scrollTo({
                    top: 0,
                    behavior: "smooth",
                  });
                }}
              >
                ← 사례 목록
              </button>

              {isAdmin && (
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => setEditing(selected)}
                >
                  ✎ 이 사례 수정
                </button>
              )}
            </div>


            <div className="public-casebook-zoom">
              <span>
                페이지 크기
              </span>

              <button
                type="button"
                className={
                  zoom === "small"
                    ? "active"
                    : ""
                }
                onClick={() =>
                  setZoom("small")
                }
              >
                작게 (한눈에)
              </button>

              <button
                type="button"
                className={
                  zoom === "normal"
                    ? "active"
                    : ""
                }
                onClick={() =>
                  setZoom("normal")
                }
              >
                기본
              </button>

              <button
                type="button"
                className={
                  zoom === "large"
                    ? "active"
                    : ""
                }
                onClick={() =>
                  setZoom("large")
                }
              >
                크게
              </button>
            </div>
          </div>


          <div
            ref={zoomWrapRef}
            className={`public-casebook-zoom-wrap zoom-${zoom} cb-whole-page-zoom`}
            style={{"--cb-page-scale":pageScale,"--cb-page-base-width":`${baseWidth}px`} as React.CSSProperties}
          >
            <CasebookPage item={selected} />
          </div>
        </section>

        {overlays}
      </>
    );
  }


  return (
    <>
      <section className="page-hero">
        <div className="hero-inner">
          <h1>
            {config.casesTitle}
          </h1>

          <p>
            {config.casesText}
          </p>
        </div>
      </section>


      <section className="content-section compact">
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:"12px",flexWrap:"wrap",marginBottom:"18px",padding:"14px 18px",background:"#eff3f5",border:"1px solid #d8e4eb",borderRadius:"6px"}}>
          <span style={{fontSize:"13px",color:"#31556c"}}>서버 연결 없이 모바일·PC에서 열람할 수 있는 공개 사례집</span>
          <a className="secondary-button" href="./casebook/" style={{textDecoration:"none",display:"inline-flex",alignItems:"center",fontWeight:700}}>독립형 웹 사례집 열기 ↗</a>
        </div>
        {isAdmin && (
          <div className="casebook-admin-banner">
            <div>
              <span>관리자 편집 모드</span>
              <b>검토대기·비공개 사례까지 함께 표시됩니다.</b>
              <small>
                카드의 수정 버튼에서 문안과 사진을 고치고, 검토완료로
                저장하면 자동 공개됩니다.
              </small>
            </div>

            <div className="kb-banner-actions"><button type="button" className="secondary-button" onClick={()=>setBookEditor(true)}>사례집 구성 편집</button><button type="button" className="secondary-button" onClick={()=>void printReviewedCases()}>검토완료 사례 PDF</button></div>
          </div>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "minmax(240px, 1fr) auto",
            gap: "10px",
            marginBottom: "20px",
          }}
        >
          <div className="search-box">
            <span>
              ⌕
            </span>

            <input
              value={query}
              onChange={(event) =>
                setQuery(
                  event.target.value,
                )
              }
              placeholder={isAdmin ? "원본 순번(예: 77) 또는 사례명 검색" : "사례명, 발생사유, 개선조치 검색"}
            />
          </div>


          <select
            value={category}
            onChange={(event) =>
              setCategory(
                event.target.value,
              )
            }
            style={{
              minWidth: "170px",
              border:
                "1px solid #d4dce8",
              borderRadius: "8px",
              backgroundColor:
                "#ffffff",
              padding: "0 12px",
              color: "#40506a",
              fontWeight: 700,
            }}
          >
            {categories.map(
              (item) => (
                <option
                  value={item}
                  key={item}
                >
                  {item}
                </option>
              ),
            )}
          </select>
        </div>


        {isAdmin && <div className="cb-review-filter" aria-label="검토상태 필터">
          {["전체","검토완료","검토대기","기준확인필요"].map(status =>
            <button type="button" key={status} aria-pressed={reviewFilter===status}
              onClick={()=>setReviewFilter(status)}>
              {status} ({status==="전체" ? items.length : items.filter(x=>x.review_status===status).length})
            </button>)}
        </div>}
        <div className="case-count">
          <b>
            {filtered.length}
          </b>

          개의 품질관리 사례
        </div>


        {loading && (
          <div className="empty-list">
            품질관리 사례를 불러오는 중입니다.
          </div>
        )}


        {!loading &&
          error && (
          <div className="empty-list">
            사례를 불러오지 못했습니다.

            <br />

            <small>
              {error} <button onClick={()=>setRetry(x=>x+1)}>다시 시도</button>
            </small>
          </div>
        )}


        {!loading &&
          !error &&
          filtered.length > 0 && (
          <div className="case-grid case-grid-text-only">
            {groupCasebookCases(filtered).flatMap(group => [
              <div key={"group-"+group.key} className="cb-case-topic-head">
                <span>{group.inspection}</span><b>{group.topic}</b><small>{group.items.length}건</small>
              </div>,
              ...group.items.map(item => (
                <article
                  key={item.id}
                  className={`case-card-shell ${
                    isAdmin && !item.published ? "is-private" : ""
                  }`}
                >
                  <button
                    type="button"
                    className="case-card"
                    onClick={() => {
                      setSelected(item);
                    }}
                  >
                    <div className="case-copy">
                      <div className="case-card-meta">
                        <span className="case-number-label">사례 {String(item.case_no).padStart(2, "0")}</span>
                        <span>{item.inspection_type}</span>
                        {isAdmin && (
                          <span className={item.review_status === "검토완료" ? "is-reviewed" : "is-pending"}>
                            {item.review_status}
                          </span>
                        )}
                      </div>
                      <h3>{item.title}</h3>
                      {isAdmin && sourceCaseNumber(item) !== null && (
                        <small
                          style={{ display: "block", marginBottom: 6, fontWeight: 800, color: "#0f766e" }}
                        >
                          사진 연결용 원본 순번 {sourceCaseNumber(item)} · 사이트 사례번호 {item.case_no}
                        </small>
                      )}

                      <p>{item.facility || item.cause_title}</p>

                      <b>자세히 보기 →</b>
                    </div>
                  </button>

                  {isAdmin && (
                    <button
                      type="button"
                      className="case-admin-edit"
                      onClick={() => setEditing(item)}
                    >
                      ✎ 수정·사진 첨부
                    </button>
                  )}
                </article>
              ))
            ])}
          </div>
        )}


        {!loading &&
          !error &&
          filtered.length === 0 && (
          <div className="empty-list">
            등록된 품질관리 사례가 없습니다.
          </div>
        )}
      </section>

      {overlays}
    </>
  );
}
