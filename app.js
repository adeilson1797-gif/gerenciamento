
const cfg = window.APP_CONFIG;
const sb = supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY);
const $ = s => document.querySelector(s);
const money = v => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v||0));
const localISODate=(d=new Date())=>new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10);
const today=()=>localISODate();
const monthNow=()=>today().slice(0,7);
const percent = v => `${(Number(v||0)*100).toFixed(1)}%`;
let user=null, profile=null, adminCache={reps:[],allProfiles:[],sales:[],month:"",itemGoals:[],itemReports:[],distributors:[],salesDistributors:[]}, repGoalCache=[], repDistributorCache=[], dailyChart=null;

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
    $("#userManagementCard")?.classList.remove("hidden");
    $("#adminResetCard")?.classList.toggle("hidden",!isMainAdmin);
    $("#userManagementHint").textContent=isMainAdmin
      ?"Administrador Geral: altere acesso, cargo/função, meta, status e nome dos usuários."
      :"Subadministrador: defina cargo/função e meta mensal dos cadastrados. Perfis de acesso e status ficam reservados ao Administrador Geral.";
    await loadAdmin();
  } else {
    showOnly("#repView");
    $("#repTitle").textContent=`${profile.job_title?profile.job_title+" — ":""}${profile.name}`;
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
  await loadRepItemGoals($("#saleDate").value||today());
  await loadRepDistributors($("#saleDate").value||today());
}


async function loadRepDistributors(dateStr){
  if(!user || profile?.role!=="rep") return;
  setMsg($("#repDistributorMsg"),"");
  const [{data:distributors,error:dErr},{data:rows,error:rErr}] = await Promise.all([
    sb.from("distributors").select("*").eq("active",true).order("name"),
    sb.from("daily_sales_distributors").select("*").eq("user_id",user.id).eq("sale_date",dateStr)
  ]);
  if(dErr||rErr){
    setMsg($("#repDistributorMsg"),(dErr||rErr).message);
    return;
  }
  repDistributorCache=distributors||[];
  const wrap=$("#repDistributorRows");
  wrap.innerHTML="";
  if((rows||[]).length){
    (rows||[]).forEach(r=>addDistributorEntryRow(r.distributor_id,Number(r.amount||0)));
  } else if(repDistributorCache.length){
    addDistributorEntryRow("", "");
  } else {
    wrap.innerHTML='<div class="muted">Nenhuma distribuidora ativa cadastrada. Solicite ao gestor.</div>';
  }
  updateDistributorTotal();
}

function distributorOptions(selected=""){
  return '<option value="">Selecione...</option>'+repDistributorCache.map(d=>`<option value="${d.id}" ${String(d.id)===String(selected)?"selected":""}>${d.name}</option>`).join("");
}

function addDistributorEntryRow(distributorId="",amount=""){
  if(!repDistributorCache.length) return;
  const row=document.createElement("div");
  row.className="distributor-entry-row";
  row.innerHTML=`
    <div><label>Distribuidora</label><select class="dist-select">${distributorOptions(distributorId)}</select></div>
    <div><label>Valor vendido (R$)</label><input class="dist-amount" type="number" min="0.01" step="0.01" value="${amount!==""?Number(amount).toFixed(2):""}" placeholder="0,00"></div>
    <button class="btn btn-light btn-xs remove-row" type="button">Remover</button>`;
  row.querySelector(".dist-amount").addEventListener("input",updateDistributorTotal);
  row.querySelector(".dist-select").addEventListener("change",updateDistributorTotal);
  row.querySelector(".remove-row").addEventListener("click",()=>{row.remove();updateDistributorTotal();});
  $("#repDistributorRows").appendChild(row);
}

function updateDistributorTotal(){
  const total=[...document.querySelectorAll("#repDistributorRows .dist-amount")]
    .reduce((s,i)=>s+Number(i.value||0),0);
  $("#saleAmount").value=total.toFixed(2);
}

function collectDistributorBreakdown(){
  const rows=[...document.querySelectorAll("#repDistributorRows .distributor-entry-row")];
  const data=[];
  const used=new Set();
  for(const row of rows){
    const distributor_id=Number(row.querySelector(".dist-select")?.value||0);
    const amount=Number(row.querySelector(".dist-amount")?.value||0);
    if(!distributor_id && !amount) continue;
    if(!distributor_id) return {ok:false,message:"Selecione a distribuidora em todas as linhas preenchidas."};
    if(amount<=0) return {ok:false,message:"Informe um valor maior que zero para cada distribuidora selecionada."};
    if(used.has(distributor_id)) return {ok:false,message:"A mesma distribuidora foi selecionada mais de uma vez. Use apenas uma linha por distribuidora."};
    used.add(distributor_id);
    data.push({distributor_id,amount:Number(amount.toFixed(2))});
  }
  return {ok:true,data};
}

$("#addDistributorRowBtn")?.addEventListener("click",()=>addDistributorEntryRow());

async function loadRepItemGoals(dateStr){
  if(!user || profile?.role!=="rep") return;
  setMsg($("#repItemGoalsMsg"),"");
  const [{data:goals,error:gErr},{data:reports,error:rErr}] = await Promise.all([
    sb.from("item_goals").select("*").eq("active",true).lte("start_date",dateStr).gte("end_date",dateStr).order("item_name"),
    sb.from("item_goal_reports").select("*").eq("user_id",user.id).eq("report_date",dateStr)
  ]);
  if(gErr||rErr){
    setMsg($("#repItemGoalsMsg"),(gErr||rErr).message);
    return;
  }
  const reportMap=Object.fromEntries((reports||[]).map(r=>[r.goal_id,r]));
  repGoalCache=(goals||[]).map(g=>({goal:g,report:reportMap[g.id]||null}));
  const wrap=$("#repItemGoals");
  if(!repGoalCache.length){
    wrap.innerHTML='<div class="muted">Nenhuma meta por item ativa para esta data.</div>';
    $("#repItemGoalStatus").textContent="Sem itens hoje";
    return;
  }
  wrap.innerHTML=repGoalCache.map(({goal,report})=>{
    const sold=report?.sold===true, no=report?.sold===false, qty=Number(report?.quantity||0);
    return `<div class="goal-report-item ${report?"goal-complete":""}" data-goal-id="${goal.id}">
      <h3>${goal.item_name}</h3>
      <div class="goal-meta">Meta do período: ${goal.target_quantity} un. • ${goal.start_date.split("-").reverse().join("/")} a ${goal.end_date.split("-").reverse().join("/")}</div>
      <div class="goal-choice">
        <label><input type="radio" name="goal_${goal.id}" value="yes" ${sold?"checked":""}> Vendi</label>
        <label><input type="radio" name="goal_${goal.id}" value="no" ${no?"checked":""}> Não vendi</label>
      </div>
      <div class="goal-qty ${sold?"":"hidden"}">
        <label>Quantidade vendida</label>
        <input type="number" min="1" step="1" class="goal-qty-input" value="${sold?qty:""}" placeholder="Quantidade">
      </div>
    </div>`;
  }).join("");
  repGoalCache.forEach(({goal})=>{
    document.querySelectorAll(`input[name="goal_${goal.id}"]`).forEach(r=>r.addEventListener("change",()=>{
      const box=document.querySelector(`[data-goal-id="${goal.id}"]`);
      box.querySelector(".goal-qty").classList.toggle("hidden",r.value!=="yes"||!r.checked);
    }));
  });
  const done=repGoalCache.filter(x=>x.report).length;
  $("#repItemGoalStatus").textContent=`${done}/${repGoalCache.length} informados`;
}

async function saveRequiredItemGoalReports(dateStr){
  if(!repGoalCache.length) return {ok:true};
  const rows=[];
  for(const {goal} of repGoalCache){
    const chosen=document.querySelector(`input[name="goal_${goal.id}"]:checked`);
    if(!chosen) return {ok:false,message:`Informe se vendeu ou não o item "${goal.item_name}".`};
    const sold=chosen.value==="yes";
    let qty=0;
    if(sold){
      const input=document.querySelector(`[data-goal-id="${goal.id}"] .goal-qty-input`);
      qty=Number(input?.value||0);
      if(!Number.isInteger(qty)||qty<=0) return {ok:false,message:`Informe uma quantidade válida para "${goal.item_name}".`};
    }
    rows.push({goal_id:goal.id,user_id:user.id,report_date:dateStr,sold,quantity:qty});
  }
  const {error}=await sb.from("item_goal_reports").upsert(rows,{onConflict:"goal_id,user_id,report_date"});
  if(error) return {ok:false,message:error.message};
  return {ok:true};
}

$("#saleDate")?.addEventListener("change",()=>{loadRepItemGoals($("#saleDate").value);loadRepDistributors($("#saleDate").value);});

$("#saleForm").addEventListener("submit",async e=>{
  e.preventDefault();
  setMsg($("#saleMsg"),"");setMsg($("#repItemGoalsMsg"),"");setMsg($("#repDistributorMsg"),"");
  const saleDate=$("#saleDate").value;

  const itemResult=await saveRequiredItemGoalReports(saleDate);
  if(!itemResult.ok){
    setMsg($("#repItemGoalsMsg"),itemResult.message);
    return;
  }

  const breakdown=collectDistributorBreakdown();
  if(!breakdown.ok){
    setMsg($("#repDistributorMsg"),breakdown.message);
    return;
  }

  const {data:total,error}=await sb.rpc("save_daily_sale_with_distributors",{
    p_sale_date:saleDate,
    p_note:$("#saleNote").value.trim()||null,
    p_breakdown:breakdown.data
  });
  if(error)return setMsg($("#saleMsg"),error.message);

  setMsg($("#saleMsg"),`Venda salva com sucesso. Total do dia: ${money(total)}.`,"ok");
  $("#saleNote").value="";
  await loadRep();
});

async function loadAdmin(){
  const mk=$("#adminMonth").value||monthNow(),{start,next}=monthBounds(mk);
  if($("#goalStartDate")&&!$("#goalStartDate").value) $("#goalStartDate").value=today();
  if($("#goalEndDate")&&!$("#goalEndDate").value) $("#goalEndDate").value=new Date(new Date().getFullYear(),new Date().getMonth()+1,0).toISOString().slice(0,10);
  const [
    {data:profiles,error:pErr},
    {data:sales,error:sErr},
    {data:invites,error:iErr},
    {data:itemGoals,error:gErr},
    {data:itemReports,error:grErr},
    {data:distributors,error:dErr},
    {data:salesDistributors,error:sdErr}
  ]=await Promise.all([
    sb.from("profiles").select("*").order("name"),
    sb.from("daily_sales").select("*").gte("sale_date",start).lt("sale_date",next),
    sb.from("representative_invites").select("*").order("created_at",{ascending:false}).limit(20),
    sb.from("item_goals").select("*").order("created_at",{ascending:false}),
    sb.from("item_goal_reports").select("*").gte("report_date",start).lt("report_date",next),
    sb.from("distributors").select("*").order("name"),
    sb.from("daily_sales_distributors").select("*").gte("sale_date",start).lt("sale_date",next)
  ]);
  if(pErr||sErr||iErr||gErr||grErr||dErr||sdErr){console.error(pErr||sErr||iErr||gErr||grErr||dErr||sdErr);return;}
  const allProfiles=profiles||[];
  const reps=allProfiles.filter(r=>r.role==="rep"&&r.active), map={};
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
      <td>${money(s.today)}</td>
      <td>${money(s.month)}</td>
      <td><div class="dist-summary">${distributorSummaryForRep(r.user_id)}</div></td>
      <td>${money(r.monthly_target)}</td>
      <td>${Number(r.monthly_target)>0?percent(s.month/Number(r.monthly_target)):"—"}</td><td>${Number(r.monthly_target)>0?money(need):"—"}</td>
      <td>${s.last?s.last.split("-").reverse().join("/"):"—"}</td>
      <td>${profile.role==="admin"
        ? `<button class="btn btn-xs btn-light" onclick="editRep('${r.user_id}','${String(r.name).replaceAll("'","&#39;")}',${Number(r.monthly_target||0)})">Editar</button>
           <button class="btn btn-xs btn-light danger" onclick="deactivateRep('${r.user_id}','${String(r.name).replaceAll("'","&#39;")}')">Desativar</button>`
        : `<span class="muted">Somente consulta</span>`}</td>
    </tr>`;
  }).join("")||`<tr><td colspan="11">Nenhum representante cadastrado.</td></tr>`;

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
  adminCache={reps,allProfiles,sales:sales||[],month:mk,itemGoals:itemGoals||[],itemReports:itemReports||[],distributors:distributors||[],salesDistributors:salesDistributors||[]};
  renderAdminSalesHistory();
  renderUserManagement();
  renderItemGoalsManager();
  renderDistributorManager();
  renderDistributorSales();
  renderRepDistributorBreakdown();
  renderDailyChart(sales||[],mk);
}


function roleLabel(role){
  return role==="admin"?"Administrador Geral":role==="sub_admin"?"Subadministrador":"Representante";
}

function renderUserManagement(){
  const card=$("#userManagementCard");
  if(!card) return;
  const canManage=["admin","sub_admin"].includes(profile?.role);
  card.classList.toggle("hidden",!canManage);
  if(!canManage) return;

  const isMainAdmin=profile.role==="admin";
  const rows=(adminCache.allProfiles||[]).filter(p=>p.user_id!==user.id && p.role!=="admin");

  $("#userManagementTable").innerHTML=rows.map(p=>`<tr>
    <td>
      ${isMainAdmin
        ? `<input class="inline-edit user-name" data-id="${p.user_id}" value="${String(p.name||"").replaceAll('"','&quot;')}">`
        : `<strong>${p.name}</strong>`}
    </td>
    <td>
      <input class="inline-edit user-title" data-id="${p.user_id}" value="${String(p.job_title||"").replaceAll('"','&quot;')}" placeholder="Ex.: Especialista, Supervisor">
    </td>
    <td>
      ${isMainAdmin
        ? `<select class="inline-edit role-select user-role" data-id="${p.user_id}">
            <option value="rep" ${p.role==="rep"?"selected":""}>Usuário / Especialista</option>
            <option value="sub_admin" ${p.role==="sub_admin"?"selected":""}>Subadministrador</option>
           </select>`
        : `<strong>${p.role==="sub_admin"?"Subadministrador":"Usuário / Especialista"}</strong><span class="restricted-note">Somente o Administrador Geral altera o perfil de acesso.</span>`}
    </td>
    <td>
      <input class="inline-edit user-target" data-id="${p.user_id}" type="number" min="0" step="0.01" value="${Number(p.monthly_target||0)}">
    </td>
    <td><span class="${p.active?"user-status-active":"user-status-inactive"}">${p.active?"Ativo":"Inativo"}</span></td>
    <td>
      <button class="btn btn-xs btn-primary" onclick="saveUserManagement('${p.user_id}',${p.active})">Salvar</button>
      ${isMainAdmin
        ? `<button class="btn btn-xs btn-light ${p.active?"danger":""}" onclick="toggleUserActive('${p.user_id}',${p.active})">${p.active?"Desativar":"Ativar"}</button>`
        : ""}
    </td>
  </tr>`).join("")||`<tr><td colspan="6">Nenhum outro usuário cadastrado.</td></tr>`;
}

window.saveUserManagement=async(userId)=>{
  if(!["admin","sub_admin"].includes(profile?.role)) return;

  const job_title=document.querySelector(`.user-title[data-id="${userId}"]`)?.value.trim()||null;
  const monthly_target=Number(document.querySelector(`.user-target[data-id="${userId}"]`)?.value||0);

  if(profile.role==="sub_admin"){
    const {error}=await sb.rpc("manager_update_profile_assignment",{
      p_user_id:userId,
      p_job_title:job_title,
      p_monthly_target:monthly_target
    });
    if(error)return setMsg($("#userManagementMsg"),error.message);
    setMsg($("#userManagementMsg"),"Função e meta mensal atualizadas.","ok");
    return await loadAdmin();
  }

  const name=document.querySelector(`.user-name[data-id="${userId}"]`)?.value.trim();
  const role=document.querySelector(`.user-role[data-id="${userId}"]`)?.value||"rep";
  const {error}=await sb.from("profiles").update({
    name,
    job_title,
    role,
    monthly_target
  }).eq("user_id",userId);
  if(error)return setMsg($("#userManagementMsg"),error.message);
  setMsg($("#userManagementMsg"),"Usuário atualizado com sucesso.","ok");
  await loadAdmin();
};

window.toggleUserActive=async(userId,isActive)=>{
  if(profile?.role!=="admin") return;
  const {error}=await sb.from("profiles").update({active:!isActive}).eq("user_id",userId);
  if(error)return setMsg($("#userManagementMsg"),error.message);
  setMsg($("#userManagementMsg"),!isActive?"Usuário ativado.":"Usuário desativado.","ok");
  await loadAdmin();
};


function renderDistributorManager(){
  const rows=adminCache.distributors||[];
  $("#distributorsTable").innerHTML=rows.map(d=>`<tr>
    <td><strong>${d.name}</strong></td>
    <td><span class="${d.active?"user-status-active":"user-status-inactive"}">${d.active?"Ativa":"Inativa"}</span></td>
    <td><button class="btn btn-xs btn-light ${d.active?"danger":""}" onclick="toggleDistributor(${d.id},${d.active})">${d.active?"Desativar":"Ativar"}</button></td>
  </tr>`).join("")||`<tr><td colspan="3">Nenhuma distribuidora cadastrada.</td></tr>`;
}


function distributorSummaryForRep(userId){
  const rows=(adminCache.salesDistributors||[]).filter(r=>r.user_id===userId);
  const distNames=Object.fromEntries((adminCache.distributors||[]).map(d=>[String(d.id),d.name]));
  const grouped={};
  rows.forEach(r=>{
    const key=String(r.distributor_id);
    grouped[key]=(grouped[key]||0)+Number(r.amount||0);
  });
  const parts=Object.entries(grouped)
    .sort((a,b)=>b[1]-a[1])
    .map(([id,total])=>`<div><strong>${distNames[id]||"Distribuidora"}:</strong> ${money(total)}</div>`);
  return parts.join("")||'<span class="muted-line">Sem divisão informada</span>';
}

function renderRepDistributorBreakdown(){
  const reps=adminCache.reps||[];
  const distributors=adminCache.distributors||[];
  const rows=adminCache.salesDistributors||[];
  const table=[];

  reps.forEach(rep=>{
    const repRows=rows.filter(r=>r.user_id===rep.user_id);
    const repTotal=repRows.reduce((s,r)=>s+Number(r.amount||0),0);

    distributors.forEach(d=>{
      const dRows=repRows.filter(r=>String(r.distributor_id)===String(d.id));
      const month=dRows.reduce((s,r)=>s+Number(r.amount||0),0);
      const todayTotal=dRows.filter(r=>r.sale_date===today()).reduce((s,r)=>s+Number(r.amount||0),0);
      if(month>0 || todayTotal>0){
        table.push({
          rep:rep.name,
          distributor:d.name,
          today:todayTotal,
          month,
          pct:repTotal>0?month/repTotal:0
        });
      }
    });
  });

  table.sort((a,b)=>a.rep.localeCompare(b.rep)||b.month-a.month);

  $("#repDistributorBreakdownTable").innerHTML=table.map(r=>`<tr>
    <td><strong>${r.rep}</strong></td>
    <td>${r.distributor}</td>
    <td>${money(r.today)}</td>
    <td>${money(r.month)}</td>
    <td>${percent(r.pct)}</td>
  </tr>`).join("")||`<tr><td colspan="5">Ainda não há vendas por distribuidora no período.</td></tr>`;
}

function renderDistributorSales(){
  const distributors=adminCache.distributors||[];
  const rows=adminCache.salesDistributors||[];
  const monthTotal=rows.reduce((s,r)=>s+Number(r.amount||0),0);
  $("#distributorSalesTable").innerHTML=distributors.map(d=>{
    const distRows=rows.filter(r=>r.distributor_id===d.id);
    const todayTotal=distRows.filter(r=>r.sale_date===today()).reduce((s,r)=>s+Number(r.amount||0),0);
    const total=distRows.reduce((s,r)=>s+Number(r.amount||0),0);
    const pct=monthTotal>0?total/monthTotal:0;
    return `<tr>
      <td><strong>${d.name}</strong></td>
      <td>${money(todayTotal)}</td>
      <td>${money(total)}</td>
      <td>${monthTotal>0?percent(pct):"—"}</td>
    </tr>`;
  }).join("")||`<tr><td colspan="4">Nenhuma distribuidora cadastrada.</td></tr>`;
}

$("#distributorForm")?.addEventListener("submit",async e=>{
  e.preventDefault();setMsg($("#distributorMsg"),"");
  if(!["admin","sub_admin"].includes(profile?.role)) return;
  const name=$("#distributorName").value.trim();
  if(!name)return setMsg($("#distributorMsg"),"Informe o nome da distribuidora.");
  const {error}=await sb.from("distributors").insert({name,created_by:user.id,active:true});
  if(error)return setMsg($("#distributorMsg"),error.message);
  $("#distributorName").value="";
  setMsg($("#distributorMsg"),"Distribuidora adicionada.","ok");
  await loadAdmin();
});

window.toggleDistributor=async(id,active)=>{
  if(!["admin","sub_admin"].includes(profile?.role)) return;
  const {error}=await sb.from("distributors").update({active:!active}).eq("id",id);
  if(error)return alert(error.message);
  await loadAdmin();
};

function renderItemGoalsManager(){
  const goals=adminCache.itemGoals||[],reports=adminCache.itemReports||[],activeReps=adminCache.reps||[];
  const todayStr=today();
  $("#itemGoalsTable").innerHTML=goals.map(g=>{
    const relevant=reports.filter(r=>r.goal_id===g.id);
    const soldQty=relevant.reduce((s,r)=>s+Number(r.quantity||0),0);
    const pct=Number(g.target_quantity)>0?soldQty/Number(g.target_quantity):0;
    const answeredToday=relevant.filter(r=>r.report_date===todayStr).length;
    const inPeriod=todayStr>=g.start_date&&todayStr<=g.end_date&&g.active;
    return `<tr>
      <td><strong>${g.item_name}</strong><br><span class="goal-status-pill ${inPeriod?"":"closed"}">${inPeriod?"Ativa":"Fora do período"}</span></td>
      <td>${g.start_date.split("-").reverse().join("/")}<br>${g.end_date.split("-").reverse().join("/")}</td>
      <td>${g.target_quantity}</td><td>${soldQty}</td>
      <td>${(pct*100).toFixed(1)}%<div class="progress-mini"><i style="width:${Math.min(pct*100,100)}%"></i></div></td>
      <td>${answeredToday}/${activeReps.length}</td>
      <td><button class="btn btn-xs btn-light" onclick="toggleItemGoal(${g.id},${g.active})">${g.active?"Encerrar":"Reativar"}</button></td>
    </tr>`;
  }).join("")||`<tr><td colspan="7">Nenhuma meta por item criada.</td></tr>`;
}

$("#itemGoalForm")?.addEventListener("submit",async e=>{
  e.preventDefault();setMsg($("#itemGoalMsg"),"");
  if(!["admin","sub_admin"].includes(profile?.role)) return;
  const row={
    item_name:$("#goalItemName").value.trim(),
    target_quantity:Number($("#goalTargetQty").value),
    start_date:$("#goalStartDate").value,
    end_date:$("#goalEndDate").value,
    created_by:user.id,
    active:true
  };
  if(!row.item_name||!Number.isInteger(row.target_quantity)||row.target_quantity<=0)return setMsg($("#itemGoalMsg"),"Informe item e quantidade válida.");
  if(row.end_date<row.start_date)return setMsg($("#itemGoalMsg"),"A data final não pode ser anterior à inicial.");
  const {error}=await sb.from("item_goals").insert(row);
  if(error)return setMsg($("#itemGoalMsg"),error.message);
  setMsg($("#itemGoalMsg"),"Meta por item criada com sucesso.","ok");
  $("#goalItemName").value="";$("#goalTargetQty").value="";
  await loadAdmin();
});
window.toggleItemGoal=async(id,active)=>{
  if(!["admin","sub_admin"].includes(profile?.role)) return;
  const {error}=await sb.from("item_goals").update({active:!active}).eq("id",id);
  if(error)return alert(error.message);
  await loadAdmin();
};

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

function filteredAdminRows(){
  const repId=$("#historyRep")?.value||"",start=$("#historyStart")?.value||"",end=$("#historyEnd")?.value||"";
  const reps=Object.fromEntries((adminCache.reps||[]).map(r=>[r.user_id,r.name]));
  const distNames=Object.fromEntries((adminCache.distributors||[]).map(d=>[String(d.id),d.name]));
  return [...(adminCache.sales||[])]
    .filter(s=>(!repId||s.user_id===repId)&&(!start||s.sale_date>=start)&&(!end||s.sale_date<=end))
    .sort((a,b)=>a.sale_date.localeCompare(b.sale_date))
    .map(s=>{
      const distText=(adminCache.salesDistributors||[])
        .filter(x=>x.user_id===s.user_id&&x.sale_date===s.sale_date)
        .map(x=>`${distNames[String(x.distributor_id)]||"Distribuidora"}: ${money(x.amount)}`)
        .join(" | ");
      return {
        Data:s.sale_date.split("-").reverse().join("/"),
        Representante:reps[s.user_id]||"",
        Distribuidoras:distText||"—",
        Valor:Number(s.amount||0),
        Observacao:s.note||""
      };
    });
}
$("#exportXlsxBtn")?.addEventListener("click",()=>{const rows=filteredAdminRows(),ws=XLSX.utils.json_to_sheet(rows),wb=XLSX.utils.book_new();ws["!cols"]=[{wch:12},{wch:28},{wch:48},{wch:14},{wch:42}];XLSX.utils.book_append_sheet(wb,ws,"Vendas");XLSX.writeFile(wb,`acompanhamento-gerencial-${adminCache.month}.xlsx`);});
$("#printReportBtn")?.addEventListener("click",()=>{
  const rows=filteredAdminRows(),total=rows.reduce((s,r)=>s+Number(r.Valor||0),0),w=window.open("","_blank");
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Relatório</title><style>body{font-family:Arial;padding:28px}h1{color:#0b6b3a}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:8px}th{background:#eef7f1}</style></head><body><h1>Acompanhamento Gerencial</h1><p>Relatório ${adminCache.month}</p><table><thead><tr><th>Data</th><th>Representante</th><th>Distribuidoras</th><th>Valor</th><th>Observação</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${r.Data}</td><td>${r.Representante}</td><td>${r.Distribuidoras||"—"}</td><td>${money(r.Valor)}</td><td>${r.Observacao||"—"}</td></tr>`).join("")}</tbody></table><h3>Total: ${money(total)}</h3><p>Projeto pessoal — Especialista Escobar-PB</p><script>window.onload=()=>window.print()<\/script></body></html>`);
  w.document.close();
});


$("#resetPanelBtn")?.addEventListener("click",async()=>{
  if(profile?.role!=="admin") return;
  const first=confirm("ATENÇÃO: isso apagará vendas, metas por item, respostas dos itens, convites e zerará metas mensais. Usuários, acessos e cargos serão preservados. Deseja continuar?");
  if(!first) return;
  const code=prompt('Para confirmar, digite exatamente: RESETAR');
  if(code!=="RESETAR"){
    return setMsg($("#resetPanelMsg"),"Reset cancelado. A confirmação não corresponde.");
  }

  setMsg($("#resetPanelMsg"),"Resetando painel...");
  const operations=[
    ()=>sb.from("item_goal_reports").delete().not("id","is",null),
    ()=>sb.from("daily_sales_distributors").delete().not("id","is",null),
    ()=>sb.from("daily_sales").delete().not("id","is",null),
    ()=>sb.from("item_goals").delete().not("id","is",null),
    ()=>sb.from("representative_invites").delete().not("id","is",null),
    ()=>sb.from("profiles").update({monthly_target:0}).neq("role","admin")
  ];

  for(const op of operations){
    const {error}=await op();
    if(error){
      setMsg($("#resetPanelMsg"),`Erro no reset: ${error.message}`);
      return;
    }
  }

  setMsg($("#resetPanelMsg"),"Painel operacional resetado com sucesso. Usuários, acessos e cargos foram preservados.","ok");
  await loadAdmin();
});
