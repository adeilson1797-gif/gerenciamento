
const cfg = window.APP_CONFIG;
const sb = supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY);
const $ = s => document.querySelector(s);
const money = v => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v||0));
const localISODate=(d=new Date())=>new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10);
const today=()=>localISODate();
const monthNow=()=>today().slice(0,7);
const percent = v => `${(Number(v||0)*100).toFixed(1)}%`;
function normalizeCNPJ(value){return String(value||"").replace(/\D/g,"").slice(0,14);}
function formatCNPJ(value){
  const d=normalizeCNPJ(value);
  if(d.length!==14)return d;
  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12,14)}`;
}
function normalizeLegalName(value){
  return String(value||"")
    .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .replace(/[^\p{L}\p{N}]+/gu," ")
    .trim().replace(/\s+/g," ").toUpperCase();
}


let user=null, profile=null, adminCache={reps:[],allProfiles:[],sales:[],month:"",itemGoals:[],itemReports:[],distributors:[],salesDistributors:[]}, repGoalCache=[], repDistributorCache=[], repCustomersCache=[], repOrdersCache=[], repOrderDistributorMap={}, clientBaseCache=[], dailyChart=null, divisionalStateChart=null, divisionalManagerChart=null, divisionalItemGoalChart=null;

function showOnly(id){
  ["#authView","#resetView","#forcePasswordView","#repView","#adminView"].forEach(x=>{
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

function formatBRLInput(value){
  const n=Number(value||0);
  if(!Number.isFinite(n)) return "R$ 0,00";
  return n.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
}

function moneyInputFromDigits(value){
  const digits=String(value||"").replace(/\D/g,"");
  const cents=Number(digits||0);
  return formatBRLInput(cents/100);
}

function parseCurrencyInput(value){
  const digits=String(value||"").replace(/\D/g,"");
  return Number(digits||0)/100;
}

function parseLooseBRL(value){
  let s=String(value??"").trim();
  if(!s) return 0;
  s=s.replace(/\s/g,"").replace(/^R\$/i,"");
  if(/^\d+(?:[.,]\d{1,2})?$/.test(s) && !s.includes(".") && !s.includes(",")){
    return Number(s);
  }
  if(s.includes(",")){
    s=s.replace(/\./g,"").replace(",",".");
  }else if((s.match(/\./g)||[]).length>1){
    s=s.replace(/\./g,"");
  }
  const n=Number(s.replace(/[^\d.-]/g,""));
  return Number.isFinite(n)?n:0;
}

function bindMoneyInput(el){
  if(!el || el.dataset.moneyBound==="1") return;
  el.dataset.moneyBound="1";
  el.addEventListener("input",()=>{
    el.value=moneyInputFromDigits(el.value);
    try{
      const len=el.value.length;
      el.setSelectionRange(len,len);
    }catch(_e){}
  });
  el.addEventListener("focus",()=>{
    if(!el.value) el.value="R$ 0,00";
  });
  el.addEventListener("blur",()=>{
    if(el.value) el.value=formatBRLInput(parseCurrencyInput(el.value));
  });
}

function bindMoneyInputs(root=document){
  root.querySelectorAll(".money-input").forEach(bindMoneyInput);
}

bindMoneyInputs();



function tableRowsForExport(table){
  const headers=[...table.querySelectorAll("thead th")].map(th=>th.textContent.trim()).filter(Boolean);
  const rows=[...table.querySelectorAll("tbody tr")].map(tr=>{
    const cells=[...tr.querySelectorAll("td")];
    return cells.map(td=>{
      const input=td.querySelector("input,select");
      return input ? (input.value||"") : td.textContent.replace(/\s+/g," ").trim();
    });
  }).filter(r=>r.length);
  return {headers,rows};
}

function exportTableCsv(table,title){
  const {headers,rows}=tableRowsForExport(table);
  if(!rows.length)return alert("Não há informações para exportar.");
  const esc=v=>`"${String(v??"").replaceAll('"','""')}"`;
  const csv="\ufeff"+[headers,...rows].map(r=>r.map(esc).join(";")).join("\r\n");
  const blob=new Blob([csv],{type:"text/csv;charset=utf-8;"});
  const url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;
  a.download=`${String(title||"relatorio").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")}.csv`;
  document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
}

function exportTablePdf(table,title){
  const {headers,rows}=tableRowsForExport(table);
  if(!rows.length)return alert("Não há informações para exportar.");
  const w=window.open("","_blank");
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
  <style>body{font-family:Arial;padding:24px;color:#222}h1{color:#0b6b3a;font-size:22px}table{width:100%;border-collapse:collapse;font-size:10px}th,td{border:1px solid #ddd;padding:6px;text-align:left}th{background:#eef7f1}</style>
  </head><body><h1>${title}</h1><table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join("")}</tr></thead>
  <tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table>
  <script>window.onload=()=>window.print()<\/script></body></html>`);
  w.document.close();
}

function ensureTableExportButtons(scopeSelector){
  document.querySelectorAll(`${scopeSelector} .card`).forEach((card,idx)=>{
    const table=card.querySelector("table");
    if(!table || card.querySelector(".auto-export-actions")) return;

    const existingTexts=[...card.querySelectorAll("button")].map(b=>b.textContent.trim().toLowerCase());
    const hasCsv=existingTexts.some(t=>t.includes("exportar csv"));
    const hasPdf=existingTexts.some(t=>t.includes("pdf"));
    if(hasCsv && hasPdf) return;

    const title=(card.querySelector("h2,h3")?.textContent||`Relatório ${idx+1}`).trim();
    const actions=document.createElement("div");
    actions.className="action-row auto-export-actions";
    if(!hasCsv){
      const csv=document.createElement("button");
      csv.type="button";csv.className="btn btn-light btn-xs";csv.textContent="Exportar CSV";
      csv.addEventListener("click",()=>exportTableCsv(table,title));
      actions.appendChild(csv);
    }
    if(!hasPdf){
      const pdf=document.createElement("button");
      pdf.type="button";pdf.className="btn btn-light btn-xs";pdf.textContent="Exportar PDF";
      pdf.addEventListener("click",()=>exportTablePdf(table,title));
      actions.appendChild(pdf);
    }

    const head=card.querySelector(".section-head");
    if(head) head.appendChild(actions);
    else card.insertBefore(actions,table.parentElement||table);
  });
}

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
  if(profile.must_change_password){
    showOnly("#forcePasswordView");
    return;
  }
  if(["admin","sub_admin","regional_manager","divisional_manager"].includes(profile.role)){
    showOnly("#adminView");
    $("#adminMonth").value=$("#adminMonth").value||monthNow();
    const isMainAdmin=profile.role==="admin";
    const isSubAdmin=profile.role==="sub_admin";
    const isRegional=profile.role==="regional_manager";
    const isDivisional=profile.role==="divisional_manager";

    $("#managerRoleBadge").textContent=isMainAdmin
      ?"Administrador principal"
      :isSubAdmin
        ?"Subadministrador"
        :isRegional
          ?`Gerente Regional — ${(profile.managed_states||[]).join(", ")||"sem região definida"}`
          :"Gerente Divisional — visão geral";
    $("#managerRoleBadge").classList.toggle("sub",!isMainAdmin);
    $("#managerRoleBadge").classList.toggle("regional-badge",isRegional);

    $("#adminInviteCard")?.classList.toggle("hidden",isDivisional);
    if($("#inviteRole")){
      $("#inviteRole").innerHTML=isMainAdmin
        ? '<option value="rep">Representante</option><option value="sub_admin">Subadministrador</option><option value="regional_manager">Gerente Regional</option><option value="divisional_manager">Gerente Divisional</option>'
        : '<option value="rep">Representante</option>';
      if(isRegional && $("#inviteState") && (profile.managed_states||[]).length===1){
        $("#inviteState").value=profile.managed_states[0];
      }
      updateInviteRoleFields();
    }

    $("#userManagementCard")?.classList.toggle("hidden",isDivisional);
    $("#adminResetCard")?.classList.toggle("hidden",!isMainAdmin);
    $("#itemGoalCreateCard")?.classList.toggle("hidden",isDivisional);
    $("#distributorManagerCard")?.classList.toggle("hidden",isDivisional);
    $("#divisionalSummaryCard")?.classList.toggle("hidden",!isDivisional);
    $("#divisionalOnlyDashboard")?.classList.toggle("hidden",!isDivisional);

    // O painel Divisional é somente consulta e possui uma composição própria.
    [
      "#adminSalesHistoryCard",
      "#itemGoalsTrackingCard",
      "#managerCnpjRankingCard",
      "#inviteSectionGrid",
      "#legacyEvolutionRankingGrid",
      "#repDistributorBreakdownCard"
    ].forEach(sel=>$(sel)?.classList.toggle("hidden",isDivisional));

    // Não mostrar telas de edição/cadastro no Divisional.
    $("#itemGoalCreateCard")?.classList.toggle("hidden",isDivisional);
    $("#distributorManagerCard")?.classList.toggle("hidden",isDivisional);
    $("#userManagementCard")?.classList.toggle("hidden",isDivisional);

    // Manter o resumo simples por distribuidora no Divisional.
    $("#distributorSalesCard")?.classList.toggle("hidden",false);

    if($("#teamResultsTitle")) $("#teamResultsTitle").textContent=isDivisional?"Resultado geral por Especialista":"Equipe";
    if($("#teamResultsSubtitle")) $("#teamResultsSubtitle").textContent=isDivisional
      ?"Resultado individual de cada especialista no mês selecionado."
      :"Quem lançou hoje e como está o mês.";
    const distSalesCard=$("#distributorSalesCard");
    if(distSalesCard && isDivisional){
      const h2=distSalesCard.querySelector("h2");
      const p=distSalesCard.querySelector(".muted");
      if(h2) h2.textContent="Total vendido por Distribuidora";
      if(p) p.textContent="Resumo simples do total vendido por cada distribuidora no período selecionado.";
    }

    if($("#userManagementHint")) $("#userManagementHint").textContent=isMainAdmin
      ?"Administrador Geral: altere acesso, cargo/função, estado/região, meta, status e senha dos usuários."
      :isRegional
        ?"Gerente Regional: permissões operacionais de Sub ADM apenas para os especialistas da sua região."
        :"Subadministrador: defina cargo/função e meta mensal dos cadastrados. Perfis de acesso, região, status e senha ficam reservados ao Administrador Geral.";
    await loadAdmin();
  } else {
    showOnly("#repView");
    setRepTab("sales");
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
$("#forcePasswordForm")?.addEventListener("submit",async e=>{
  e.preventDefault();setMsg($("#forcePasswordMsg"),"");
  const p1=$("#forceNewPassword").value,p2=$("#forceConfirmPassword").value;
  if(p1!==p2)return setMsg($("#forcePasswordMsg"),"As senhas não coincidem.");
  if(p1.length<8)return setMsg($("#forcePasswordMsg"),"Use pelo menos 8 caracteres.");
  if(p1==="redefinirsenha")return setMsg($("#forcePasswordMsg"),"Escolha uma senha diferente da senha temporária.");
  const {error}=await sb.auth.updateUser({password:p1});
  if(error)return setMsg($("#forcePasswordMsg"),error.message);
  const {error:rpcError}=await sb.rpc("complete_password_change");
  if(rpcError)return setMsg($("#forcePasswordMsg"),rpcError.message);
  setMsg($("#forcePasswordMsg"),"Senha alterada com sucesso. Liberando seu acesso...","ok");
  await loadProfile();setTimeout(()=>boot(),600);
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


function setRepTab(tab){
  const sales=tab==="sales";
  $("#repSalesTab")?.classList.toggle("hidden",!sales);
  $("#repClientBaseTab")?.classList.toggle("hidden",sales);
  $("#repNavSales")?.classList.toggle("active",sales);
  $("#repNavClients")?.classList.toggle("active",!sales);
  if(!sales) loadClientBase();
}

$("#repNavSales")?.addEventListener("click",()=>setRepTab("sales"));
$("#repNavClients")?.addEventListener("click",()=>setRepTab("clients"));

function resetClientBaseForm(){
  $("#clientBaseEditId").value="";
  $("#clientBaseCnpj").value="";
  $("#clientBaseLegalName").value="";
  $("#clientBaseDefinition").value="independente";
  $("#clientBaseBuyer").value="";
  $("#clientBasePhone").value="";
  $("#clientBaseCity").value="";
  $("#clientBaseState").value="";
  $("#clientBaseNetworkName").value="";
  $("#clientBaseUnitType").value="matriz";
  $("#clientBaseParentMatrix").value="";
  $("#clientBaseCancelEdit").classList.add("hidden");
  updateClientBaseDefinitionUI();
  setMsg($("#clientBaseMsg"),"");
}

function updateClientBaseDefinitionUI(){
  const isNetwork=$("#clientBaseDefinition").value==="rede";
  $("#clientBaseNetworkWrap").classList.toggle("hidden",!isNetwork);
  $("#clientBaseNetworkDetails").classList.toggle("hidden",!isNetwork);

  if(!isNetwork){
    $("#clientBaseNetworkName").value="";
    $("#clientBaseUnitType").value="matriz";
    $("#clientBaseParentMatrix").value="";
    $("#clientBaseMatrixWrap").classList.add("hidden");
    return;
  }

  const isBranch=$("#clientBaseUnitType").value==="filial";
  $("#clientBaseMatrixWrap").classList.toggle("hidden",!isBranch);
  if(!isBranch) $("#clientBaseParentMatrix").value="";
}

$("#clientBaseDefinition")?.addEventListener("change",updateClientBaseDefinitionUI);
$("#clientBaseUnitType")?.addEventListener("change",updateClientBaseDefinitionUI);
$("#clientBaseCancelEdit")?.addEventListener("click",resetClientBaseForm);

async function loadClientBase(){
  if(!user || profile?.role!=="rep") return;
  setMsg($("#clientBaseMsg"),"");

  const [
    {data,error},
    {data:operationalCustomers,error:ocErr},
    {data:historicalOrders,error:hoErr}
  ]=await Promise.all([
    sb.from("client_base").select("*").eq("user_id",user.id).order("legal_name"),
    sb.from("customers").select("id,cnpj,legal_name").eq("user_id",user.id),
    sb.from("sales_orders").select("id,cnpj,legal_name,order_number,order_date").eq("user_id",user.id).order("order_date",{ascending:false}).limit(5000)
  ]);

  if(error||ocErr||hoErr){
    setMsg($("#clientBaseMsg"),(error||ocErr||hoErr).message);
    return;
  }

  clientBaseCache=data||[];

  const independent=clientBaseCache.filter(c=>c.definition==="independente").length;
  const matrices=clientBaseCache.filter(c=>c.definition==="rede"&&c.unit_type==="matriz").length;
  const branches=clientBaseCache.filter(c=>c.definition==="rede"&&c.unit_type==="filial").length;
  const valid=independent+matrices;
  const all=independent+matrices+branches;

  $("#clientBaseCountValid").textContent=valid;
  $("#clientBaseCountAll").textContent=all;
  $("#clientBaseCountMatrices").textContent=matrices;
  $("#clientBaseCountBranches").textContent=branches;

  const matrixRows=clientBaseCache.filter(c=>c.definition==="rede"&&c.unit_type==="matriz");
  $("#clientBaseParentMatrix").innerHTML='<option value="">Selecione a matriz...</option>'+matrixRows.map(c=>`<option value="${c.id}">${c.legal_name} — ${formatCNPJ(c.cnpj)}</option>`).join("");

  const byId=Object.fromEntries(clientBaseCache.map(c=>[String(c.id),c]));

  $("#clientBaseTable").innerHTML=clientBaseCache.map(c=>{
    let definitionLabel=c.definition==="independente"?"Independente":"Rede";
    let unitLabel="—", cls="independent";
    if(c.definition==="rede"&&c.unit_type==="matriz"){unitLabel="Matriz";cls="";}
    if(c.definition==="rede"&&c.unit_type==="filial"){unitLabel="Filial";cls="branch";}
    const matrixName=c.parent_matrix_id?(byId[String(c.parent_matrix_id)]?.legal_name||"Matriz"):"—";
    return `<tr>
      <td><span class="cnpj-chip">${formatCNPJ(c.cnpj)}</span></td>
      <td><strong>${c.legal_name}</strong></td>
      <td>${c.city||"—"}</td>
      <td>${c.state||"—"}</td>
      <td>${definitionLabel}</td>
      <td><span class="client-type-pill ${cls}">${unitLabel}</span></td>
      <td>${matrixName}</td>
      <td>${c.buyer_name||"—"}</td>
      <td>${c.phone||"—"}</td>
      <td>${c.network_name||"—"}</td>
      <td>
        <button class="btn btn-xs btn-light" onclick="editClientBase(${c.id})">Editar</button>
        <button class="btn btn-xs btn-light danger" onclick="deleteClientBase(${c.id},'${String(c.legal_name||"").replaceAll("'","&#39;")}')">Excluir</button>
      </td>
    </tr>`;
  }).join("")||`<tr><td colspan="11">Nenhum cliente cadastrado na base.</td></tr>`;

  renderClientBaseConflicts(operationalCustomers||[],historicalOrders||[]);
  ensureTableExportButtons("#repClientBaseTab");
}

function findBaseConflict(cnpj,legalName){
  const normalizedCnpj=normalizeCNPJ(cnpj);
  const normalizedName=normalizeLegalName(legalName);
  const byCnpj=clientBaseCache.find(c=>normalizeCNPJ(c.cnpj)===normalizedCnpj);
  const byName=clientBaseCache.find(c=>normalizeLegalName(c.legal_name)===normalizedName);

  if(byCnpj && normalizeLegalName(byCnpj.legal_name)!==normalizedName){
    return {type:"cnpj_name",base:byCnpj,message:`O CNPJ ${formatCNPJ(normalizedCnpj)} está cadastrado na Base como "${byCnpj.legal_name}".`};
  }
  if(byName && normalizeCNPJ(byName.cnpj)!==normalizedCnpj){
    return {type:"name_cnpj",base:byName,message:`A razão "${byName.legal_name}" está cadastrada com o CNPJ ${formatCNPJ(byName.cnpj)}.`};
  }
  return null;
}

function renderClientBaseConflicts(customers,orders){
  const raw=[];
  (customers||[]).forEach(c=>{
    const conflict=findBaseConflict(c.cnpj,c.legal_name);
    if(conflict) raw.push({origin:"Cadastro de pedidos",cnpj:c.cnpj,legal_name:c.legal_name,...conflict});
  });
  (orders||[]).forEach(o=>{
    const conflict=findBaseConflict(o.cnpj,o.legal_name);
    if(conflict) raw.push({origin:`Pedido ${o.order_number||"—"} • ${o.order_date||""}`,cnpj:o.cnpj,legal_name:o.legal_name,...conflict});
  });

  const seen=new Set();
  const conflicts=raw.filter(c=>{
    const key=[c.origin,normalizeCNPJ(c.cnpj),normalizeLegalName(c.legal_name),c.type,c.base?.id].join("|");
    if(seen.has(key))return false;
    seen.add(key);return true;
  });

  const card=$("#clientBaseConflictCard");
  if(!conflicts.length){
    card?.classList.add("hidden");
    $("#clientBaseConflictTable").innerHTML="";
    $("#clientBaseConflictCount").textContent="0 conflito(s)";
    return;
  }

  card?.classList.remove("hidden");
  $("#clientBaseConflictCount").textContent=`${conflicts.length} conflito(s)`;
  $("#clientBaseConflictTable").innerHTML=conflicts.map(c=>`<tr>
    <td>${c.origin}</td>
    <td><span class="cnpj-chip">${formatCNPJ(c.cnpj)}</span></td>
    <td>${c.legal_name||"—"}</td>
    <td><strong>${formatCNPJ(c.base.cnpj)} — ${c.base.legal_name}</strong></td>
    <td>Revise o cadastro/pedido e mantenha o CNPJ e a Razão exatamente como estão na Base Clientes.</td>
  </tr>`).join("");
}

window.editClientBase=(id)=>{
  const c=clientBaseCache.find(x=>Number(x.id)===Number(id));
  if(!c) return;

  $("#clientBaseEditId").value=c.id;
  $("#clientBaseCnpj").value=formatCNPJ(c.cnpj);
  $("#clientBaseLegalName").value=c.legal_name||"";
  $("#clientBaseDefinition").value=c.definition||"independente";
  $("#clientBaseBuyer").value=c.buyer_name||"";
  $("#clientBasePhone").value=c.phone||"";
  $("#clientBaseCity").value=c.city||"";
  $("#clientBaseState").value=c.state||"";
  $("#clientBaseNetworkName").value=c.network_name||"";
  $("#clientBaseUnitType").value=c.unit_type||"matriz";
  updateClientBaseDefinitionUI();
  $("#clientBaseParentMatrix").value=c.parent_matrix_id||"";
  $("#clientBaseCancelEdit").classList.remove("hidden");
  $("#clientBaseForm").scrollIntoView({behavior:"smooth",block:"start"});
};

window.deleteClientBase=async(id,name)=>{
  if(!confirm(`Excluir "${name}" da Base Clientes?`)) return;
  const {error}=await sb.from("client_base").delete().eq("id",id).eq("user_id",user.id);
  if(error){
    alert(error.message);
    return;
  }
  await loadClientBase();
};


function clientBaseExportRows(){
  const byId=Object.fromEntries((clientBaseCache||[]).map(c=>[String(c.id),c]));
  return [...(clientBaseCache||[])].sort((a,b)=>String(a.legal_name||"").localeCompare(String(b.legal_name||""))).map(c=>({
    CNPJ:formatCNPJ(c.cnpj),
    "Razão Social":c.legal_name||"",
    Cidade:c.city||"",
    Estado:c.state||"",
    Definição:c.definition==="rede"?"Rede":"Independente",
    Unidade:c.definition==="rede"?(c.unit_type==="filial"?"Filial":"Matriz"):"—",
    Matriz:c.parent_matrix_id?(byId[String(c.parent_matrix_id)]?.legal_name||"Matriz"):"—",
    Comprador:c.buyer_name||"",
    Telefone:c.phone||"",
    Rede:c.network_name||""
  }));
}

$("#clientBaseExportCsvBtn")?.addEventListener("click",()=>{
  const rows=clientBaseExportRows();
  if(!rows.length)return alert("Não há clientes cadastrados para exportar.");
  const headers=["CNPJ","Razão Social","Cidade","Estado","Definição","Unidade","Matriz","Comprador","Telefone","Rede"];
  const esc=v=>`"${String(v??"").replaceAll('"','""')}"`;
  const lines=[headers.map(esc).join(";"),...rows.map(r=>headers.map(h=>esc(r[h])).join(";"))];
  const blob=new Blob(["\ufeff"+lines.join("\r\n")],{type:"text/csv;charset=utf-8;"});
  const url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download="base-clientes.csv";
  document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
});

$("#clientBaseExportPdfBtn")?.addEventListener("click",()=>{
  const rows=clientBaseExportRows();
  if(!rows.length)return alert("Não há clientes cadastrados para exportar.");
  const w=window.open("","_blank");
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Base Clientes</title>
  <style>body{font-family:Arial;padding:24px;color:#222}h1{color:#0b6b3a}table{width:100%;border-collapse:collapse;font-size:10px}th,td{border:1px solid #ddd;padding:6px;text-align:left}th{background:#eef7f1}</style>
  </head><body><h1>Base Clientes — ${profile?.name||"Representante"}</h1><p>Total de cadastros: ${rows.length}</p>
  <table><thead><tr><th>CNPJ</th><th>Razão Social</th><th>Cidade</th><th>Estado</th><th>Definição</th><th>Unidade</th><th>Matriz</th><th>Comprador</th><th>Telefone</th><th>Rede</th></tr></thead>
  <tbody>${rows.map(r=>`<tr><td>${r.CNPJ}</td><td>${r["Razão Social"]}</td><td>${r.Cidade}</td><td>${r.Estado}</td><td>${r["Definição"]}</td><td>${r.Unidade}</td><td>${r.Matriz}</td><td>${r.Comprador}</td><td>${r.Telefone}</td><td>${r.Rede}</td></tr>`).join("")}</tbody></table>
  <script>window.onload=()=>window.print()<\/script></body></html>`);
  w.document.close();
});

$("#clientBaseCnpj")?.addEventListener("input",()=>{
  const d=normalizeCNPJ($("#clientBaseCnpj").value);
  $("#clientBaseCnpj").value=d.length===14?formatCNPJ(d):d;
});

$("#clientBaseForm")?.addEventListener("submit",async e=>{
  e.preventDefault();
  setMsg($("#clientBaseMsg"),"");

  const editId=Number($("#clientBaseEditId").value||0);
  const cnpj=normalizeCNPJ($("#clientBaseCnpj").value);
  const legal_name=$("#clientBaseLegalName").value.trim();
  const definition=$("#clientBaseDefinition").value;
  const buyer_name=$("#clientBaseBuyer").value.trim()||null;
  const phone=$("#clientBasePhone").value.trim()||null;
  const city=$("#clientBaseCity").value.trim();
  const state=$("#clientBaseState").value.trim().toUpperCase();

  if(cnpj.length!==14)return setMsg($("#clientBaseMsg"),"Informe um CNPJ válido com 14 dígitos.");
  if(!legal_name)return setMsg($("#clientBaseMsg"),"Informe a razão social.");
  if(!city)return setMsg($("#clientBaseMsg"),"Informe a cidade.");
  if(!state)return setMsg($("#clientBaseMsg"),"Informe o estado.");

  let unit_type=null, network_name=null, parent_matrix_id=null;

  if(definition==="rede"){
    network_name=$("#clientBaseNetworkName").value.trim();
    unit_type=$("#clientBaseUnitType").value;
    if(!network_name)return setMsg($("#clientBaseMsg"),"Informe o nome da rede.");

    if(unit_type==="filial"){
      parent_matrix_id=Number($("#clientBaseParentMatrix").value||0);
      if(!parent_matrix_id)return setMsg($("#clientBaseMsg"),"Selecione a matriz desta filial.");
      if(editId && parent_matrix_id===editId)return setMsg($("#clientBaseMsg"),"Uma unidade não pode ser matriz dela mesma.");
    }
  }

  const row={
    user_id:user.id,
    cnpj,
    legal_name,
    definition,
    unit_type,
    buyer_name,
    phone,
    city,
    state,
    network_name,
    parent_matrix_id,
    active:true
  };

  let result;
  if(editId){
    result=await sb.from("client_base").update(row).eq("id",editId).eq("user_id",user.id);
  }else{
    result=await sb.from("client_base").insert(row);
  }

  if(result.error)return setMsg($("#clientBaseMsg"),result.error.message);

  setMsg($("#clientBaseMsg"),editId?"Cliente atualizado com sucesso.":"Cliente cadastrado com sucesso.","ok");
  resetClientBaseForm();
  await loadClientBase();
});

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
  $("#repHistory").innerHTML=rows.slice(0,12).map(r=>`<tr><td>${r.sale_date.split("-").reverse().join("/")}</td><td>${money(r.amount)}</td><td>${r.note==="Total automático dos pedidos"?"Pedidos cadastrados":(r.note||"—")}</td></tr>`).join("")||`<tr><td colspan="3">Nenhum pedido lançado no mês.</td></tr>`;
  await loadRepItemGoals($("#saleDate").value||today());
  await loadRepDistributorSummary();
  await loadRepOrders();
  ensureTableExportButtons("#repView");
}



async function loadRepOrders(){
  if(!user || profile?.role!=="rep") return;
  if($("#orderDate")&&!$("#orderDate").value) $("#orderDate").value=today();

  const mk=monthNow(),{start,next}=monthBounds(mk);
  const [{data:customers,error:cErr},{data:orders,error:oErr},{data:distributors,error:dErr},{data:baseClients,error:bErr}] = await Promise.all([
    sb.from("customers").select("*").eq("user_id",user.id).order("legal_name"),
    sb.from("sales_orders").select("*").eq("user_id",user.id).gte("order_date",start).lt("order_date",next).order("order_date",{ascending:false}),
    sb.from("distributors").select("*").eq("active",true).order("name"),
    sb.from("client_base").select("*").eq("user_id",user.id).eq("active",true).order("legal_name")
  ]);
  if(cErr||oErr||dErr||bErr){
    setMsg($("#orderMsg"),(cErr||oErr||dErr||bErr).message);
    return;
  }

  repCustomersCache=customers||[];
  repOrdersCache=orders||[];
  clientBaseCache=baseClients||[];

  const orderClients=clientBaseCache.length?clientBaseCache:repCustomersCache;
  $("#customerCnpjList").innerHTML=orderClients.map(c=>`<option value="${formatCNPJ(c.cnpj)}">${c.legal_name}</option>`).join("");
  $("#customerNameList").innerHTML=orderClients.map(c=>`<option value="${c.legal_name}">${formatCNPJ(c.cnpj)}</option>`).join("");
  $("#orderDistributor").innerHTML='<option value="">Selecione...</option>'+(distributors||[]).map(d=>`<option value="${d.id}">${d.name}</option>`).join("");

  const distNames=Object.fromEntries((distributors||[]).map(d=>[String(d.id),d.name]));
  repOrderDistributorMap=distNames;
  $("#repOrdersTable").innerHTML=repOrdersCache.slice(0,30).map(o=>`<tr>
    <td>${o.order_date.split("-").reverse().join("/")}</td>
    <td><span class="cnpj-chip">${formatCNPJ(o.cnpj)}</span></td>
    <td>${o.legal_name}</td>
    <td>${o.city||"—"}</td>
    <td>${o.state||"—"}</td>
    <td>${distNames[String(o.distributor_id)]||"Distribuidora"}</td>
    <td>${o.order_number}</td>
    <td>${money(o.amount)}</td>
    <td><button class="btn btn-xs btn-light danger" type="button" onclick="deleteRepOrder(${o.id},'${String(o.order_number||"").replaceAll("'","&#39;")}',${Number(o.amount||0)})">Apagar</button></td>
  </tr>`).join("")||`<tr><td colspan="9">Nenhum pedido registrado neste mês.</td></tr>`;

  renderRepCnpjRanking();
  renderCurrentOrderConflicts();
}


window.deleteRepOrder=async(orderId,orderNumber,amount)=>{
  if(profile?.role!=="rep") return;
  const ok=confirm(`Apagar o pedido ${orderNumber||"selecionado"} no valor de ${money(amount)}?\n\nO valor será retirado automaticamente das vendas do dia, mês, cliente, distribuidora e demais estatísticas.`);
  if(!ok) return;

  setMsg($("#orderMsg"),"Apagando venda e recalculando os totais...","ok");
  const {error}=await sb.from("sales_orders")
    .delete()
    .eq("id",orderId)
    .eq("user_id",user.id);

  if(error){
    return setMsg($("#orderMsg"),`Não foi possível apagar: ${error.message}`);
  }

  setMsg($("#orderMsg"),"Venda apagada. Todos os totais e estatísticas foram recalculados automaticamente.","ok");
  await loadRep();
};

function renderRepCnpjRanking(){
  const grouped={};
  (repOrdersCache||[]).forEach(o=>{
    const key=o.cnpj;
    grouped[key]||={cnpj:key,legal_name:o.legal_name,total:0,count:0};
    grouped[key].total+=Number(o.amount||0);
    grouped[key].count+=1;
    if(o.legal_name) grouped[key].legal_name=o.legal_name;
  });
  const ranking=Object.values(grouped).sort((a,b)=>b.total-a.total);
  $("#repCnpjRankingTable").innerHTML=ranking.map((r,i)=>`<tr>
    <td>${i+1}º</td>
    <td><span class="cnpj-chip">${formatCNPJ(r.cnpj)}</span></td>
    <td>${r.legal_name}</td>
    <td>${r.count}</td>
    <td><strong>${money(r.total)}</strong></td>
  </tr>`).join("")||`<tr><td colspan="5">Sem pedidos para ranquear.</td></tr>`;
}


function renderCurrentOrderConflicts(){
  const conflicts=(repOrdersCache||[]).map(o=>({order:o,conflict:findBaseConflict(o.cnpj,o.legal_name)})).filter(x=>x.conflict);
  const box=$("#orderDataConflictBox");
  if(!conflicts.length){
    box?.classList.add("hidden");
    $("#orderDataConflictText").textContent="";
    return;
  }
  box?.classList.remove("hidden");
  const first=conflicts[0];
  $("#orderDataConflictText").textContent=`Existem ${conflicts.length} pedido(s) neste mês com divergência. Ex.: pedido ${first.order.order_number||"—"} — ${first.conflict.message} Corrija os dados para manter o histórico consistente.`;
}

$("#goClientBaseBtn")?.addEventListener("click",()=>setRepTab("clients"));

function findOrderBaseClientByCnpj(cnpj){
  return (clientBaseCache||[]).find(c=>normalizeCNPJ(c.cnpj)===normalizeCNPJ(cnpj));
}
function findOrderBaseClientByName(name){
  return (clientBaseCache||[]).find(c=>normalizeLegalName(c.legal_name)===normalizeLegalName(name));
}

function autofillCustomerByCnpj(){
  const cnpj=normalizeCNPJ($("#orderCnpj").value);
  const match=findOrderBaseClientByCnpj(cnpj)||repCustomersCache.find(c=>normalizeCNPJ(c.cnpj)===cnpj);
  if(match){
    $("#orderLegalName").value=match.legal_name;
    $("#orderCity").value=match.city||"";
    $("#orderState").value=match.state||"";
  }
}
function autofillCustomerByName(){
  const name=$("#orderLegalName").value.trim();
  const match=findOrderBaseClientByName(name)||repCustomersCache.find(c=>normalizeLegalName(c.legal_name)===normalizeLegalName(name));
  if(match){
    $("#orderCnpj").value=formatCNPJ(match.cnpj);
    $("#orderCity").value=match.city||"";
    $("#orderState").value=match.state||"";
  }
}

$("#orderCnpj")?.addEventListener("input",()=>{
  const digits=normalizeCNPJ($("#orderCnpj").value);
  $("#orderCnpj").value=digits.length===14?formatCNPJ(digits):digits;
  autofillCustomerByCnpj();
});
$("#orderCnpj")?.addEventListener("change",autofillCustomerByCnpj);
$("#orderLegalName")?.addEventListener("change",autofillCustomerByName);

$("#orderForm")?.addEventListener("submit",async e=>{
  e.preventDefault();setMsg($("#orderMsg"),"");
  if(profile?.role!=="rep") return;

  const cnpj=normalizeCNPJ($("#orderCnpj").value);
  const legal_name=$("#orderLegalName").value.trim();
  const city=$("#orderCity").value.trim();
  const state=$("#orderState").value.trim().toUpperCase();
  const amount=parseCurrencyInput($("#orderAmount").value);
  const order_number=$("#orderNumber").value.trim();
  const distributor_id=Number($("#orderDistributor").value||0);
  const order_date=$("#orderDate").value;

  if(cnpj.length!==14)return setMsg($("#orderMsg"),"Informe um CNPJ válido com 14 dígitos.");
  if(!legal_name)return setMsg($("#orderMsg"),"Informe a razão social.");
  if(!city)return setMsg($("#orderMsg"),"Informe a cidade do cliente.");
  if(!state)return setMsg($("#orderMsg"),"Informe o estado do cliente.");
  if(!distributor_id)return setMsg($("#orderMsg"),"Selecione a distribuidora.");
  if(amount<=0)return setMsg($("#orderMsg"),"Informe um valor de pedido maior que zero.");
  if(!order_number)return setMsg($("#orderMsg"),"Informe o número do pedido.");

  const baseByCnpj=findOrderBaseClientByCnpj(cnpj);
  const baseByName=findOrderBaseClientByName(legal_name);

  if(baseByCnpj && normalizeLegalName(baseByCnpj.legal_name)!==normalizeLegalName(legal_name)){
    $("#orderDataConflictBox").classList.remove("hidden");
    $("#orderDataConflictText").textContent=`Este CNPJ pertence a "${baseByCnpj.legal_name}" na Base Clientes. Corrija a Razão Social antes de salvar o pedido.`;
    return setMsg($("#orderMsg"),`Conflito: o CNPJ ${formatCNPJ(cnpj)} está cadastrado como "${baseByCnpj.legal_name}".`);
  }
  if(baseByName && normalizeCNPJ(baseByName.cnpj)!==cnpj){
    $("#orderDataConflictBox").classList.remove("hidden");
    $("#orderDataConflictText").textContent=`A Razão Social "${baseByName.legal_name}" pertence ao CNPJ ${formatCNPJ(baseByName.cnpj)} na Base Clientes. Corrija o CNPJ antes de salvar.`;
    return setMsg($("#orderMsg"),`Conflito: a Razão Social informada está vinculada a outro CNPJ na Base Clientes.`);
  }

  const canonical=baseByCnpj||baseByName;
  const safeLegalName=canonical?.legal_name||legal_name;
  const safeCity=canonical?.city||city;
  const safeState=(canonical?.state||state).toUpperCase();

  const {data:customer,error:cErr}=await sb.from("customers")
    .upsert({user_id:user.id,cnpj,legal_name:safeLegalName,city:safeCity,state:safeState},{onConflict:"user_id,cnpj"})
    .select().single();
  if(cErr)return setMsg($("#orderMsg"),cErr.message);

  const {error:oErr}=await sb.from("sales_orders").insert({
    user_id:user.id,
    customer_id:customer.id,
    distributor_id,
    order_date,
    cnpj,
    legal_name:safeLegalName,
    city:safeCity,
    state:safeState,
    order_number,
    amount
  });
  if(oErr)return setMsg($("#orderMsg"),oErr.message);

  setMsg($("#orderMsg"),"Pedido salvo. Cliente armazenado para autopreenchimento.","ok");
  $("#orderAmount").value="";
  $("#orderNumber").value="";
  await loadRep();
});



function repOrderExportRows(){
  return [...(repOrdersCache||[])].sort((a,b)=>a.order_date.localeCompare(b.order_date)).map(o=>({
    Data:o.order_date.split("-").reverse().join("/"),
    CNPJ:formatCNPJ(o.cnpj),
    "Razão Social":o.legal_name,
    Cidade:o.city||"",
    Estado:o.state||"",
    Distribuidora:repOrderDistributorMap[String(o.distributor_id)]||"Distribuidora",
    "Número do Pedido":o.order_number,
    Valor:Number(o.amount||0)
  }));
}

function escapeCsvCell(value){
  const s=String(value??"");
  return `"${s.replaceAll('"','""')}"`;
}

$("#repExportCsvBtn")?.addEventListener("click",()=>{
  const rows=repOrderExportRows();
  if(!rows.length)return alert("Não há pedidos no mês para exportar.");
  const headers=["Data","CNPJ","Razão Social","Cidade","Estado","Distribuidora","Número do Pedido","Valor"];
  const lines=[
    headers.map(escapeCsvCell).join(";"),
    ...rows.map(r=>[
      r.Data,r.CNPJ,r["Razão Social"],r.Cidade,r.Estado,r.Distribuidora,r["Número do Pedido"],
      Number(r.Valor||0).toFixed(2).replace(".",",")
    ].map(escapeCsvCell).join(";"))
  ];
  const total=rows.reduce((s,r)=>s+Number(r.Valor||0),0);
  lines.push("");
  lines.push(`${escapeCsvCell("TOTAL")};${escapeCsvCell("")};${escapeCsvCell("")};${escapeCsvCell("")};${escapeCsvCell("")};${escapeCsvCell("")};${escapeCsvCell("")};${escapeCsvCell(total.toFixed(2).replace(".",","))}`);
  const blob=new Blob(["\ufeff"+lines.join("\r\n")],{type:"text/csv;charset=utf-8;"});
  const url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;
  a.download=`minhas-vendas-${monthNow()}.csv`;
  document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
});

$("#repExportPdfBtn")?.addEventListener("click",()=>{
  const rows=repOrderExportRows();
  if(!rows.length)return alert("Não há pedidos no mês para exportar.");
  const total=rows.reduce((s,r)=>s+Number(r.Valor||0),0);
  const w=window.open("","_blank");
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Minhas vendas</title>
  <style>body{font-family:Arial;padding:28px;color:#222}h1{color:#0b6b3a}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #ddd;padding:7px;text-align:left}th{background:#eef7f1}.total{margin-top:16px;font-size:18px;font-weight:bold}</style>
  </head><body><h1>Minhas vendas — ${profile?.name||"Representante"}</h1><p>Período: ${monthNow()}</p>
  <table><thead><tr><th>Data</th><th>CNPJ</th><th>Razão Social</th><th>Cidade</th><th>Estado</th><th>Distribuidora</th><th>Pedido</th><th>Valor</th></tr></thead>
  <tbody>${rows.map(r=>`<tr><td>${r.Data}</td><td>${r.CNPJ}</td><td>${r["Razão Social"]}</td><td>${r.Cidade||"—"}</td><td>${r.Estado||"—"}</td><td>${r.Distribuidora}</td><td>${r["Número do Pedido"]}</td><td>${money(r.Valor)}</td></tr>`).join("")}</tbody></table>
  <div class="total">Total: ${money(total)}</div><script>window.onload=()=>window.print()<\/script></body></html>`);
  w.document.close();
});

async function loadRepDistributorSummary(){
  if(!user || profile?.role!=="rep") return;
  const mk=monthNow(),{start,next}=monthBounds(mk);
  const [{data:rows,error:rErr},{data:distributors,error:dErr}] = await Promise.all([
    sb.from("daily_sales_distributors").select("*").eq("user_id",user.id).gte("sale_date",start).lt("sale_date",next),
    sb.from("distributors").select("*").order("name")
  ]);
  if(rErr||dErr){
    console.error(rErr||dErr);
    return;
  }
  const all=rows||[], monthTotal=all.reduce((s,r)=>s+Number(r.amount||0),0);
  const grouped={};
  (distributors||[]).forEach(d=>grouped[d.id]={name:d.name,today:0,month:0});
  all.forEach(r=>{
    grouped[r.distributor_id]||={name:"Distribuidora",today:0,month:0};
    grouped[r.distributor_id].month+=Number(r.amount||0);
    if(r.sale_date===today()) grouped[r.distributor_id].today+=Number(r.amount||0);
  });
  const list=Object.values(grouped).filter(x=>x.month>0||x.today>0).sort((a,b)=>b.month-a.month);
  $("#repDistributorSummaryTable").innerHTML=list.map(x=>`<tr>
    <td><strong>${x.name}</strong></td>
    <td>${money(x.today)}</td>
    <td>${money(x.month)}</td>
    <td>${monthTotal>0?percent(x.month/monthTotal):"—"}</td>
  </tr>`).join("")||`<tr><td colspan="4">Nenhuma venda por distribuidora neste mês.</td></tr>`;
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
    <div><label>Valor vendido (R$)</label><input class="dist-amount money-input" type="text" inputmode="numeric" value="${amount!==""?formatBRLInput(Number(amount)):""}" placeholder="R$ 0,00" autocomplete="off"></div>
    <button class="btn btn-light btn-xs remove-row" type="button">Remover</button>`;
  row.querySelector(".dist-amount").addEventListener("input",updateDistributorTotal);
  row.querySelector(".dist-select").addEventListener("change",updateDistributorTotal);
  row.querySelector(".remove-row").addEventListener("click",()=>{row.remove();updateDistributorTotal();});
  $("#repDistributorRows").appendChild(row);
}

function updateDistributorTotal(){
  const total=[...document.querySelectorAll("#repDistributorRows .dist-amount")]
    .reduce((s,i)=>s+parseCurrencyInput(i.value),0);
  $("#saleAmount").value=total.toFixed(2);
}

function collectDistributorBreakdown(){
  const rows=[...document.querySelectorAll("#repDistributorRows .distributor-entry-row")];
  const data=[];
  const used=new Set();
  for(const row of rows){
    const distributor_id=Number(row.querySelector(".dist-select")?.value||0);
    const amount=parseCurrencyInput(row.querySelector(".dist-amount")?.value);
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

  const {data:goals,error:gErr}=await sb.from("item_goals")
    .select("*")
    .eq("active",true)
    .lte("start_date",dateStr)
    .gte("end_date",dateStr)
    .order("item_name");

  if(gErr){
    setMsg($("#repItemGoalsMsg"),gErr.message);
    return;
  }

  const myGoals=(goals||[]).filter(g=>!g.assigned_user_id||g.assigned_user_id===user.id);
  let reports=[];
  if(myGoals.length){
    const ids=myGoals.map(g=>g.id);
    const minStart=myGoals.reduce((m,g)=>!m||g.start_date<m?g.start_date:m,null);
    const maxEnd=myGoals.reduce((m,g)=>!m||g.end_date>m?g.end_date:m,null);
    const {data:rData,error:rErr}=await sb.from("item_goal_reports")
      .select("*")
      .eq("user_id",user.id)
      .in("goal_id",ids)
      .gte("report_date",minStart)
      .lte("report_date",maxEnd);
    if(rErr){
      setMsg($("#repItemGoalsMsg"),rErr.message);
      return;
    }
    reports=rData||[];
  }

  const todayMap=Object.fromEntries(reports.filter(r=>r.report_date===dateStr).map(r=>[r.goal_id,r]));
  repGoalCache=myGoals.map(g=>({
    goal:g,
    report:todayMap[g.id]||null,
    periodSold:reports.filter(r=>r.goal_id===g.id).reduce((s,r)=>s+Number(r.quantity||0),0)
  }));

  const wrap=$("#repItemGoals");
  if(!repGoalCache.length){
    wrap.innerHTML='<div class="muted">Nenhuma meta individual por item ativa para esta data.</div>';
    $("#repItemGoalCountTable").innerHTML='<tr><td colspan="5">Nenhuma meta ativa.</td></tr>';
    $("#repItemGoalStatus").textContent="Sem metas hoje";
    return;
  }

  wrap.innerHTML=repGoalCache.map(({goal,report,periodSold})=>{
    const sold=report?.sold===true, no=report?.sold===false, qty=Number(report?.quantity||0);
    const target=Number(goal.target_quantity||0);
    const pct=target>0?periodSold/target:0;
    return `<div class="goal-report-item ${report?"goal-complete":""}" data-goal-id="${goal.id}">
      <h3>${goal.item_name}</h3>
      <div class="goal-meta"><strong>Minha meta: ${target} un.</strong> • ${goal.start_date.split("-").reverse().join("/")} a ${goal.end_date.split("-").reverse().join("/")}</div>
      <div class="goal-progress-text"><span>Realizado: <strong>${periodSold} un.</strong></span><span>${target>0?percent(pct):"—"}</span></div>
      <div class="progress-mini"><i style="width:${Math.min(pct*100,100)}%"></i></div>
      <div class="goal-choice">
        <label><input type="radio" name="goal_${goal.id}" value="yes" ${sold?"checked":""}> Vendi hoje</label>
        <label><input type="radio" name="goal_${goal.id}" value="no" ${no?"checked":""}> Não vendi hoje</label>
      </div>
      <div class="goal-qty ${sold?"":"hidden"}">
        <label>Quantidade vendida hoje</label>
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

  renderRepItemGoalCount();
  const done=repGoalCache.filter(x=>x.report).length;
  $("#repItemGoalStatus").textContent=`${done}/${repGoalCache.length} informados`;
}


function renderRepItemGoalCount(){
  const rows=(repGoalCache||[]).map(({goal,periodSold})=>{
    const target=Number(goal.target_quantity||0);
    const sold=Number(periodSold||0);
    return {
      item:goal.item_name,
      target,
      sold,
      remaining:Math.max(target-sold,0),
      pct:target>0?sold/target:0
    };
  }).sort((a,b)=>b.pct-a.pct||b.sold-a.sold);

  $("#repItemGoalCountTable").innerHTML=rows.map(r=>`<tr>
    <td><strong>${r.item}</strong></td>
    <td>${r.target} un.</td>
    <td>${r.sold} un.</td>
    <td>${r.remaining} un.</td>
    <td><strong>${percent(r.pct)}</strong><div class="progress-mini"><i style="width:${Math.min(r.pct*100,100)}%"></i></div></td>
  </tr>`).join("")||`<tr><td colspan="5">Nenhuma meta ativa.</td></tr>`;
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

$("#saleDate")?.addEventListener("change",()=>loadRepItemGoals($("#saleDate").value));

$("#saveItemGoalsBtn")?.addEventListener("click",async()=>{
  setMsg($("#repItemGoalsMsg"),"");
  const dateStr=$("#saleDate").value||today();
  const result=await saveRequiredItemGoalReports(dateStr);
  if(!result.ok)return setMsg($("#repItemGoalsMsg"),result.message);
  setMsg($("#repItemGoalsMsg"),"Informações dos itens salvas com sucesso.","ok");
  await loadRepItemGoals(dateStr);
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
    {data:salesDistributors,error:sdErr},
    {data:orders,error:oErr},
    {data:customers,error:cErr}
  ]=await Promise.all([
    sb.from("profiles").select("*").order("name"),
    sb.from("daily_sales").select("*").gte("sale_date",start).lt("sale_date",next),
    profile.role==="divisional_manager" ? Promise.resolve({data:[],error:null}) : sb.from("representative_invites").select("*").order("created_at",{ascending:false}).limit(20),
    sb.from("item_goals").select("*").order("created_at",{ascending:false}),
    sb.from("item_goal_reports").select("*").gte("report_date",start).lt("report_date",next),
    sb.from("distributors").select("*").order("name"),
    sb.from("daily_sales_distributors").select("*").gte("sale_date",start).lt("sale_date",next),
    sb.from("sales_orders").select("*").gte("order_date",start).lt("order_date",next),
    sb.from("customers").select("*")
  ]);
  if(pErr||sErr||iErr||gErr||grErr||dErr||sdErr||oErr||cErr){console.error(pErr||sErr||iErr||gErr||grErr||dErr||sdErr||oErr||cErr);return;}
  const allProfiles=profiles||[];
  const reps=allProfiles.filter(r=>r.role==="rep"&&r.active), map={};
  const goalRep=$("#goalRep");
  if(goalRep){
    const keep=goalRep.value;
    goalRep.innerHTML='<option value="">Selecione...</option>'+reps.map(r=>`<option value="${r.user_id}">${r.name}</option>`).join("");
    if(reps.some(r=>r.user_id===keep)) goalRep.value=keep;
  }
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
  const activeItemGoals=(itemGoals||[]).filter(g=>g.active);
  const activeGoalIds=new Set(activeItemGoals.map(g=>g.id));
  const itemGoalCount=activeItemGoals.length;
  const itemTargetUnits=activeItemGoals.reduce((s,g)=>s+Number(g.target_quantity||0),0);
  const itemSoldTotal=(itemReports||[]).filter(r=>activeGoalIds.has(r.goal_id)).reduce((s,r)=>s+Number(r.quantity||0),0);
  $("#admItemTargetTotal").textContent=String(itemGoalCount);
  $("#admItemSoldTotal").textContent=`${itemSoldTotal} un.`;
  $("#admItemPct").textContent=itemTargetUnits>0?percent(itemSoldTotal/itemTargetUnits):"—";
  $("#admItemRemaining").textContent=`${Math.max(itemTargetUnits-itemSoldTotal,0)} un.`;

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
      <td>${profile.role==="divisional_manager"
        ? `<span class="muted">Resumo no quadro geral por distribuidora</span>`
        : `<div class="dist-summary">${distributorSummaryForRep(r.user_id)}</div>`}</td>
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
    <td>${i.invite_role==="sub_admin"?"Subadministrador":i.invite_role==="regional_manager"?"Gerente Regional":i.invite_role==="divisional_manager"?"Gerente Divisional":"Representante"}</td>
    <td>${i.code.slice(0,10)}…</td>
    <td>${i.used_by?"Utilizado":(i.active?"Disponível":"Inativo")}</td>
  </tr>`).join("")||`<tr><td colspan="4">Nenhum convite criado.</td></tr>`;
  adminCache={reps,allProfiles,sales:sales||[],month:mk,itemGoals:itemGoals||[],itemReports:itemReports||[],distributors:distributors||[],salesDistributors:salesDistributors||[],orders:orders||[],customers:customers||[]};
  renderAdminSalesHistory();
  renderUserManagement();
  renderItemGoalsManager();
  renderItemPerformance();
  renderDistributorManager();
  renderDistributorSales();
  renderRepDistributorBreakdown();
  renderManagerCnpjRanking();
  renderDivisionalSummary();
  renderDivisionalDashboard();
  renderDailyChart(sales||[],mk);
  ensureTableExportButtons("#adminView");
}



function renderDivisionalSummary(){
  const table=$("#divisionalRegionSummaryTable");
  if(!table || profile?.role!=="divisional_manager") return;

  const managers=(adminCache.allProfiles||[]).filter(p=>p.role==="regional_manager"&&p.active);
  const reps=adminCache.reps||[];
  const sales=adminCache.sales||[];

  const rows=managers.map(m=>{
    const states=(m.managed_states||[]).map(x=>String(x).toUpperCase());
    const regionalReps=reps.filter(r=>r.state_code && states.includes(String(r.state_code).toUpperCase()));
    const ids=new Set(regionalReps.map(r=>r.user_id));
    const sold=sales.filter(s=>ids.has(s.user_id)).reduce((sum,s)=>sum+Number(s.amount||0),0);
    const target=regionalReps.reduce((sum,r)=>sum+Number(r.monthly_target||0),0);
    return {name:m.name,states,reps:regionalReps.length,sold,target,pct:target>0?sold/target:0};
  }).sort((a,b)=>b.sold-a.sold);

  table.innerHTML=rows.map(r=>`<tr>
    <td><strong>${r.name}</strong></td>
    <td>${r.states.join(", ")||"—"}</td>
    <td>${r.reps}</td>
    <td>${money(r.sold)}</td>
    <td>${money(r.target)}</td>
    <td>${r.target>0?percent(r.pct):"—"}</td>
  </tr>`).join("")||`<tr><td colspan="6">Nenhum Gerente Regional cadastrado.</td></tr>`;
}


function divisionalStateList(){
  const states=new Set();
  (adminCache.reps||[]).forEach(r=>{ if(r.state_code) states.add(String(r.state_code).toUpperCase()); });
  return [...states].sort();
}

function managerForState(state){
  const st=String(state||"").toUpperCase();
  return (adminCache.allProfiles||[]).find(p=>
    p.role==="regional_manager" &&
    p.active &&
    (p.managed_states||[]).map(x=>String(x).toUpperCase()).includes(st)
  )||null;
}

function renderDivisionalStateResults(){
  const table=$("#divisionalStateResultsTable");
  if(!table || profile?.role!=="divisional_manager") return;

  const reps=adminCache.reps||[];
  const sales=adminCache.sales||[];
  const rows=divisionalStateList().map(state=>{
    const stateReps=reps.filter(r=>String(r.state_code||"").toUpperCase()===state);
    const ids=new Set(stateReps.map(r=>r.user_id));
    const month=sales.filter(s=>ids.has(s.user_id)).reduce((sum,s)=>sum+Number(s.amount||0),0);
    const todayTotal=sales.filter(s=>ids.has(s.user_id)&&s.sale_date===today()).reduce((sum,s)=>sum+Number(s.amount||0),0);
    const target=stateReps.reduce((sum,r)=>sum+Number(r.monthly_target||0),0);
    return {state,reps:stateReps.length,today:todayTotal,month,target,pct:target>0?month/target:0};
  }).sort((a,b)=>b.month-a.month);

  table.innerHTML=rows.map(r=>`<tr>
    <td><strong>${r.state}</strong></td>
    <td>${r.reps}</td>
    <td>${money(r.today)}</td>
    <td><strong>${money(r.month)}</strong></td>
    <td>${money(r.target)}</td>
    <td>${r.target>0?percent(r.pct):"—"}</td>
  </tr>`).join("")||`<tr><td colspan="6">Nenhum estado com especialistas cadastrados.</td></tr>`;
}

function accumulatedSeriesByUsers(userIds,mk){
  const {y,m}=monthBounds(mk),days=new Date(y,m,0).getDate();
  const daily=Array(days).fill(0);
  const ids=new Set(userIds);
  (adminCache.sales||[]).filter(s=>ids.has(s.user_id)).forEach(s=>{
    const d=Number(String(s.sale_date).slice(-2));
    if(d>=1&&d<=days) daily[d-1]+=Number(s.amount||0);
  });
  let running=0;
  return daily.map(v=>(running+=v));
}

function renderDivisionalEvolutionCharts(){
  if(profile?.role!=="divisional_manager") return;
  const mk=adminCache.month||monthNow();
  const {y,m}=monthBounds(mk),days=new Date(y,m,0).getDate();
  const labels=Array.from({length:days},(_,i)=>String(i+1).padStart(2,"0"));
  const reps=adminCache.reps||[];

  const stateDatasets=divisionalStateList().map(state=>{
    const ids=reps.filter(r=>String(r.state_code||"").toUpperCase()===state).map(r=>r.user_id);
    return {label:state,data:accumulatedSeriesByUsers(ids,mk),tension:.25,fill:false};
  });

  const stateCtx=$("#divisionalStateEvolutionChart");
  if(stateCtx){
    if(divisionalStateChart) divisionalStateChart.destroy();
    divisionalStateChart=new Chart(stateCtx,{
      type:"line",
      data:{labels,datasets:stateDatasets},
      options:{responsive:true,maintainAspectRatio:false,interaction:{mode:"index",intersect:false},
        plugins:{legend:{display:true,position:"bottom"}},
        scales:{y:{ticks:{callback:v=>money(v)}}}}
    });
  }

  const managers=(adminCache.allProfiles||[]).filter(p=>p.role==="regional_manager"&&p.active);
  const managerDatasets=managers.map(manager=>{
    const states=(manager.managed_states||[]).map(x=>String(x).toUpperCase());
    const ids=reps.filter(r=>states.includes(String(r.state_code||"").toUpperCase())).map(r=>r.user_id);
    return {label:manager.name,data:accumulatedSeriesByUsers(ids,mk),tension:.25,fill:false};
  });

  const managerCtx=$("#divisionalManagerEvolutionChart");
  if(managerCtx){
    if(divisionalManagerChart) divisionalManagerChart.destroy();
    divisionalManagerChart=new Chart(managerCtx,{
      type:"line",
      data:{labels,datasets:managerDatasets},
      options:{responsive:true,maintainAspectRatio:false,interaction:{mode:"index",intersect:false},
        plugins:{legend:{display:true,position:"bottom"}},
        scales:{y:{ticks:{callback:v=>money(v)}}}}
    });
  }
}

function renderDivisionalItemGoals(){
  const table=$("#divisionalItemGoalsByStateTable");
  if(!table || profile?.role!=="divisional_manager") return;

  const reps=adminCache.reps||[];
  const activeGoals=(adminCache.itemGoals||[]).filter(g=>g.active&&g.assigned_user_id);
  const reports=adminCache.itemReports||[];

  const repById=Object.fromEntries(reps.map(r=>[r.user_id,r]));
  const grouped={};

  activeGoals.forEach(g=>{
    const rep=repById[g.assigned_user_id];
    const state=String(rep?.state_code||"SEM ESTADO").toUpperCase();
    grouped[state]||={state,goalIds:new Set(),goalCount:0,target:0,sold:0};
    grouped[state].goalIds.add(g.id);
    grouped[state].goalCount+=1;
    grouped[state].target+=Number(g.target_quantity||0);
  });

  Object.values(grouped).forEach(row=>{
    row.sold=reports.filter(r=>row.goalIds.has(r.goal_id)).reduce((sum,r)=>sum+Number(r.quantity||0),0);
    row.pct=row.target>0?row.sold/row.target:0;
    const mgr=managerForState(row.state);
    row.manager=mgr?.name||"Sem Gerente Regional";
  });

  const rows=Object.values(grouped).sort((a,b)=>b.pct-a.pct||b.sold-a.sold);
  table.innerHTML=rows.map(r=>`<tr>
    <td><strong>${r.state}</strong></td>
    <td>${r.manager}</td>
    <td>${r.goalCount}</td>
    <td>${r.target} un.</td>
    <td>${r.sold} un.</td>
    <td>${r.target>0?percent(r.pct):"—"}</td>
  </tr>`).join("")||`<tr><td colspan="6">Não existem metas por item vinculadas a especialistas.</td></tr>`;

  const ctx=$("#divisionalItemGoalsChart");
  if(ctx){
    if(divisionalItemGoalChart) divisionalItemGoalChart.destroy();
    divisionalItemGoalChart=new Chart(ctx,{
      type:"bar",
      data:{
        labels:rows.map(r=>r.state),
        datasets:[{
          label:"% da meta por item realizada",
          data:rows.map(r=>Number((r.pct*100).toFixed(1)))
        }]
      },
      options:{
        responsive:true,maintainAspectRatio:false,
        plugins:{legend:{display:false}},
        scales:{y:{beginAtZero:true,max:100,ticks:{callback:v=>`${v}%`}}}
      }
    });
  }
}

function renderDivisionalDashboard(){
  if(profile?.role!=="divisional_manager") return;
  renderDivisionalStateResults();
  renderDivisionalSummary();
  renderDivisionalEvolutionCharts();
  renderDivisionalItemGoals();
}

function roleLabel(role){
  return role==="admin"?"Administrador Geral"
    :role==="sub_admin"?"Subadministrador"
    :role==="regional_manager"?"Gerente Regional"
    :role==="divisional_manager"?"Gerente Divisional"
    :"Representante";
}

function renderUserManagement(){
  const card=$("#userManagementCard");
  if(!card) return;
  const canManage=["admin","sub_admin","regional_manager"].includes(profile?.role);
  card.classList.toggle("hidden",!canManage);
  if(!canManage) return;

  const isMainAdmin=profile.role==="admin";
  const rows=(adminCache.allProfiles||[]).filter(p=>p.user_id!==user.id && p.role!=="admin");

  $("#userManagementTable").innerHTML=rows.map(p=>`<tr>
    <td>${isMainAdmin?`<input class="inline-edit user-name" data-id="${p.user_id}" value="${String(p.name||"").replaceAll('"','&quot;')}">`:`<strong>${p.name}</strong>`}</td>
    <td><input class="inline-edit user-title" data-id="${p.user_id}" value="${String(p.job_title||"").replaceAll('"','&quot;')}" placeholder="Ex.: Especialista, Supervisor"></td>
    <td>${isMainAdmin
      ? `<select class="inline-edit role-select user-role" data-id="${p.user_id}">
          <option value="rep" ${p.role==="rep"?"selected":""}>Usuário / Especialista</option>
          <option value="regional_manager" ${p.role==="regional_manager"?"selected":""}>Gerente Regional</option>
          <option value="divisional_manager" ${p.role==="divisional_manager"?"selected":""}>Gerente Divisional</option>
          <option value="sub_admin" ${p.role==="sub_admin"?"selected":""}>Subadministrador</option>
         </select>`
      : `<strong>${roleLabel(p.role)}</strong><span class="restricted-note">Somente o Administrador Geral altera o perfil de acesso.</span>`}</td>
    <td>${isMainAdmin
      ? `<div class="region-field-stack">
          <input class="inline-edit user-state" data-id="${p.user_id}" maxlength="2" value="${String(p.state_code||"").replaceAll('"','&quot;')}" placeholder="Estado do representante: PB">
          <input class="inline-edit user-managed-states" data-id="${p.user_id}" value="${String((p.managed_states||[]).join(', ')).replaceAll('"','&quot;')}" placeholder="Regiões do gerente: PB, CE">
          <small>Use Estado para representante e Regiões para Gerente Regional.</small>
         </div>`
      : `<span>${p.role==="regional_manager"?(p.managed_states||[]).join(", "):p.role==="divisional_manager"?"Todas as regiões":(p.state_code||"—")}</span>`}</td>
    <td><input class="inline-edit user-target money-input" data-id="${p.user_id}" type="text" inputmode="numeric" value="${formatBRLInput(Number(p.monthly_target||0))}" autocomplete="off"></td>
    <td><span class="${p.active?"user-status-active":"user-status-inactive"}">${p.active?"Ativo":"Inativo"}</span>${p.must_change_password?'<span class="force-password-note">Troca de senha pendente</span>':''}</td>
    <td>${isMainAdmin?`<button class="btn btn-xs btn-light" onclick="resetUserPassword('${p.user_id}','${String(p.name||"").replaceAll("'","&#39;")}')">Resetar senha</button>`:'—'}</td>
    <td>
      <button class="btn btn-xs btn-primary" onclick="saveUserManagement('${p.user_id}',${p.active})">Salvar</button>
      ${isMainAdmin?`<button class="btn btn-xs btn-light ${p.active?"danger":""}" onclick="toggleUserActive('${p.user_id}',${p.active})">${p.active?"Desativar":"Ativar"}</button>`:""}
    </td>
  </tr>`).join("")||`<tr><td colspan="8">Nenhum outro usuário cadastrado.</td></tr>`;
}

window.saveUserManagement=async(userId)=>{
  if(!["admin","sub_admin","regional_manager"].includes(profile?.role)) return;

  const job_title=document.querySelector(`.user-title[data-id="${userId}"]`)?.value.trim()||null;
  const monthly_target=parseCurrencyInput(document.querySelector(`.user-target[data-id="${userId}"]`)?.value);

  if(["sub_admin","regional_manager"].includes(profile.role)){
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
  const state_code=(document.querySelector(`.user-state[data-id="${userId}"]`)?.value||"").trim().toUpperCase()||null;
  const managed_states=[...new Set((document.querySelector(`.user-managed-states[data-id="${userId}"]`)?.value||"").split(",").map(x=>x.trim().toUpperCase()).filter(Boolean))];
  const {error}=await sb.from("profiles").update({
    name,
    job_title,
    role,
    monthly_target,
    state_code:role==="rep"?state_code:null,
    managed_states:role==="regional_manager"?managed_states:[]
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

window.resetUserPassword=async(userId,name)=>{
  if(profile?.role!=="admin") return;
  if(!confirm(`Resetar a senha de ${name}? A senha temporária será "redefinirsenha" e o usuário será obrigado a criar outra senha no próximo acesso.`)) return;
  setMsg($("#userManagementMsg"),"Resetando senha...","ok");
  const {data,error}=await sb.functions.invoke("admin-reset-password",{body:{target_user_id:userId}});
  if(error || data?.error)return setMsg($("#userManagementMsg"),data?.error||error?.message||"Não foi possível resetar a senha.");
  setMsg($("#userManagementMsg"),`Senha de ${name} redefinida. Senha temporária: redefinirsenha. No próximo login a troca será obrigatória.`,"ok");
  await loadAdmin();
};




function normalizeItemName(name){
  return String(name||"").trim().replace(/\s+/g," ").toUpperCase();
}

function renderItemPerformance(){
  const goals=(adminCache.itemGoals||[]).filter(g=>g.active&&g.assigned_user_id);
  const reports=adminCache.itemReports||[];
  const repNames=Object.fromEntries((adminCache.reps||[]).map(r=>[r.user_id,r.name]));

  const rows=goals.map(g=>{
    const sold=reports
      .filter(r=>r.goal_id===g.id)
      .reduce((sum,r)=>sum+Number(r.quantity||0),0);
    const target=Number(g.target_quantity||0);
    return {
      id:g.id,
      rep:repNames[g.assigned_user_id]||"Especialista",
      item:g.item_name,
      target,
      sold,
      remaining:Math.max(target-sold,0),
      pct:target>0?sold/target:0
    };
  }).sort((a,b)=>b.pct-a.pct||b.sold-a.sold||a.item.localeCompare(b.item));

  $("#itemPerformanceTable").innerHTML=rows.map((r,i)=>`<tr>
    <td><span class="rank-badge">${i+1}</span></td>
    <td><strong>${r.rep}</strong></td>
    <td><strong>${r.item}</strong><br><small class="muted">Cadastro #${r.id}</small></td>
    <td>${r.target} un.</td>
    <td>${r.sold} un.</td>
    <td>${r.remaining} un.</td>
    <td class="${i===0&&r.pct>0?"item-hit-fast":""}"><strong>${percent(r.pct)}</strong><div class="progress-mini"><i style="width:${Math.min(r.pct*100,100)}%"></i></div></td>
  </tr>`).join("")||`<tr><td colspan="7">Nenhuma meta por item ativa.</td></tr>`;
}

function renderDistributorManager(){
  const rows=adminCache.distributors||[];
  const canDelete=profile?.role==="admin";
  $("#distributorsTable").innerHTML=rows.map(d=>`<tr>
    <td><input class="inline-edit distributor-name-edit" data-id="${d.id}" value="${String(d.name||"").replaceAll('"','&quot;')}"></td>
    <td><span class="${d.active?"user-status-active":"user-status-inactive"}">${d.active?"Ativa":"Inativa"}</span></td>
    <td>
      <button class="btn btn-xs btn-primary" onclick="saveDistributorName(${d.id})">Salvar nome</button>
      <button class="btn btn-xs btn-light ${d.active?"danger":""}" onclick="toggleDistributor(${d.id},${d.active})">${d.active?"Desativar":"Ativar"}</button>
      ${canDelete?`<button class="btn btn-xs btn-danger" onclick="deleteDistributor(${d.id},'${String(d.name||"").replaceAll("'","&#39;")}')">Apagar</button>`:""}
    </td>
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


function renderManagerCnpjRanking(){
  const orders=adminCache.orders||[];
  const grouped={};
  orders.forEach(o=>{
    const key=o.cnpj;
    grouped[key]||={cnpj:key,legal_name:o.legal_name,total:0,count:0,reps:new Set()};
    grouped[key].total+=Number(o.amount||0);
    grouped[key].count+=1;
    grouped[key].reps.add(o.user_id);
    if(o.legal_name) grouped[key].legal_name=o.legal_name;
  });
  const ranking=Object.values(grouped).sort((a,b)=>b.total-a.total);
  $("#managerCnpjRankingTable").innerHTML=ranking.map((r,i)=>`<tr>
    <td>${i+1}º</td>
    <td><span class="cnpj-chip">${formatCNPJ(r.cnpj)}</span></td>
    <td>${r.legal_name}</td>
    <td>${r.count}</td>
    <td>${r.reps.size}</td>
    <td><strong>${money(r.total)}</strong></td>
  </tr>`).join("")||`<tr><td colspan="6">Nenhum pedido detalhado no período.</td></tr>`;
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
  if(!["admin","sub_admin","regional_manager"].includes(profile?.role)) return;
  const {error}=await sb.from("distributors").update({active:!active}).eq("id",id);
  if(error)return alert(error.message);
  await loadAdmin();
};

window.saveDistributorName=async(id)=>{
  if(!["admin","sub_admin","regional_manager"].includes(profile?.role)) return;
  const input=document.querySelector(`.distributor-name-edit[data-id="${id}"]`);
  const name=input?.value.trim();
  if(!name)return alert("Informe o nome da distribuidora.");
  const {error}=await sb.from("distributors").update({name}).eq("id",id);
  if(error)return alert(error.message);
  await loadAdmin();
};

window.deleteDistributor=async(id,name)=>{
  if(profile?.role!=="admin") return;
  if(!confirm(`Apagar a distribuidora "${name}"?`)) return;
  const {error}=await sb.from("distributors").delete().eq("id",id);
  if(error){
    alert("Não foi possível apagar. Essa distribuidora possui vendas ou pedidos vinculados. Use Desativar para preservar o histórico.");
    return;
  }
  await loadAdmin();
};


function renderItemGoalsManager(){
  const goals=adminCache.itemGoals||[],reports=adminCache.itemReports||[],activeReps=adminCache.reps||[];
  const todayStr=today();
  const repNames=Object.fromEntries(activeReps.map(r=>[r.user_id,r.name]));
  const individualGoals=goals.filter(g=>g.assigned_user_id);

  $("#itemGoalsTable").innerHTML=individualGoals.map(g=>{
    const relevant=reports.filter(r=>r.goal_id===g.id&&r.user_id===g.assigned_user_id);
    const soldQty=relevant.reduce((s,r)=>s+Number(r.quantity||0),0);
    const pct=Number(g.target_quantity)>0?soldQty/Number(g.target_quantity):0;
    const answeredToday=relevant.some(r=>r.report_date===todayStr);
    const inPeriod=todayStr>=g.start_date&&todayStr<=g.end_date&&g.active;
    return `<tr>
      <td><strong>${repNames[g.assigned_user_id]||"Representante"}</strong></td>
      <td><strong>${g.item_name}</strong><br><span class="goal-status-pill ${inPeriod?"":"closed"}">${inPeriod?"Ativa":"Fora do período"}</span></td>
      <td>${g.start_date.split("-").reverse().join("/")}<br>${g.end_date.split("-").reverse().join("/")}</td>
      <td>${g.target_quantity}</td>
      <td>${soldQty}</td>
      <td>${(pct*100).toFixed(1)}%<div class="progress-mini"><i style="width:${Math.min(pct*100,100)}%"></i></div></td>
      <td>${answeredToday?"Sim":"Pendente"}</td>
      <td>${["admin","sub_admin"].includes(profile?.role)?`<button class="btn btn-xs btn-light" onclick="toggleItemGoal(${g.id},${g.active})">${g.active?"Encerrar":"Reativar"}</button>`:'<span class="muted">Consulta</span>'}</td>
    </tr>`;
  }).join("")||`<tr><td colspan="8">Nenhuma meta individual por item criada.</td></tr>`;
}

$("#itemGoalForm")?.addEventListener("submit",async e=>{
  e.preventDefault();setMsg($("#itemGoalMsg"),"");
  if(!["admin","sub_admin","regional_manager"].includes(profile?.role)) return;
  const row={
    assigned_user_id:$("#goalRep").value,
    item_name:$("#goalItemName").value.trim(),
    target_quantity:Number($("#goalTargetQty").value),
    start_date:$("#goalStartDate").value,
    end_date:$("#goalEndDate").value,
    created_by:user.id,
    active:true
  };
  if(!row.assigned_user_id)return setMsg($("#itemGoalMsg"),"Selecione o representante.");
  if(!row.item_name||!Number.isInteger(row.target_quantity)||row.target_quantity<=0)return setMsg($("#itemGoalMsg"),"Informe item e quantidade válida.");
  if(row.end_date<row.start_date)return setMsg($("#itemGoalMsg"),"A data final não pode ser anterior à inicial.");
  const {error}=await sb.from("item_goals").insert(row);
  if(error)return setMsg($("#itemGoalMsg"),error.message);
  setMsg($("#itemGoalMsg"),"Meta individual por item criada com sucesso.","ok");
  $("#goalItemName").value="";$("#goalTargetQty").value="";
  await loadAdmin();
});
window.toggleItemGoal=async(id,active)=>{
  if(!["admin","sub_admin","regional_manager"].includes(profile?.role)) return;
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
  const targetText=prompt("Meta mensal (R$):",formatBRLInput(target));if(targetText===null)return;
  const newTarget=parseLooseBRL(targetText);
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

function updateInviteRoleFields(){
  const role=$("#inviteRole")?.value||"rep";
  const isRep=role==="rep",isRegional=role==="regional_manager";
  $("#inviteTargetWrap")?.classList.toggle("hidden",!isRep);
  $("#inviteStateWrap")?.classList.toggle("hidden",!isRep);
  $("#inviteManagedStatesWrap")?.classList.toggle("hidden",!isRegional);
  if(!isRep) $("#inviteTarget").value="R$ 0,00";
}
$("#inviteRole")?.addEventListener("change",updateInviteRoleFields);

$("#inviteForm").addEventListener("submit",async e=>{
  e.preventDefault();setMsg($("#inviteMsg"),"");
  if(!["admin","sub_admin","regional_manager"].includes(profile?.role)) return setMsg($("#inviteMsg"),"Você não possui permissão para gerar acessos.");
  const role=["sub_admin","regional_manager"].includes(profile?.role)?"rep":($("#inviteRole")?.value||"rep");
  const state_code=role==="rep"?($("#inviteState").value.trim().toUpperCase()||null):null;
  const managed_states=role==="regional_manager"?[...new Set($("#inviteManagedStates").value.split(",").map(x=>x.trim().toUpperCase()).filter(Boolean))]:[];
  if(role==="regional_manager"&&!managed_states.length)return setMsg($("#inviteMsg"),"Informe pelo menos um estado para o Gerente Regional.");
  if(profile?.role==="regional_manager" && (!state_code || !(profile.managed_states||[]).map(x=>String(x).toUpperCase()).includes(state_code))){
    return setMsg($("#inviteMsg"),"Escolha um estado que pertença à sua região.");
  }
  const row={
    representative_name:$("#inviteName").value.trim(),
    monthly_target:role==="rep"?parseCurrencyInput($("#inviteTarget").value):0,
    invite_role:role,
    state_code,
    managed_states
  };
  const {data,error}=await sb.from("representative_invites").insert(row).select().single();
  if(error)return setMsg($("#inviteMsg"),error.message);
  $("#generatedCode").textContent=data.code;
  $("#inviteResult").classList.remove("hidden");
  setMsg($("#inviteMsg"),role==="sub_admin"
    ?"Convite de subadministrador criado. Envie o código para o segundo gestor."
    :role==="regional_manager"
      ?"Convite de Gerente Regional criado. Envie o código ao gerente."
      :role==="divisional_manager"
        ?"Convite de Gerente Divisional criado. Envie o código ao gerente."
        :"Convite de representante criado. Envie o código ao representante.","ok");
  await loadAdmin();
});
$("#copyCodeBtn").addEventListener("click",async()=>{await navigator.clipboard.writeText($("#generatedCode").textContent);$("#copyCodeBtn").textContent="Copiado!";setTimeout(()=>$("#copyCodeBtn").textContent="Copiar código",1300);});

$("#resetPasswordForm")?.addEventListener("submit",async e=>{e.preventDefault();const p1=$("#newPassword").value,p2=$("#confirmNewPassword").value;if(p1!==p2)return setMsg($("#resetPasswordMsg"),"As senhas não coincidem.");const {error}=await sb.auth.updateUser({password:p1});if(error)return setMsg($("#resetPasswordMsg"),error.message);try{await loadProfile();if(profile?.must_change_password)await sb.rpc("complete_password_change");}catch(_e){}setMsg($("#resetPasswordMsg"),"Senha atualizada com sucesso.","ok");setTimeout(()=>boot(),800);});

sb.auth.onAuthStateChange(async(event,session)=>{if(event==="PASSWORD_RECOVERY"){user=session?.user||null;showOnly("#resetView");$("#logoutBtn").classList.remove("hidden");return;}if(session?.user){user=session.user;await loadProfile();await tryPendingInvite();}});
boot();


function renderAdminSalesHistory(){
  if(!adminCache.sales)return;
  const repId=$("#historyRep")?.value||"",start=$("#historyStart")?.value||"",end=$("#historyEnd")?.value||"";
  const reps=Object.fromEntries((adminCache.reps||[]).map(r=>[r.user_id,r.name]));
  const rows=[...(adminCache.sales||[])].filter(s=>(!repId||s.user_id===repId)&&(!start||s.sale_date>=start)&&(!end||s.sale_date<=end)).sort((a,b)=>b.sale_date.localeCompare(a.sale_date)).slice(0,120);
  $("#adminSalesHistory").innerHTML=rows.map(s=>`<tr><td>${s.sale_date.split("-").reverse().join("/")}</td><td>${reps[s.user_id]||"Representante"}</td><td>${money(s.amount)}</td><td>${s.note||"—"}</td><td>${["admin","sub_admin","regional_manager"].includes(profile?.role)?`<button class="btn btn-xs btn-light" onclick="editSale(${s.id},${Number(s.amount||0)},'${String(s.note||"").replaceAll("'","&#39;")}')">Corrigir</button>`:'<span class="muted">Consulta</span>'}</td></tr>`).join("")||`<tr><td colspan="5">Nenhum lançamento encontrado.</td></tr>`;
}
["historyRep","historyStart","historyEnd"].forEach(id=>$("#"+id)?.addEventListener("change",renderAdminSalesHistory));
$("#clearHistoryFilters")?.addEventListener("click",()=>{$("#historyRep").value="";$("#historyStart").value="";$("#historyEnd").value="";renderAdminSalesHistory();});

window.editSale=async(id,amount,note)=>{
  const value=prompt("Novo valor da venda:",formatBRLInput(amount));
  if(value===null) return;
  const newAmount=parseLooseBRL(value);
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
    ()=>sb.from("sales_orders").delete().not("id","is",null),
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
