import { formatUSD, formatBS, showToast, setText, createElement } from './utils.js';

let currentCalc = { usd: 0, bs: 0, costs: {}, jobName: '' };
let currentCart = [];
let rates = { bcv: 1, binance: 1 };

export const MATERIALS = [
  { id: 'pla', name: 'PLA', pricePerKg: 40 },
  { id: 'petg', name: 'PETG', pricePerKg: 45 },
  { id: 'tpu', name: 'TPU Flexible', pricePerKg: 55 },
  { id: 'abs', name: 'ABS', pricePerKg: 42 },
];

export const QUALITIES = [
  { id: 'standard', name: 'Estándar (0.2mm)', timeFactor: 1.0 },
  { id: 'high', name: 'Alta (0.12mm)', timeFactor: 1.3 },
  { id: 'ultra', name: 'Ultra (0.08mm)', timeFactor: 1.6 },
];

export function getCart() { return currentCart; }
export function getRates() { return rates; }

export function clearCart() { 
    currentCart = []; 
    renderCart(); 
}

export async function fetchRates() {
    try {
        const resO = await fetch('https://ve.dolarapi.com/v1/dolares/oficial');
        const dataO = await resO.json();
        rates.bcv = dataO.promedio || 1;
        
        const resP = await fetch('https://ve.dolarapi.com/v1/dolares/paralelo');
        const dataP = await resP.json();
        rates.binance = dataP.promedio || 1;
        
        const resE = await fetch('https://ve.dolarapi.com/v1/euros');
        const dataE = await resE.json();
        if (dataE.length > 0 && dataE[0].promedio) {
            rates.euro = dataE[0].promedio;
        } else {
            rates.euro = 1;
        }
        
        const manRate = document.getElementById('manualRate');
        const binRate = document.getElementById('binanceRateManual');
        const eurRate = document.getElementById('euroRateManual');
        if (manRate) manRate.value = rates.bcv.toFixed(2);
        if (binRate) binRate.value = rates.binance.toFixed(2);
        if (eurRate) eurRate.value = rates.euro.toFixed(2);
        
        updateRatesDisplay();
    } catch (e) { 
        showToast("Error fetch rates, usando tasas manuales"); 
    }
}

export function updateRatesDisplay() {
    setText('bcvStatus', `BCV: ${rates.bcv.toFixed(2)}`);
    setText('binanceStatus', `BINANCE: ${rates.binance.toFixed(2)}`);
    setText('euroStatus', `EURO: ${rates.euro.toFixed(2)}`);
}

export function setRates(bcv, binance, euro) {
    rates.bcv = parseFloat(bcv) || rates.bcv;
    rates.binance = parseFloat(binance) || rates.binance;
    rates.euro = parseFloat(euro) || rates.euro;
    updateRatesDisplay();
}

export function calculate() {
    const peso = parseFloat(document.getElementById('peso')?.value) || 0;
    const horasRaw = parseFloat(document.getElementById('horas')?.value) || 0;
    const manoObra = parseFloat(document.getElementById('postHrs')?.value) || 0; 
    const designExtra = parseFloat(document.getElementById('disenoSelect')?.value) || 0;
    const delivery = parseFloat(document.getElementById('delivery')?.value) || 0;
    
    const mPrice = parseFloat(document.getElementById('machinePrice')?.value) || 400;
    const margin = parseFloat(document.getElementById('profitMargin')?.value) || 2.0;

    const materialSelect = document.getElementById('materialSelect');
    const qualitySelect = document.getElementById('qualitySelect');
    const plaPriceInput = document.getElementById('plaPrice');

    let materialPrice = parseFloat(plaPriceInput?.value) || 40;
    if (materialSelect) {
        const selectedMat = MATERIALS.find(m => m.id === materialSelect.value);
        if (selectedMat && !plaPriceInput?.value) materialPrice = selectedMat.pricePerKg;
    }

    let timeFactor = 1.0;
    if (qualitySelect) {
        const selectedQual = QUALITIES.find(q => q.id === qualitySelect.value);
        if (selectedQual) timeFactor = selectedQual.timeFactor;
    }

    const horas = horasRaw * timeFactor;
    
    const matCost = (materialPrice / 1000) * peso;
    const wearCost = (mPrice / 4000) * horas;
    const risk = (matCost + wearCost) * 0.05;

    const production = matCost + wearCost + risk;
    
    const totalUSD = (production * margin) + manoObra + designExtra + delivery;
    const totalBS = totalUSD * rates.binance;

    const cMat = matCost + risk; 
    let gananciaBruta = totalUSD - cMat - wearCost - delivery;
    
    let aporteMaquina = 0;
    if (gananciaBruta > 0) {
        aporteMaquina = Math.max(1.00, gananciaBruta * 0.20);
        if (aporteMaquina > gananciaBruta * 0.50) {
            aporteMaquina = gananciaBruta * 0.50;
        }
    }

    const cWear = wearCost + aporteMaquina;
    const cProfit = gananciaBruta - aporteMaquina;

    currentCalc = {
        usd: totalUSD, 
        bs: totalBS,
        jobName: document.getElementById('jobName')?.value || "Pieza 3D",
        costs: { mat: cMat, wear: cWear, profit: cProfit, delivery: delivery },
        rawInputs: { 
            peso, 
            horas: horasRaw, 
            manoObra, 
            designExtra, 
            delivery, 
            jobName: document.getElementById('jobName')?.value,
            material: materialSelect?.value || 'pla',
            quality: qualitySelect?.value || 'standard'
        }
    };

    const resWearAuto = document.getElementById('resWearAuto');
    if (resWearAuto) {
        resWearAuto.value = formatUSD(wearCost);
    }

    const resTotal = document.getElementById('resTotalUSD');
    if (resTotal) {
        resTotal.textContent = totalUSD > 0 ? totalUSD.toFixed(2) : "0.00";
    }
}

export function addToCart() {
    if (currentCalc.usd <= 0) return showToast("La pieza está en $0.00");
    
    currentCart.push(JSON.parse(JSON.stringify(currentCalc)));
    
    const elIds = ['jobName', 'peso', 'horas', 'postHrs', 'delivery'];
    elIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    
    const disenoEl = document.getElementById('disenoSelect');
    if (disenoEl) disenoEl.selectedIndex = 0;
    
    calculate(); 
    renderCart();
    showToast("🛒 Pieza añadida a la orden");
}

export function removeFromCart(index) {
    currentCart.splice(index, 1);
    renderCart();
}

export function renderCart() {
    const section = document.getElementById('cartSection');
    const list = document.getElementById('cartListUI');
    const totalUSDUI = document.getElementById('cartTotalUSD');
    const countUI = document.getElementById('cartCount');

    if (!section || !list || !totalUSDUI || !countUI) return;

    if (currentCart.length === 0) {
        section.classList.add('hidden');
        return;
    }

    section.classList.remove('hidden');
    countUI.textContent = currentCart.length;

    let totalUSD = 0;
    list.innerHTML = ''; // safe clear

    currentCart.forEach((item, index) => {
        totalUSD += item.usd;
        
        const container = createElement('div', 'flex justify-between items-center bg-white/5 p-2 rounded-xl border border-white/5');
        
        const infoDiv = createElement('div', 'truncate pr-2');
        const nameP = createElement('p', 'text-[11px] font-bold text-pink-300 truncate', item.jobName);
        const priceP = createElement('p', 'text-[9px] text-gray-400', `+${formatUSD(item.usd)}`);
        
        infoDiv.appendChild(nameP);
        infoDiv.appendChild(priceP);
        
        const btn = createElement('button', 'text-[10px] text-red-400 hover:text-red-500 bg-red-500/10 hover:bg-red-500/20 px-2 py-1.5 rounded-lg transition-colors', '🗑️');
        btn.onclick = () => removeFromCart(index);
        
        container.appendChild(infoDiv);
        container.appendChild(btn);
        
        list.appendChild(container);
    });

    totalUSDUI.textContent = formatUSD(totalUSD);
}
