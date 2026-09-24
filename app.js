const KEY = "stock_pos_v1";

const defaultData = {
  products: [],
  sales: [],
  purchases: [],
  expenses: [],
  openingCash: 0,
  countedCash: null
};

let data = loadData();

function loadData(){
  try{
    const raw = localStorage.getItem(KEY);
    return raw ? {...defaultData, ...JSON.parse(raw)} : structuredClone(defaultData);
  }catch(e){
    return structuredClone(defaultData);
  }
}

function saveData(){
  localStorage.setItem(KEY, JSON.stringify(data));
  renderAll();
}

function money(n){
  return "RD$" + Number(n || 0).toLocaleString("es-DO",{minimumFractionDigits:2,maximumFractionDigits:2});
}

function id(){
  return Date.now().toString(36) + Math.random().toString(36).slice(2,8);
}

function now(){
  return new Date().toISOString();
}

function productById(pid){
  return data.products.find(p => p.id === pid);
}

function stockOf(pid){
  const bought = data.purchases.filter(x=>x.productId===pid).reduce((s,x)=>s+Number(x.qty||0),0);
  const sold = data.sales.filter(x=>x.productId===pid).reduce((s,x)=>s+Number(x.qty||0),0);
  return bought - sold;
}

function totals(){
  const sales = data.sales.reduce((s,x)=>s+Number(x.total||0),0);
  const purchases = data.purchases.reduce((s,x)=>s+Number(x.total||0),0);
  const expenses = data.expenses.reduce((s,x)=>s+Number(x.amount||0),0);
  const cogs = data.sales.reduce((s,x)=>s+Number(x.costTotal||0),0);
  const gross = sales - cogs;
  const net = gross - expenses;
  const cash = Number(data.openingCash||0) + sales - purchases - expenses;
  return {sales,purchases,expenses,cogs,gross,net,cash};
}

function toast(msg){
  const el=document.getElementById("toast");
  el.textContent=msg;
  el.classList.add("show");
  clearTimeout(window.toastTimer);
  window.toastTimer=setTimeout(()=>el.classList.remove("show"),2200);
}

function showScreen(name){
  if(name==="more"){
    document.getElementById("moreMenu").classList.remove("hidden");
    return;
  }
  document.querySelectorAll(".screen").forEach(s=>s.classList.remove("active"));
  const target=document.getElementById(name);
  if(target) target.classList.add("active");
  document.querySelectorAll(".bottom-nav button").forEach(b=>b.classList.remove("active"));
  const nav=document.querySelector(`.bottom-nav button[data-go="${name}"]`);
  if(nav) nav.classList.add("active");
  if(name==="sale") refreshSale();
  if(name==="purchase") refreshPurchase();
  if(name==="products") renderProducts();
  if(name==="inventory") renderInventory();
  if(name==="cash") renderCash();
  if(name==="reports") renderReports();
  if(name==="history") renderHistory();
  window.scrollTo({top:0,behavior:"smooth"});
}

document.addEventListener("click", e=>{
  const btn=e.target.closest("[data-go]");
  if(btn){
    showScreen(btn.dataset.go);
    if(btn.closest("#moreMenu")) document.getElementById("moreMenu").classList.add("hidden");
  }
});

document.getElementById("closeMore").onclick=()=>document.getElementById("moreMenu").classList.add("hidden");

function fillProductSelect(id, includeEmpty=true){
  const sel=document.getElementById(id);
  if(!sel) return;
  const old=sel.value;
  sel.innerHTML=includeEmpty?'<option value="">Selecciona un producto</option>':"";
  data.products.forEach(p=>{
    const opt=document.createElement("option");
    opt.value=p.id;
    opt.textContent=p.name;
    sel.appendChild(opt);
  });
  if(data.products.some(p=>p.id===old)) sel.value=old;
}

function refreshSale(){
  fillProductSelect("saleProduct");
  const pid=document.getElementById("saleProduct").value;
  const p=productById(pid);
  document.getElementById("salePrice").textContent=money(p?.price||0);
  document.getElementById("saleStock").textContent=p?stockOf(pid):0;
  updateSaleTotal();
}

function updateSaleTotal(){
  const p=productById(document.getElementById("saleProduct").value);
  const qty=Number(document.getElementById("saleQty").value||0);
  document.getElementById("saleTotal").textContent=money((p?.price||0)*qty);
}

document.getElementById("saleProduct").addEventListener("change",refreshSale);
document.getElementById("saleQty").addEventListener("input",updateSaleTotal);

document.getElementById("saveSale").onclick=()=>{
  const pid=document.getElementById("saleProduct").value;
  const qty=Number(document.getElementById("saleQty").value);
  const p=productById(pid);
  if(!p) return toast("Selecciona un producto.");
  if(qty<=0) return toast("La cantidad debe ser mayor que 0.");
  const stock=stockOf(pid);
  if(qty>stock) return toast(`No hay suficiente inventario. Disponible: ${stock}.`);
  const total=qty*Number(p.price||0);
  data.sales.push({
    id:id(), productId:pid, qty, total,
    costTotal:qty*Number(p.cost||0), date:now()
  });
  saveData();
  document.getElementById("saleQty").value=1;
  toast("Venta guardada.");
  showScreen("sale");
};

function refreshPurchase(){
  fillProductSelect("purchaseProduct");
  updatePurchase();
}

function updatePurchase(){
  const packs=Math.max(0,Number(document.getElementById("purchasePacks").value||0));
  const units=Math.max(0,Number(document.getElementById("purchaseUnits").value||0));
  const cost=Math.max(0,Number(document.getElementById("purchasePackCost").value||0));
  document.getElementById("purchaseQty").textContent=packs*units;
  document.getElementById("purchaseTotal").textContent=money(packs*cost);
}

["purchasePacks","purchaseUnits","purchasePackCost"].forEach(id=>{
  document.getElementById(id).addEventListener("input",updatePurchase);
});

document.getElementById("savePurchase").onclick=()=>{
  const pid=document.getElementById("purchaseProduct").value;
  const packs=Number(document.getElementById("purchasePacks").value);
  const units=Number(document.getElementById("purchaseUnits").value);
  const packCost=Number(document.getElementById("purchasePackCost").value);
  if(!productById(pid)) return toast("Selecciona un producto.");
  if(packs<=0 || units<=0) return toast("Fardos y unidades deben ser mayores que 0.");
  if(packCost<0) return toast("El costo no puede ser negativo.");
  data.purchases.push({
    id:id(), productId:pid, packs, unitsPerPack:units,
    qty:packs*units, total:packs*packCost, unitCost:(packs*units?packCost/units:0), date:now()
  });
  saveData();
  document.getElementById("purchasePacks").value=1;
  document.getElementById("purchaseUnits").value=1;
  document.getElementById("purchasePackCost").value=0;
  toast("Compra guardada.");
  showScreen("purchase");
};

document.getElementById("newProductBtn").onclick=()=>{
  document.getElementById("productFormTitle").textContent="Nuevo producto";
  document.getElementById("editProductId").value="";
  document.getElementById("productName").value="";
  document.getElementById("productCost").value=0;
  document.getElementById("productPrice").value=0;
  showScreen("productForm");
};

document.getElementById("cancelProduct").onclick=()=>showScreen("products");

document.getElementById("saveProduct").onclick=()=>{
  const pid=document.getElementById("editProductId").value;
  const name=document.getElementById("productName").value.trim();
  const cost=Number(document.getElementById("productCost").value||0);
  const price=Number(document.getElementById("productPrice").value||0);
  if(!name) return toast("Escribe el nombre del producto.");
  if(cost<0 || price<0) return toast("Los precios no pueden ser negativos.");
  if(pid){
    const p=productById(pid);
    if(p){p.name=name;p.cost=cost;p.price=price;}
    toast("Producto actualizado.");
  }else{
    data.products.push({id:id(),name,cost,price});
    toast("Producto creado.");
  }
  saveData();
  showScreen("products");
};

function renderProducts(){
  const box=document.getElementById("productList");
  if(!data.products.length){box.innerHTML='<div class="empty">Todavía no tienes productos. Pulsa “+ Nuevo”.</div>';return;}
  box.innerHTML=data.products.map(p=>`
    <div class="item">
      <div class="item-top">
        <div>
          <div class="item-title">${escapeHtml(p.name)}</div>
          <div class="item-meta">Costo: ${money(p.cost)} · Venta: ${money(p.price)}</div>
          <div class="item-meta">Existencia: <b>${stockOf(p.id)}</b></div>
        </div>
        <span class="badge">${money(p.price)}</span>
      </div>
      <div class="item-actions">
        <button data-edit-product="${p.id}">Editar</button>
      </div>
    </div>
  `).join("");
  box.querySelectorAll("[data-edit-product]").forEach(b=>b.onclick=()=>editProduct(b.dataset.editProduct));
}

function editProduct(pid){
  const p=productById(pid);
  if(!p) return;
  document.getElementById("productFormTitle").textContent="Editar producto";
  document.getElementById("editProductId").value=p.id;
  document.getElementById("productName").value=p.name;
  document.getElementById("productCost").value=p.cost;
  document.getElementById("productPrice").value=p.price;
  showScreen("productForm");
}

function renderInventory(){
  const box=document.getElementById("inventoryList");
  if(!data.products.length){box.innerHTML='<div class="empty">No hay productos registrados.</div>';return;}
  box.innerHTML=data.products.map(p=>{
    const stock=stockOf(p.id);
    return `<div class="item">
      <div class="item-top">
        <div><div class="item-title">${escapeHtml(p.name)}</div><div class="item-meta">Costo ${money(p.cost)} · Venta ${money(p.price)}</div></div>
        <span class="badge">Stock: ${stock}</span>
      </div>
    </div>`;
  }).join("");
}

document.getElementById("saveExpense").onclick=()=>{
  const description=document.getElementById("expenseDescription").value.trim();
  const amount=Number(document.getElementById("expenseAmount").value||0);
  if(!description) return toast("Escribe la descripción.");
  if(amount<=0) return toast("El monto debe ser mayor que 0.");
  data.expenses.push({id:id(),description,amount,date:now()});
  saveData();
  document.getElementById("expenseDescription").value="";
  document.getElementById("expenseAmount").value=0;
  toast("Gasto guardado.");
  showScreen("expense");
};

function renderCash(){
  const t=totals();
  document.getElementById("openingCash").value=data.openingCash||0;
  document.getElementById("countedCash").value=data.countedCash==null?"":data.countedCash;
  document.getElementById("cashOpeningView").textContent=money(data.openingCash);
  document.getElementById("cashSalesView").textContent=money(t.sales);
  document.getElementById("cashPurchasesView").textContent=money(t.purchases);
  document.getElementById("cashExpensesView").textContent=money(t.expenses);
  document.getElementById("cashExpectedView").textContent=money(t.cash);
  const diff=data.countedCash==null?0:Number(data.countedCash)-t.cash;
  document.getElementById("cashDifference").textContent=money(diff);
}

document.getElementById("saveOpeningCash").onclick=()=>{
  const n=Number(document.getElementById("openingCash").value||0);
  if(n<0) return toast("El dinero inicial no puede ser negativo.");
  data.openingCash=n;
  saveData();
  toast("Dinero inicial guardado.");
};

document.getElementById("saveCountedCash").onclick=()=>{
  const n=Number(document.getElementById("countedCash").value||0);
  if(n<0) return toast("El dinero contado no puede ser negativo.");
  data.countedCash=n;
  saveData();
  toast("Cuadre guardado.");
};

function renderReports(){
  const t=totals();
  document.getElementById("reportSales").textContent=money(t.sales);
  document.getElementById("reportCOGS").textContent=money(t.cogs);
  document.getElementById("reportGross").textContent=money(t.gross);
  document.getElementById("reportExpenses").textContent=money(t.expenses);
  document.getElementById("reportNet").textContent=money(t.net);
}

function renderHistory(){
  const items=[];
  data.sales.forEach(x=>items.push({date:x.date,type:"Venta",text:`${productById(x.productId)?.name||"Producto"} × ${x.qty}`,amount:x.total,positive:true}));
  data.purchases.forEach(x=>items.push({date:x.date,type:"Compra",text:`${productById(x.productId)?.name||"Producto"} × ${x.qty}`,amount:x.total,positive:false}));
  data.expenses.forEach(x=>items.push({date:x.date,type:"Gasto",text:x.description,amount:x.amount,positive:false}));
  items.sort((a,b)=>new Date(b.date)-new Date(a.date));
  const box=document.getElementById("historyList");
  if(!items.length){box.innerHTML='<div class="empty">No hay movimientos todavía.</div>';return;}
  box.innerHTML=items.map(x=>`
    <div class="item">
      <div class="item-top">
        <div><div class="item-title">${escapeHtml(x.type)}</div><div class="item-meta">${escapeHtml(x.text)}<br>${new Date(x.date).toLocaleString("es-DO")}</div></div>
        <strong>${x.positive?"+":"-"}${money(x.amount)}</strong>
      </div>
    </div>
  `).join("");
}

function renderDashboard(){
  const t=totals();
  document.getElementById("dashSales").textContent=money(t.sales);
  document.getElementById("dashPurchases").textContent=money(t.purchases);
  document.getElementById("dashExpenses").textContent=money(t.expenses);
  document.getElementById("dashProfit").textContent=money(t.net);
  document.getElementById("dashCash").textContent=money(t.cash);
  document.getElementById("dashProducts").textContent=data.products.length;
}

function renderAll(){
  renderDashboard();
  renderProducts();
  renderInventory();
  renderCash();
  renderReports();
  renderHistory();
  refreshSale();
  refreshPurchase();
}

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
}

document.getElementById("backupBtn").onclick=()=>{
  const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  a.download="STOCK_POS_backup.json";
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  toast("Copia de seguridad creada.");
};

document.getElementById("backupBtn").addEventListener("contextmenu",e=>e.preventDefault());

renderAll();
