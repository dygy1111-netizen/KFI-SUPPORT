import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { AdminPanel } from "./components/AdminPanel";
import { defaultContent, defaultConfig } from "./defaults";

import {
  isSupabaseConfigured,
  publicAssetUrl,
  supabase,
} from "./lib/supabase";

import { ManualPage } from "./features/manual/ManualPage";

import type {
  CaseItem,
  ManualItem,
  PortalContent,
  ResourceItem,
  SiteConfig,
  View,
} from "./types";


const validViews: View[] = [
  "home",
  "schedule",
  "procedure",
  "cases",
  "manual",
  "resources",
  "admin",
];


const KFI_ON_URL =
  "https://dygy1111-netizen.github.io/KFI-ON/";

const OPEN_INSPECTION_URL =
  "https://ee2478-lab.github.io/open-inspection/";


export default function App() {
  const [view, setView] = useState<View>("home");

  const [content, setContent] =
    useState<PortalContent>(defaultContent);

  const [notice, setNotice] = useState("");

  const [loading, setLoading] = useState(true);


  const reload = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setNotice(
        "Supabase 연결값을 입력하기 전이라 기본 화면을 표시하고 있습니다.",
      );

      setLoading(false);

      return;
    }

    try {
      const [
        configResult,
        casesResult,
        manualsResult,
        resourcesResult,
      ] = await Promise.all([
        supabase
          .from("site_config")
          .select("config")
          .eq("id", 1)
          .maybeSingle(),

        supabase
          .from("cases")
          .select("*")
          .order("id", { ascending: false }),

        supabase
          .from("manuals")
          .select("*")
          .order("id", { ascending: true }),

        supabase
          .from("resources")
          .select("*")
          .order("id", { ascending: false }),
      ]);

      const error =
        configResult.error ||
        casesResult.error ||
        manualsResult.error ||
        resourcesResult.error;

      if (error) {
        setNotice(
          `Supabase 내용을 불러오지 못했습니다: ${error.message}`,
        );

        return;
      }

      setContent({
        config: {
          ...defaultConfig,
          ...((configResult.data?.config || {}) as Partial<SiteConfig>),
        },

        cases: (casesResult.data || []) as CaseItem[],

        manuals:
          (manualsResult.data || []) as ManualItem[],

        resources:
          (resourcesResult.data || []) as ResourceItem[],
      });

      setNotice("");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "알 수 없는 오류가 발생했습니다.";

      setNotice(
        `Supabase 내용을 불러오지 못했습니다: ${message}`,
      );
    } finally {
      setLoading(false);
    }
  }, []);


  useEffect(() => {
    void reload();

    const syncView = () => {
      const next =
        window.location.hash.replace("#", "") as View;

      setView(
        validViews.includes(next)
          ? next
          : "home",
      );
    };

    syncView();

    window.addEventListener(
      "hashchange",
      syncView,
    );

    return () =>
      window.removeEventListener(
        "hashchange",
        syncView,
      );
  }, [reload]);


  const move = (next: View) => {
    window.location.hash = next;

    setView(next);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };


  if (loading) {
    return <div className="site-shell" />;
  }


  const config = content.config;


  return (
    <div className="site-shell">
      <Header
        config={config}
        active={view}
        move={move}
      />

      {notice && (
        <div className="system-notice">
          {notice}
        </div>
      )}


      {view === "home" && (
        <HomeView
          config={config}
          move={move}
        />
      )}


      {view === "schedule" && (
        <SchedulePage />
      )}


      {view === "procedure" && (
        <ProcedurePage />
      )}


      {view === "cases" && (
        <CasesView
          config={config}
          items={content.cases}
        />
      )}


      {view === "manual" && (
        <ManualPage
          title={config.manualTitle}
          text={config.manualText}
          items={content.manuals}
        />
      )}


      {view === "resources" && (
        <ResourcesView
          config={config}
          items={content.resources}
        />
      )}


      {view === "admin" && (
        <AdminPanel
          content={content}
          reload={reload}
        />
      )}


      {view !== "schedule" &&
        view !== "procedure" && (
          <footer className="footer">
            <div>
              <strong>
                {config.organization}
              </strong>

              <span>
                {config.siteTitle}
              </span>
            </div>

            <p>
              {config.footerNotice}
            </p>
          </footer>
        )}
    </div>
  );
}



function Header({
  config,
  active,
  move,
}: {
  config: SiteConfig;
  active: View;
  move: (view: View) => void;
}) {
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
        <button
          className="brand"
          onClick={() => move("home")}
          aria-label="홈으로 이동"
        >
          <img
            src={`${import.meta.env.BASE_URL}images/kfi-symbol.png`}
            alt="KFI"
            className="brand-symbol"
          />

          <span className="brand-name">
            한국소방산업기술원
          </span>
        </button>


        <nav
          className="main-nav"
          aria-label="주요 메뉴"
        >
          {items.map(
            ([key, label]) => (
              <button
                key={key}
                className={
                  active === key
                    ? "active"
                    : ""
                }
                onClick={() =>
                  move(key)
                }
              >
                {label}
              </button>
            ),
          )}
        </nav>
      </header>


      <nav
        className="mobile-nav"
        aria-label="모바일 메뉴"
      >
        {items.map(
          ([key, label]) => (
            <button
              key={key}
              className={
                active === key
                  ? "active"
                  : ""
              }
              onClick={() =>
                move(key)
              }
            >
              {label}
            </button>
          ),
        )}
      </nav>
    </>
  );
}



function SchedulePage() {
  return (
    <div
      style={{
        width: "100%",
        height:
          "calc(100vh - 120px)",
        minHeight: "750px",
        overflow: "hidden",
        backgroundColor: "#ffffff",
      }}
    >
      <iframe
        src={KFI_ON_URL}
        title="KFI-ON 검사시기 일정확인"
        style={{
          display: "block",
          width: "100%",
          height:
            "calc(100% + 64px)",
          border: "none",
          transform:
            "translateY(-64px)",
          backgroundColor: "#ffffff",
        }}
      />
    </div>
  );
}



function ProcedurePage() {
  const PROCEDURE_HEADER_CROP = 98;

  const [
    procedureTab,
    setProcedureTab,
  ] = useState<
    "guide" | "documents"
  >("documents");


  const documentGroups = [
    {
      title:
        "옥외탱크저장소 기술검토",

      description:
        "기술검토 신청 시 준비해야 하는 주요 서류입니다.",

      items: [
        "기술검토신청서 및 구조설비명세표",
        "설계도면(기초, 탱크본체, 소화설비 등)",
        "구조계산서(기초, 탱크본체, 소화설비 등)",
        "지반조사자료",
        "공사계획서 및 공정표",
        "용접부에 관한 설명서",
      ],
    },

    {
      title:
        "옥외탱크저장소 안전성능검사",

      description:
        "안전성능검사 신청 시 준비해야 하는 주요 서류입니다.",

      items: [
        "안전성능검사 신청서 및 구조설비명세표",
        "설치허가서 사본",
        "관련 설계도면(기초, 탱크본체)",
      ],
    },

    {
      title:
        "옥외탱크저장소 완공검사",

      description:
        "완공검사 신청 시 준비해야 하는 주요 서류입니다.",

      items: [
        "완공검사 신청서 및 구조설비명세표",
        "배관에 관한 내압시험, 비파괴시험 등에 합격하였음을 증명하는 서류",
        "재료의 성능을 증명하는 서류",
        "위험물탱크, 방유제 등의 설계도면",
        "소화설비, 전기설비 등의 계산서 및 설계도면 등",
      ],
    },

    {
      title:
        "옥외탱크저장소 중간·정밀 정기검사",

      description:
        "정기검사 신청 시 준비해야 하는 주요 서류입니다.",

      items: [
        "정기검사신청서 및 구조설비명세표",
        "위치·구조 및 설비에 관한 도면",
        "완공검사합격확인증 사본",
        "밑판, 옆판, 지붕판 및 개구부의 보수이력에 관한 서류",
        "구조안전점검 성적서(정밀정기검사에 한함)",
      ],
    },
  ];


  return (
    <div
      style={{
        width: "100%",
        minHeight:
          "calc(100vh - 74px)",
        backgroundColor: "#f4f7fb",
      }}
    >
      {/* 내부 탭 */}
      <div
        style={{
          backgroundColor: "#ffffff",
          borderBottom:
            "1px solid #dce3ee",
        }}
      >
        <div
          style={{
            maxWidth: "1180px",
            margin: "0 auto",
            padding:
              "18px 28px 0",
            display: "flex",
            gap: "8px",
          }}
        >
          {/* 신청·구비서류를 첫 번째로 */}
          <button
            onClick={() =>
              setProcedureTab(
                "documents",
              )
            }
            style={{
              border: "none",

              borderBottom:
                procedureTab ===
                "documents"
                  ? "3px solid #2868df"
                  : "3px solid transparent",

              backgroundColor:
                "transparent",

              color:
                procedureTab ===
                "documents"
                  ? "#1d57b7"
                  : "#66758b",

              padding:
                "12px 18px",

              fontSize: "1rem",

              fontWeight: 850,
            }}
          >
            신청·구비서류
          </button>


          <button
            onClick={() =>
              setProcedureTab(
                "guide",
              )
            }
            style={{
              border: "none",

              borderBottom:
                procedureTab ===
                "guide"
                  ? "3px solid #2868df"
                  : "3px solid transparent",

              backgroundColor:
                "transparent",

              color:
                procedureTab ===
                "guide"
                  ? "#1d57b7"
                  : "#66758b",

              padding:
                "12px 18px",

              fontSize: "1rem",

              fontWeight: 850,
            }}
          >
            검사절차 안내
          </button>
        </div>
      </div>


      {/* 신청·구비서류 */}
      {procedureTab ===
        "documents" && (
        <section
          style={{
            maxWidth: "1180px",
            margin: "0 auto",

            padding:
              "48px 28px 80px",
          }}
        >
          <div
            style={{
              marginBottom: "32px",
            }}
          >
            <h1
              style={{
                margin:
                  "0 0 10px",

                fontSize: "2rem",

                lineHeight: 1.3,

                letterSpacing:
                  "-0.035em",

                color: "#172135",
              }}
            >
              옥외탱크저장소
              신청·구비서류
            </h1>


            <p
              style={{
                margin: 0,

                color: "#637086",

                fontSize: "1rem",

                lineHeight: 1.75,
              }}
            >
              검사 종류별 신청 시
              준비해야 하는 주요 서류를
              확인할 수 있습니다.
            </p>
          </div>


          <div
            style={{
              display: "grid",

              gridTemplateColumns:
                "repeat(auto-fit, minmax(430px, 1fr))",

              gap: "18px",
            }}
          >
            {documentGroups.map(
              (group, index) => (
                <article
                  key={group.title}
                  style={{
                    backgroundColor:
                      "#ffffff",

                    border:
                      "1px solid #d9e1ed",

                    borderRadius:
                      "14px",

                    padding:
                      "28px 30px",

                    boxShadow:
                      "0 7px 24px rgba(24, 39, 75, 0.05)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",

                      alignItems:
                        "center",

                      gap: "12px",

                      marginBottom:
                        "8px",
                    }}
                  >
                    <span
                      style={{
                        width: "34px",

                        height: "34px",

                        flex: "0 0 auto",

                        borderRadius:
                          "50%",

                        display: "grid",

                        placeItems:
                          "center",

                        backgroundColor:
                          "#edf4ff",

                        color:
                          "#2865ca",

                        fontSize:
                          "0.85rem",

                        fontWeight:
                          900,
                      }}
                    >
                      {String(
                        index + 1,
                      ).padStart(
                        2,
                        "0",
                      )}
                    </span>


                    <h2
                      style={{
                        margin: 0,

                        color:
                          "#1b2c47",

                        fontSize:
                          "1.18rem",

                        lineHeight:
                          1.45,

                        letterSpacing:
                          "-0.02em",
                      }}
                    >
                      {group.title}
                    </h2>
                  </div>


                  <p
                    style={{
                      margin:
                        "0 0 20px 46px",

                      color:
                        "#7a8799",

                      fontSize:
                        "0.88rem",
                    }}
                  >
                    {
                      group.description
                    }
                  </p>


                  <ul
                    style={{
                      margin: 0,

                      paddingLeft:
                        "24px",

                      color:
                        "#43516a",

                      lineHeight:
                        1.85,

                      fontSize:
                        "0.95rem",
                    }}
                  >
                    {group.items.map(
                      (item) => (
                        <li
                          key={item}
                          style={{
                            marginBottom:
                              "7px",

                            paddingLeft:
                              "3px",
                          }}
                        >
                          {item}
                        </li>
                      ),
                    )}
                  </ul>
                </article>
              ),
            )}
          </div>


          <div
            style={{
              marginTop: "24px",

              backgroundColor:
                "#edf4ff",

              border:
                "1px solid #c9dcfa",

              borderRadius: "10px",

              padding:
                "17px 20px",

              color: "#435a7c",

              fontSize: "0.9rem",

              lineHeight: 1.7,
            }}
          >
            <b
              style={{
                color: "#245fc6",
              }}
            >
              안내
            </b>

            <br />

            실제 신청 시 시설의 구조
            및 검사 내용에 따라
            추가자료가 요구될 수
            있습니다. 세부사항은
            담당자와 확인해 주세요.
          </div>
        </section>
      )}


      {/* 검사절차 안내 */}
      {procedureTab ===
        "guide" && (
        <div
          style={{
            width: "100%",

            height:
              "calc(100vh - 135px)",

            minHeight: "750px",

            overflow: "hidden",

            backgroundColor:
              "#ffffff",
          }}
        >
          <iframe
            src={
              OPEN_INSPECTION_URL
            }
            title="검사절차 안내"
            style={{
              display: "block",

              width: "100%",

              height: `calc(100% + ${PROCEDURE_HEADER_CROP}px)`,

              border: "none",

              transform: `translateY(-${PROCEDURE_HEADER_CROP}px)`,

              backgroundColor:
                "#ffffff",
            }}
          />
        </div>
      )}
    </div>
  );
}



function PageHero({
  title,
  text,
}: {
  title: string;
  text: string;
}) {
  return (
    <section className="page-hero">
      <div className="hero-inner">
        <h1>{title}</h1>

        <p>{text}</p>
      </div>
    </section>
  );
}



function HomeView({
  config,
  move,
}: {
  config: SiteConfig;
  move: (view: View) => void;
}) {
  const cards: Array<{
    key: View;
    no: string;
    title: string;
    text: string;
    tone: string;
  }> = [
    {
      key: "schedule",
      no: "01",
      title: config.scheduleTitle,
      text: config.scheduleCardText,
      tone: "blue",
    },

    {
      key: "procedure",
      no: "02",
      title: config.procedureTitle,
      text: config.procedureCardText,
      tone: "indigo",
    },

    {
      key: "cases",
      no: "03",
      title: config.casesTitle,
      text: config.casesCardText,
      tone: "orange",
    },

    {
      key: "manual",
      no: "04",
      title: config.manualTitle,
      text: config.manualCardText,
      tone: "teal",
    },

    {
      key: "resources",
      no: "05",
      title: config.resourcesTitle,
      text: config.resourcesCardText,
      tone: "slate",
    },
  ];


  return (
    <>
      <section className="home-hero">
        <div className="hero-inner home-hero-grid">
          <div>
            <span className="eyebrow">
              {config.heroEyebrow}
            </span>

            <h1>
              {config.heroTitle}

              <br />

              <em>
                {config.heroAccent}
              </em>
            </h1>

            <p>
              {config.heroText}
            </p>
          </div>


          <div className="journey-card">
            <div>
              <span>
                BEFORE
              </span>

              <b>
                미리 준비하고
              </b>

              <p>
                검사기한·서류 확인
              </p>
            </div>


            <i>→</i>


            <div>
              <span>
                DURING
              </span>

              <b>
                쉽게 이해하고
              </b>

              <p>
                검사절차·방법 안내
              </p>
            </div>


            <i>→</i>


            <div>
              <span>
                AFTER
              </span>

              <b>
                함께 개선합니다
              </b>

              <p>
                개선사례·예방대책
              </p>
            </div>
          </div>
        </div>
      </section>


      <section className="content-section">
        <div className="section-heading">
          <div>
            <span className="section-kicker">
              QUICK SERVICE
            </span>

            <h2>
              어떤 도움이
              필요하신가요?
            </h2>
          </div>


          <p>
            현재 상황에 맞는 서비스를
            선택해 주세요.
          </p>
        </div>


        <div className="service-grid">
          {cards.map((card) => (
            <button
              className={`service-card ${card.tone}`}
              key={card.key}
              onClick={() =>
                move(card.key)
              }
            >
              <span className="service-icon">
                {card.no}
              </span>

              <h3>
                {card.title}
              </h3>

              <p>
                {card.text}
              </p>

              <b>
                바로가기 →
              </b>
            </button>
          ))}
        </div>
      </section>
    </>
  );
}



function CasesView({
  config,
  items,
}: {
  config: SiteConfig;
  items: CaseItem[];
}) {
  const [query, setQuery] =
    useState("");

  const [
    category,
    setCategory,
  ] = useState("전체");

  const [
    selected,
    setSelected,
  ] = useState<CaseItem | null>(
    null,
  );


  const categories =
    useMemo(
      () => [
        "전체",
        ...new Set(
          items.map(
            (item) =>
              item.category,
          ),
        ),
      ],
      [items],
    );


  const filtered =
    items.filter(
      (item) =>
        (category === "전체" ||
          item.category ===
            category) &&
        `${item.title} ${item.summary} ${item.cause} ${item.action}`.includes(
          query,
        ),
    );


  return (
    <>
      <PageHero
        title={config.casesTitle}
        text={config.casesText}
      />


      <section className="content-section compact">
        <Toolbar
          query={query}
          setQuery={setQuery}
          placeholder="사례명, 원인, 개선방법 검색"
          categories={categories}
          category={category}
          setCategory={
            setCategory
          }
        />


        <div className="case-count">
          <b>
            {filtered.length}
          </b>
          개의 품질관리 사례
        </div>


        {filtered.length ? (
          <div className="case-grid">
            {filtered.map(
              (item) => (
                <button
                  className="case-card"
                  key={item.id}
                  onClick={() =>
                    setSelected(
                      item,
                    )
                  }
                >
                  <div className="case-visual">
                    {item.before_image_path ? (
                      <img
                        src={publicAssetUrl(
                          item.before_image_path,
                        )}
                        alt="사례 사진"
                      />
                    ) : (
                      <i>!</i>
                    )}


                    <span>
                      {
                        item.category
                      }
                    </span>


                    <b>
                      {item.status}
                    </b>
                  </div>


                  <div className="case-copy">
                    <span>
                      CASE{" "}
                      {String(
                        item.id,
                      ).padStart(
                        2,
                        "0",
                      )}
                    </span>


                    <h3>
                      {item.title}
                    </h3>


                    <p>
                      {
                        item.summary
                      }
                    </p>


                    <b>
                      자세히 보기 →
                    </b>
                  </div>
                </button>
              ),
            )}
          </div>
        ) : (
          <Empty
            title="게시된 사례가 없습니다"
            text="관리자 화면에서 첫 사례를 등록해 주세요."
          />
        )}
      </section>


      {selected && (
        <Modal
          close={() =>
            setSelected(null)
          }
        >
          <span className="result-label">
            {selected.category} ·{" "}
            {selected.status}
          </span>


          <h2>
            {selected.title}
          </h2>


          <p className="modal-lead">
            {selected.summary}
          </p>


          {(selected.before_image_path ||
            selected.after_image_path) && (
            <div className="case-photo-pair">
              {selected.before_image_path && (
                <figure>
                  <img
                    src={publicAssetUrl(
                      selected.before_image_path,
                    )}
                    alt="개선 전"
                  />

                  <figcaption>
                    개선 전
                  </figcaption>
                </figure>
              )}


              {selected.after_image_path && (
                <figure>
                  <img
                    src={publicAssetUrl(
                      selected.after_image_path,
                    )}
                    alt="개선 후"
                  />

                  <figcaption>
                    개선 후
                  </figcaption>
                </figure>
              )}
            </div>
          )}


          <dl>
            <dt>
              발생 원인
            </dt>

            <dd>
              {selected.cause}
            </dd>


            <dt>
              개선 방법
            </dt>

            <dd>
              {selected.action}
            </dd>


            <dt>
              관련 기준
            </dt>

            <dd>
              {selected.standard}
            </dd>
          </dl>
        </Modal>
      )}
    </>
  );
}



function ResourcesView({
  config,
  items,
}: {
  config: SiteConfig;
  items: ResourceItem[];
}) {
  const [query, setQuery] =
    useState("");

  const [
    category,
    setCategory,
  ] = useState("전체");


  const categories =
    useMemo(
      () => [
        "전체",
        ...new Set(
          items.map(
            (item) =>
              item.category,
          ),
        ),
      ],
      [items],
    );


  const filtered =
    items.filter(
      (item) =>
        (category === "전체" ||
          item.category ===
            category) &&
        `${item.title} ${item.description} ${item.file_name}`.includes(
          query,
        ),
    );


  return (
    <>
      <PageHero
        title={
          config.resourcesTitle
        }
        text={
          config.resourcesText
        }
      />


      <section className="content-section compact">
        <Toolbar
          query={query}
          setQuery={setQuery}
          placeholder="양식명, 설명, 파일명 검색"
          categories={categories}
          category={category}
          setCategory={
            setCategory
          }
        />


        {filtered.length ? (
          <div className="resource-list">
            {filtered.map(
              (item) => (
                <article
                  key={item.id}
                >
                  <span className="file-icon">
                    {item.file_name
                      .split(".")
                      .pop()
                      ?.toUpperCase()}
                  </span>


                  <div>
                    <span>
                      {
                        item.category
                      }
                    </span>


                    <h3>
                      {item.title}
                    </h3>


                    <p>
                      {
                        item.description
                      }
                    </p>


                    <small>
                      {
                        item.file_name
                      }{" "}
                      ·{" "}
                      {formatSize(
                        item.file_size,
                      )}
                    </small>
                  </div>


                  <a
                    href={publicAssetUrl(
                      item.file_path,
                    )}
                    download={
                      item.file_name
                    }
                    target="_blank"
                    rel="noreferrer"
                  >
                    다운로드 ↓
                  </a>
                </article>
              ),
            )}
          </div>
        ) : (
          <Empty
            title="게시된 양식이 없습니다"
            text="관리자 화면에서 양식과 참고자료를 게시해 주세요."
          />
        )}
      </section>
    </>
  );
}



function Toolbar({
  query,
  setQuery,
  placeholder,
  categories,
  category,
  setCategory,
}: {
  query: string;

  setQuery: (
    value: string,
  ) => void;

  placeholder: string;

  categories: string[];

  category: string;

  setCategory: (
    value: string,
  ) => void;
}) {
  return (
    <div className="toolbar">
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
          placeholder={
            placeholder
          }
        />
      </div>


      <div className="filter-row">
        {categories.map(
          (item) => (
            <button
              key={item}
              className={
                category ===
                item
                  ? "active"
                  : ""
              }
              onClick={() =>
                setCategory(
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
  );
}



function Modal({
  close,
  children,
}: {
  close: () => void;

  children: ReactNode;
}) {
  return (
    <div
      className="modal-backdrop"
      onClick={close}
    >
      <article
        className="case-modal"
        onClick={(event) =>
          event.stopPropagation()
        }
      >
        <button
          className="modal-close"
          onClick={close}
          aria-label="닫기"
        >
          ×
        </button>


        {children}
      </article>
    </div>
  );
}



function Empty({
  title,
  text,
}: {
  title: string;
  text: string;
}) {
  return (
    <div className="empty-state">
      <span>
        ⌕
      </span>

      <b>
        {title}
      </b>

      <p>
        {text}
      </p>
    </div>
  );
}



function formatSize(
  size: number,
) {
  if (size < 1024) {
    return `${size} B`;
  }

  if (
    size <
    1024 * 1024
  ) {
    return `${Math.round(
      size / 1024,
    )} KB`;
  }

  return `${(
    size /
    1024 /
    1024
  ).toFixed(1)} MB`;
}
