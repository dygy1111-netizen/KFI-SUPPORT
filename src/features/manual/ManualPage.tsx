import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { ManualItem } from "../../types";

import {
  MANUAL_REPO_RAW,
  imagesForManual,
  manualContentUrl,
  manualImageUrl,
  manualSections,
  manualTitles,
} from "./manualData";

import "./manual.css";

type Tab = "manual" | "faq" | "extra";

type FAQItem = {
  q: string;
  a: string;
};

type ManualPageProps = {
  title: string;
  text: string;
  items: ManualItem[];
};

const FAVORITES_KEY = "kfi-support-manual-favorites";
const HISTORY_KEY = "kfi-support-manual-history";

function readStoredArray(key: string): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "[]");

    return Array.isArray(parsed)
      ? parsed.filter(
          (value): value is string => typeof value === "string",
        )
      : [];
  } catch {
    return [];
  }
}

function resolveMarkdownUrl(src?: string) {
  if (!src) return "";

  if (/^(https?:|data:|blob:)/i.test(src)) {
    return src;
  }

  const clean = src.replace(/^\.?\//, "");

  if (
    clean.startsWith("images/") ||
    clean.startsWith("faq_images/")
  ) {
    return `${MANUAL_REPO_RAW}/${clean
      .split("/")
      .map((part) => encodeURIComponent(part))
      .join("/")}`;
  }

  return src;
}

/**
 * Markdown 안의 간단한 인라인 문법 처리
 * **굵게**
 * [링크](주소)
 */
function renderInlineMarkdown(text: string): ReactNode[] {
  const parts: ReactNode[] = [];

  const regex =
    /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(
        <span key={`text-${key++}`}>
          {text.slice(lastIndex, match.index)}
        </span>,
      );
    }

    const value = match[0];

    if (
      value.startsWith("**") &&
      value.endsWith("**")
    ) {
      parts.push(
        <strong key={`strong-${key++}`}>
          {value.slice(2, -2)}
        </strong>,
      );
    } else {
      const linkMatch = value.match(
        /^\[([^\]]+)\]\(([^)]+)\)$/,
      );

      if (linkMatch) {
        parts.push(
          <a
            key={`link-${key++}`}
            href={resolveMarkdownUrl(linkMatch[2])}
            target="_blank"
            rel="noreferrer"
          >
            {linkMatch[1]}
          </a>,
        );
      }
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(
      <span key={`text-${key++}`}>
        {text.slice(lastIndex)}
      </span>,
    );
  }

  return parts;
}

/**
 * 외부 Markdown 패키지를 사용하지 않고
 * kfi_manual의 Markdown을 간단히 JSX로 변환
 */
function SimpleMarkdown({
  content,
}: {
  content: string;
}) {
  const lines = content.replace(/\r/g, "").split("\n");

  const elements: ReactNode[] = [];

  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    /*
     * Markdown 이미지
     * ![설명](주소)
     */
    const imageMatch = trimmed.match(
      /^!\[([^\]]*)\]\(([^)]+)\)$/,
    );

    if (imageMatch) {
      elements.push(
        <figure key={`image-${index}`}>
          <img
            src={resolveMarkdownUrl(imageMatch[2])}
            alt={imageMatch[1] || "매뉴얼 이미지"}
            loading="lazy"
          />

          {imageMatch[1] && (
            <figcaption>{imageMatch[1]}</figcaption>
          )}
        </figure>,
      );

      index += 1;
      continue;
    }

    /*
     * 제목
     */
    if (trimmed.startsWith("#### ")) {
      elements.push(
        <h4 key={`h4-${index}`}>
          {renderInlineMarkdown(trimmed.slice(5))}
        </h4>,
      );

      index += 1;
      continue;
    }

    if (trimmed.startsWith("### ")) {
      elements.push(
        <h3 key={`h3-${index}`}>
          {renderInlineMarkdown(trimmed.slice(4))}
        </h3>,
      );

      index += 1;
      continue;
    }

    if (trimmed.startsWith("## ")) {
      elements.push(
        <h2 key={`h2-${index}`}>
          {renderInlineMarkdown(trimmed.slice(3))}
        </h2>,
      );

      index += 1;
      continue;
    }

    if (trimmed.startsWith("# ")) {
      elements.push(
        <h1 key={`h1-${index}`}>
          {renderInlineMarkdown(trimmed.slice(2))}
        </h1>,
      );

      index += 1;
      continue;
    }

    /*
     * 인용문
     */
    if (trimmed.startsWith("> ")) {
      elements.push(
        <blockquote key={`quote-${index}`}>
          {renderInlineMarkdown(trimmed.slice(2))}
        </blockquote>,
      );

      index += 1;
      continue;
    }

    /*
     * 표
     */
    if (
      trimmed.startsWith("|") &&
      trimmed.endsWith("|")
    ) {
      const tableLines: string[] = [];

      while (
        index < lines.length &&
        lines[index].trim().startsWith("|") &&
        lines[index].trim().endsWith("|")
      ) {
        tableLines.push(lines[index].trim());
        index += 1;
      }

      if (tableLines.length >= 2) {
        const rows = tableLines
          .map((row) =>
            row
              .slice(1, -1)
              .split("|")
              .map((cell) => cell.trim()),
          )
          .filter((row) => {
            return !row.every((cell) =>
              /^:?-{3,}:?$/.test(cell),
            );
          });

        if (rows.length) {
          const [header, ...body] = rows;

          elements.push(
            <div
              key={`table-${index}`}
              style={{ overflowX: "auto" }}
            >
              <table>
                <thead>
                  <tr>
                    {header.map((cell, cellIndex) => (
                      <th key={cellIndex}>
                        {renderInlineMarkdown(cell)}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {body.map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      {row.map((cell, cellIndex) => (
                        <td key={cellIndex}>
                          {renderInlineMarkdown(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>,
          );

          continue;
        }
      }

      continue;
    }

    /*
     * 순서 없는 목록
     */
    if (
      /^[-*]\s+/.test(trimmed)
    ) {
      const listItems: string[] = [];

      while (
        index < lines.length &&
        /^[-*]\s+/.test(lines[index].trim())
      ) {
        listItems.push(
          lines[index].trim().replace(/^[-*]\s+/, ""),
        );

        index += 1;
      }

      elements.push(
        <ul key={`ul-${index}`}>
          {listItems.map((item, itemIndex) => (
            <li key={itemIndex}>
              {renderInlineMarkdown(item)}
            </li>
          ))}
        </ul>,
      );

      continue;
    }

    /*
     * 숫자 목록
     * 1. / 1) / 1).
     */
    if (
      /^\d+[.)]\.?\s+/.test(trimmed)
    ) {
      const listItems: string[] = [];

      while (
        index < lines.length &&
        /^\d+[.)]\.?\s+/.test(lines[index].trim())
      ) {
        listItems.push(
          lines[index]
            .trim()
            .replace(/^\d+[.)]\.?\s+/, ""),
        );

        index += 1;
      }

      elements.push(
        <ol key={`ol-${index}`}>
          {listItems.map((item, itemIndex) => (
            <li key={itemIndex}>
              {renderInlineMarkdown(item)}
            </li>
          ))}
        </ol>,
      );

      continue;
    }

    /*
     * 일반 문단
     */
    elements.push(
      <p key={`p-${index}`}>
        {renderInlineMarkdown(trimmed)}
      </p>,
    );

    index += 1;
  }

  return <>{elements}</>;
}

export function ManualPage({
  title,
  text,
  items,
}: ManualPageProps) {
  const [tab, setTab] =
    useState<Tab>("manual");

  const [query, setQuery] =
    useState("");

  const [selected, setSelected] =
    useState<string | null>(null);

  const [
    manualBodies,
    setManualBodies,
  ] = useState<Record<string, string>>({});

  const [
    loadingIndex,
    setLoadingIndex,
  ] = useState(true);

  const [
    loadError,
    setLoadError,
  ] = useState("");

  const [faqs, setFaqs] =
    useState<FAQItem[]>([]);

  const [
    openFaq,
    setOpenFaq,
  ] = useState<number | null>(null);

  const [
    favorites,
    setFavorites,
  ] = useState<string[]>(() =>
    readStoredArray(FAVORITES_KEY),
  );

  const [
    history,
    setHistory,
  ] = useState<string[]>(() =>
    readStoredArray(HISTORY_KEY),
  );

  const [
    extraSelected,
    setExtraSelected,
  ] = useState<ManualItem | null>(
    items[0] || null,
  );

  useEffect(() => {
    let cancelled = false;

    async function loadManualIndex() {
      setLoadingIndex(true);
      setLoadError("");

      try {
        const entries =
          await Promise.all(
            manualTitles.map(
              async (manualTitle) => {
                const response =
                  await fetch(
                    manualContentUrl(
                      manualTitle,
                    ),
                  );

                if (!response.ok) {
                  return [
                    manualTitle,
                    "",
                  ] as const;
                }

                return [
                  manualTitle,
                  await response.text(),
                ] as const;
              },
            ),
          );

        if (!cancelled) {
          setManualBodies(
            Object.fromEntries(entries),
          );
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(
            error instanceof Error
              ? error.message
              : "E-매뉴얼을 불러오지 못했습니다.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingIndex(false);
        }
      }
    }

    async function loadFaq() {
      try {
        const response = await fetch(
          `${MANUAL_REPO_RAW}/faq.json`,
        );

        if (!response.ok) {
          return;
        }

        const data =
          (await response.json()) as FAQItem[];

        if (
          !cancelled &&
          Array.isArray(data)
        ) {
          setFaqs(data);
        }
      } catch {
        // FAQ 오류가 나더라도
        // E-매뉴얼 본문은 정상 사용
      }
    }

    void loadManualIndex();
    void loadFaq();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(
      FAVORITES_KEY,
      JSON.stringify(favorites),
    );
  }, [favorites]);

  useEffect(() => {
    localStorage.setItem(
      HISTORY_KEY,
      JSON.stringify(history),
    );
  }, [history]);

  useEffect(() => {
    if (
      items.length &&
      !extraSelected
    ) {
      setExtraSelected(items[0]);
    }
  }, [items, extraSelected]);

  const normalizedQuery =
    query.trim().toLowerCase();

  const filteredManualTitles =
    useMemo(() => {
      if (!normalizedQuery) {
        return manualTitles;
      }

      const tokens =
        normalizedQuery
          .split(/\s+/)
          .filter(Boolean);

      return manualTitles.filter(
        (manualTitle) => {
          const haystack =
            `${manualTitle} ${
              manualBodies[
                manualTitle
              ] || ""
            }`.toLowerCase();

          return tokens.every(
            (token) =>
              haystack.includes(token),
          );
        },
      );
    }, [
      manualBodies,
      normalizedQuery,
    ]);

  const filteredFaqs =
    useMemo(() => {
      if (!normalizedQuery) {
        return faqs;
      }

      return faqs.filter((item) =>
        `${item.q} ${item.a}`
          .toLowerCase()
          .includes(normalizedQuery),
      );
    }, [faqs, normalizedQuery]);

  const filteredExtra =
    useMemo(() => {
      if (!normalizedQuery) {
        return items;
      }

      return items.filter((item) =>
        `${item.category} ${item.title} ${item.summary} ${item.body}`
          .toLowerCase()
          .includes(normalizedQuery),
      );
    }, [items, normalizedQuery]);

  const selectedBody =
    selected
      ? manualBodies[selected] || ""
      : "";

  const selectedImages =
    selected
      ? imagesForManual(selected)
      : [];

  function openManual(
    manualTitle: string,
  ) {
    setSelected(manualTitle);

    setHistory((current) =>
      [
        manualTitle,
        ...current.filter(
          (item) =>
            item !== manualTitle,
        ),
      ].slice(0, 5),
    );

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function toggleFavorite(
    manualTitle: string,
  ) {
    setFavorites((current) =>
      current.includes(manualTitle)
        ? current.filter(
            (item) =>
              item !== manualTitle,
          )
        : [manualTitle, ...current],
    );
  }

  function changeTab(next: Tab) {
    setTab(next);
    setQuery("");
    setOpenFaq(null);
  }

  return (
    <>
      <section className="page-hero">
        <div className="hero-inner">
          <span className="eyebrow">
          <h1>{title}</h1>
          <p>{text}</p>
        </div>
      </section>

      <section className="emanual-page">
        <div className="emanual-shell">
          <div className="emanual-top-tabs">
            <button
              className={
                tab === "manual"
                  ? "active"
                  : ""
              }
              onClick={() =>
                changeTab("manual")
              }
            >
              📘 E-매뉴얼
            </button>

            <button
              className={
                tab === "faq"
                  ? "active"
                  : ""
              }
              onClick={() =>
                changeTab("faq")
              }
            >
              💡 자주하는 질문
            </button>

            {items.length > 0 && (
              <button
                className={
                  tab === "extra"
                    ? "active"
                    : ""
                }
                onClick={() =>
                  changeTab("extra")
                }
              >
                📝 추가 안내
              </button>
            )}
          </div>

          <div className="emanual-layout">
            <aside className="emanual-sidebar">
              <div className="emanual-search">
                <span>⌕</span>

                <input
                  value={query}
                  onChange={(event) =>
                    setQuery(
                      event.target.value,
                    )
                  }
                  placeholder={
                    tab === "faq"
                      ? "질문·답변 검색"
                      : tab === "extra"
                        ? "추가 안내 검색"
                        : "제목·본문 통합검색"
                  }
                />
              </div>

              {tab === "manual" && (
                <>
                  <div className="emanual-side-actions">
                    <button
                      onClick={() =>
                        setSelected(null)
                      }
                    >
                      전체 목차
                    </button>

                    <button
                      onClick={() =>
                        setQuery("")
                      }
                    >
                      검색 초기화
                    </button>
                  </div>

                  {!normalizedQuery &&
                    favorites.length >
                      0 && (
                      <div className="emanual-section">
                        <button className="emanual-section-title">
                          ⭐ 즐겨찾기
                        </button>

                        <div className="emanual-section-items">
                          {favorites.map(
                            (item) => (
                              <button
                                key={`fav-${item}`}
                                className={
                                  selected ===
                                  item
                                    ? "active"
                                    : ""
                                }
                                onClick={() =>
                                  openManual(
                                    item,
                                  )
                                }
                              >
                                {item}
                              </button>
                            ),
                          )}
                        </div>
                      </div>
                    )}

                  {!normalizedQuery &&
                    history.length > 0 && (
                      <div className="emanual-section">
                        <button className="emanual-section-title">
                          🕘 최근 열람
                        </button>

                        <div className="emanual-section-items">
                          {history.map(
                            (item) => (
                              <button
                                key={`history-${item}`}
                                className={
                                  selected ===
                                  item
                                    ? "active"
                                    : ""
                                }
                                onClick={() =>
                                  openManual(
                                    item,
                                  )
                                }
                              >
                                {item}
                              </button>
                            ),
                          )}
                        </div>
                      </div>
                    )}

                  {normalizedQuery ? (
                    <div className="emanual-section">
                      <div className="emanual-search-caption">
                        검색 결과{" "}
                        {
                          filteredManualTitles.length
                        }
                        건
                      </div>

                      {filteredManualTitles.map(
                        (
                          manualTitle,
                        ) => (
                          <button
                            key={
                              manualTitle
                            }
                            className={`emanual-search-result ${
                              selected ===
                              manualTitle
                                ? "active"
                                : ""
                            }`}
                            onClick={() =>
                              openManual(
                                manualTitle,
                              )
                            }
                          >
                            {
                              manualTitle
                            }
                          </button>
                        ),
                      )}
                    </div>
                  ) : (
                    Object.entries(
                      manualSections,
                    ).map(
                      ([
                        section,
                        subs,
                      ]) => (
                        <div
                          className="emanual-section"
                          key={section}
                        >
                          <button className="emanual-section-title">
                            {section}
                          </button>

                          <div className="emanual-section-items">
                            {subs.map(
                              (
                                manualTitle,
                              ) => (
                                <button
                                  key={
                                    manualTitle
                                  }
                                  className={
                                    selected ===
                                    manualTitle
                                      ? "active"
                                      : ""
                                  }
                                  onClick={() =>
                                    openManual(
                                      manualTitle,
                                    )
                                  }
                                >
                                  {
                                    manualTitle
                                  }
                                </button>
                              ),
                            )}
                          </div>
                        </div>
                      ),
                    )
                  )}
                </>
              )}

              {tab === "faq" && (
                <div className="emanual-search-caption">
                  FAQ{" "}
                  {filteredFaqs.length}건
                </div>
              )}

              {tab === "extra" && (
                <>
                  <div className="emanual-search-caption">
                    추가 안내{" "}
                    {
                      filteredExtra.length
                    }
                    건
                  </div>

                  <div className="emanual-section-items">
                    {filteredExtra.map(
                      (item) => (
                        <button
                          key={item.id}
                          className={
                            extraSelected?.id ===
                            item.id
                              ? "active"
                              : ""
                          }
                          onClick={() =>
                            setExtraSelected(
                              item,
                            )
                          }
                        >
                          {item.title}
                        </button>
                      ),
                    )}
                  </div>
                </>
              )}
            </aside>

            <main className="emanual-main">
              {tab === "manual" && (
                <>
                  {loadingIndex && (
                    <div className="emanual-loading">
                      E-매뉴얼 내용을
                      불러오는 중입니다.
                    </div>
                  )}

                  {!loadingIndex &&
                    loadError && (
                      <div className="emanual-error">
                        <div>
                          <b>
                            E-매뉴얼을
                            불러오지
                            못했습니다.
                          </b>

                          <br />

                          {loadError}
                        </div>
                      </div>
                    )}

                  {!loadingIndex &&
                    !loadError &&
                    !selected && (
                      <div className="emanual-home">
                        <h2>
                          위험물탱크
                          E-매뉴얼
                        </h2>

                        <p className="emanual-lead">
                          위험물탱크의
                          위치·구조·설비
                          기준부터
                          안전성능검사,
                          정기검사,
                          부록까지 한
                          화면에서 확인할
                          수 있습니다.
                        </p>

                        <div className="emanual-home-grid">
                          {Object.entries(
                            manualSections,
                          ).map(
                            ([
                              section,
                              subs,
                            ]) => (
                              <article
                                className="emanual-home-card"
                                key={
                                  section
                                }
                              >
                                <b>
                                  {
                                    section
                                  }
                                </b>

                                {subs.map(
                                  (
                                    manualTitle,
                                  ) => (
                                    <button
                                      key={
                                        manualTitle
                                      }
                                      onClick={() =>
                                        openManual(
                                          manualTitle,
                                        )
                                      }
                                    >
                                      {
                                        manualTitle
                                      }
                                    </button>
                                  ),
                                )}
                              </article>
                            ),
                          )}
                        </div>
                      </div>
                    )}

                  {!loadingIndex &&
                    !loadError &&
                    selected && (
                      <article className="emanual-document">
                        <div className="emanual-doc-head">
                          <div>
                            <small>
                              위험물탱크
                              E-매뉴얼
                            </small>

                            <h2>
                              {selected}
                            </h2>
                          </div>

                          <button
                            className={`emanual-fav ${
                              favorites.includes(
                                selected,
                              )
                                ? "active"
                                : ""
                            }`}
                            onClick={() =>
                              toggleFavorite(
                                selected,
                              )
                            }
                          >
                            {favorites.includes(
                              selected,
                            )
                              ? "★ 즐겨찾기"
                              : "☆ 즐겨찾기"}
                          </button>
                        </div>

                        {selectedImages.length >
                          0 && (
                          <div className="emanual-images">
                            {selectedImages.map(
                              (
                                fileName,
                              ) => (
                                <figure
                                  key={
                                    fileName
                                  }
                                >
                                  <img
                                    src={manualImageUrl(
                                      fileName,
                                    )}
                                    alt={`${selected} 참고 이미지`}
                                    loading="lazy"
                                  />

                                  <figcaption>
                                    {fileName
                                      .replace(
                                        /\.(png|jpe?g|webp)$/i,
                                        "",
                                      )
                                      .replace(
                                        `${selected.replaceAll(
                                          " ",
                                          "_",
                                        )}_`,
                                        "",
                                      )
                                      .replaceAll(
                                        "_",
                                        " ",
                                      )}
                                  </figcaption>
                                </figure>
                              ),
                            )}
                          </div>
                        )}

                        <div className="emanual-markdown">
                          {selectedBody ? (
                            <SimpleMarkdown
                              content={
                                selectedBody
                              }
                            />
                          ) : (
                            <p>
                              해당 매뉴얼
                              본문을 찾을 수
                              없습니다.
                            </p>
                          )}
                        </div>
                      </article>
                    )}
                </>
              )}

              {tab === "faq" && (
                <section className="emanual-faq">
                  <h2>
                    자주하는 질문
                  </h2>

                  <p className="emanual-lead">
                    위험물탱크 검사와
                    관련해 자주 확인하는
                    질문을 검색할 수
                    있습니다.
                  </p>

                  {filteredFaqs.length ? (
                    <div className="emanual-faq-list">
                      {filteredFaqs.map(
                        (
                          item,
                          index,
                        ) => (
                          <article
                            className="emanual-faq-item"
                            key={`${item.q}-${index}`}
                          >
                            <button
                              className="emanual-faq-question"
                              onClick={() =>
                                setOpenFaq(
                                  openFaq ===
                                    index
                                    ? null
                                    : index,
                                )
                              }
                            >
                              Q. {item.q}
                            </button>

                            {openFaq ===
                              index && (
                              <div className="emanual-faq-answer">
                                A.{" "}
                                {item.a}
                              </div>
                            )}
                          </article>
                        ),
                      )}
                    </div>
                  ) : (
                    <div className="emanual-loading">
                      검색 결과가
                      없습니다.
                    </div>
                  )}
                </section>
              )}

              {tab === "extra" && (
                <section className="emanual-extra">
                  <h2>추가 안내</h2>

                  <p className="emanual-lead">
                    기존 KFI-SUPPORT
                    관리자에서 등록한
                    매뉴얼·FAQ
                    내용입니다.
                  </p>

                  {extraSelected ? (
                    <div className="emanual-extra-list">
                      <div className="emanual-extra-menu">
                        {filteredExtra.map(
                          (item) => (
                            <button
                              key={
                                item.id
                              }
                              className={
                                extraSelected.id ===
                                item.id
                                  ? "active"
                                  : ""
                              }
                              onClick={() =>
                                setExtraSelected(
                                  item,
                                )
                              }
                            >
                              {
                                item.title
                              }
                            </button>
                          ),
                        )}
                      </div>

                      <article className="emanual-extra-body">
                        <span>
                          {
                            extraSelected.category
                          }
                        </span>

                        <h3>
                          {
                            extraSelected.title
                          }
                        </h3>

                        <p className="summary">
                          {
                            extraSelected.summary
                          }
                        </p>

                        <div className="body">
                          {
                            extraSelected.body
                          }
                        </div>
                      </article>
                    </div>
                  ) : (
                    <div className="emanual-loading">
                      등록된 추가 안내가
                      없습니다.
                    </div>
                  )}
                </section>
              )}
            </main>
          </div>
        </div>
      </section>
    </>
  );
}
