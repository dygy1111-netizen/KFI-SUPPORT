import { supabase } from './supabase';
import type { CasebookCase } from './casebook';

const publicFields = 'id,case_no,inspection_type,title,facility,photo1_path,photo2_path,photo_caption,photo_note,standard_title,standard_body,cause_title,cause_body,action_body,prevention_body,sort_order';
const missingColumn = (error: {code?:string} | null) => error?.code === '42703' || error?.code === 'PGRST204';

/** Legacy compatibility never falls back after an authorization or network error. */
export async function loadCasebook(publicOnly: boolean) {
  let legacy = false;
  let hasPublished = true;
  const schema = await supabase.from('casebook_cases').select('review_status').limit(0);
  if (schema.error) {
    if (!missingColumn(schema.error)) return {data:null,error:schema.error,legacy:false};
    legacy = true;
    const visibility = await supabase.from('casebook_cases').select('published').limit(0);
    if (visibility.error && !missingColumn(visibility.error)) return {data:null,error:visibility.error,legacy};
    hasPublished = !visibility.error;
  }
  const rows: CasebookCase[] = [];
  for (let offset=0; ; offset+=500) {
    let query = supabase.from('casebook_cases').select(publicOnly ? publicFields + (legacy ? '' : ',finding_type,test_item') : '*');
    if (publicOnly && hasPublished) query = query.eq('published',true);
    if (publicOnly && !legacy) query = query.eq('review_status','검토완료');
    const result = await query.order('sort_order').order('case_no').order('id').range(offset,offset+499);
    if (result.error) return {data:null,error:result.error,legacy};
    rows.push(...(result.data as unknown as Record<string, unknown>[] || []).map(row => ({finding_type:'',test_item:'',source_uid:null,source_row:null,source_sheet:'',review_note:'',review_status:'검토완료',published:true,...row}) as CasebookCase));
    if ((result.data?.length || 0)<500) return {data:rows,error:null,legacy};
  }
}
