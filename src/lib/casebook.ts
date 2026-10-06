export type ReviewStatus = '검토대기' | '기준확인필요' | '검토완료';
export type CasebookCase = {
  id: number; case_no: number; inspection_type: string; title: string; facility: string;
  photo1_path: string | null; photo2_path: string | null; photo_caption: string; photo_note: string;
  standard_title: string; standard_body: string; cause_title: string; cause_body: string;
  action_body: string; prevention_body: string; sort_order: number;
  finding_type: string; test_item: string; source_uid: string | null;
  source_row: number | null; source_sheet: string; review_note: string;
  review_status: ReviewStatus; published: boolean; created_at?: string; updated_at?: string;
};
export type ImportCase = Omit<CasebookCase, 'id' | 'created_at' | 'updated_at'>;
const textFields = ['inspection_type','title','facility','standard_title','standard_body','cause_title','cause_body','action_body','prevention_body','finding_type','test_item','source_sheet','review_note'] as const;
export function parseImport(input: unknown): {rows: ImportCase[]; errors: string[]} {
  if (!Array.isArray(input) || input.length > 2000) throw new Error('최대 2,000건의 JSON 배열을 선택하세요.');
  const rows: ImportCase[] = [], errors: string[] = [], seen = new Set<string>();
  input.forEach((value, index) => {
    try {
      if (!value || typeof value !== 'object') throw new Error('객체 형식이 아닙니다.');
      const v = value as Record<string, unknown>;
      if (typeof v.source_uid !== 'string' || !/^[a-zA-Z0-9:_-]{8,160}$/.test(v.source_uid)) throw new Error('source_uid가 올바르지 않습니다.');
      if (seen.has(v.source_uid)) throw new Error('파일 안에서 source_uid가 중복됩니다.');
      const text = Object.fromEntries(textFields.map(key => {
        if (typeof v[key] !== 'string' || (v[key] as string).length > 10000) throw new Error(`${key} 문자열을 확인하세요.`);
        return [key, (v[key] as string).trim()];
      })) as Pick<ImportCase, typeof textFields[number]>;
      if (!text.title || !text.inspection_type) throw new Error('제목과 검사구분이 필요합니다.');
      if (text.inspection_type === '안전성능검사') throw new Error('현재 가져오기에서 안전성능검사는 제외합니다.');
      if (!['보완','부적합'].includes(text.finding_type)) throw new Error('보완·부적합 구분을 확인하세요.');
      if (!Number.isInteger(v.source_row) || Number(v.source_row) < 2) throw new Error('원본 행 번호가 필요합니다.');
      seen.add(v.source_uid);
      rows.push({...text, source_uid:v.source_uid, source_row:Number(v.source_row), case_no:0, sort_order:0,
        review_status:v.review_status === '기준확인필요' ? '기준확인필요' : '검토대기', published:false,
        photo1_path:null, photo2_path:null, photo_caption:'', photo_note:''});
    } catch (e) { errors.push(`${index+1}행: ${e instanceof Error ? e.message : '잘못된 데이터'}`); }
  });
  return {rows, errors};
}
