// Export an immutable, fully self-contained public casebook during CI.
// The deployed reader does not contain Supabase credentials or make API calls.
import { copyFile, mkdir, rm, writeFile } from "node:fs/promises";
import { join, extname } from "node:path";
import { createHash } from "node:crypto";

const root = process.cwd();
const destination = join(root, "public", "casebook");
const template = join(root, "static-casebook");
const base = (process.env.VITE_SUPABASE_URL || "").replace(/\/+$/, "");
const key = process.env.VITE_SUPABASE_ANON_KEY || "";
if (!/^https:\/\/[a-z0-9.-]+$/i.test(base) || !key) {
  throw new Error("정적 사례집 내보내기: Supabase 읽기용 URL 및 공개 API 키가 필요합니다.");
}
const headers = { apikey: key, Authorization: "Bearer " + key };
const requiredColumns = [
  "id", "case_no", "inspection_type", "title", "facility", "photo_caption",
  "photo_note", "standard_title", "standard_body", "cause_title", "cause_body",
  "action_body", "prevention_body", "sort_order",
  "photo1_path", "photo2_path", "photo3_path", "photo4_path",
  "photo1_width_pct", "photo2_width_pct", "photo3_width_pct", "photo4_width_pct",
  "photo1_stretch_x_pct", "photo2_stretch_x_pct", "photo3_stretch_x_pct", "photo4_stretch_x_pct"
];
async function getJson(path) {
  const response = await fetch(base + "/rest/v1/" + path, {
    headers: { ...headers, Accept: "application/json" },
    signal: AbortSignal.timeout(30000)
  });
  if (!response.ok) {
    throw new Error("Supabase 공개 데이터 조회 실패 (" + response.status + "): " + (await response.text()).slice(0, 300));
  }
  return response.json();
}
function assetName(path) {
  const ext = extname(path.split("?")[0]).toLowerCase();
  const safeExt = /^\.(webp|png|jpg|jpeg|gif|avif)$/.test(ext) ? ext : ".webp";
  return createHash("sha256").update(path).digest("hex").slice(0, 24) + safeExt;
}
async function copyPublicPhoto(path, name) {
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  const url = base + "/storage/v1/object/public/public-assets/" + encodedPath;
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw new Error("HTTP " + response.status);
      const type = response.headers.get("content-type") || "";
      if (!type.startsWith("image/")) throw new Error("Not an image: " + type);
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.length < 10 || buffer.length > 30 * 1024 * 1024) throw new Error("Unexpected image size");
      await writeFile(join(destination, "images", name), buffer);
      return;
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise(resolve => setTimeout(resolve, attempt * 900));
    }
  }
  throw new Error("공개 사진 복사 실패: " + path + " (" + String(lastError) + ")");
}
async function main() {
  const query = new URLSearchParams({
    select: requiredColumns.join(","),
    published: "eq.true",
    review_status: "eq.검토완료",
    order: "sort_order.asc,case_no.asc,id.asc",
    limit: "1000"
  });
  const cases = await getJson("casebook_cases?" + query);
  if (!Array.isArray(cases) || cases.length === 0 || cases.length >= 1000) {
    throw new Error("공개·검토완료 사례 결과가 비어 있거나 1,000건 제한에 도달했습니다. 불완전한 내보내기를 중단합니다.");
  }
  const configs = await getJson("site_config?select=config&id=eq.1&limit=1");
  if (!Array.isArray(configs) || !configs[0]?.config) throw new Error("사례집 표지·검사 개요 설정을 조회하지 못했습니다.");

  const images = new Map();
  for (const item of cases) {
    for (let i = 1; i <= 4; i++) {
      const photoPath = item["photo" + i + "_path"];
      if (!photoPath) continue;
      if (typeof photoPath !== "string" || !photoPath.startsWith("cases/")) {
        throw new Error("허용되지 않은 사진 경로: " + String(photoPath));
      }
      if (!images.has(photoPath)) images.set(photoPath, assetName(photoPath));
    }
  }
  await rm(destination, { recursive: true, force: true });
  await mkdir(join(destination, "images"), { recursive: true });
  await Promise.all(["index.html", "style.css", "reader.js"].map(name =>
    copyFile(join(template, name), join(destination, name))
  ));
  const entries = [...images];
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(5, entries.length) }, async () => {
    while (cursor < entries.length) {
      const [path, name] = entries[cursor++];
      await copyPublicPhoto(path, name);
    }
  }));
  const exported = cases.map(item => {
    const photos = [];
    for (let i = 1; i <= 4; i++) {
      const path = item["photo" + i + "_path"];
      if (path) photos.push({
        src: "images/" + images.get(path),
        slot: i,
        width: item["photo" + i + "_width_pct"] ?? 100,
        stretch: item["photo" + i + "_stretch_x_pct"] ?? 100
      });
    }
    const fields = [
      "id", "case_no", "inspection_type", "title", "facility", "photo_caption",
      "photo_note", "standard_title", "standard_body", "cause_title", "cause_body",
      "action_body", "prevention_body"
    ];
    return Object.fromEntries([...fields.map(field => [field, item[field] ?? ""]), ["photos", photos]]);
  });
  const snapshot = {
    version: 1,
    exportedAt: new Date().toISOString(),
    count: exported.length,
    photoCount: entries.length,
    book: configs[0].config.casebookBookText || {},
    cases: exported
  };
  const safeJson = JSON.stringify(snapshot).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
  await writeFile(join(destination, "data.js"), "window.KFI_STATIC_CASEBOOK = " + safeJson + ";\n", "utf8");
  console.log("독립형 사례집 생성 완료:", exported.length, "개 공개·검토완료 사례,", entries.length, "개 사진");
}
await main();