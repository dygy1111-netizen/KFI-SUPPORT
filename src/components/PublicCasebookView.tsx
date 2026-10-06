import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
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
import { casebookGroup, type CasebookCase } from "../lib/casebook";
import { CasebookManager, CasebookPage } from "./CasebookManager";

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
  ] = useState<ZoomLevel>("normal");


  const [retry, setRetry] = useState(0);
  const [authReady, setAuthReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [editing, setEditing] = useState<CasebookCase | null>(null);
  const [printItems, setPrintItems] = useState<CasebookCase[]>([]);
  const originalTitle = useRef<string | null>(null);

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

      const nextItems = (data || []) as CasebookCase[];
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

        const queryMatch =
          !normalizedQuery ||
          searchText.includes(
            normalizedQuery,
          );

        return (
          categoryMatch &&
          queryMatch
        );
      }),
    [
      items,
      category,
      normalizedQuery,
    ],
  );

  const printReviewedCases = () => {
    const targets = items
      .filter(
        (item) => item.review_status === "검토완료" && item.published,
      )
      .sort(
        (a, b) =>
          a.case_no - b.case_no ||
          a.sort_order - b.sort_order ||
          a.id - b.id,
      );

    if (!targets.length) {
      setError("PDF로 출력할 검토완료 사례가 없습니다.");
      return;
    }

    originalTitle.current = document.title;
    document.title = "위험물시설_품질관리_사례집";
    setPrintItems(targets);

    window.setTimeout(async () => {
      await document.fonts.ready;

      const pages = Array.from(
        document.querySelectorAll<HTMLElement>(
          ".cb-print-only .cb-a4-page",
        ),
      );

      await Promise.allSettled(
        pages.flatMap((page) =>
          Array.from(page.querySelectorAll("img")).map((image) =>
            image.decode(),
          ),
        ),
      );

      const oversized = pages
        .map((page, index) => (page.scrollHeight > 1123 ? index + 1 : 0))
        .filter(Boolean);

      if (oversized.length) {
        setError(
          `A4 분량을 초과한 사례가 있습니다: ${oversized.join(", ")}쪽`,
        );
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
              />
            </div>
          </div>,
          document.body,
        )}

      {printItems.length > 0 &&
        createPortal(
          <div className="cb-print-only">
            {printItems.map((item, index) => (
              <CasebookPage
                key={`public-print-${item.id}`}
                item={item}
                pageNumber={index + 1}
              />
            ))}
          </div>,
          document.body,
        )}
    </>
  );


  if (selected) {
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


        <section
          className="content-section compact"
          style={{
            maxWidth: "1180px",
          }}
        >
          <div className="public-casebook-toolbar">
            <div className="public-casebook-toolbar-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  setSelected(null);

                  setZoom("normal");

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
                화면 크기
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
                작게
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
            className={`public-casebook-zoom-wrap zoom-${zoom}`}
          >
            <PublicCasebookPage
              item={selected}
            />
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

            <button
              type="button"
              className="secondary-button"
              onClick={printReviewedCases}
            >
              검토완료 사례 PDF
            </button>
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
              placeholder="사례명, 발생사유, 개선조치 검색"
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
          <div className="case-grid">
            {filtered.map(
              (item) => (
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

                      setZoom("normal");

                      window.scrollTo({
                        top: 0,
                        behavior: "smooth",
                      });
                    }}
                  >
                    <div className="case-visual">
                      {item.photo1_path ? (
                        <img
                          src={publicAssetUrl(item.photo1_path)}
                          alt={item.title}
                        />
                      ) : (
                        <i>!</i>
                      )}

                      <span>{item.inspection_type}</span>

                      {isAdmin && (
                        <b
                          className={
                            item.review_status === "검토완료"
                              ? "is-reviewed"
                              : "is-pending"
                          }
                        >
                          {item.review_status}
                        </b>
                      )}
                    </div>

                    <div className="case-copy">
                      <span>
                        CASE {String(item.case_no).padStart(2, "0")}
                      </span>

                      <h3>{item.title}</h3>

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
              ),
            )}
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


function PublicCasebookPage({
  item,
}: {
  item: CasebookCase;
}) {
  const image1 =
    publicAssetUrl(
      item.photo1_path,
    );

  const image2 =
    publicAssetUrl(
      item.photo2_path,
    );

  return (
    <article className="cb-a4-page">
      <header className="cb-case-head">
        <span>
          [사례{" "}
          {String(
            item.case_no,
          ).padStart(
            2,
            "0",
          )}
          ] {casebookGroup(item.inspection_type)} ·{" "}
          {
            item.inspection_type
          }
        </span>

        <h1>
          {item.title}
        </h1>
      </header>


      <div className="cb-table">
        <CaseRow label="구 분">
          <p className="cb-bullet">
            {item.facility}
          </p>
        </CaseRow>


        <CaseRow
          label={
            "관련 사진\n(현장 사례)"
          }
        >
          <div className="cb-photo-area">
            <div
              className={`cb-preview-photos ${
                image1 &&
                image2
                  ? "two"
                  : "one"
              }`}
            >
              {image1 && (
                <img
                  src={image1}
                  alt="관련 사진 1"
                />
              )}

              {image2 && (
                <img
                  src={image2}
                  alt="관련 사진 2"
                />
              )}

              {!image1 &&
                !image2 && (
                <div className="cb-photo-placeholder">
                  관련 사진
                </div>
              )}
            </div>


            {(item.photo_caption ||
              item.photo_note) && (
              <div className="cb-photo-copy">
                {item.photo_caption && (
                  <p>
                    {
                      item.photo_caption
                    }
                  </p>
                )}

                {item.photo_note && (
                  <small>
                    ※{" "}
                    {
                      item.photo_note
                    }
                  </small>
                )}
              </div>
            )}
          </div>
        </CaseRow>


        <CaseRow
          label={
            "검사 기준\n(관련 법령)"
          }
        >
          <div className="cb-copy">
            {item.standard_title && (
              <p className="cb-bullet cb-strong">
                {
                  item.standard_title
                }
              </p>
            )}

            {splitLines(
              item.standard_body,
            ).map(
              (
                line,
                index,
              ) => (
                <p key={index}>
                  {line}
                </p>
              ),
            )}
          </div>
        </CaseRow>


        <CaseRow label="발생 사유">
          <div className="cb-copy">
            {item.cause_title && (
              <p className="cb-bullet cb-strong">
                {
                  item.cause_title
                }
              </p>
            )}

            {splitLines(
              item.cause_body,
            ).map(
              (
                line,
                index,
              ) => (
                <p key={index}>
                  {line}
                </p>
              ),
            )}
          </div>
        </CaseRow>


        <CaseRow
          label={
            "개선\n조치"
          }
        >
          <div className="cb-copy">
            {splitLines(
              item.action_body,
            ).map(
              (
                line,
                index,
              ) => (
                <p
                  className="cb-bullet"
                  key={index}
                >
                  {line}
                </p>
              ),
            )}
          </div>
        </CaseRow>


        <CaseRow label="예방 대책">
          <div className="cb-copy">
            {splitLines(
              item.prevention_body,
            ).map(
              (
                line,
                index,
              ) => (
                <p
                  className="cb-bullet"
                  key={index}
                >
                  {line}
                </p>
              ),
            )}
          </div>
        </CaseRow>
      </div>


      <footer className="cb-page-footer">
        <b>
          한국소방산업기술원 위험물검사부
        </b>

        <span>
          Page{" "}
          {1}
        </span>
      </footer>
    </article>
  );
}


function CaseRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="cb-table-row">
      <div className="cb-table-label">
        {label
          .split("\n")
          .map(
            (
              line,
              index,
            ) => (
              <span
                key={index}
              >
                {line}
              </span>
            ),
          )}
      </div>

      <div className="cb-table-content">
        {children}
      </div>
    </div>
  );
}


function splitLines(
  text: string,
) {
  if (!text) {
    return [];
  }

  return text
    .split("\n")
    .map(
      (line) =>
        line.trim(),
    )
    .filter(Boolean);
}
