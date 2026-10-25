export const draftKey = accountId => `yiban:memory-draft:v1:${accountId}`;
export function readDraft(storage, accountId) {
  if (!accountId) return null;
  try { const record=JSON.parse(storage.getItem(draftKey(accountId))||'null');return record&&Date.now()-record.savedAt<7*86400000?record.form:null; } catch { return null; }
}
export const hasDraftContent = form => Boolean(form.title?.trim()||form.story?.trim()||form.cover||form.audio||form.video);
export const memoryTitle = form => form.title?.trim()||form.story?.trim().split(/[。！？\n]/)[0]?.slice(0,40)||(form.audio?'一段家人的声音':form.video?'一段家庭影像':'一张值得记住的照片');
