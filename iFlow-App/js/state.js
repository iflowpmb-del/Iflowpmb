import { Timestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

export const WALLET_CONFIG = {
    ars: { name: "Efectivo (ARS)", currency: "ARS", icon: "fas fa-money-bill-wave" },
    mp: { name: "Digital (ARS)", currency: "ARS", icon: "fas fa-credit-card" },
    usd: { name: "Dólares (USD)", currency: "USD", icon: "fas fa-dollar-sign" },
    usdt: { name: "USDT", currency: "USDT", icon: "fas fa-coins" },
    clientDebt: { name: "Deudas Clientes (USD)", currency: "USD", icon: "fas fa-hand-holding-dollar", type: 'asset' },
    debt: { name: "Deudas (USD)", currency: "USD", icon: "fas fa-receipt", type: 'liability' }
};

export const DEFAULT_CATEGORIES = [
    {
        id: 'iphone',
        name: "iPhone",
        attributes: [
            { id: 'attr-model', name: "Modelo", type: "select", options: ["iPhone 16 Pro Max", "iPhone 16 Pro", "iPhone 16 Plus", "iPhone 16", "iPhone 15 Pro Max", "iPhone 15 Pro", "iPhone 15 Plus", "iPhone 15", "iPhone 14 Pro Max", "iPhone 14 Pro", "iPhone 14 Plus", "iPhone 14", "iPhone 13 Pro Max", "iPhone 13 Pro", "iPhone 13", "iPhone 13 mini", "iPhone 12 Pro Max", "iPhone 12 Pro", "iPhone 12", "iPhone 12 mini", "iPhone 11 Pro Max", "iPhone 11 Pro", "iPhone 11", "iPhone SE (3rd Gen)", "iPhone SE (2nd Gen)", "iPhone XS Max", "iPhone XS", "iPhone XR", "iPhone X", "iPhone 8 Plus", "iPhone 8"], required: true },
            { id: 'attr-grade', name: "Grado", type: "select", options: ["Caja Sellada", "A+", "A", "B", "C"], required: true },
            { id: 'attr-battery', name: "Batería", type: "number", unit: "%", required: false },
            { id: 'attr-storage', name: "Almacenamiento", type: "text", unit: "GB", required: false },
            { id: 'attr-color', name: "Color", type: "text", required: false }
        ]
    },
    {
        id: 'ipad',
        name: "iPad",
        attributes: [
            { id: 'attr-model', name: "Modelo", type: "select", options: ["iPad Pro 12.9\" (6th Gen)", "iPad Pro 11\" (4th Gen)", "iPad Air (5th Gen)", "iPad (10th Gen)", "iPad (9th Gen)", "iPad mini (6th Gen)", "iPad Pro 12.9\" (5th Gen)", "iPad Pro 11\" (3rd Gen)", "iPad Air (4th Gen)", "iPad mini (5th Gen)"], required: true },
            { id: 'attr-grade', name: "Grado", type: "select", options: ["Caja Sellada", "A+", "A", "B", "C"], required: true },
            { id: 'attr-storage', name: "Almacenamiento", type: "text", unit: "GB", required: false },
            { id: 'attr-connectivity', name: "Conectividad", type: "select", options: ["Wi-Fi", "Wi-Fi + Cellular"], required: false },
            { id: 'attr-color', name: "Color", type: "text", required: false }
        ]
    },
    {
        id: 'macbook',
        name: "MacBook",
        attributes: [
            { id: 'attr-model', name: "Modelo", type: "select", options: ["MacBook Air 13\" (M3)", "MacBook Air 15\" (M3)", "MacBook Air 13\" (M2)", "MacBook Air 15\" (M2)", "MacBook Air (M1)", "MacBook Pro 14\" (M3)", "MacBook Pro 14\" (M3 Pro/Max)", "MacBook Pro 16\" (M3 Pro/Max)", "MacBook Pro 13\" (M2)", "MacBook Pro 14\" (M2 Pro/Max)", "MacBook Pro 16\" (M2 Pro/Max)"], required: true },
            { id: 'attr-grade', name: "Grado", type: "select", options: ["Caja Sellada", "A+", "A", "B", "C"], required: true },
            { id: 'attr-cpu', name: "Procesador", type: "text", required: false },
            { id: 'attr-ram', name: "RAM", type: "number", unit: "GB", required: false },
            { id: 'attr-storage', name: "Almacenamiento", type: "text", unit: "GB/TB", required: false },
            { id: 'attr-battery-cycles', name: "Ciclos Batería", type: "number", required: false },
        ]
    },
    { 
        id: 'watch', 
        name: "Apple Watch", 
        attributes: [
            { id: 'attr-model', name: "Modelo", type: "select", options: ["Series 9", "Ultra 2", "SE (2nd Gen)", "Series 8", "Ultra", "SE (1st Gen)", "Series 7", "Series 6", "Series 5", "Series 4", "Series 3"], required: true },
            { id: 'attr-size', name: "Tamaño", type: "select", options: ["38mm", "40mm", "41mm", "42mm", "44mm", "45mm", "49mm"], required: true },
            { id: 'attr-material', name: "Material", type: "select", options: ["Aluminio", "Acero Inoxidable", "Titanio"], required: false },
            { id: 'attr-color', name: "Color", type: "text", required: false },
            { id: 'attr-battery', name: "Batería", type: "number", unit: "%", required: false },
        ] 
    },
    { 
        id: 'other', 
        name: "Otro", 
        attributes: [
            { id: 'attr-product-type', name: "Tipo de Producto", type: "text", placeholder: "Parlante, Vaso Térmico, etc.", required: true },
            { id: 'attr-brand', name: "Marca", type: "text", required: false },
            { id: 'attr-model', name: "Modelo", type: "text", required: false },
            { id: 'attr-color', name: "Color", type: "text", required: false },
            { id: 'attr-condition', name: "Condición", type: "select", options: ["Nuevo", "Usado - Como Nuevo", "Usado - Buen Estado", "Usado - Con detalles"], required: false },
            { id: 'attr-material', name: "Material", type: "text", required: false },
        ] 
    }
];

const initialState = {
    user: null,
    profile: null,
    capital: null,
    stock: null,
    sales: null,
    clients: null,
    categories: null,
    debts: null,
    fixedExpenses: null,
    dailyExpenses: null,
    providers: null,
    notes: null,
    capitalHistory: null,
    exchangeRate: 1000,
    clientSearchTerm: '',
    stockSearchTerm: '',
    salesSearchTerm: '',
    expensesSearchTerm: '',
    providersSearchTerm: '',
    notesSearchTerm: '',
    isDataLoading: true,
    isInitialRender: true,
    ui: {
        collapsedSections: {
            ventas: false,
            stock: false,
            clientes: false,
            gastos: false,
            deudas: false,
        },
        activeSalesSubTab: 'nueva', 
        activeOperacionesSubTab: 'gastos',
        dashboard: {
            dashboardPeriod: 'month',
            dashboardCustomStartDate: '',
            dashboardCustomEndDate: ''
        },
        analysis: {
            analysisPeriod: 'month',
            analysisCustomStartDate: '',
            analysisCustomEndDate: ''
        }
    },
    addSaleForm: { isFormVisible: false },
    addClientForm: { isFormVisible: false },
    addDebtForm: { isFormVisible: false },
    addStockForm: {
        model: '',
        serialNumber: '',
        category: 'iPhone',
        phoneCost: '',
        suggestedSalePrice: '',
        quantity: 1, // <<<--- NUEVO CAMPO AÑADIDO AQUÍ
        isFormVisible: false
    },
    sale: {
        clientSearchTerm: '',
        stockSearchTerm: '',
        selectedClient: null,
        items: [],
        discount: 0,
        saleCosts: 0
    },
    categoryManager: {
        selectedCategoryId: null,
        isEditingCategoryName: false,
        newAttribute: {
            name: '',
            type: 'text',
            options: ''
        }
    }
};

export let appState = { ...initialState };
let listeners = [];

export function subscribe(listener) {
    listeners.push(listener);
    return function unsubscribe() {
        listeners = listeners.filter(l => l !== listener);
    };
}

function notify() {
    [...listeners].forEach(listener => listener(appState));
}

export function setState(newState) {
    // Deep merge for nested state objects to avoid overwriting
    if (newState.sale) {
        appState.sale = { ...appState.sale, ...newState.sale };
        delete newState.sale;
    }
    if (newState.addStockForm) {
        appState.addStockForm = { ...appState.addStockForm, ...newState.addStockForm };
        delete newState.addStockForm;
    }
    if (newState.addSaleForm) {
        appState.addSaleForm = { ...appState.addSaleForm, ...newState.addSaleForm };
        delete newState.addSaleForm;
    }
    if (newState.addClientForm) {
        appState.addClientForm = { ...appState.addClientForm, ...newState.addClientForm };
        delete newState.addClientForm;
    }
    if (newState.addDebtForm) {
        appState.addDebtForm = { ...appState.addDebtForm, ...newState.addDebtForm };
        delete newState.addDebtForm;
    }
    if (newState.ui) {
        appState.ui = { 
            ...appState.ui, 
            ...newState.ui,
            dashboard: { ...appState.ui.dashboard, ...newState.ui.dashboard },
            analysis: { ...appState.ui.analysis, ...newState.ui.analysis }
        };
        delete newState.ui;
    }
    if (newState.categoryManager) {
        appState.categoryManager = { ...appState.categoryManager, ...newState.categoryManager };
        delete newState.categoryManager;
    }

    appState = { ...appState, ...newState };
    notify();
}

export function resetState() {
    const newInitialState = JSON.parse(JSON.stringify(initialState));
    appState = newInitialState;
    notify();
}

let firebaseUnsubscribes = [];
export function addFirebaseListener(unsubscribe) { firebaseUnsubscribes.push(unsubscribe); }
export function clearFirebaseListeners() {
    firebaseUnsubscribes.forEach(unsub => unsub());
    firebaseUnsubscribes = [];
}

export let charts = { 
    performance: null, 
    expenseBreakdown: null, 
    netProfitCategory: null, 
    salesMetrics: null,
    capitalGrowth: null,
    salesAnalysis: null
};
