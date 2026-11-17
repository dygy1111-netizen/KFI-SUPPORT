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
  // Keep old sites readable until the optional photo-size migration is applied.
  // Only missing-column errors permit falling back; never downgrade on auth/network errors.
  const photoCheck = await supabase.from('casebook_cases').select('photo1_width_pct,photo2_width_pct').limit(0);
  if (photoCheck.error && !missingColumn(photoCheck.error)) return {data:null,error:photoCheck.error,legacy,photoSizeReady:false};
  const photoSizeReady = !photoCheck.error;
  const photoFields = photoSizeReady ? ',photo1_width_pct,photo2_width_pct' : '';
  // Horizontal stretch is a separate optional migration. Never hide legacy cases
  // if the new columns have not been installed yet.
  const stretchCheck = await supabase.from('casebook_cases')
    .select('photo1_stretch_x_pct,photo2_stretch_x_pct').limit(0);
  if (stretchCheck.error && !missingColumn(stretchCheck.error)) {
    return {data:null,error:stretchCheck.error,legacy,photoSizeReady,photoStretchReady:false};
  }
  const photoStretchReady = !stretchCheck.error;
  const stretchFields = photoStretchReady ? ',photo1_stretch_x_pct,photo2_stretch_x_pct' : '';
  // The four-photo migration is optional until applied by the Supabase owner.
  // Do not break existing listings or photo 1/2 editing if the columns are absent.
  const extraCheck = await supabase.from('casebook_cases')
    .select('photo3_path,photo4_path,photo3_width_pct,photo4_width_pct,photo3_stretch_x_pct,photo4_stretch_x_pct')
    .limit(0);
  if (extraCheck.error && !missingColumn(extraCheck.error)) {
    return {data:null,error:extraCheck.error,legacy,photoSizeReady,photoStretchReady,extraPhotosReady:false};
  }
  const extraPhotosReady = !extraCheck.error;
  const extraPhotoFields = extraPhotosReady
    ? ',photo3_path,photo4_path,photo3_width_pct,photo4_width_pct,photo3_stretch_x_pct,photo4_stretch_x_pct'
    : '';
  const rows: CasebookCase[] = [];
  for (let offset=0; ; offset+=500) {
    let query = supabase.from('casebook_cases').select(publicOnly ? publicFields + photoFields + stretchFields + extraPhotoFields + (legacy ? '' : ',finding_type,test_item') : '*');
    if (publicOnly && hasPublished) query = query.eq('published',true);
    if (publicOnly && !legacy) query = query.eq('review_status','검토완료');
    const result = await query.order('sort_order').order('case_no').order('id').range(offset,offset+499);
    if (result.error) return {data:null,error:result.error,legacy,photoSizeReady,photoStretchReady,extraPhotosReady};
    rows.push(...(result.data as unknown as Record<string, unknown>[] || []).map(row => ({finding_type:'',test_item:'',source_uid:null,source_row:null,source_sheet:'',review_note:'',review_status:'검토완료',published:true,photo1_width_pct:100,photo2_width_pct:100,photo1_stretch_x_pct:100,photo2_stretch_x_pct:100,photo3_path:null,photo4_path:null,photo3_width_pct:100,photo4_width_pct:100,photo3_stretch_x_pct:100,photo4_stretch_x_pct:100,...row}) as CasebookCase));
    if ((result.data?.length || 0)<500) return {data:rows,error:null,legacy,photoSizeReady,photoStretchReady,extraPhotosReady};
  }
}
