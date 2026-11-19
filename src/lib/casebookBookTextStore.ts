import { supabase } from "./supabase";
import { parseBookText, validateBookText, type BookText } from "./casebookBookText";

const KEY="casebookBookText";
export async function loadBookText(){
  const {data,error}=await supabase.from("site_config").select("config,updated_at").eq("id",1).single();
  if(error)throw new Error(error.message);
  return {text:parseBookText(data.config?.[KEY]),revision: data.updated_at as string};
}
export async function saveBookText(text:BookText,revision:string){
  const problems=validateBookText(text);
  if(problems.length)throw new Error(problems.join("\n"));
  const permission=await supabase.rpc("is_admin");
  if(permission.error||permission.data!==true)throw new Error("관리자만 저장할 수 있습니다.");
  const current=await supabase.from("site_config").select("config,updated_at").eq("id",1).single();
  if(current.error)throw new Error(current.error.message);
  if(current.data.updated_at!==revision)throw new Error("다른 설정이 변경되었습니다. 다시 불러온 뒤 저장해 주세요.");
  const result=await supabase.from("site_config")
    .update({config:{...current.data.config,[KEY]:text},updated_at:new Date().toISOString()})
    .eq("id",1).eq("updated_at",revision).select("updated_at").single();
  if(result.error)throw new Error("저장 실패: "+result.error.message);
  return result.data.updated_at as string;
}
