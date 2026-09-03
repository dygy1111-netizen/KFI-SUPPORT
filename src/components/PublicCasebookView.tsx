import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  publicAssetUrl,
  supabase,
} from "../lib/supabase";

import type {
  SiteConfig,
} from "../types";

import "./CasebookManager.css";


type CasebookCase = {
  id: number;
  case_no: number;
  inspection_type: string;
  title: string;
  facility: string;
  photo1_path: string | null;
  photo2_path: string | null;
  photo_caption: string;
  photo_note: string;
  standard_title: string;
  standard_body: string;
  cause_title: string;
  cause_body: string;
  action_body: string;
  prevention_body: string;
  sort_order: number;
};


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


  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);

      setError("");

      const {
        data,
        error: loadError,
      } = await supabase
        .from("casebook_cases")
        .select("*")
        .order("sort_order", {
          ascending: true,
        })
        .order("case_no", {
          ascending: true,
        });

      if (!active) {
        return;
      }

      if (loadError) {
        setError(loadError.message);

        setItems([]);

        setLoading(false);

        return;
      }

      setItems(
        (data || []) as CasebookCase[],
      );

      setLoading(false);
    }

    void load();

    return () => {
      active = false;
    };
  }, []);


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
          item.title,
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
              {error}
            </small>
          </div>
        )}


        {!loading &&
          !error &&
          filtered.length > 0 && (
          <div className="case-grid">
            {filtered.map(
              (item) => (
                <button
                  key={item.id}
                  className="case-card"
                  onClick={() => {
                    setSelected(item);

                    setZoom("normal");

                    window.scrollTo({
                      top: 0,
                      behavior:
                        "smooth",
                    });
                  }}
                >
                  <div className="case-visual">
                    {item.photo1_path ? (
                      <img
                        src={publicAssetUrl(
                          item.photo1_path,
                        )}
                        alt={item.title}
                      />
                    ) : (
                      <i>
                        !
                      </i>
                    )}

                    <span>
                      {
                        item.inspection_type
                      }
                    </span>
                  </div>


                  <div className="case-copy">
                    <span>
                      CASE{" "}
                      {String(
                        item.case_no,
                      ).padStart(
                        2,
                        "0",
                      )}
                    </span>

                    <h3>
                      {item.title}
                    </h3>

                    <p>
                      {item.facility ||
                        item.cause_title}
                    </p>

                    <b>
                      자세히 보기 →
                    </b>
                  </div>
                </button>
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
          ] 위험물시설 ·{" "}
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
            "개선 및\n보완조치"
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
          {Number(
            item.case_no ||
              1,
          ) + 3}
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
