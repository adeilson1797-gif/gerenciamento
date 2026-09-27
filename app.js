
const cfg = window.APP_CONFIG;
const sb = supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY);
const $ = s => document.querySelector(s);
const money = v => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v||0));
const localISODate=(d=new Date())=>new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10);
const today=()=>localISODate();
const monthNow=()=>today().slice(0,7);
const percent = v => `${(Number(v||0)*100).toFixed(1)}%`;
let user=null, profile=null, adminCache={reps:[],sales:[],month:""}, dailyChart=null;

function showOnly(id){
  ["#authView","#resetView","#repView","#adminView"].forEach(x=>{
    const el=$(x);
    if(el) el.classList.add("hidden");
  });
  const target=$(id);
  if(target) target.classList.remove("hidden");
}
function setMsg(el,text,type="error"){
  el.textContent=text||""; el.className="msg "+(text?type:"");
}
function pane(name){
  document.querySelectorAll(".pane").forEach(x=>x.classList.add("hidden"));
  document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));
  $("#"+name+"Pane").classList.remove("hidden");
  document.querySelector(`[data-tab="${name}"]`).classList.add("active");
}
document.querySelectorAll(".tab").forEach(b=>b.addEventListener("click",()=>pane(b.dataset.tab)));

function previousDateISO(){
  const d=new Date(); d.setDate(d.getDate()-1); return localISODate(d);
}
function elapsedBusinessDays(mk){
  const {y,m}=monthBounds(mk);
  const start=new Date(y,m-1,1);
  const isCurrent=mk===monthNow();
  const end=isCurrent?new Date():new Date(y,m,0);
  let count=0,d=new Date(start);
  while(d<=end){const day=d.getDay();if(day!==0&&day!==6)count++;d.setDate(d.getDate()+1);}
  return count;
}
function totalBusinessDays(mk){
  const {y,m}=monthBounds(mk),end=new Date(y,m,0);let count=0,d=new Date(y,m-1,1);
  while(d<=end){const day=d.getDay();if(day!==0&&day!==6)count++;d.setDate(d.getDate()+1);}
  return count;
}
function monthBounds(mk){
  const [y,m]=mk.split("-").map(Number);
  return {start:`${mk}-01`, next:new Date(y,m,1).toISOString().slice(0,10), y, m};
}
function businessDaysRemaining(mk){
  const {y,m}=monthBounds(mk);
  const now=new Date(), isCurrent=mk===monthNow();
  let d=isCurrent?new Date(now.getFullYear(),now.getMonth(),now.getDate()):new Date(y,m-1,1);
  const end=new Date(y,m,0); let count=0;
  while(d<=end){ const day=d.getDay(); if(day!==0&&day!==6) count++; d.setDate(d.getDate()+1); }
  return count;
}
function businessDayNeed(target,sold,mk){
  const remaining=Math.max(Number(target||0)-Number(sold||0),0), days=businessDaysRemaining(mk);
  return days>0?remaining/days:remaining;
}
function escapeCsv(v){ const s=String(v??""); return `"${s.replaceAll('"','""')}"`; }

async function loadProfile(){
  const {data,error}=await sb.from("profiles").select("*").eq("user_id",user.id).maybeSingle();
  if(error) throw error; profile=data;
}
async function boot(){
  const {data:{session}}=await sb.auth.getSession();
  if(!session){
    user=null;profile=null;showOnly("#authView");$("#logoutBtn").classList.add("hidden");$("#sessionName").textContent="";return;
  }
  user=session.user; await loadProfile(); await tryPendingInvite();
  if(!profile){showOnly("#authView");$("#sessionName").textContent=user.email||"";$("#logoutBtn").classList.remove("hidden");return;}
  $("#sessionName").textContent=profile.name;$("#logoutBtn").classList.remove("hidden");
  if(["admin","sub_admin"].includes(profile.role)){
    showOnly("#adminView");
    $("#adminMonth").value=$("#adminMonth").value||monthNow();
    const isMainAdmin=profile.role==="admin";
    $("#managerRoleBadge").textContent=isMainAdmin?"Administrador principal":"Subadministrador";
    $("#managerRoleBadge").classList.toggle("sub",!isMainAdmin);
    $("#adminInviteCard")?.classList.toggle("hidden",!isMainAdmin);
    $("#subAdminInfo")?.classList.toggle("hidden",isMainAdmin);
    await loadAdmin();
  } else {
    showOnly("#repView");
    $("#repTitle").textContent=`Vendas de ${profile.name}`;
    $("#saleDate").value=today();
    await loadRep();
  }
}

$("#loginForm").addEventListener("submit",async e=>{
  e.preventDefault(); setMsg($("#loginMsg"),"");
  const {error}=await sb.auth.signInWithPassword({email:$("#loginEmail").value.trim(),password:$("#loginPassword").value});
  if(error) return setMsg($("#loginMsg"),"E-mail ou senha inválidos.");
  await boot();
});
$("#forgotBtn").addEventListener("click",async()=>{
  const email=$("#loginEmail").value.trim(); if(!email)return setMsg($("#loginMsg"),"Digite seu e-mail primeiro.");
  const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:window.location.href});
  setMsg($("#loginMsg"),error?error.message:"Link de recuperação enviado.","ok");
});
$("#setupForm").addEventListener("submit",async e=>{
  e.preventDefault();setMsg($("#setupMsg"),"");
  const name=$("#setupName").value.trim(),email=$("#setupEmail").value.trim(),password=$("#setupPassword").value;
  const {data,error}=await sb.auth.signUp({email,password}); if(error)return setMsg($("#setupMsg"),error.message);
  if(!data.session)return setMsg($("#setupMsg"),"Conta criada. Confirme o e-mail e depois entre para concluir.","ok");
  user=data.user;const {error:rpcErr}=await sb.rpc("bootstrap_admin",{p_name:name});
  if(rpcErr)return setMsg($("#setupMsg"),rpcErr.message); await boot();
});
$("#repSignupForm").addEventListener("submit",async e=>{
  e.preventDefault();setMsg($("#repSignupMsg"),"");
  const code=$("#inviteCode").value.trim(),email=$("#repEmail").value.trim(),password=$("#repPassword").value;
  const {data,error}=await sb.auth.signUp({email,password});if(error)return setMsg($("#repSignupMsg"),error.message);
  if(!data.session){localStorage.setItem("pending_invite_code",code);return setMsg($("#repSignupMsg"),"Conta criada. Confirme o e-mail e depois entre.","ok");}
  user=data.user;const {error:rpcErr}=await sb.rpc("claim_representative_invite",{p_code:code});
  if(rpcErr)return setMsg($("#repSignupMsg"),rpcErr.message);await boot();
});
$("#logoutBtn").addEventListener("click",async()=>{await sb.auth.signOut();await boot();});

async function tryPendingInvite(){
  const code=localStorage.getItem("pending_invite_code");if(!code||!user||profile)return;
  const {error}=await sb.rpc("claim_representative_invite",{p_code:code});
  if(!error)localStorage.removeItem("pending_invite_code");await loadProfile();
}

async function loadRep(){
  const mk=monthNow(),{start,next}=monthBounds(mk);
  const {data,error}=await sb.from("daily_sales").select("*").eq("user_id",user.id).gte("sale_date",start).lt("sale_date",next).order("sale_date",{ascending:false});
  if(error)return setMsg($("#saleMsg"),error.message);
  const rows=data||[], month=rows.reduce((s,r)=>s+Number(r.amount||0),0), td=rows.find(r=>r.sale_date===today())?.amount||0;
  const target=Number(profile.monthly_target||0), rem=Math.max(target-month,0), days=businessDaysRemaining(mk), need=days?rem/days:rem, p=target>0?month/target:0;
  $("#repToday").textContent=money(td);$("#repMonth").textContent=money(month);$("#repTarget").textContent=money(target);$("#repPct").textContent=target>0?percent(p):"—";
  $("#repRemaining").textContent=target>0?`Faltam ${money(rem)}`:"Meta não definida";
  $("#repProgress").style.width=`${Math.min(p*100,100)}%`;
  $("#repDailyNeed").textContent=target>0?`Média necessária: ${money(need)}/dia útil`:"Média necessária: —";
  $("#repDaysLeft").textContent=`Dias úteis restantes: ${days}`;
  $("#repHistory").innerHTML=rows.slice(0,12).map(r=>`<tr><td>${r.sale_date.split("-").reverse().join("/")}</td><td>${money(r.amount)}</td><td>${r.note||"—"}</td></tr>`).join("")||`<tr><td colspan="3">Nenhum lançamento no mês.</td></tr>`;
}
$("#saleForm").addEventListener("submit",async e=>{
  e.preventDefault();setMsg($("#saleMsg"),"");
  const row={user_id:user.id,sale_date:$("#saleDate").value,amount:Number($("#saleAmount").value),note:$("#saleNote").value.trim()||null};
  const {error}=await sb.from("daily_sales").upsert(row,{onConflict:"user_id,sale_date"});
  if(error)return setMsg($("#saleMsg"),error.message);
  setMsg($("#saleMsg"),"Venda salva com sucesso.","ok");$("#saleAmount").value="";$("#saleNote").value="";await loadRep();
});

async function loadAdmin(){
  const mk=$("#adminMonth").value||monthNow(),{start,next}=monthBounds(mk);
  const [{data:profiles,error:pErr},{data:sales,error:sErr},{data:invites,error:iErr}]=await Promise.all([
    sb.from("profiles").select("*").eq("role","rep").order("name"),
    sb.from("daily_sales").select("*").gte("sale_date",start).lt("sale_date",next),
    sb.from("representative_invites").select("*").order("created_at",{ascending:false}).limit(12)
  ]);
  if(pErr||sErr||iErr){console.error(pErr||sErr||iErr);return;}
  const reps=(profiles||[]).filter(r=>r.active), map={};
  (sales||[]).forEach(s=>{map[s.user_id]||={month:0,today:0,last:null,hasToday:false};map[s.user_id].month+=Number(s.amount||0);if(s.sale_date===today()){map[s.user_id].today+=Number(s.amount||0);map[s.user_id].hasToday=true;}if(!map[s.user_id].last||s.sale_date>map[s.user_id].last)map[s.user_id].last=s.sale_date;});
  const totalMonth=Object.values(map).reduce((a,b)=>a+b.month,0),totalToday=Object.values(map).reduce((a,b)=>a+b.today,0),target=reps.reduce((a,b)=>a+Number(b.monthly_target||0),0);
  const yesterday=previousDateISO();
  const totalYesterday=(sales||[]).filter(s=>s.sale_date===yesterday).reduce((a,b)=>a+Number(b.amount||0),0);
  const reported=reps.filter(r=>map[r.user_id]?.hasToday===true).length;
  const elapsed=Math.max(elapsedBusinessDays(mk),1),totalDays=Math.max(totalBusinessDays(mk),1);
  const projection=(totalMonth/elapsed)*totalDays;
  const remaining=Math.max(target-totalMonth,0);
  const need=businessDayNeed(target,totalMonth,mk);
  const vs=totalYesterday>0?((totalToday-totalYesterday)/totalYesterday):null;

  $("#admToday").textContent=money(totalToday);
  $("#admYesterday").textContent=money(totalYesterday);
  $("#admVsYesterday").textContent=vs===null?"Sem base comparativa":`${vs>=0?"+":""}${(vs*100).toFixed(1)}% vs ontem`;
  $("#admMonth").textContent=money(totalMonth);
  $("#admProjection").textContent=money(projection);
  $("#admTarget").textContent=money(target);
  $("#admPct").textContent=target>0?percent(totalMonth/target):"—";
  $("#admRemaining").textContent=money(remaining);
  $("#admDailyNeed").textContent=target>0?money(need):"—";
  $("#admActive").textContent=reps.length;$("#admReported").textContent=reported;$("#admPending").textContent=Math.max(reps.length-reported,0);

  const ranked=[...reps].sort((a,b)=>(map[b.user_id]?.month||0)-(map[a.user_id]?.month||0));
  $("#adminTeam").innerHTML=ranked.map((r,idx)=>{
    const s=map[r.user_id]||{month:0,today:0,last:null,hasToday:false}, need=businessDayNeed(r.monthly_target,s.month,mk);
    const statusClass=!s.hasToday?"pending":(s.today>0?"sale":"zero");
    const statusText=!s.hasToday?"Pendente":(s.today>0?"Com venda":"Sem venda");
    return `<tr>
      <td><span class="rank-badge">${idx+1}</span></td><td>${r.name}</td>
      <td><span class="status ${statusClass}">${statusText}</span></td>
      <td>${money(s.today)}</td><td>${money(s.month)}</td><td>${money(r.monthly_target)}</td>
      <td>${Number(r.monthly_target)>0?percent(s.month/Number(r.monthly_target)):"—"}</td><td>${Number(r.monthly_target)>0?money(need):"—"}</td>
      <td>${s.last?s.last.split("-").reverse().join("/"):"—"}</td>
      <td>${profile.role==="admin"
        ? `<button class="btn btn-xs btn-light" onclick="editRep('${r.user_id}','${String(r.name).replaceAll("'","&#39;")}',${Number(r.monthly_target||0)})">Editar</button>
           <button class="btn btn-xs btn-light danger" onclick="deactivateRep('${r.user_id}','${String(r.name).replaceAll("'","&#39;")}')">Desativar</button>`
        : `<span class="muted">Somente consulta</span>`}</td>
    </tr>`;
  }).join("")||`<tr><td colspan="10">Nenhum representante cadastrado.</td></tr>`;

  const historyRep=$("#historyRep"); if(historyRep){const keep=historyRep.value;historyRep.innerHTML='<option value="">Todos os representantes</option>'+reps.map(r=>`<option value="${r.user_id}">${r.name}</option>`).join("");historyRep.value=keep;}
  $("#rankingTable").innerHTML=ranked.slice(0,10).map((r,idx)=>{
    const sold=map[r.user_id]?.month||0,target=Number(r.monthly_target||0);
    return `<tr><td>${idx+1}º</td><td>${r.name}</td><td>${money(sold)}</td><td>${target>0?percent(sold/target):"—"}</td></tr>`;
  }).join("")||`<tr><td colspan="4">Sem dados.</td></tr>`;

  $("#inviteList").innerHTML=(invites||[]).map(i=>`<tr>
    <td>${i.representative_name}</td>
    <td>${i.invite_role==="sub_admin"?"Subadministrador":"Representante"}</td>
    <td>${i.code.slice(0,10)}…</td>
    <td>${i.used_by?"Utilizado":(i.active?"Disponível":"Inativo")}</td>
  </tr>`).join("")||`<tr><td colspan="4">Nenhum convite criado.</td></tr>`;
  adminCache={reps,sales:sales||[],month:mk};
  renderAdminSalesHistory();
  renderDailyChart(sales||[],mk);
}

function renderDailyChart(sales,mk){
  const {y,m}=monthBounds(mk), days=new Date(y,m,0).getDate(), totals=Array(days).fill(0);
  sales.forEach(s=>{const d=Number(s.sale_date.slice(-2));if(d>=1&&d<=days)totals[d-1]+=Number(s.amount||0);});
  const ctx=$("#dailyChart"); if(dailyChart)dailyChart.destroy();
  dailyChart=new Chart(ctx,{type:"line",data:{labels:Array.from({length:days},(_,i)=>String(i+1).padStart(2,"0")),datasets:[{label:"Vendas por dia",data:totals,tension:.25,fill:true}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{ticks:{callback:v=>money(v)}}}}});
}

window.editRep=async(userId,name,target)=>{
  const newName=prompt("Nome do representante:",name); if(newName===null)return;
  const targetText=prompt("Meta mensal (R$):",String(target));if(targetText===null)return;
  const newTarget=Number(String(targetText).replace(",","."));
  if(Number.isNaN(newTarget)||newTarget<0)return alert("Meta inválida.");
  const {error}=await sb.from("profiles").update({name:newName.trim()||name,monthly_target:newTarget}).eq("user_id",userId);
  if(error)return alert(error.message);await loadAdmin();
};
window.deactivateRep=async(userId,name)=>{
  if(!confirm(`Desativar ${name}? O histórico será preservado.`))return;
  const {error}=await sb.from("profiles").update({active:false}).eq("user_id",userId);
  if(error)return alert(error.message);await loadAdmin();
};

$("#refreshBtn").addEventListener("click",loadAdmin);
$("#adminMonth").addEventListener("change",loadAdmin);
$("#exportBtn").addEventListener("click",()=>{
  const repsById=Object.fromEntries(adminCache.reps.map(r=>[r.user_id,r.name]));
  const rows=[["Data","Representante","Valor","Observação"],...adminCache.sales.sort((a,b)=>a.sale_date.localeCompare(b.sale_date)).map(s=>[s.sale_date,repsById[s.user_id]||s.user_id,s.amount,s.note||""])];
  const csv="\ufeff"+rows.map(r=>r.map(escapeCsv).join(";")).join("\n");
  const blob=new Blob([csv],{type:"text/csv;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download=`vendas-${adminCache.month}.csv`;a.click();URL.revokeObjectURL(url);
});

$("#inviteRole")?.addEventListener("change",()=>{
  const isRep=$("#inviteRole").value==="rep";
  $("#inviteTargetWrap")?.classList.toggle("hidden",!isRep);
  if(!isRep) $("#inviteTarget").value="0";
});

$("#inviteForm").addEventListener("submit",async e=>{
  e.preventDefault();setMsg($("#inviteMsg"),"");
  if(profile?.role!=="admin") return setMsg($("#inviteMsg"),"Apenas o administrador principal pode gerar acessos.");
  const role=$("#inviteRole")?.value||"rep";
  const row={
    representative_name:$("#inviteName").value.trim(),
    monthly_target:role==="rep"?Number($("#inviteTarget").value||0):0,
    invite_role:role
  };
  const {data,error}=await sb.from("representative_invites").insert(row).select().single();
  if(error)return setMsg($("#inviteMsg"),error.message);
  $("#generatedCode").textContent=data.code;
  $("#inviteResult").classList.remove("hidden");
  setMsg($("#inviteMsg"),role==="sub_admin"
    ?"Convite de subadministrador criado. Envie o código para o segundo gestor."
    :"Convite de representante criado. Envie o código ao representante.","ok");
  await loadAdmin();
});
$("#copyCodeBtn").addEventListener("click",async()=>{await navigator.clipboard.writeText($("#generatedCode").textContent);$("#copyCodeBtn").textContent="Copiado!";setTimeout(()=>$("#copyCodeBtn").textContent="Copiar código",1300);});

$("#resetPasswordForm")?.addEventListener("submit",async e=>{e.preventDefault();const p1=$("#newPassword").value,p2=$("#confirmNewPassword").value;if(p1!==p2)return setMsg($("#resetPasswordMsg"),"As senhas não coincidem.");const {error}=await sb.auth.updateUser({password:p1});if(error)return setMsg($("#resetPasswordMsg"),error.message);setMsg($("#resetPasswordMsg"),"Senha atualizada com sucesso.","ok");setTimeout(()=>boot(),800);});

sb.auth.onAuthStateChange(async(event,session)=>{if(event==="PASSWORD_RECOVERY"){user=session?.user||null;showOnly("#resetView");$("#logoutBtn").classList.remove("hidden");return;}if(session?.user){user=session.user;await loadProfile();await tryPendingInvite();}});
boot();


function renderAdminSalesHistory(){
  if(!adminCache.sales)return;
  const repId=$("#historyRep")?.value||"",start=$("#historyStart")?.value||"",end=$("#historyEnd")?.value||"";
  const reps=Object.fromEntries((adminCache.reps||[]).map(r=>[r.user_id,r.name]));
  const rows=[...(adminCache.sales||[])].filter(s=>(!repId||s.user_id===repId)&&(!start||s.sale_date>=start)&&(!end||s.sale_date<=end)).sort((a,b)=>b.sale_date.localeCompare(a.sale_date)).slice(0,120);
  $("#adminSalesHistory").innerHTML=rows.map(s=>`<tr><td>${s.sale_date.split("-").reverse().join("/")}</td><td>${reps[s.user_id]||"Representante"}</td><td>${money(s.amount)}</td><td>${s.note||"—"}</td><td><button class="btn btn-xs btn-light" onclick="editSale(${s.id},${Number(s.amount||0)},'${String(s.note||"").replaceAll("'","&#39;")}')">Corrigir</button></td></tr>`).join("")||`<tr><td colspan="5">Nenhum lançamento encontrado.</td></tr>`;
}
["historyRep","historyStart","historyEnd"].forEach(id=>$("#"+id)?.addEventListener("change",renderAdminSalesHistory));
$("#clearHistoryFilters")?.addEventListener("click",()=>{$("#historyRep").value="";$("#historyStart").value="";$("#historyEnd").value="";renderAdminSalesHistory();});

window.editSale=async(id,amount,note)=>{
  const value=prompt("Novo valor da venda:",String(amount));
  if(value===null) return;
  const newAmount=Number(String(value).replace(",","."));
  if(Number.isNaN(newAmount)||newAmount<0) return alert("Valor inválido.");
  const newNote=prompt("Observação:",note) ?? note;
  const {error}=await sb.from("daily_sales").update({amount:newAmount,note:newNote||null}).eq("id",id);
  if(error) return alert(error.message);
  await loadAdmin();
};

function filteredAdminRows(){const repId=$("#historyRep")?.value||"",start=$("#historyStart")?.value||"",end=$("#historyEnd")?.value||"";const reps=Object.fromEntries((adminCache.reps||[]).map(r=>[r.user_id,r.name]));return [...(adminCache.sales||[])].filter(s=>(!repId||s.user_id===repId)&&(!start||s.sale_date>=start)&&(!end||s.sale_date<=end)).sort((a,b)=>a.sale_date.localeCompare(b.sale_date)).map(s=>({Data:s.sale_date.split("-").reverse().join("/"),Representante:reps[s.user_id]||"",Valor:Number(s.amount||0),Observacao:s.note||""}));}
$("#exportXlsxBtn")?.addEventListener("click",()=>{const rows=filteredAdminRows(),ws=XLSX.utils.json_to_sheet(rows),wb=XLSX.utils.book_new();ws["!cols"]=[{wch:12},{wch:28},{wch:14},{wch:42}];XLSX.utils.book_append_sheet(wb,ws,"Vendas");XLSX.writeFile(wb,`acompanhamento-gerencial-${adminCache.month}.xlsx`);});
$("#printReportBtn")?.addEventListener("click",()=>{const rows=filteredAdminRows(),total=rows.reduce((s,r)=>s+Number(r.Valor||0),0),w=window.open("","_blank");w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Relatório</title><style>body{font-family:Arial;padding:28px}h1{color:#0b6b3a}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:8px}th{background:#eef7f1}</style></head><body><h1>Acompanhamento Gerencial</h1><p>Relatório ${adminCache.month}</p><table><thead><tr><th>Data</th><th>Representante</th><th>Valor</th><th>Observação</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${r.Data}</td><td>${r.Representante}</td><td>${money(r.Valor)}</td><td>${r.Observacao||"—"}</td></tr>`).join("")}</tbody></table><h3>Total: ${money(total)}</h3><p>Projeto pessoal — Especialista Escobar-PB</p><script>window.onload=()=>window.print()<\/script></body></html>`);w.document.close();});
