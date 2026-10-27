"use client";

import { useEffect, useState } from 'react';
import { websiteApi, websiteImage } from '@/lib/website';

type Certificate = {id:number;title:string;image_url:string;file_url:string;sort_order:number;kind:'certificate'};
const empty = {title:'',image_url:'',file_url:'',sort_order:0,kind:'certificate' as const};
const input = 'w-full rounded-lg border border-gray-300 bg-white p-3';

export default function CertificatesPage() {
  const [items,setItems] = useState<Certificate[]>([]);
  const [form,setForm] = useState({...empty});
  const [id,setId] = useState<number|null>(null);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [message,setMessage] = useState('');
  async function load() {
    try { setItems(await websiteApi<Certificate[]>('/catalogs?kind=certificate')); }
    catch(e) { setError((e as Error).message); }
  }
  useEffect(()=>{void load();},[]);
  async function upload(file:File) {
    if(file.size>4*1024*1024) {setError('파일은 4MB 이하로 선택해 주세요.');return;}
    setBusy(true);setError('');setMessage('');
    try {
      const body=new FormData();body.append('file',file);
      const result=await websiteApi<{url:string}>('/upload',{method:'POST',body});
      setForm(f=>({...f,file_url:result.url,...(file.type.startsWith('image/')?{image_url:result.url}:{})}));
      setMessage('업로드 완료. 저장을 눌러 홈페이지에 공개하세요.');
    }catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  async function save(e:React.FormEvent) {
    e.preventDefault();setBusy(true);setError('');setMessage('');
    try {
      if(!form.file_url && !form.image_url) throw new Error('인증서 파일이나 원본 주소를 입력해 주세요.');
      await websiteApi(id===null?'/catalogs':`/catalogs/${id}`,{method:id===null?'POST':'PUT',body:JSON.stringify(form)});
      setId(null);setForm({...empty});await load();setMessage('인증서를 홈페이지에 반영했습니다.');
    }catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  async function remove(item:Certificate) {
    if(!window.confirm(`${item.title} 인증서를 삭제할까요?`))return;
    setBusy(true);setError('');
    try {await websiteApi(`/catalogs/${item.id}`,{method:'DELETE'});if(id===item.id){setId(null);setForm({...empty});}await load();}
    catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  return <div className="space-y-6"><div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-2xl font-extrabold">인증서 보관함 관리</h1><a href="https://kyungnam-order.vercel.app/certificates" target="_blank" rel="noreferrer" className="rounded-lg border bg-white px-4 py-2">홈페이지 보기</a></div>
    <p className="text-sm text-gray-500">제품 인증서·시험성적서를 이미지 또는 PDF로 등록합니다. 등록한 자료는 홈페이지에 공개됩니다.</p>
    {error&&<p role="alert" className="rounded-lg bg-red-50 p-3 text-red-700">{error}</p>}{message&&<p role="status" className="rounded-lg bg-green-50 p-3 text-green-800">{message}</p>}
    <form onSubmit={save} className="rounded-2xl border bg-white p-5"><fieldset disabled={busy} className="space-y-4"><h2 className="font-bold">{id===null?'새 인증서 등록':'인증서 수정'}</h2>
      <label className="block">제목<input required className={input} value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></label>
      <label className="block">인증서 파일 (JPG·PNG·WEBP·PDF, 최대 4MB)<input className="mt-2 block max-w-full" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={e=>{const file=e.target.files?.[0];if(file)void upload(file);e.target.value='';}}/></label>
      <label className="block">원본 파일 주소<input className={input} value={form.file_url} onChange={e=>setForm({...form,file_url:e.target.value})}/></label>
      <label className="block">미리보기 이미지 주소<input className={input} value={form.image_url} onChange={e=>setForm({...form,image_url:e.target.value})}/></label>
      {form.image_url&&<img src={websiteImage(form.image_url)} alt="인증서 미리보기" className="max-h-64 max-w-full object-contain"/>}
      <label className="block">정렬 순서<input type="number" className={input} value={form.sort_order} onChange={e=>setForm({...form,sort_order:Number(e.target.value)})}/></label>
      <div className="flex gap-3"><button className="rounded-lg bg-black px-5 py-3 text-white" type="submit">{busy?'처리 중…':'저장'}</button><button type="button" className="rounded-lg border px-5 py-3" onClick={()=>{setId(null);setForm({...empty});}}>초기화</button></div>
    </fieldset></form>
    <div className="grid gap-4 md:grid-cols-2">{items.map(item=><article key={item.id} className="rounded-xl border bg-white p-5"><h2 className="font-bold">{item.title}</h2><div className="mt-4 flex flex-wrap gap-3 text-sm"><a href={websiteImage(item.file_url||item.image_url)} target="_blank" rel="noreferrer" className="underline">원본 보기</a><button disabled={busy} onClick={()=>{setId(item.id);setForm({...item});window.scrollTo({top:0,behavior:'smooth'});}}>수정</button><button disabled={busy} onClick={()=>void remove(item)} className="text-red-600">삭제</button></div></article>)}</div>
    {!items.length&&<p className="text-sm text-gray-500">등록된 인증서가 없습니다.</p>}
  </div>;
}
