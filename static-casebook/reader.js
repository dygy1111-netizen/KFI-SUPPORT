/* No fetch, Supabase client, external libraries or runtime API calls.
   All published content and photos are bundled beside this reader. */
(() => {
  "use strict";
  const snapshot = window.KFI_STATIC_CASEBOOK;
  const $ = id => document.getElementById(id);
  if (!snapshot || !Array.isArray(snapshot.cases)) {
    $("caseList").textContent = "정적 데이터 파일(data.js)을 찾지 못했습니다. 전체 배포 파일을 함께 보관해 주세요.";
    return;
  }
  const cases = snapshot.cases;
  const book = snapshot.book || {};
  const byId = new Map(cases.map(item => [String(item.id), item]));
  const groups = [
    { number:"01", title:"위험물탱크", categories:["안전성능검사","정밀정기검사","중간정기검사","탱크 완공검사"] },
    { number:"02", title:"법정검사 제품", categories:["이중벽탱크","운반용기"] },
    { number:"03", title:"자율인증 제품", categories:["폼챔버","위치표시형밸브","포소화약제탱크","누설감지설비","교반기","통기관대기밸브","비상압력배출장치"] }
  ];
  const sectionKeys = {
    "안전성능검사":"safety","정밀정기검사":"precision","중간정기검사":"interim",
    "탱크 완공검사":"completion","이중벽탱크":"doublewall","운반용기":"container",
    "폼챔버":"foamchamber","위치표시형밸브":"indicator","포소화약제탱크":"foamtank",
    "누설감지설비":"leak","교반기":"agitator","통기관대기밸브":"breather",
    "비상압력배출장치":"emergency"
  };
  const state = { category:"전체", selected:null };
  const categoryCounts = new Map();
  cases.forEach(item => categoryCounts.set(item.inspection_type, 1+(categoryCounts.get(item.inspection_type)||0)));
  function node(tag, className, content) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (content !== undefined && content !== null) element.textContent = String(content);
    return element;
  }
  function field(id, value) { if ($(id) && value != null) $(id).textContent = String(value); }
  function appendText(parent, tag, className, value) {
    const item = node(tag, className, value); parent.append(item); return item;
  }
  const cover = book.cover || {};
  field("coverLabel", cover.label);
  field("coverYear", cover.year);
  field("coverTitle", cover.title);
  field("coverSubtitle", cover.subtitle);
  field("coverDeck", cover.deck);
  field("coverOrganization", cover.organization);
  field("coverDepartment", cover.department);
  field("coverStamp", String(snapshot.count) + "건 · 열람용");
  field("totalMark", String(snapshot.count) + " CASES");
  field("sidebarCount", String(snapshot.count) + "건 · " + categoryCounts.size + "개 검사구분");
  const overview = book.overview || {};
  field("overviewTitle", overview.title);
  field("overviewLead", overview.lead);
  field("overviewPurpose", overview.purpose);
  field("overviewNote", overview.note);
  if (Array.isArray(overview.systems)) {
    for (const system of overview.systems) {
      const card = node("div", "system-card");
      appendText(card, "strong", "", system.title);
      appendText(card, "p", "", system.description);
      appendText(card, "small", "", system.detail);
      $("systems").append(card);
    }
  }
  const exported = new Date(snapshot.exportedAt);
  const dateText = Number.isNaN(exported.valueOf()) ? "정적 보관본"
    : new Intl.DateTimeFormat("ko-KR", {timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit"}).format(exported);
  field("snapshotLabel", "내보낸 날짜 " + dateText);
  field("footerInfo", "공개·검토완료 " + snapshot.count + "건 · " + dateText);

  function goCategory(category) {
    $("searchInput").value = "";
    const target = category === "전체" ? "#home" : "#category/" + encodeURIComponent(category);
    if (location.hash === target) showRoute();
    else location.hash = target;
  }
  function renderNav() {
    const nav = $("categoryNav");
    nav.replaceChildren();
    const all = node("button", "nav-all", "전체 사례");
    all.type = "button";
    all.append(node("span","count",snapshot.count));
    all.classList.toggle("active", state.category === "전체" && !state.selected);
    all.addEventListener("click", () => goCategory("전체"));
    nav.append(all);
    const shown = new Set();
    for (const group of groups) {
      const available = group.categories.filter(c => categoryCounts.has(c));
      if (!available.length) continue;
      const part = book.parts && book.parts[group.number];
      const section = node("section","nav-group");
      const heading = node("h3", "", group.number + "  " + (part?.title || group.title));
      section.append(heading);
      for (const category of available) {
        shown.add(category);
        const button = node("button", "nav-category");
        button.type = "button";
        button.append(node("span", "", category), node("span", "count", categoryCounts.get(category)));
        button.classList.toggle("active", state.category === category && !state.selected);
        button.addEventListener("click", () => goCategory(category));
        section.append(button);
      }
      nav.append(section);
    }
    const remainder = [...categoryCounts.keys()].filter(c => !shown.has(c));
    if (remainder.length) {
      const other = node("section", "nav-group");
      other.append(node("h3","", "기타 검사"));
      for (const category of remainder) {
        const button = node("button", "nav-category");
        button.type = "button";
        button.append(node("span", "", category), node("span", "count", categoryCounts.get(category)));
        button.addEventListener("click", () => goCategory(category));
        other.append(button);
      }
      nav.append(other);
    }
  }
  function makeIntro(category) {
    const panel = $("introPanel");
    panel.replaceChildren();
    const data = book.sections?.[sectionKeys[category]];
    if (!data) { panel.hidden = true; return; }
    panel.hidden = false;
    appendText(panel, "span", "section-eyebrow", "INSPECTION / OVERVIEW");
    appendText(panel, "h3", "", data.title || category);
    if (data.summary) appendText(panel, "p", "intro-lead", data.summary);
    if (data.basis) {
      const legal = node("div", "intro-legal");
      appendText(legal,"strong","","관련 근거"); appendText(legal,"span","",data.basis);
      panel.append(legal);
    }
    if (Array.isArray(data.checks) && data.checks.length) {
      appendText(panel,"h4","","주요 확인사항");
      const ul = node("ul","intro-checks");
      for (const check of data.checks) appendText(ul,"li","",check);
      panel.append(ul);
    }
  }
  function renderCards() {
    const search = $("searchInput").value.trim().toLocaleLowerCase("ko-KR");
    const list = $("caseList");
    list.replaceChildren();
    field("browseHeading", state.category === "전체" ? "전체 사례" : state.category);
    field("browseCount", state.category === "전체" ? "현장에서 확인된 주요 사례를 검사구분별로 정리했습니다."
      : "검사 개요와 관련 사례를 함께 확인할 수 있습니다.");
    makeIntro(state.category === "전체" ? "" : state.category);
    const visible = cases.filter(item => {
      if (state.category !== "전체" && item.inspection_type !== state.category) return false;
      if (!search) return true;
      return [item.title,item.inspection_type,item.facility,item.standard_title,item.standard_body,
        item.cause_title,item.cause_body,item.action_body,item.prevention_body].join(" ").toLocaleLowerCase("ko-KR").includes(search);
    });
    field("resultCount", "검색 결과 " + visible.length + "건");
    $("emptyMessage").hidden = visible.length !== 0;
    const fragment = document.createDocumentFragment();
    for (const item of visible) {
      const button = node("button", "case-card");
      button.type = "button";
      button.setAttribute("aria-label", item.title + " 사례 보기");
      const imageFrame = node("div", "case-thumb");
      if (item.photos && item.photos.length) {
        const img = document.createElement("img");
        img.src = "./" + item.photos[0].src;
        img.alt = item.title + " 현장 사진";
        img.loading = "lazy";
        imageFrame.append(img);
      } else imageFrame.append(node("span", "no-photo", "사진 없음"));
      const body = node("div","case-card-body");
      appendText(body,"span","case-tag",item.inspection_type);
      appendText(body,"h3","",item.title);
      appendText(body,"p","",item.standard_title || item.facility || "검사 사례");
      const foot = node("div", "case-card-foot");
      appendText(foot,"span","","사례 " + item.case_no);
      appendText(foot,"strong","","사례 보기 ↗");
      body.append(foot);
      button.append(imageFrame,body);
      button.addEventListener("click", () => { location.hash = "case/" + encodeURIComponent(item.id); });
      fragment.append(button);
    }
    list.append(fragment);
  }
  function makeLines(values, strongFirst) {
    const group = node("div","case-lines");
    let index = 0;
    for (const value of values) {
      for (const line of String(value || "").split(/\r?\n|[;；]/).map(s => s.trim()).filter(Boolean)) {
        const p = node("p", index === 0 && strongFirst ? "strong-line" : "",line);
        group.append(p); index++;
      }
    }
    if (!index) group.append(node("p", "blank-line", "—"));
    return group;
  }
  function makeRow(label, content, extraClass) {
    const row = node("div", "case-row" + (extraClass ? " " + extraClass : ""));
    const heading = node("div", "case-label");
    String(label).split("\n").forEach(t => appendText(heading,"span","",t));
    const value = node("div","case-value");
    value.append(content);
    row.append(heading,value);
    return row;
  }
  function openPhoto(src, alt) {
    const modal = $("photoModal");
    $("modalImage").src = src;
    $("modalImage").alt = alt;
    modal.hidden = false;
    $("closePhoto").focus();
    document.body.classList.add("modal-open");
  }
  function closePhoto() {
    $("photoModal").hidden = true;
    $("modalImage").removeAttribute("src");
    document.body.classList.remove("modal-open");
  }
  function photoPanel(item) {
    const panel = node("div","photo-panel");
    const photos = item.photos || [];
    if (photos.length) {
      const grid = node("div", "photo-grid photos-" + photos.length);
      for (const photo of photos) {
        const button = node("button", "photo-tile");
        button.type = "button";
        button.title = "사진 확대";
        const image = document.createElement("img");
        image.src = "./" + photo.src;
        image.alt = item.title + " 현장 사진 " + photo.slot;
        image.loading = "eager";
        button.append(image);
        button.addEventListener("click", () => openPhoto(image.src, image.alt));
        grid.append(button);
      }
      panel.append(grid);
    } else appendText(panel,"p","photo-missing","사진 미등록");
    if (item.photo_caption) appendText(panel,"p","photo-caption",item.photo_caption);
    if (item.photo_note) appendText(panel,"p","photo-note","※ " + item.photo_note);
    return panel;
  }
  function renderDetail(item) {
    const paper = $("casePaper");
    paper.replaceChildren();
    const header = node("header","case-paper-head");
    appendText(header,"span","case-eyebrow",item.inspection_type + " · 현장 품질관리 사례");
    appendText(header,"h1","",item.title);
    const table = node("div","case-table");
    table.append(
      makeRow("구 분",makeLines([item.facility],false)),
      makeRow("관련 사진\n(현장 사례)",photoPanel(item),"photo-row"),
      makeRow("검사 기준\n(관련 법령)",makeLines([item.standard_title,item.standard_body],true),"standard-row"),
      makeRow("발생 사유",makeLines([item.cause_title,item.cause_body],true)),
      makeRow("개선조치",makeLines([item.action_body],false)),
      makeRow("예방 대책",makeLines([item.prevention_body],false))
    );
    const footer = node("footer","case-paper-footer");
    appendText(footer,"strong","","한국소방산업기술원 · 위험물검사부");
    appendText(footer,"span","","사례번호 " + item.case_no);
    paper.append(header,table,footer);
    document.title = item.title + " | 품질관리 사례집";
  }
  function showRoute() {
    let hash;
    try { hash = decodeURIComponent(location.hash.slice(1)); } catch { hash = "home"; }
    const matching = hash.startsWith("case/") ? byId.get(hash.slice(5)) : null;
    if (matching) {
      state.selected = matching;
      $("homeView").hidden = true; $("browseView").hidden = true; $("detailView").hidden = false;
      state.category = matching.inspection_type;
      renderDetail(matching);
    } else {
      state.selected = null;
      state.category = hash.startsWith("category/") && categoryCounts.has(hash.slice(9))
        ? hash.slice(9) : "전체";
      $("detailView").hidden = true;
      $("homeView").hidden = state.category !== "전체" || hash === "search" || hash === "list";
      $("browseView").hidden = false;
      renderCards();
      document.title = "위험물시설 품질관리 사례집 | 독립형 열람판";
    }
    renderNav();
    if (location.hash) window.scrollTo({top:0,behavior:"instant"});
  }
  $("searchInput").addEventListener("input", () => {
    if ($("searchInput").value.trim()) {
      if (location.hash !== "#search") location.hash = "search";
      else {
        state.category = "전체";
        $("homeView").hidden = true;
        $("browseView").hidden = false;
        $("detailView").hidden = true;
        renderCards();
        renderNav();
      }
    } else if (location.hash === "#search") {
      location.hash = "list";
    } else {
      renderCards();
    }
  });
  $("clearFilter").addEventListener("click", () => goCategory("전체"));
  $("backButton").addEventListener("click", () => goCategory(state.category));
  $("printButton").addEventListener("click", () => window.print());
  $("copyLink").addEventListener("click", async () => {
    const button = $("copyLink");
    try { await navigator.clipboard.writeText(location.href); button.textContent = "복사됨"; }
    catch { window.prompt("아래 주소를 복사하세요.", location.href); }
    setTimeout(() => {button.textContent = "링크 복사";},1800);
  });
  $("closePhoto").addEventListener("click", closePhoto);
  $("photoModal").addEventListener("click", event => {if(event.target === $("photoModal")) closePhoto();});
  window.addEventListener("keydown", event => {if(event.key === "Escape" && !$("photoModal").hidden) closePhoto();});
  window.addEventListener("hashchange", showRoute);
  showRoute();
})();