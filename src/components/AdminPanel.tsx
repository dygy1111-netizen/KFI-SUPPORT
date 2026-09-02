import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";

import { defaultConfig } from "../defaults";

import {
  isSupabaseConfigured,
  publicAssetUrl,
  removePublicFile,
  supabase,
  uploadPublicFile,
} from "../lib/supabase";

import type {
  CaseItem,
  ManualItem,
  PortalContent,
  ResourceItem,
  SiteConfig,
} from "../types";

import { CasebookManager } from "./CasebookManager";


type Tab =
  | "basic"
  | "cases"
  | "casebook"
  | "manuals"
  | "resources"
  | "account";


const emptyCase:
  Omit<CaseItem, "id"> & {
    id?: number;
  } = {
  category: "안전성능검사",
  title: "",
  summary: "",
  cause: "",
  action: "",
  standard: "",
  status: "보완",
  published: true,
  before_image_path: null,
  after_image_path: null,
};


const emptyManual:
  Omit<ManualItem, "id"> & {
    id?: number;
  } = {
  category: "검사 준비",
  title: "",
  summary: "",
  body: "",
  faq: false,
  published: true,
};


const emptyResource:
  Omit<ResourceItem, "id"> & {
    id?: number;
  } = {
  category: "신청 양식",
  title: "",
  description: "",
  file_path: "",
  file_name: "",
  file_type: "application/octet-stream",
  file_size: 0,
  published: true,
};


const configGroups: Array<{
  title: string;

  fields: Array<{
    key: keyof SiteConfig;
    label: string;
    long?: boolean;
  }>;
}> = [
  {
    title: "사이트 기본정보",

    fields: [
      {
        key: "organization",
        label: "기관명",
      },

      {
        key: "siteTitle",
        label: "사이트 제목",
      },

      {
        key: "heroEyebrow",
        label: "첫 화면 작은 제목",
      },

      {
        key: "heroTitle",
        label: "첫 화면 큰 제목",
      },

      {
        key: "heroAccent",
        label: "강조 제목",
      },

      {
        key: "heroText",
        label: "첫 화면 소개문구",
        long: true,
      },

      {
        key: "footerNotice",
        label: "하단 안내문",
        long: true,
      },
    ],
  },

  {
    title: "상단 메뉴명",

    fields: [
      {
        key: "navHome",
        label: "홈",
      },

      {
        key: "navSchedule",
        label: "검사시기",
      },

      {
        key: "navProcedure",
        label: "검사절차",
      },

      {
        key: "navCases",
        label: "품질사례",
      },

      {
        key: "navManual",
        label: "E-매뉴얼",
      },

      {
        key: "navResources",
        label: "양식자료",
      },

      {
        key: "navAdmin",
        label: "관리자",
      },
    ],
  },

  {
    title: "서비스 제목·소개",

    fields: [
      {
        key: "scheduleTitle",
        label: "검사시기 제목",
      },

      {
        key: "scheduleText",
        label: "검사시기 소개",
        long: true,
      },

      {
        key: "scheduleCardText",
        label: "검사시기 카드문구",
        long: true,
      },

      {
        key: "procedureTitle",
        label: "검사절차 제목",
      },

      {
        key: "procedureText",
        label: "검사절차 소개",
        long: true,
      },

      {
        key: "procedureCardText",
        label: "검사절차 카드문구",
        long: true,
      },

      {
        key: "casesTitle",
        label: "품질사례 제목",
      },

      {
        key: "casesText",
        label: "품질사례 소개",
        long: true,
      },

      {
        key: "casesCardText",
        label: "품질사례 카드문구",
        long: true,
      },

      {
        key: "manualTitle",
        label: "매뉴얼 제목",
      },

      {
        key: "manualText",
        label: "매뉴얼 소개",
        long: true,
      },

      {
        key: "manualCardText",
        label: "매뉴얼 카드문구",
        long: true,
      },

      {
        key: "resourcesTitle",
        label: "양식자료 제목",
      },

      {
        key: "resourcesText",
        label: "양식자료 소개",
        long: true,
      },

      {
        key: "resourcesCardText",
        label: "양식자료 카드문구",
        long: true,
      },
    ],
  },
];


export function AdminPanel({
  content,
  reload,
}: {
  content: PortalContent;
  reload: () => Promise<void>;
}) {
  const [
    checking,
    setChecking,
  ] = useState(true);

  const [
    isAdmin,
    setIsAdmin,
  ] = useState(false);

  const [
    tab,
    setTab,
  ] = useState<Tab>("basic");

  const [
    message,
    setMessage,
  ] = useState("");

  const [
    error,
    setError,
  ] = useState(false);

  const [
    busy,
    setBusy,
  ] = useState(false);

  const [
    login,
    setLogin,
  ] = useState({
    email: "",
    password: "",
  });

  const [
    adminEmail,
    setAdminEmail,
  ] = useState("");

  const [
    config,
    setConfig,
  ] = useState<SiteConfig>(
    content.config,
  );

  const [
    caseDraft,
    setCaseDraft,
  ] = useState(emptyCase);

  const [
    manualDraft,
    setManualDraft,
  ] = useState(
    emptyManual,
  );

  const [
    resourceDraft,
    setResourceDraft,
  ] = useState(
    emptyResource,
  );

  const [
    caseFiles,
    setCaseFiles,
  ] = useState<{
    before: File | null;
    after: File | null;
  }>({
    before: null,
    after: null,
  });

  const [
    resourceFile,
    setResourceFile,
  ] = useState<File | null>(
    null,
  );

  const [
    passwords,
    setPasswords,
  ] = useState({
    next: "",
    confirm: "",
  });


  useEffect(
    () =>
      setConfig(
        content.config,
      ),
    [content.config],
  );


  useEffect(() => {
    let active = true;


    const check =
      async () => {
        if (
          !isSupabaseConfigured
        ) {
          if (active) {
            setChecking(false);
          }

          return;
        }


        const {
          data:
            sessionData,
        } =
          await supabase.auth.getSession();


        if (
          !sessionData.session
        ) {
          if (active) {
            setIsAdmin(false);

            setChecking(
              false,
            );
          }

          return;
        }


        const {
          data,
          error:
            roleError,
        } =
          await supabase.rpc(
            "is_admin",
          );


        if (active) {
          const allowed =
            Boolean(data) &&
            !roleError;


          setIsAdmin(
            allowed,
          );


          setAdminEmail(
            allowed
              ? sessionData
                  .session
                  .user
                  .email ||
                  ""
              : "",
          );


          setChecking(false);


          if (allowed) {
            await reload();
          }
        }
      };


    void check();


    const {
      data:
        listener,
    } =
      supabase.auth.onAuthStateChange(
        (event) => {
          if (
            event ===
            "SIGNED_OUT"
          ) {
            setIsAdmin(
              false,
            );

            setAdminEmail(
              "",
            );
          }
        },
      );


    return () => {
      active = false;

      listener.subscription.unsubscribe();
    };
  }, [reload]);


  const notify = (
    text: string,
    failed = false,
  ) => {
    setMessage(text);

    setError(failed);
  };


  const run = async (
    job: () => Promise<void>,
    success: string,
  ) => {
    setBusy(true);

    notify("");


    try {
      await job();

      await reload();

      notify(success);
    } catch (caught) {
      notify(
        caught instanceof Error
          ? caught.message
          : "작업을 완료하지 못했습니다.",
        true,
      );
    } finally {
      setBusy(false);
    }
  };


  const submitLogin =
    async (
      event: FormEvent,
    ) => {
      event.preventDefault();


      const email =
        login.email
          .trim()
          .toLowerCase();


      if (!email) {
        notify(
          "관리자 이메일을 입력해 주세요.",
          true,
        );

        return;
      }


      setBusy(true);

      notify("");


      const {
        data:
          loginData,
        error:
          loginError,
      } =
        await supabase.auth.signInWithPassword(
          {
            email,

            password:
              login.password,
          },
        );


      if (loginError) {
        notify(
          "이메일 또는 비밀번호를 확인해 주세요.",
          true,
        );

        setBusy(false);

        return;
      }


      const {
        data,
        error:
          roleError,
      } =
        await supabase.rpc(
          "is_admin",
        );


      if (
        !data ||
        roleError
      ) {
        await supabase.auth.signOut();


        notify(
          "로그인은 됐지만 관리자 권한이 등록되지 않았습니다. admin_users에 해당 사용자의 UID가 등록되어 있는지 확인해 주세요.",
          true,
        );


        setBusy(false);

        return;
      }


      setIsAdmin(true);


      setAdminEmail(
        loginData.user
          .email ||
          email,
      );


      setLogin({
        email: "",
        password: "",
      });


      await reload();


      setBusy(false);
    };


  const logout =
    async () => {
      await supabase.auth.signOut();

      setIsAdmin(false);

      setAdminEmail("");

      notify("");
    };


  if (
    !isSupabaseConfigured
  ) {
    return (
      <AdminGate
        title="Supabase 연결이 필요합니다"
        text=".env 파일에 프로젝트 URL과 anon key를 입력한 뒤 다시 실행해 주세요."
      />
    );
  }


  if (checking) {
    return (
      <AdminGate
        title="관리자 권한 확인 중"
        text="잠시만 기다려 주세요."
      />
    );
  }


  if (!isAdmin) {
    return (
      <>
        <PageHero />

        <section className="content-section compact">
          <div className="admin-gate">
            <span>
              🔐
            </span>

            <h2>
              관리자 로그인
            </h2>

            <p>
              Supabase
              Authentication에
              등록되고{" "}
              <code>
                admin_users
              </code>
              에 권한이
              부여된 관리자만
              로그인할 수
              있습니다.
            </p>

            <form
              className="admin-login-form"
              onSubmit={
                submitLogin
              }
            >
              <label>
                관리자 이메일

                <input
                  type="email"
                  autoComplete="username"
                  placeholder="name@example.com"
                  value={
                    login.email
                  }
                  onChange={(
                    event,
                  ) =>
                    setLogin(
                      {
                        ...login,

                        email:
                          event
                            .target
                            .value,
                      },
                    )
                  }
                  required
                />
              </label>

              <label>
                비밀번호

                <input
                  type="password"
                  autoComplete="current-password"
                  value={
                    login.password
                  }
                  onChange={(
                    event,
                  ) =>
                    setLogin(
                      {
                        ...login,

                        password:
                          event
                            .target
                            .value,
                      },
                    )
                  }
                  required
                />
              </label>

              {message && (
                <div className="login-error">
                  {message}
                </div>
              )}

              <button
                className="primary-button full"
                disabled={busy}
              >
                {busy
                  ? "확인 중…"
                  : "로그인"}
              </button>
            </form>
          </div>
        </section>
      </>
    );
  }


  const tabs:
    Array<
      [
        Tab,
        string,
      ]
    > = [
    [
      "basic",
      "기본문구",
    ],

    [
      "cases",
      "품질사례",
    ],

    [
      "casebook",
      "사례집 관리",
    ],

    [
      "manuals",
      "매뉴얼·FAQ",
    ],

    [
      "resources",
      "양식자료",
    ],

    [
      "account",
      "비밀번호",
    ],
  ];


  return (
    <>
      <PageHero />

      <section className="content-section compact">

        <div className="admin-topline">

          <div>
            <span className="section-kicker">
              CONTENT MANAGER
            </span>

            <h2>
              사이트 내용 직접 관리
            </h2>

            <p>
              저장하면 모든 방문자 화면에 바로 반영됩니다.
            </p>
          </div>


          <div className="admin-account">

            <b>
              {adminEmail ||
                "관리자"}
            </b>

            <span>
              관리자 로그인 중
            </span>

            <button
              onClick={() =>
                void logout()
              }
            >
              로그아웃
            </button>

          </div>

        </div>


        <div className="admin-tabs">

          {tabs.map(
            ([
              key,
              label,
            ]) => (
              <button
                key={key}
                className={
                  tab ===
                  key
                    ? "active"
                    : ""
                }
                onClick={() => {
                  setTab(key);

                  notify("");
                }}
              >
                {label}
              </button>
            ),
          )}

        </div>


        {message && (
          <div
            className={`admin-message ${
              error
                ? "error"
                : ""
            }`}
          >
            {message}

            <button
              onClick={() =>
                notify("")
              }
            >
              ×
            </button>
          </div>
        )}


        {tab ===
          "basic" && (
          <ConfigEditor
            config={
              config
            }
            setConfig={
              setConfig
            }
            busy={
              busy
            }
            save={() =>
              void run(
                async () => {
                  const {
                    error:
                      updateError,
                  } =
                    await supabase
                      .from(
                        "site_config",
                      )
                      .update(
                        {
                          config,

                          updated_at:
                            new Date().toISOString(),
                        },
                      )
                      .eq(
                        "id",
                        1,
                      );


                  if (
                    updateError
                  ) {
                    throw updateError;
                  }
                },

                "사이트 문구가 저장되었습니다.",
              )
            }
          />
        )}


        {tab ===
          "cases" && (
          <CaseEditor
            items={
              content.cases
            }
            draft={
              caseDraft
            }
            setDraft={
              setCaseDraft
            }
            files={
              caseFiles
            }
            setFiles={
              setCaseFiles
            }
            busy={
              busy
            }
            save={() =>
              void run(
                async () => {
                  if (
                    !caseDraft.title.trim()
                  ) {
                    throw new Error(
                      "사례 제목을 입력해 주세요.",
                    );
                  }


                  let before =
                    caseDraft.before_image_path;

                  let after =
                    caseDraft.after_image_path;


                  if (
                    caseFiles.before
                  ) {
                    before =
                      await uploadPublicFile(
                        caseFiles.before,
                        "cases",
                      );
                  }


                  if (
                    caseFiles.after
                  ) {
                    after =
                      await uploadPublicFile(
                        caseFiles.after,
                        "cases",
                      );
                  }


                  const payload =
                    {
                      ...caseDraft,

                      before_image_path:
                        before,

                      after_image_path:
                        after,

                      updated_at:
                        new Date().toISOString(),
                    };


                  const query =
                    caseDraft.id
                      ? supabase
                          .from(
                            "cases",
                          )
                          .update(
                            payload,
                          )
                          .eq(
                            "id",
                            caseDraft.id,
                          )
                      : supabase
                          .from(
                            "cases",
                          )
                          .insert(
                            payload,
                          );


                  const {
                    error:
                      saveError,
                  } =
                    await query;


                  if (
                    saveError
                  ) {
                    throw saveError;
                  }


                  setCaseDraft(
                    emptyCase,
                  );


                  setCaseFiles(
                    {
                      before:
                        null,

                      after:
                        null,
                    },
                  );
                },

                "품질사례가 저장되었습니다.",
              )
            }
            edit={
              setCaseDraft
            }
            remove={(
              item,
            ) =>
              void run(
                async () => {
                  await Promise.all(
                    [
                      removePublicFile(
                        item.before_image_path,
                      ),

                      removePublicFile(
                        item.after_image_path,
                      ),
                    ],
                  );


                  const {
                    error:
                      removeError,
                  } =
                    await supabase
                      .from(
                        "cases",
                      )
                      .delete()
                      .eq(
                        "id",
                        item.id,
                      );


                  if (
                    removeError
                  ) {
                    throw removeError;
                  }
                },

                "품질사례를 삭제했습니다.",
              )
            }
          />
        )}


        {/* 사례집 관리 */}
        {tab ===
          "casebook" && (
          <CasebookManager />
        )}


        {tab ===
          "manuals" && (
          <ManualEditor
            items={
              content.manuals
            }
            draft={
              manualDraft
            }
            setDraft={
              setManualDraft
            }
            busy={
              busy
            }
            save={() =>
              void run(
                async () => {
                  if (
                    !manualDraft.title.trim()
                  ) {
                    throw new Error(
                      "제목을 입력해 주세요.",
                    );
                  }


                  const payload =
                    {
                      ...manualDraft,

                      updated_at:
                        new Date().toISOString(),
                    };


                  const query =
                    manualDraft.id
                      ? supabase
                          .from(
                            "manuals",
                          )
                          .update(
                            payload,
                          )
                          .eq(
                            "id",
                            manualDraft.id,
                          )
                      : supabase
                          .from(
                            "manuals",
                          )
                          .insert(
                            payload,
                          );


                  const {
                    error:
                      saveError,
                  } =
                    await query;


                  if (
                    saveError
                  ) {
                    throw saveError;
                  }


                  setManualDraft(
                    emptyManual,
                  );
                },

                "매뉴얼·FAQ가 저장되었습니다.",
              )
            }
            edit={
              setManualDraft
            }
            remove={(
              id,
            ) =>
              void run(
                async () => {
                  const {
                    error:
                      removeError,
                  } =
                    await supabase
                      .from(
                        "manuals",
                      )
                      .delete()
                      .eq(
                        "id",
                        id,
                      );


                  if (
                    removeError
                  ) {
                    throw removeError;
                  }
                },

                "항목을 삭제했습니다.",
              )
            }
          />
        )}


        {tab ===
          "resources" && (
          <ResourceEditor
            items={
              content.resources
            }
            draft={
              resourceDraft
            }
            setDraft={
              setResourceDraft
            }
            file={
              resourceFile
            }
            setFile={
              setResourceFile
            }
            busy={
              busy
            }
            save={() =>
              void run(
                async () => {
                  if (
                    !resourceDraft.title.trim()
                  ) {
                    throw new Error(
                      "자료 제목을 입력해 주세요.",
                    );
                  }


                  let path =
                    resourceDraft.file_path;

                  let name =
                    resourceDraft.file_name;

                  let type =
                    resourceDraft.file_type;

                  let size =
                    resourceDraft.file_size;


                  if (
                    resourceFile
                  ) {
                    path =
                      await uploadPublicFile(
                        resourceFile,

                        "resources",
                      );


                    name =
                      resourceFile.name;


                    type =
                      resourceFile.type ||
                      "application/octet-stream";


                    size =
                      resourceFile.size;
                  }


                  if (!path) {
                    throw new Error(
                      "첨부파일을 선택해 주세요.",
                    );
                  }


                  const payload =
                    {
                      ...resourceDraft,

                      file_path:
                        path,

                      file_name:
                        name,

                      file_type:
                        type,

                      file_size:
                        size,

                      updated_at:
                        new Date().toISOString(),
                    };


                  const query =
                    resourceDraft.id
                      ? supabase
                          .from(
                            "resources",
                          )
                          .update(
                            payload,
                          )
                          .eq(
                            "id",
                            resourceDraft.id,
                          )
                      : supabase
                          .from(
                            "resources",
                          )
                          .insert(
                            payload,
                          );


                  const {
                    error:
                      saveError,
                  } =
                    await query;


                  if (
                    saveError
                  ) {
                    throw saveError;
                  }


                  setResourceDraft(
                    emptyResource,
                  );


                  setResourceFile(
                    null,
                  );
                },

                "양식자료가 게시되었습니다.",
              )
            }
            edit={
              setResourceDraft
            }
            remove={(
              item,
            ) =>
              void run(
                async () => {
                  await removePublicFile(
                    item.file_path,
                  );


                  const {
                    error:
                      removeError,
                  } =
                    await supabase
                      .from(
                        "resources",
                      )
                      .delete()
                      .eq(
                        "id",
                        item.id,
                      );


                  if (
                    removeError
                  ) {
                    throw removeError;
                  }
                },

                "양식자료를 삭제했습니다.",
              )
            }
          />
        )}


        {tab ===
          "account" && (
          <PasswordEditor
            email={
              adminEmail
            }
            values={
              passwords
            }
            setValues={
              setPasswords
            }
            busy={
              busy
            }
            save={(
              event,
            ) => {
              event.preventDefault();


              if (
                passwords
                  .next
                  .length <
                8
              ) {
                notify(
                  "새 비밀번호는 8자 이상 입력해 주세요.",
                  true,
                );

                return;
              }


              if (
                passwords.next !==
                passwords.confirm
              ) {
                notify(
                  "새 비밀번호 확인이 일치하지 않습니다.",
                  true,
                );

                return;
              }


              void run(
                async () => {
                  const {
                    error:
                      updateError,
                  } =
                    await supabase.auth.updateUser(
                      {
                        password:
                          passwords.next,
                      },
                    );


                  if (
                    updateError
                  ) {
                    throw updateError;
                  }


                  setPasswords(
                    {
                      next: "",

                      confirm:
                        "",
                    },
                  );
                },

                "관리자 비밀번호가 변경되었습니다.",
              );
            }}
          />
        )}

      </section>
    </>
  );
}


function PageHero() {
  return (
    <section className="page-hero">

      <div className="hero-inner">

        <span className="eyebrow">
          관리자
        </span>

        <h1>
          콘텐츠 관리
        </h1>

        <p>
          사이트의 제목·문구·사례·매뉴얼·양식자료를 직접 수정합니다.
        </p>

      </div>

    </section>
  );
}


function AdminGate({
  title,
  text,
}: {
  title: string;
  text: string;
}) {
  return (
    <>
      <PageHero />

      <section className="content-section compact">

        <div className="admin-gate">

          <span>
            ⚙
          </span>

          <h2>
            {title}
          </h2>

          <p>
            {text}
          </p>

        </div>

      </section>
    </>
  );
}


function ConfigEditor({
  config,
  setConfig,
  busy,
  save,
}: {
  config: SiteConfig;
  setConfig: (
    value: SiteConfig,
  ) => void;
  busy: boolean;
  save: () => void;
}) {
  return (
    <form
      className="admin-sheet"
      onSubmit={(
        event,
      ) => {
        event.preventDefault();

        save();
      }}
    >

      {configGroups.map(
        (group) => (
          <fieldset
            key={
              group.title
            }
          >

            <legend>
              {group.title}
            </legend>


            <div className="admin-field-grid">

              {group.fields.map(
                (field) => (
                  <label
                    className={
                      field.long
                        ? "span-2"
                        : ""
                    }
                    key={
                      field.key
                    }
                  >

                    {
                      field.label
                    }


                    {field.long ? (
                      <textarea
                        rows={
                          3
                        }
                        value={
                          config[
                            field
                              .key
                          ]
                        }
                        onChange={(
                          event,
                        ) =>
                          setConfig(
                            {
                              ...config,

                              [field.key]:
                                event
                                  .target
                                  .value,
                            },
                          )
                        }
                      />
                    ) : (
                      <input
                        value={
                          config[
                            field
                              .key
                          ]
                        }
                        onChange={(
                          event,
                        ) =>
                          setConfig(
                            {
                              ...config,

                              [field.key]:
                                event
                                  .target
                                  .value,
                            },
                          )
                        }
                      />
                    )}

                  </label>
                ),
              )}

            </div>

          </fieldset>
        ),
      )}


      <button
        className="primary-button"
        disabled={busy}
      >
        전체 문구 저장
      </button>

    </form>
  );
}


function EditorShell({
  title,
  form,
  list,
}: {
  title: string;
  form: React.ReactNode;
  list: React.ReactNode;
}) {
  return (
    <div className="editor-layout">

      <div className="admin-sheet">

        <div className="editor-title">
          <h3>
            {title}
          </h3>
        </div>

        {form}

      </div>


      <div className="admin-list">
        {list}
      </div>

    </div>
  );
}


function Rows<
  T extends {
    id: number;
    title: string;
  },
>({
  items,
  meta,
  edit,
  remove,
}: {
  items: T[];
  meta: (
    item: T,
  ) => string;
  edit: (
    item: T,
  ) => void;
  remove: (
    item: T,
  ) => void;
}) {
  return (
    <>
      <div className="list-heading">

        <h3>
          등록된 내용
        </h3>

        <span>
          {items.length}개
        </span>

      </div>


      {items.length ? (
        items.map(
          (item) => (
            <div
              className="content-row"
              key={
                item.id
              }
            >

              <div>

                <span>
                  {meta(
                    item,
                  )}
                </span>

                <b>
                  {
                    item.title
                  }
                </b>

              </div>


              <div>

                <button
                  onClick={() =>
                    edit(
                      item,
                    )
                  }
                >
                  수정
                </button>

                <button
                  className="danger"
                  onClick={() => {
                    if (
                      confirm(
                        `'${item.title}' 항목을 삭제할까요?`,
                      )
                    ) {
                      remove(
                        item,
                      );
                    }
                  }}
                >
                  삭제
                </button>

              </div>

            </div>
          ),
        )
      ) : (
        <div className="empty-list">
          아직 등록된 내용이 없습니다.
        </div>
      )}
    </>
  );
}


function CaseEditor({
  items,
  draft,
  setDraft,
  files,
  setFiles,
  busy,
  save,
  edit,
  remove,
}: {
  items: CaseItem[];
  draft: typeof emptyCase;
  setDraft: (
    value: typeof emptyCase,
  ) => void;
  files: {
    before: File | null;
    after: File | null;
  };
  setFiles: (
    value: {
      before: File | null;
      after: File | null;
    },
  ) => void;
  busy: boolean;
  save: () => void;
  edit: (
    item: CaseItem,
  ) => void;
  remove: (
    item: CaseItem,
  ) => void;
}) {
  const form = (
    <form
      onSubmit={(
        event,
      ) => {
        event.preventDefault();

        save();
      }}
    >

      <div className="admin-field-grid">

        <label>
          검사 구분

          <input
            required
            value={
              draft.category
            }
            onChange={(
              event,
            ) =>
              setDraft(
                {
                  ...draft,

                  category:
                    event
                      .target
                      .value,
                },
              )
            }
          />
        </label>


        <label>
          결과 구분

          <select
            value={
              draft.status
            }
            onChange={(
              event,
            ) =>
              setDraft(
                {
                  ...draft,

                  status:
                    event
                      .target
                      .value as
                    | "보완"
                    | "부적합",
                },
              )
            }
          >
            <option>
              보완
            </option>

            <option>
              부적합
            </option>
          </select>
        </label>


        <label className="span-2">
          사례 제목

          <input
            required
            value={
              draft.title
            }
            onChange={(
              event,
            ) =>
              setDraft(
                {
                  ...draft,

                  title:
                    event
                      .target
                      .value,
                },
              )
            }
          />
        </label>


        <label className="span-2">
          지적 내용·요약

          <textarea
            rows={
              3
            }
            value={
              draft.summary
            }
            onChange={(
              event,
            ) =>
              setDraft(
                {
                  ...draft,

                  summary:
                    event
                      .target
                      .value,
                },
              )
            }
          />
        </label>


        <label className="span-2">
          발생 원인

          <textarea
            rows={
              3
            }
            value={
              draft.cause
            }
            onChange={(
              event,
            ) =>
              setDraft(
                {
                  ...draft,

                  cause:
                    event
                      .target
                      .value,
                },
              )
            }
          />
        </label>


        <label className="span-2">
          개선 방법

          <textarea
            rows={
              3
            }
            value={
              draft.action
            }
            onChange={(
              event,
            ) =>
              setDraft(
                {
                  ...draft,

                  action:
                    event
                      .target
                      .value,
                },
              )
            }
          />
        </label>


        <label className="span-2">
          관련 기준

          <textarea
            rows={
              2
            }
            value={
              draft.standard
            }
            onChange={(
              event,
            ) =>
              setDraft(
                {
                  ...draft,

                  standard:
                    event
                      .target
                      .value,
                },
              )
            }
          />
        </label>

      </div>


      <div className="photo-upload-grid">

        <FileInput
          label="개선 전 사진"
          accept="image/jpeg,image/png,image/webp,image/gif"
          current={
            draft.before_image_path
          }
          file={
            files.before
          }
          setFile={(
            file,
          ) =>
            setFiles(
              {
                ...files,

                before:
                  file,
              },
            )
          }
        />


        <FileInput
          label="개선 후 사진"
          accept="image/jpeg,image/png,image/webp,image/gif"
          current={
            draft.after_image_path
          }
          file={
            files.after
          }
          setFile={(
            file,
          ) =>
            setFiles(
              {
                ...files,

                after:
                  file,
              },
            )
          }
        />

      </div>


      <Published
        checked={
          draft.published
        }
        setChecked={(
          published,
        ) =>
          setDraft(
            {
              ...draft,

              published,
            },
          )
        }
      />


      <div className="form-actions">

        <button
          className="primary-button"
          disabled={busy}
        >
          {draft.id
            ? "사례 수정"
            : "새 사례 등록"}
        </button>


        {draft.id && (
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              setDraft(
                emptyCase,
              );


              setFiles(
                {
                  before:
                    null,

                  after:
                    null,
                },
              );
            }}
          >
            취소
          </button>
        )}

      </div>

    </form>
  );


  return (
    <EditorShell
      title={
        draft.id
          ? "품질사례 수정"
          : "새 품질사례"
      }
      form={
        form
      }
      list={
        <Rows
          items={
            items
          }
          meta={(
            item,
          ) =>
            `${item.category} · ${item.status}${
              item.published
                ? ""
                : " · 비공개"
            }`
          }
          edit={(
            item,
          ) => {
            edit(item);


            setFiles(
              {
                before:
                  null,

                after:
                  null,
              },
            );
          }}
          remove={
            remove
          }
        />
      }
    />
  );
}


function ManualEditor({
  items,
  draft,
  setDraft,
  busy,
  save,
  edit,
  remove,
}: {
  items: ManualItem[];
  draft: typeof emptyManual;
  setDraft: (
    value: typeof emptyManual,
  ) => void;
  busy: boolean;
  save: () => void;
  edit: (
    item: ManualItem,
  ) => void;
  remove: (
    id: number,
  ) => void;
}) {
  const form = (
    <form
      onSubmit={(
        event,
      ) => {
        event.preventDefault();

        save();
      }}
    >

      <div className="admin-field-grid">

        <label>
          분류

          <input
            value={
              draft.category
            }
            onChange={(
              event,
            ) =>
              setDraft(
                {
                  ...draft,

                  category:
                    event
                      .target
                      .value,
                },
              )
            }
          />
        </label>


        <label>
          콘텐츠 유형

          <select
            value={
              draft.faq
                ? "faq"
                : "manual"
            }
            onChange={(
              event,
            ) =>
              setDraft(
                {
                  ...draft,

                  faq:
                    event
                      .target
                      .value ===
                    "faq",
                },
              )
            }
          >
            <option value="manual">
              매뉴얼
            </option>

            <option value="faq">
              FAQ
            </option>
          </select>
        </label>


        <label className="span-2">
          제목

          <input
            required
            value={
              draft.title
            }
            onChange={(
              event,
            ) =>
              setDraft(
                {
                  ...draft,

                  title:
                    event
                      .target
                      .value,
                },
              )
            }
          />
        </label>


        <label className="span-2">
          요약

          <textarea
            rows={
              3
            }
            value={
              draft.summary
            }
            onChange={(
              event,
            ) =>
              setDraft(
                {
                  ...draft,

                  summary:
                    event
                      .target
                      .value,
                },
              )
            }
          />
        </label>


        <label className="span-2">
          본문

          <textarea
            rows={
              12
            }
            value={
              draft.body
            }
            onChange={(
              event,
            ) =>
              setDraft(
                {
                  ...draft,

                  body:
                    event
                      .target
                      .value,
                },
              )
            }
          />
        </label>

      </div>


      <Published
        checked={
          draft.published
        }
        setChecked={(
          published,
        ) =>
          setDraft(
            {
              ...draft,

              published,
            },
          )
        }
      />


      <div className="form-actions">

        <button
          className="primary-button"
          disabled={busy}
        >
          {draft.id
            ? "내용 수정"
            : "새 내용 등록"}
        </button>


        {draft.id && (
          <button
            type="button"
            className="secondary-button"
            onClick={() =>
              setDraft(
                emptyManual,
              )
            }
          >
            취소
          </button>
        )}

      </div>

    </form>
  );


  return (
    <EditorShell
      title={
        draft.id
          ? "매뉴얼·FAQ 수정"
          : "새 매뉴얼·FAQ"
      }
      form={
        form
      }
      list={
        <Rows
          items={
            items
          }
          meta={(
            item,
          ) =>
            `${item.faq ? "FAQ" : "매뉴얼"} · ${item.category}${
              item.published
                ? ""
                : " · 비공개"
            }`
          }
          edit={
            edit
          }
          remove={(
            item,
          ) =>
            remove(
              item.id,
            )
          }
        />
      }
    />
  );
}


function ResourceEditor({
  items,
  draft,
  setDraft,
  file,
  setFile,
  busy,
  save,
  edit,
  remove,
}: {
  items: ResourceItem[];
  draft: typeof emptyResource;
  setDraft: (
    value: typeof emptyResource,
  ) => void;
  file: File | null;
  setFile: (
    value: File | null,
  ) => void;
  busy: boolean;
  save: () => void;
  edit: (
    item: ResourceItem,
  ) => void;
  remove: (
    item: ResourceItem,
  ) => void;
}) {
  const form = (
    <form
      onSubmit={(
        event,
      ) => {
        event.preventDefault();

        save();
      }}
    >

      <div className="admin-field-grid">

        <label>
          자료 분류

          <input
            value={
              draft.category
            }
            onChange={(
              event,
            ) =>
              setDraft(
                {
                  ...draft,

                  category:
                    event
                      .target
                      .value,
                },
              )
            }
          />
        </label>


        <label className="span-2">
          자료 제목

          <input
            required
            value={
              draft.title
            }
            onChange={(
              event,
            ) =>
              setDraft(
                {
                  ...draft,

                  title:
                    event
                      .target
                      .value,
                },
              )
            }
          />
        </label>


        <label className="span-2">
          자료 설명

          <textarea
            rows={
              3
            }
            value={
              draft.description
            }
            onChange={(
              event,
            ) =>
              setDraft(
                {
                  ...draft,

                  description:
                    event
                      .target
                      .value,
                },
              )
            }
          />
        </label>

      </div>


      <FileInput
        label="첨부파일"
        accept=".pdf,.hwp,.hwpx,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.zip,.txt"
        current={
          draft.file_path
        }
        file={
          file
        }
        setFile={
          setFile
        }
      />


      <Published
        checked={
          draft.published
        }
        setChecked={(
          published,
        ) =>
          setDraft(
            {
              ...draft,

              published,
            },
          )
        }
      />


      <div className="form-actions">

        <button
          className="primary-button"
          disabled={busy}
        >
          {draft.id
            ? "자료 수정"
            : "자료 게시"}
        </button>


        {draft.id && (
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              setDraft(
                emptyResource,
              );


              setFile(
                null,
              );
            }}
          >
            취소
          </button>
        )}

      </div>

    </form>
  );


  return (
    <EditorShell
      title={
        draft.id
          ? "양식자료 수정"
          : "새 양식자료"
      }
      form={
        form
      }
      list={
        <Rows
          items={
            items
          }
          meta={(
            item,
          ) =>
            `${item.category} · ${item.file_name}${
              item.published
                ? ""
                : " · 비공개"
            }`
          }
          edit={(
            item,
          ) => {
            edit(item);

            setFile(null);
          }}
          remove={
            remove
          }
        />
      }
    />
  );
}


function FileInput({
  label,
  accept,
  current,
  file,
  setFile,
}: {
  label: string;
  accept: string;
  current: string | null;
  file: File | null;
  setFile: (
    value: File | null,
  ) => void;
}) {
  const preview =
    current &&
    current.startsWith(
      "cases/",
    )
      ? publicAssetUrl(
          current,
        )
      : "";


  return (
    <label className="file-drop">

      {preview ? (
        <img
          src={
            preview
          }
          alt="현재 첨부"
        />
      ) : (
        <span>
          ＋
        </span>
      )}


      <b>
        {label}
      </b>


      <small>
        {file?.name ||
          (current
            ? "기존 파일 유지"
            : "파일을 선택하세요")}
      </small>


      <input
        type="file"
        accept={
          accept
        }
        onChange={(
          event,
        ) =>
          setFile(
            event
              .target
              .files?.[0] ||
              null,
          )
        }
      />

    </label>
  );
}


function Published({
  checked,
  setChecked,
}: {
  checked: boolean;
  setChecked: (
    value: boolean,
  ) => void;
}) {
  return (
    <label className="check-row">

      <input
        type="checkbox"
        checked={
          checked
        }
        onChange={(
          event,
        ) =>
          setChecked(
            event
              .target
              .checked,
          )
        }
      />

      방문자에게 공개

    </label>
  );
}


function PasswordEditor({
  email,
  values,
  setValues,
  busy,
  save,
}: {
  email: string;

  values: {
    next: string;
    confirm: string;
  };

  setValues: (
    value: {
      next: string;
      confirm: string;
    },
  ) => void;

  busy: boolean;

  save: (
    event: FormEvent,
  ) => void;
}) {
  const strength =
    useMemo(
      () =>
        values.next.length >=
        12
          ? "안전"
          : values.next
                .length >=
              8
            ? "사용 가능"
            : "8자 이상 필요",

      [values.next],
    );


  return (
    <form
      className="admin-sheet account-sheet"
      onSubmit={
        save
      }
    >

      <h3>
        관리자 비밀번호 변경
      </h3>


      <p className="sheet-intro">
        현재 로그인 계정:{" "}

        <b>
          {email ||
            "관리자"}
        </b>
      </p>


      <div className="admin-field-grid">

        <label className="span-2">
          새 비밀번호

          <input
            type="password"
            autoComplete="new-password"
            value={
              values.next
            }
            onChange={(
              event,
            ) =>
              setValues(
                {
                  ...values,

                  next:
                    event
                      .target
                      .value,
                },
              )
            }
            required
          />

          <small>
            상태:{" "}
            {
              strength
            }
          </small>
        </label>


        <label className="span-2">
          새 비밀번호 확인

          <input
            type="password"
            autoComplete="new-password"
            value={
              values.confirm
            }
            onChange={(
              event,
            ) =>
              setValues(
                {
                  ...values,

                  confirm:
                    event
                      .target
                      .value,
                },
              )
            }
            required
          />
        </label>

      </div>


      <button
        className="primary-button"
        disabled={busy}
      >
        비밀번호 변경
      </button>

    </form>
  );
}
