import * as cheerio from 'cheerio';
import * as XLSX from 'xlsx';

const UA = {
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36',
  'accept': 'text/html,application/xhtml+xml,application/json,*/*'
};

async function text(url, opts={}) {
  const r = await fetch(url, {headers:{...UA,...(opts.headers||{})}, redirect:'follow', ...opts});
  return {r, body: await r.text()};
}
function controls(html) {
  const $=cheerio.load(html);
  const forms=[];
  $('form').each((i,f)=>{
    const arr=[];
    $(f).find('input,select,button,textarea,a').each((j,e)=>{
      const el=$(e);
      const name=el.attr('name'), id=el.attr('id');
      if (!name && !id && e.tagName!=='a') return;
      let options;
      if(e.tagName==='select') options=el.find('option').map((k,o)=>({value:$(o).attr('value')||'',text:$(o).text().trim()})).get().slice(0,300);
      arr.push({tag:e.tagName,name,id,type:el.attr('type'),value:el.attr('value'),href:el.attr('href'),text:el.text().replace(/\s+/g,' ').trim().slice(0,180),options});
    });
    forms.push({action:$(f).attr('action'),method:$(f).attr('method'),id:$(f).attr('id'),fields:arr});
  });
  return {title:$('title').text().trim(),forms,scripts:$('script[src]').map((i,e)=>$(e).attr('src')).get()};
}
export default async function handler(req,res){
  const mode=String(req.query.mode||'');
  try {
    if(mode==='phoenixDiag'){
      const u=new URL('https://maps.phoenix.gov/pub/rest/services/Public/Planning_Permit/MapServer/1/query');
      for(const [k,v] of Object.entries({
        where:'PER_ENT_DATE IS NOT NULL',outFields:'*',returnGeometry:'false',
        orderByFields:'PER_ENT_DATE DESC,OBJECTID DESC',resultRecordCount:'1000',f:'json'
      })) u.searchParams.set(k,v);
      const r=await fetch(u,{headers:UA}); const j=await r.json();
      const a=(j.features||[]).map(x=>x.attributes||{});
      const dist={};
      for(const fld of ['PER_TYPE','PER_TYPE_DESC','MOD_DESC','SCOPE_CODE','PERMIT_STAT']){
        const m={}; for(const x of a){const k=String(x[fld]||'');m[k]=(m[k]||0)+1}
        dist[fld]=Object.entries(m).sort((x,y)=>y[1]-x[1]).slice(0,100);
      }
      return res.status(r.status).json({count:a.length,fields:a[0]?Object.keys(a[0]):[],dist,sample:a.slice(0,60)});
    }
    if(mode==='dallasCO'){
      const url='https://dallascityhall.com/departments/pnv/Documents/AH%20Memos/COSMonthly%20Report2026-Aug.xlsx';
      const r=await fetch(url,{headers:UA}); const b=Buffer.from(await r.arrayBuffer());
      if(!r.ok) return res.status(r.status).json({status:r.status,bytes:b.length});
      const wb=XLSX.read(b,{type:'buffer',cellDates:true}); const out={};
      for(const n of wb.SheetNames){
        const rows=XLSX.utils.sheet_to_json(wb.Sheets[n],{defval:'',raw:false});
        out[n]={count:rows.length,headers:rows[0]?Object.keys(rows[0]):[],sample:rows.slice(0,80)};
      }
      return res.json({bytes:b.length,sheets:out});
    }
    if(mode==='tdlrInspect'){
      const {r,body}=await text('https://www.tdlr.texas.gov/TABS/Search/');
      return res.status(r.status).json({status:r.status,url:r.url,...controls(body)});
    }
    if(mode==='atlantaInspect'){
      const {r,body}=await text('https://aca-prod.accela.com/ATLANTA_GA/Cap/CapHome.aspx?module=Building&TabName=Building');
      const c=controls(body);
      return res.status(200).json({upstreamStatus:r.status,url:r.url,bytes:body.length,head:body.slice(0,500),...c});
    }
    if(mode==='getText'){
      const u=new URL(String(req.query.url||''));
      const allowed=['www.tdlr.texas.gov','tdlr.texas.gov','aca-prod.accela.com','maps.phoenix.gov','dallascityhall.com'];
      if(!allowed.includes(u.hostname)) return res.status(403).json({error:'blocked'});
      const {r,body}=await text(u.toString());
      return res.status(200).json({status:r.status,url:r.url,ctype:r.headers.get('content-type'),bytes:body.length,body:body.slice(0,200000)});
    }
    return res.status(400).json({error:'mode'});
  } catch(e){return res.status(500).json({error:String(e),stack:e?.stack});}
}
