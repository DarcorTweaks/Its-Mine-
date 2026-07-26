import { getSalesHistory, getExpensesHistory, getTotalSavedUSDT } from './sales.js';
import { formatUSD } from './utils.js';

let salesChart = null;
let expensesChart = null;

export function updateAdminPanel() {
    const salesHistory = getSalesHistory();
    const expensesHistory = getExpensesHistory();
    const totalSavedUSDT = getTotalSavedUSDT();

    let total = 0, profit = 0, matAccumulated = 0, machineAccumulated = 0, delivAccumulated = 0;
    salesHistory.forEach(s => {
        total += s.usd || 0; 
        profit += s.costs?.profit || 0;
        matAccumulated += (s.costs?.mat || s.costs?.material || 0); 
        machineAccumulated += (s.costs?.wear || s.costs?.machine || 0);
        delivAccumulated += (s.costs?.delivery || s.delivery || 0);
    });

    let expMat = 0, expMach = 0, expDeliv = 0, expProfit = 0, totalExp = 0;
    expensesHistory.forEach(e => {
        totalExp += e.amount;
        if (e.category === 'mat') expMat += e.amount;
        if (e.category === 'machine') expMach += e.amount;
        if (e.category === 'delivery') expDeliv += e.amount;
        if (e.category === 'profit') expProfit += e.amount;
    });

    const currentMat = matAccumulated - expMat;
    const currentMach = machineAccumulated - expMach;
    const currentDeliv = delivAccumulated - expDeliv;
    const currentProfit = profit - expProfit - totalSavedUSDT; 

    const tS = document.getElementById('totalSalesUSD');
    const nP = document.getElementById('netProfitUSD');
    const tE = document.getElementById('totalExpensesUSD');
    const fMat = document.getElementById('fundMaterial');
    const fMach = document.getElementById('fundMachine');
    const fDeliv = document.getElementById('fundDelivery');
    const fSaved = document.getElementById('totalSavedUSDT');

    if (tS) tS.textContent = formatUSD(total);
    
    if (nP) {
        nP.textContent = formatUSD(currentProfit);
        nP.className = `text-2xl font-black ${currentProfit < 0 ? 'text-red-500' : 'text-green-400'}`;
    }
    
    if (tE) tE.textContent = `-${formatUSD(totalExp)}`;
    
    if (fMat) {
        fMat.textContent = formatUSD(currentMat);
        fMat.className = `font-black text-lg ${currentMat < 0 ? 'text-red-500' : ''}`;
    }
    if (fMach) {
        fMach.textContent = formatUSD(currentMach);
        fMach.className = `font-black text-lg ${currentMach < 0 ? 'text-red-500' : ''}`;
    }
    if (fDeliv) {
        fDeliv.textContent = formatUSD(currentDeliv);
        fDeliv.className = `font-black text-lg ${currentDeliv < 0 ? 'text-red-500' : ''}`;
    }
    
    if (fSaved) fSaved.textContent = formatUSD(totalSavedUSDT);

    updateKPIs(total, profit, salesHistory.length);
    renderCharts(salesHistory, expensesHistory);
}

export function renderCharts(sales, expenses) {
    if (typeof Chart === 'undefined') return;

    // Sales by month (last 6 months)
    const salesCtx = document.getElementById('salesChart');
    if (salesCtx) {
        const monthData = {};
        const now = new Date();
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const mLabel = d.toLocaleString('es', { month: 'short' });
            monthData[mLabel] = 0;
        }

        sales.forEach(s => {
            const date = new Date(s.timestamp);
            if (date > new Date(now.getFullYear(), now.getMonth() - 5, 1)) {
                const mLabel = date.toLocaleString('es', { month: 'short' });
                if (monthData[mLabel] !== undefined) {
                    monthData[mLabel] += s.usd;
                }
            }
        });

        const sData = {
            labels: Object.keys(monthData),
            datasets: [{
                label: 'Ventas USD',
                data: Object.values(monthData),
                backgroundColor: 'rgba(255, 105, 180, 0.5)',
                borderColor: '#ff69b4',
                borderWidth: 1,
                borderRadius: 4
            }]
        };

        if (salesChart) {
            salesChart.data = sData;
            salesChart.update();
        } else {
            salesChart = new Chart(salesCtx, {
                type: 'bar',
                data: sData,
                options: {
                    responsive: true,
                    plugins: { legend: { display: false } },
                    scales: { 
                        y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.1)' } },
                        x: { grid: { display: false } }
                    }
                }
            });
        }
    }

    // Expenses by category
    const expCtx = document.getElementById('expensesChart');
    if (expCtx) {
        const catData = { mat: 0, machine: 0, delivery: 0, profit: 0 };
        expenses.forEach(e => {
            if (catData[e.category] !== undefined) {
                catData[e.category] += e.amount;
            }
        });

        const eData = {
            labels: ['Material', 'Máquina', 'Envío', 'Ganancia'],
            datasets: [{
                data: [catData.mat, catData.machine, catData.delivery, catData.profit],
                backgroundColor: ['#f43f5e', '#ff69b4', '#9ca3af', '#22c55e'],
                borderWidth: 0
            }]
        };

        if (expensesChart) {
            expensesChart.data = eData;
            expensesChart.update();
        } else {
            expensesChart = new Chart(expCtx, {
                type: 'doughnut',
                data: eData,
                options: {
                    responsive: true,
                    plugins: { 
                        legend: { position: 'bottom', labels: { color: '#fff' } } 
                    },
                    cutout: '70%'
                }
            });
        }
    }
}

export function updateKPIs(totalUsd, totalProfit, ordersCount) {
    const ordersEl = document.getElementById('kpiOrders');
    const ticketEl = document.getElementById('kpiTicket');
    const marginEl = document.getElementById('kpiMargin');

    if (ordersEl) ordersEl.textContent = ordersCount.toString();
    
    if (ticketEl) {
        const avg = ordersCount > 0 ? totalUsd / ordersCount : 0;
        ticketEl.textContent = formatUSD(avg);
    }
    
    if (marginEl) {
        const marginStr = totalUsd > 0 ? ((totalProfit / totalUsd) * 100).toFixed(1) + '%' : '0%';
        marginEl.textContent = marginStr;
    }
}
