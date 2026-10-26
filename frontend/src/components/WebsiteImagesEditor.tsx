"use client";

import { useState } from 'react';
import { websiteApi, websiteImage } from '@/lib/website';

type Images = { image_url: string; image_urls: string[]; detail_image_urls: string[] };
const button = 'rounded-lg border bg-white px-3 py-2 text-xs disabled:opacity-30';

async function prepare(file: File, detail: boolean): Promise<File> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('JPG, PNG, WEBP 파일을 선택해 주세요.');
  if (detail && file.size <= 4 * 1024 * 1024) return file;
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, (detail ? 1200 : 1800) / (detail ? bitmap.width : Math.max(bitmap.width, bitmap.height)), 16000 / bitmap.height);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('이미지를 처리할 수 없습니다.');
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.9, 0.8, 0.65]) {
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', quality));
      if (blob && blob.size <= 4 * 1024 * 1024) return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.webp', {type: blob.type});
    }
    throw new Error('이미지가 너무 큽니다. 상세설명 이미지를 나누어 업로드해 주세요.');
  } finally { bitmap.close(); }
}

export default function WebsiteImagesEditor({ value, onChange, onBusy, onError }: {
  value: Images; onChange: (value: Images) => void; onBusy: (busy: boolean) => void; onError: (message: string) => void;
}) {
  const [progress, setProgress] = useState('');
  async function upload(files: File[], kind: 'main' | 'gallery' | 'detail') {
    if (!files.length) return;
    onBusy(true); onError('');
    const draft = {...value, image_urls: [...value.image_urls], detail_image_urls: [...value.detail_image_urls]};
    let completed = 0;
    try {
      files.sort((a,b) => a.name.localeCompare(b.name, 'ko', {numeric:true}));
      for (const file of files) {
        setProgress(`${completed + 1}/${files.length} · ${file.name} 업로드 중`);
        const prepared = await prepare(file, kind === 'detail');
        const body = new FormData(); body.append('file', prepared);
        const {url} = await websiteApi<{url:string}>('/upload', {method:'POST', body});
        if (kind === 'detail') draft.detail_image_urls.push(url);
        else if (kind === 'main' || !draft.image_url) {
          if (draft.image_url) draft.image_urls.unshift(draft.image_url);
          draft.image_url = url;
        } else draft.image_urls.push(url);
        onChange({...draft, image_urls:[...draft.image_urls], detail_image_urls:[...draft.detail_image_urls]});
        completed++;
      }
      setProgress(`${completed}개 업로드 완료 · 아래 저장 버튼을 눌러 상품에 반영하세요.`);
    } catch (e) {
      onError(`${(e as Error).message} (${completed}개 업로드 완료. 업로드된 이미지는 편집 화면에 유지됩니다.)`);
      setProgress('');
    } finally { onBusy(false); }
  }
  function reorder(key: 'image_urls' | 'detail_image_urls', from: number, step: number) {
    const list = [...value[key]]; const to = from + step;
    if (to < 0 || to >= list.length) return;
    [list[from],list[to]] = [list[to],list[from]];
    onChange({...value,[key]:list});
  }
  return <section className="space-y-6 rounded-xl border border-gray-200 bg-gray-50 p-4">
    <div><h3 className="font-bold">상품 이미지</h3><p className="mt-1 text-xs leading-6 text-gray-500">촬영 사진과 긴 상세설명 이미지를 구분해 올려주세요. 여러 장을 선택할 수 있으며 큰 촬영 사진은 자동으로 최적화합니다. 원본 파일은 변경하지 않습니다.</p></div>
    {progress && <p role="status" className="rounded-lg bg-blue-50 p-3 text-sm text-blue-800">{progress}</p>}
    <div className="rounded-xl border bg-white p-4">
      <h4 className="font-bold text-sm">1. 대표 이미지</h4><p className="my-2 text-xs text-gray-500">상품 목록과 상세페이지의 첫 사진입니다.</p>
      <div className="flex flex-wrap items-start gap-4">{value.image_url && <img src={websiteImage(value.image_url)} alt="대표 이미지" className="h-32 w-40 rounded border object-contain" />}
        <div className="flex-1 space-y-2"><input aria-label="대표 이미지 업로드" type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>{void upload(Array.from(e.target.files??[]),'main');e.target.value='';}} />
          <input aria-label="대표 이미지 주소" className="w-full rounded-lg border p-2 text-xs" value={value.image_url} onChange={e=>onChange({...value,image_url:e.target.value})} />
          {value.image_url && <button type="button" className={button} onClick={()=>onChange({...value,image_url:''})}>대표 이미지 제거</button>}
        </div>
      </div>
    </div>
    {(['image_urls','detail_image_urls'] as const).map(key => <div key={key} className="rounded-xl border bg-white p-4">
      <h4 className="font-bold text-sm">{key==='image_urls' ? '2. 촬영 사진 갤러리' : '3. 상세설명 이미지'} <span className="font-normal text-gray-500">({value[key].length}장)</span></h4>
      <p className="my-2 text-xs leading-6 text-gray-500">{key==='image_urls' ? '상단에서 넘겨보는 제품 사진입니다. 첫 대표 이미지와 함께 표시됩니다.' : '하단에 원래 비율로 길게 표시됩니다. 상세.jpg → 상세2.jpg 순서로 배치하세요.'}</p>
      <input aria-label={key==='image_urls'?'촬영 사진 여러 장 업로드':'상세설명 여러 장 업로드'} multiple type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>{void upload(Array.from(e.target.files??[]),key==='image_urls'?'gallery':'detail');e.target.value='';}} />
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{value[key].map((url,i)=><div key={`${i}-${url}`} className="space-y-2 rounded-lg border p-3">
        <div className="h-36 overflow-auto rounded bg-gray-50">{url && <img src={websiteImage(url)} alt={`${key==='image_urls'?'촬영':'상세설명'} ${i+1}`} className={key==='image_urls'?'h-full w-full object-contain':'h-auto w-full'} />}</div>
        <input aria-label={`이미지 ${i+1} 주소`} className="w-full rounded border p-2 text-xs" value={url} onChange={e=>onChange({...value,[key]:value[key].map((u,n)=>n===i?e.target.value:u)})} />
        <div className="flex flex-wrap gap-1"><button type="button" aria-label={`${i+1}번 이미지 앞으로`} className={button} disabled={i===0} onClick={()=>reorder(key,i,-1)}>앞으로</button><button type="button" className={button} disabled={i===value[key].length-1} onClick={()=>reorder(key,i,1)}>뒤로</button>
          {key==='image_urls' && <button type="button" className={button} onClick={()=>onChange({...value,image_url:url,image_urls:value.image_urls.flatMap((u,n)=>n===i?(value.image_url?[value.image_url]:[]):[u])})}>대표로</button>}
          <button type="button" className={button} onClick={()=>onChange({...value,[key]:value[key].filter((_,n)=>n!==i)})}>제거</button></div>
      </div>)}</div>
      <button type="button" className={`${button} mt-3`} onClick={()=>onChange({...value,[key]:[...value[key],'']})}>이미지 주소 직접 추가</button>
    </div>)}
  </section>;
}
