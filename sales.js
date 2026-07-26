import { currentUserId, saveDoc, removeDoc, listenCollection, listenDoc, saveCatalogItem, deleteCatalogItem, listenPublicCatalog } from './firebase.js';
import { formatUSD, formatBS, showToast, safeConfirm, createElement, exportToCSV, compressImageFile } from './utils.js';
import { getCart, clearCart, calculate, getRates } from './calculator.js';
import { updateAdminPanel } from './dashboard.js';

let salesHistory = [];
let expensesHistory = [];
let inventoryData = [];
let catalogData = [];
let totalSavedUSDT = 0;
let currentStatusFilter = 'all';

export const CATALOG_CATEGORIES = [
  { id: 'accesorio', label: 'Accesorio', color: 'pink' },
  { id: 'hogar', label: 'Hogar', color: 'green' },
  { id: 'coleccionable', label: 'Coleccionable', color: 'pink' },
  { id: 'repuesto', label: 'Repuesto', color: 'yellow' },
  { id: 'gamer', label: 'Setup Gamer', color: 'blue' },
  { id: 'empresarial', label: 'Empresarial', color: 'yellow' },
  { id: 'otro', label: 'Otro', color: 'red' },
];

export const ORDER_STATUSES = [
  { id: 'quoted', label: '📝 Cotizado', color: 'yellow' },
  { id: 'confirmed', label: '✅ Confirmado', color: 'blue' },
  { id: 'printing', label: '🖨️ Imprimiendo', color: 'pink' },
  { id: 'postprocess', label: '✂️ Post-proceso', color: 'rose' },
  { id: 'shipped', label: '📦 Enviado', color: 'green' },
  { id: 'delivered', label: '✔️ Entregado', color: 'green' },
];

export function getSalesHistory() { return salesHistory; }
export function getExpensesHistory() { return expensesHistory; }
export function getInventoryData() { return inventoryData; }
export function getCatalogData() { return catalogData; }
export function getTotalSavedUSDT() { return totalSavedUSDT; }

export function getLowStockItems() {
  return inventoryData.filter(i => i.qty <= (i.minQty || 2));
}

export function getStockAlertCount() {
  return getLowStockItems().length;
}

function updateStockBadge() {
    const btn = document.getElementById('navInventory');
    if (!btn) return;
    const count = getStockAlertCount();
    let badge = btn.querySelector('.alert-badge');
    if (count > 0) {
        if (!badge) {
            badge = createElement('span', 'alert-badge bg-red-500 text-white rounded-full px-1.5 py-0.5 text-[8px] absolute top-1 right-1 font-bold', count.toString());
            btn.style.position = 'relative';
            btn.appendChild(badge);
        } else {
            badge.textContent = count.toString();
        }
    } else {
        if (badge) badge.remove();
    }
}

export function startRealtimeSync() {
    if (!currentUserId) return;

    listenCollection('ventas', (data) => {
        salesHistory = data;
        renderSales();
        updateAdminPanel();
    });

    listenCollection('gastos', (data) => {
        expensesHistory = data;
        renderExpenses();
        updateAdminPanel();
    });

    listenCollection('inventario', (data) => {
        inventoryData = data;
        renderInventory();
        updateStockBadge();
    });

    listenDoc('config', 'ahorros', (data) => {
        totalSavedUSDT = data ? data.total || 0 : 0;
        updateAdminPanel();
    });

    // Catálogo público: no depende de currentUserId, cualquiera puede leerlo,
    // pero aquí lo usamos para que el admin vea y gestione lo que sube.
    listenPublicCatalog((data) => {
        catalogData = data;
        renderCatalogAdmin();
    });
}

export async function registerSale() {
    const cart = getCart();
    if (cart.length === 0 || !currentUserId) return showToast("No hay orden para guardar");
    
    let aggUsd = 0, aggMat = 0, aggWear = 0, aggProfit = 0, aggDeliv = 0;
    let jobNames = [];

    cart.forEach(item => {
        aggUsd += item.usd;
        aggMat += item.costs.mat;
        aggWear += item.costs.wear;
        aggProfit += item.costs.profit;
        aggDeliv += item.costs.delivery;
        jobNames.push(item.jobName);
    });

    const saleId = Date.now().toString();
    const clientNameInput = document.getElementById('clientName');
    const clientPhoneInput = document.getElementById('clientPhone');

    const sale = {
        id: saleId,
        client: clientNameInput?.value || "Invitado",
        job: jobNames.join(', '), 
        phone: clientPhoneInput?.value || "",
        usd: aggUsd, 
        costs: { mat: aggMat, wear: aggWear, profit: aggProfit, delivery: aggDeliv },
        items: cart, 
        date: new Date().toLocaleDateString(),
        timestamp: Date.now(),
        status: 'quoted'
    };
    
    try {
        await saveDoc('ventas', saleId, sale);
        
        if (typeof confetti !== 'undefined') {
            confetti({
                particleCount: 150,
                spread: 80,
                origin: { y: 0.6 },
                colors: ['#ff69b4', '#f43f5e', '#ffffff', '#facc15'],
                disableForReducedMotion: true
            });
        }
        
        showToast("🎉 ¡Orden Guardada con Éxito!");
        
        if (clientNameInput) clientNameInput.value = "";
        if (clientPhoneInput) clientPhoneInput.value = "";
        clearCart();
        calculate();
        
        setTimeout(() => window.showPage('calc'), 1500);
        
    } catch(e) { showToast("Error al guardar en la nube"); console.error(e); }
}

export async function deleteSale(id) {
    if (!currentUserId) return;
    if (confirm("¿Estás seguro de ELIMINAR esta orden completa de la NUBE?")) {
        await removeDoc('ventas', id.toString());
        showToast("Orden eliminada de la nube");
    }
}

export async function editSale(id) {
    const sale = salesHistory.find(s => s.id.toString() === id.toString());
    if (!sale || !currentUserId) return;
    if (!confirm("Esto regresará la orden entera al carrito para que la edites. ¿Continuar?")) return;

    if (sale.items && sale.items.length > 0) {
        // Must use global currentCart or window method since we import clearCart
        window.currentCart = sale.items; // handled by modifying getter if needed, but we should import a setter or use clearCart
        // Since getCart returns a reference, we can just push
        const cart = getCart();
        cart.length = 0;
        sale.items.forEach(i => cart.push(i));
    } else {
        const cart = getCart();
        cart.length = 0;
        cart.push({ usd: sale.usd, bs: sale.usd * getRates().binance, jobName: sale.job, costs: sale.costs });
    }

    const clientNameInput = document.getElementById('clientName');
    const clientPhoneInput = document.getElementById('clientPhone');
    if (clientNameInput) clientNameInput.value = sale.client || '';
    if (clientPhoneInput) clientPhoneInput.value = sale.phone || '';

    await removeDoc('ventas', id.toString());
    
    // We need to call renderCart from window or export it
    if (window.renderCart) window.renderCart();
    calculate();
    window.showPage('calc');
    showToast("✏️ Orden restaurada en el carrito");
}

export async function updateSaleStatus(id, newStatus) {
    if (!currentUserId) return;
    await saveDoc('ventas', id.toString(), { status: newStatus });
    showToast("Estado actualizado");
}

export function filterSales(status) {
    currentStatusFilter = status;
    renderSales();
}

export function renderSales() {
    const list = document.getElementById('salesList');
    if (!list) return;

    list.innerHTML = '';

    let filtered = salesHistory;
    if (currentStatusFilter === 'pending') {
        filtered = salesHistory.filter(s => s.status !== 'delivered');
    } else if (currentStatusFilter === 'delivered') {
        filtered = salesHistory.filter(s => s.status === 'delivered');
    }

    if (filtered.length === 0) { 
        list.appendChild(createElement('p', 'text-center text-gray-500 text-[10px] py-10 font-bold uppercase', 'Sin registros')); 
        return; 
    }

    [...filtered].reverse().forEach(s => {
        const statusObj = ORDER_STATUSES.find(st => st.id === (s.status || 'quoted')) || ORDER_STATUSES[0];
        const statusIndex = ORDER_STATUSES.findIndex(st => st.id === statusObj.id);

        const container = createElement('div', 'p-4 bg-white/5 rounded-2xl border border-white/5 flex flex-col mb-2');
        
        const topRow = createElement('div', 'flex justify-between items-center mb-2');
        const infoDiv = createElement('div', 'flex-1 pr-2 truncate');
        
        const clientP = createElement('p', 'text-[11px] font-black uppercase text-pink-500 truncate', s.client);
        
        const jobText = s.job + (s.items && s.items.length > 1 ? ` (${s.items.length} items)` : '');
        const jobP = createElement('p', 'text-[9px] text-rose-400 font-bold mb-1 truncate', jobText);
        
        const dateP = createElement('p', 'text-[8px] text-gray-500 font-bold', s.date);
        
        infoDiv.appendChild(clientP);
        infoDiv.appendChild(jobP);
        infoDiv.appendChild(dateP);

        const priceDiv = createElement('div', 'flex flex-col items-end gap-2');
        const priceP = createElement('p', 'text-sm font-black text-white', formatUSD(s.usd));
        
        const statusBadge = createElement('span', `badge badge-${statusObj.color} text-[8px] px-2 py-0.5 rounded-full font-bold`, statusObj.label);

        priceDiv.appendChild(priceP);
        priceDiv.appendChild(statusBadge);

        topRow.appendChild(infoDiv);
        topRow.appendChild(priceDiv);
        
        const bottomRow = createElement('div', 'flex justify-between items-center mt-2 pt-2 border-t border-white/5');
        
        const actionsDiv = createElement('div', 'flex gap-2');
        const editBtn = createElement('button', 'text-[9px] bg-pink-600/20 text-pink-400 px-3 py-1.5 rounded-lg font-bold uppercase tracking-widest hover:bg-pink-600/40 transition-colors', 'Editar');
        editBtn.onclick = () => editSale(s.id);
        const delBtn = createElement('button', 'text-[10px] bg-red-600/20 text-red-400 px-3 py-1.5 rounded-lg hover:bg-red-600/40 transition-colors', '🗑️');
        delBtn.onclick = () => deleteSale(s.id);
        
        actionsDiv.appendChild(editBtn);
        actionsDiv.appendChild(delBtn);

        const statusActionsDiv = createElement('div', 'flex gap-1');
        if (statusIndex > 0) {
            const prevBtn = createElement('button', 'text-[10px] bg-gray-600/30 px-2 py-1 rounded', '◀');
            prevBtn.onclick = () => updateSaleStatus(s.id, ORDER_STATUSES[statusIndex - 1].id);
            statusActionsDiv.appendChild(prevBtn);
        }
        if (statusIndex < ORDER_STATUSES.length - 1) {
            const nextBtn = createElement('button', 'text-[10px] bg-gray-600/30 px-2 py-1 rounded', '▶');
            nextBtn.onclick = () => updateSaleStatus(s.id, ORDER_STATUSES[statusIndex + 1].id);
            statusActionsDiv.appendChild(nextBtn);
        }

        bottomRow.appendChild(actionsDiv);
        bottomRow.appendChild(statusActionsDiv);

        container.appendChild(topRow);
        container.appendChild(bottomRow);

        list.appendChild(container);
    });
}


// --- EXPENSES ---
export async function addExpense() {
    if (!currentUserId) return;
    const descInput = document.getElementById('expDesc');
    const amountInput = document.getElementById('expAmount');
    const categoryInput = document.getElementById('expCategory');

    const desc = descInput?.value;
    const amount = parseFloat(amountInput?.value) || 0;
    const category = categoryInput?.value;

    if (!desc || amount <= 0) return showToast("Datos inválidos");

    const expId = Date.now().toString();
    try {
        await saveDoc('gastos', expId, {
            id: expId, desc, amount, category, date: new Date().toLocaleDateString(), timestamp: Date.now()
        });
        if (descInput) descInput.value = '';
        if (amountInput) amountInput.value = '';
        showToast("💖 Gasto guardado en la nube");
    } catch(e) { console.error(e); }
}

export async function deleteExpense(id) {
    if (!currentUserId) return;
    if (confirm("¿Anular este gasto y regresar el dinero?")) {
        await removeDoc('gastos', id.toString());
        showToast("Gasto anulado de la nube");
    }
}

export function renderExpenses() {
    const list = document.getElementById('expensesList');
    if (!list) return;

    list.innerHTML = '';
    if (expensesHistory.length === 0) { 
        list.appendChild(createElement('p', 'text-center text-gray-500 text-[9px] py-4 font-bold uppercase', 'Sin gastos registrados')); 
        return; 
    }

    [...expensesHistory].reverse().forEach(e => {
        let catName = 'Gasto';
        if (e.category === 'mat') catName = 'Fondo Material';
        if (e.category === 'machine') catName = 'Fondo Máquina';
        if (e.category === 'delivery') catName = 'Fondo Envío';
        if (e.category === 'profit') catName = 'Retiro Ganancia';
        
        const container = createElement('div', 'flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/5 mb-2');
        
        const infoDiv = createElement('div');
        infoDiv.appendChild(createElement('p', 'text-[11px] font-bold text-white capitalize', e.desc));
        infoDiv.appendChild(createElement('p', 'text-[9px] text-gray-500 uppercase mt-0.5', `${catName} | ${e.date}`));
        
        const actionDiv = createElement('div', 'flex items-center gap-3');
        actionDiv.appendChild(createElement('span', 'text-[12px] font-black text-rose-400', `-${formatUSD(e.amount)}`));
        
        const btn = createElement('button', 'text-[10px] bg-red-500/10 text-red-500 hover:bg-red-500/20 px-2 py-1.5 rounded-lg transition-colors', '🗑️');
        btn.onclick = () => deleteExpense(e.id);
        actionDiv.appendChild(btn);

        container.appendChild(infoDiv);
        container.appendChild(actionDiv);
        list.appendChild(container);
    });
}

// --- INVENTORY ---
export async function addInvItem() {
    if (!currentUserId) return;
    const nameInput = document.getElementById('invName');
    const qtyInput = document.getElementById('invQty');
    const priceInput = document.getElementById('invPrice');
    const typeInput = document.getElementById('invType');
    const minQtyInput = document.getElementById('invMinQty');

    const name = nameInput?.value;
    const qty = parseInt(qtyInput?.value) || 0;
    const minQty = parseInt(minQtyInput?.value) || 2;
    const price = parseFloat(priceInput?.value) || 0;
    const type = typeInput?.value;
    
    if (!name) return showToast("Escribe el nombre del material");

    const itemId = Date.now().toString();
    await saveDoc('inventario', itemId, {
        id: itemId, name, qty, minQty, price, type, date: new Date().toLocaleDateString(), timestamp: Date.now()
    });
    
    if (nameInput) nameInput.value = '';
    if (qtyInput) qtyInput.value = '';
    if (priceInput) priceInput.value = '';
    if (minQtyInput) minQtyInput.value = '';
    showToast("💖 Inventario subido a la nube");
}

export async function updateInvQty(id, delta) {
    if (!currentUserId) return;
    const item = inventoryData.find(i => i.id.toString() === id.toString());
    if (item) {
        let newQty = item.qty + delta;
        if (newQty < 0) newQty = 0; 
        await saveDoc('inventario', id.toString(), { qty: newQty });
    }
}

export async function deleteInvItem(id) {
    if (!currentUserId) return;
    if (confirm("¿Borrar material de la nube?")) {
        await removeDoc('inventario', id.toString());
        showToast("Borrado");
    }
}

export async function editInvItem(id) {
    if (!currentUserId) return;
    const item = inventoryData.find(i => i.id.toString() === id.toString());
    if (!item) return;

    const nameInput = document.getElementById('invName');
    const qtyInput = document.getElementById('invQty');
    const minQtyInput = document.getElementById('invMinQty');
    const priceInput = document.getElementById('invPrice');
    const typeInput = document.getElementById('invType');

    if (nameInput) nameInput.value = item.name || '';
    if (qtyInput) qtyInput.value = item.qty || '';
    if (minQtyInput) minQtyInput.value = item.minQty || 2;
    if (priceInput) priceInput.value = item.price || '';
    if (typeInput) typeInput.value = item.type || 'PLA';

    await removeDoc('inventario', id.toString());
    showToast("✏️ Editando...");
}

export function renderInventory() {
    const list = document.getElementById('inventoryList');
    if (!list) return;

    list.innerHTML = '';
    if (inventoryData.length === 0) { 
        list.appendChild(createElement('p', 'text-center text-gray-500 text-[10px] py-10 font-bold uppercase tracking-widest', 'Inventario Vacío')); 
        return; 
    }

    [...inventoryData].reverse().forEach(i => {
        let colorClass = i.type === 'PLA' ? 'text-pink-400' : (i.type === 'Empaque' ? 'text-rose-400' : 'text-gray-400');
        const priceText = i.price ? ` | ${formatUSD(i.price)}` : '';
        
        const minQty = i.minQty || 2;
        let stockClass = 'stock-ok';
        if (i.qty <= minQty) stockClass = 'stock-critical border-red-500';
        else if (i.qty <= minQty * 2) stockClass = 'stock-low border-yellow-500';
        else stockClass = 'stock-ok border-green-500';

        const container = createElement('div', `p-3 bg-white/5 rounded-2xl border-l-4 flex flex-col gap-2 mb-2 ${stockClass}`);
        
        const topRow = createElement('div', 'flex justify-between items-start');
        const infoDiv = createElement('div', 'flex-1');
        
        infoDiv.appendChild(createElement('p', 'text-[11px] font-black uppercase text-white', i.name));
        infoDiv.appendChild(createElement('p', `text-[9px] ${colorClass} font-bold`, `${i.type}${priceText}`));
        infoDiv.appendChild(createElement('p', 'text-[8px] text-gray-500 font-bold mt-0.5', `Comprado: ${i.date || 'Sin fecha'}`));

        const btnDiv = createElement('div', 'flex items-center gap-2');
        const editBtn = createElement('button', 'text-[9px] bg-pink-600/20 text-pink-400 px-2 py-1.5 rounded-lg font-bold uppercase hover:bg-pink-600/40 transition-colors', 'Editar');
        editBtn.onclick = () => editInvItem(i.id);
        const delBtn = createElement('button', 'text-[10px] bg-red-600/20 text-red-400 px-2 py-1.5 rounded-lg hover:bg-red-600/40 transition-colors', '🗑️');
        delBtn.onclick = () => deleteInvItem(i.id);

        btnDiv.appendChild(editBtn);
        btnDiv.appendChild(delBtn);

        topRow.appendChild(infoDiv);
        topRow.appendChild(btnDiv);

        const bottomRow = createElement('div', 'flex justify-end mt-1');
        const qtyCtrl = createElement('div', 'flex items-center bg-black/40 rounded-xl border border-white/5 w-fit');
        
        const minusBtn = createElement('button', 'px-3 py-1.5 text-rose-400 hover:bg-rose-500/20 rounded-l-xl font-bold text-lg leading-none', '-');
        minusBtn.onclick = () => updateInvQty(i.id, -1);
        
        const qtySpan = createElement('span', 'text-sm font-black text-white w-8 text-center', i.qty.toString());
        
        const plusBtn = createElement('button', 'px-3 py-1.5 text-pink-400 hover:bg-pink-500/20 rounded-r-xl font-bold text-lg leading-none', '+');
        plusBtn.onclick = () => updateInvQty(i.id, 1);

        qtyCtrl.appendChild(minusBtn);
        qtyCtrl.appendChild(qtySpan);
        qtyCtrl.appendChild(plusBtn);

        bottomRow.appendChild(qtyCtrl);

        container.appendChild(topRow);
        container.appendChild(bottomRow);

        list.appendChild(container);
    });
}

// --- SAVINGS ---
export async function addSavings() {
    if (!currentUserId) return;
    const input = document.getElementById('usdtInput');
    const val = parseFloat(input?.value);
    if (isNaN(val) || val <= 0) return showToast("Monto inválido");
    
    const newTotal = totalSavedUSDT + val;
    await saveDoc('config', 'ahorros', { total: newTotal });
    if (input) input.value = '';
    showToast("💖 USDT Ahorrado en la nube");
}

export async function clearSavings() {
    if (!currentUserId) return;
    if (confirm("¿Reiniciar tu contador de ahorros en la nube?")) {
        await saveDoc('config', 'ahorros', { total: 0 });
        showToast("Ahorros reiniciados");
    }
}

export async function clearAllData() {
    if (!currentUserId) return;
    if (safeConfirm("🚨 ¿BORRAR DEFINITIVAMENTE TODOS LOS DATOS DE LA NUBE?", "BORRAR")) {
        
        // Simple JSON backup
        const backup = { sales: salesHistory, expenses: expensesHistory, inventory: inventoryData };
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backup));
        const dlAnchorElem = document.getElementById('downloadAnchorElem') || document.createElement('a');
        dlAnchorElem.setAttribute("href", dataStr);
        dlAnchorElem.setAttribute("download", "backup.json");
        document.body.appendChild(dlAnchorElem); // required for firefox
        dlAnchorElem.click();
        dlAnchorElem.remove();

        for (const s of salesHistory) await removeDoc('ventas', s.id.toString());
        for (const e of expensesHistory) await removeDoc('gastos', e.id.toString());
        for (const i of inventoryData) await removeDoc('inventario', i.id.toString());
        
        showToast("La nube ha sido formateada");
    }
}

// --- EXPORTS ---
export function exportSalesCSV() { exportToCSV(salesHistory, 'ventas.csv'); }
export function exportExpensesCSV() { exportToCSV(expensesHistory, 'gastos.csv'); }
export function exportInventoryCSV() { exportToCSV(inventoryData, 'inventario.csv'); }

export function generateWHTicket() {
    const cart = getCart();
    if (cart.length === 0) return showToast("No hay orden para el ticket");

    const client = document.getElementById('clientName')?.value || 'Amigo';
    let aggUsd = 0;
    let aggBs = 0;
    
    let itemListText = "";
    cart.forEach(item => {
        itemListText += `🔸 *${item.jobName}* - $${item.usd.toFixed(2)}\n`;
        aggUsd += item.usd;
        aggBs += item.bs;
    });

    const rates = getRates();

    const text = `*👑 PRESUPUESTO ITS MINE PRINTER 3D 👑*\n\n*Cliente:* ${client}\n\n*📋 Detalle de su orden:*\n${itemListText}\n*Monto Total:* $${aggUsd.toFixed(2)}\n*Bolívares:* ${aggBs.toLocaleString('es-VE')} (Binance)\n\n_Válido por 24h_`;
    
    const phone = (document.getElementById('clientPhone')?.value || "").replace(/\D/g, '');
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank');
}

export function generateQuoteView() {
    const cart = getCart();
    if (cart.length === 0) return showToast("No hay orden para cotizar");

    let aggUsd = 0, aggBs = 0;
    cart.forEach(item => {
        aggUsd += item.usd;
        aggBs += item.bs;
    });

    const overlay = document.getElementById('quoteOverlay');
    const content = document.getElementById('quoteContent');
    if (!overlay || !content) return;

    content.innerHTML = '';

    const title = createElement('h2', 'text-2xl font-black text-pink-500 mb-4', 'Presupuesto');
    content.appendChild(title);

    cart.forEach(item => {
        const row = createElement('div', 'flex justify-between text-sm mb-2');
        row.appendChild(createElement('span', 'font-bold', item.jobName));
        row.appendChild(createElement('span', '', formatUSD(item.usd)));
        content.appendChild(row);
    });

    content.appendChild(createElement('hr', 'my-4 border-pink-500/30'));

    const totalUsdRow = createElement('div', 'flex justify-between text-lg font-black text-white');
    totalUsdRow.appendChild(createElement('span', '', 'Total:'));
    totalUsdRow.appendChild(createElement('span', '', formatUSD(aggUsd)));
    content.appendChild(totalUsdRow);

    const totalBsRow = createElement('div', 'flex justify-between text-sm font-bold text-gray-400');
    totalBsRow.appendChild(createElement('span', '', 'Total Bs:'));
    totalBsRow.appendChild(createElement('span', '', formatBS(aggBs)));
    content.appendChild(totalBsRow);

    content.appendChild(createElement('p', 'text-xs text-center text-gray-500 mt-6', 'Válido por 24h'));

    overlay.classList.remove('hidden');
}

export function closeQuoteView() {
    const overlay = document.getElementById('quoteOverlay');
    if (overlay) overlay.classList.add('hidden');
}

// --- CATÁLOGO (fotos que se ven en index.html) ---
export async function addCatalogItem() {
    const nameInput = document.getElementById('catName');
    const priceInput = document.getElementById('catPrice');
    const categoryInput = document.getElementById('catCategory');
    const fileInput = document.getElementById('catPhoto');
    const btn = document.getElementById('btnSaveCatalog');

    const name = nameInput?.value?.trim();
    const price = parseFloat(priceInput?.value) || 0;
    const category = categoryInput?.value || 'otro';
    const file = fileInput?.files?.[0];

    if (!name) return showToast("Escribe el nombre de la pieza");
    if (!file) return showToast("Selecciona una foto");

    const itemId = Date.now().toString();

    try {
        if (btn) { btn.disabled = true; btn.textContent = "Comprimiendo foto..."; }
        const imageBase64 = await compressImageFile(file);
        if (btn) { btn.textContent = "Guardando..."; }
        await saveCatalogItem(itemId, {
            id: itemId, name, price, category, imageBase64,
            date: new Date().toLocaleDateString(),
            timestamp: Date.now()
        });

        if (nameInput) nameInput.value = '';
        if (priceInput) priceInput.value = '';
        if (fileInput) fileInput.value = '';
        showToast("💖 Foto subida al catálogo público");
    } catch (e) {
        console.error(e);
        showToast("Error al subir la foto");
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = "+ Subir al Catálogo"; }
    }
}

export async function removeCatalogItem(id) {
    if (!confirm("¿Quitar esta pieza del catálogo público?")) return;
    await deleteCatalogItem(id.toString());
    showToast("Pieza eliminada del catálogo");
}

export function renderCatalogAdmin() {
    const list = document.getElementById('catalogAdminList');
    if (!list) return;

    list.innerHTML = '';
    if (catalogData.length === 0) {
        list.appendChild(createElement('p', 'text-center text-gray-500 text-[10px] py-10 font-bold uppercase', 'Aún no has subido fotos'));
        return;
    }

    [...catalogData].reverse().forEach(item => {
        const container = createElement('div', 'flex items-center gap-3 bg-white/5 p-2 rounded-xl border border-white/5 mb-2');

        const img = document.createElement('img');
        img.src = item.imageBase64;
        img.className = 'w-14 h-14 object-cover rounded-lg';
        img.style.width = '56px';
        img.style.height = '56px';
        img.style.objectFit = 'cover';
        img.style.borderRadius = '10px';

        const infoDiv = createElement('div', 'flex-1 truncate');
        infoDiv.appendChild(createElement('p', 'text-[11px] font-black uppercase text-white truncate', item.name));
        const catLabel = CATALOG_CATEGORIES.find(c => c.id === item.category)?.label || item.category;
        const priceText = item.price ? ` · $${item.price.toFixed(2)}` : '';
        infoDiv.appendChild(createElement('p', 'text-[9px] text-pink-400 font-bold', `${catLabel}${priceText}`));

        const btn = createElement('button', 'text-[10px] bg-red-500/10 text-red-500 hover:bg-red-500/20 px-2 py-1.5 rounded-lg transition-colors', '🗑️');
        btn.onclick = () => removeCatalogItem(item.id);

        container.appendChild(img);
        container.appendChild(infoDiv);
        container.appendChild(btn);
        list.appendChild(container);
    });
}
