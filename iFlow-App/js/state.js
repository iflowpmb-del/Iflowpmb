import { Timestamp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

export const WALLET_CONFIG = {
  ars: { name: 'Efectivo (ARS)', currency: 'ARS', icon: 'fas fa-money-bill-wave' },
  mp: { name: 'Digital (ARS)', currency: 'ARS', icon: 'fas fa-credit-card' },
  usd: { name: 'Dólares (USD)', currency: 'USD', icon: 'fas fa-dollar-sign' },
  usdt: { name: 'USDT', currency: 'USDT', icon: 'fas fa-coins' },
  clientDebt: {
    name: 'Deudas Clientes (USD)',
    currency: 'USD',
    icon: 'fas fa-hand-holding-dollar',
    type: 'asset',
  },
  debt: { name: 'Deudas (USD)', currency: 'USD', icon: 'fas fa-receipt', type: 'liability' },
};

// =================================================================================
// >>>>>>>>>> INICIO DE LA MODIFICACIÓN: BASE DE DATOS DE PRODUCTOS AMPLIADA Y CORREGIDA <<<<<<<<<<
// Se añaden las líneas completas de iPhone 11 y 12, con sus respectivas opciones.
// =================================================================================
export const DEFAULT_CATEGORIES = [
  // --- Apple Products ---
  {
    id: 'iphone',
    name: 'iPhone',
    attributes: [
      {
        id: 'model',
        name: 'Producto',
        type: 'select',
        options: [
          'iPhone 16 Pro Max',
          'iPhone 16 Pro',
          'iPhone 16 Plus',
          'iPhone 16',
          'iPhone 15 Pro Max',
          'iPhone 15 Pro',
          'iPhone 15 Plus',
          'iPhone 15',
          'iPhone 14 Pro Max',
          'iPhone 14 Pro',
          'iPhone 14 Plus',
          'iPhone 14',
          'iPhone 13 Pro Max',
          'iPhone 13 Pro',
          'iPhone 13',
          'iPhone 12 Pro Max',
          'iPhone 12 Pro',
          'iPhone 12',
          'iPhone 12 mini',
          'iPhone 11 Pro Max',
          'iPhone 11 Pro',
          'iPhone 11',
        ],
        required: true,
      },
      {
        id: 'storage',
        name: 'Almacenamiento',
        type: 'select',
        dependsOn: 'model',
        options: {
          'iPhone 16 Pro Max': ['256GB', '512GB', '1TB'],
          'iPhone 16 Pro': ['256GB', '512GB', '1TB'],
          'iPhone 16 Plus': ['128GB', '256GB', '512GB'],
          'iPhone 16': ['128GB', '256GB', '512GB'],
          'iPhone 15 Pro Max': ['256GB', '512GB', '1TB'],
          'iPhone 15 Pro': ['128GB', '256GB', '512GB', '1TB'],
          'iPhone 15 Plus': ['128GB', '256GB', '512GB'],
          'iPhone 15': ['128GB', '256GB', '512GB'],
          'iPhone 14 Pro Max': ['128GB', '256GB', '512GB', '1TB'],
          'iPhone 14 Pro': ['128GB', '256GB', '512GB', '1TB'],
          'iPhone 14 Plus': ['128GB', '256GB', '512GB'],
          'iPhone 14': ['128GB', '256GB', '512GB'],
          'iPhone 13 Pro Max': ['128GB', '256GB', '512GB', '1TB'],
          'iPhone 13 Pro': ['128GB', '256GB', '512GB', '1TB'],
          'iPhone 13': ['128GB', '256GB', '512GB'],
          'iPhone 12 Pro Max': ['128GB', '256GB', '512GB'],
          'iPhone 12 Pro': ['128GB', '256GB', '512GB'],
          'iPhone 12': ['64GB', '128GB', '256GB'],
          'iPhone 12 mini': ['64GB', '128GB', '256GB'],
          'iPhone 11 Pro Max': ['64GB', '256GB', '512GB'],
          'iPhone 11 Pro': ['64GB', '256GB', '512GB'],
          'iPhone 11': ['64GB', '128GB', '256GB'],
        },
        required: true,
      },
      {
        id: 'color',
        name: 'Color',
        type: 'select',
        dependsOn: 'model',
        options: {
          'iPhone 16 Pro Max': [
            'Titanio Desierto',
            'Titanio Gris',
            'Titanio Blanco',
            'Titanio Negro Espacial',
          ],
          'iPhone 16 Pro': [
            'Titanio Desierto',
            'Titanio Gris',
            'Titanio Blanco',
            'Titanio Negro Espacial',
          ],
          'iPhone 16 Plus': ['Rosa', 'Amarillo', 'Azul', 'Verde', 'Negro', 'Blanco'],
          'iPhone 16': ['Rosa', 'Amarillo', 'Azul', 'Verde', 'Negro', 'Blanco'],
          'iPhone 15 Pro Max': [
            'Titanio Natural',
            'Titanio Azul',
            'Titanio Blanco',
            'Titanio Negro',
          ],
          'iPhone 15 Pro': ['Titanio Natural', 'Titanio Azul', 'Titanio Blanco', 'Titanio Negro'],
          'iPhone 15 Plus': ['Rosa', 'Amarillo', 'Verde', 'Azul', 'Negro'],
          'iPhone 15': ['Rosa', 'Amarillo', 'Verde', 'Azul', 'Negro'],
          'iPhone 14 Pro Max': ['Morado Oscuro', 'Oro', 'Plata', 'Negro Espacial'],
          'iPhone 14 Pro': ['Morado Oscuro', 'Oro', 'Plata', 'Negro Espacial'],
          'iPhone 14 Plus': ['Azul', 'Morado', 'Medianoche', 'Starlight', 'Rojo'],
          'iPhone 14': ['Azul', 'Morado', 'Medianoche', 'Starlight', 'Rojo'],
          'iPhone 13 Pro Max': ['Verde Alpino', 'Plata', 'Oro', 'Grafito', 'Azul Sierra'],
          'iPhone 13 Pro': ['Verde Alpino', 'Plata', 'Oro', 'Grafito', 'Azul Sierra'],
          'iPhone 13': ['Verde', 'Rosa', 'Azul', 'Medianoche', 'Starlight', 'Rojo'],
          'iPhone 12 Pro Max': ['Plata', 'Grafito', 'Oro', 'Azul Pacífico'],
          'iPhone 12 Pro': ['Plata', 'Grafito', 'Oro', 'Azul Pacífico'],
          'iPhone 12': ['Negro', 'Blanco', 'Rojo', 'Verde', 'Azul', 'Púrpura'],
          'iPhone 12 mini': ['Negro', 'Blanco', 'Rojo', 'Verde', 'Azul', 'Púrpura'],
          'iPhone 11 Pro Max': ['Verde Medianoche', 'Plata', 'Gris Espacial', 'Oro'],
          'iPhone 11 Pro': ['Verde Medianoche', 'Plata', 'Gris Espacial', 'Oro'],
          'iPhone 11': ['Negro', 'Blanco', 'Rojo', 'Verde', 'Amarillo', 'Púrpura'],
        },
        required: true,
      },
      {
        id: 'grade',
        name: 'Grado',
        type: 'select',
        options: ['Caja Sellada', 'A+', 'A', 'B', 'C'],
        required: true,
      },
      { id: 'battery', name: 'Batería (%)', type: 'number', required: false },
    ],
  },
  {
    id: 'macbook',
    name: 'MacBook',
    attributes: [
      {
        id: 'model',
        name: 'Producto',
        type: 'select',
        options: [
          'MacBook Air M4 13"',
          'MacBook Air M4 15"',
          'MacBook Pro M4 14"',
          'MacBook Pro M4 Pro/Max 14"',
          'MacBook Pro M4 Pro/Max 16"',
          'MacBook Air M3 13"',
          'MacBook Air M3 15"',
          'MacBook Air M2 13"',
          'MacBook Air M2 15"',
          'MacBook Air M1 13"',
          'MacBook Pro M3 14"',
          'MacBook Pro M3 Pro/Max 14"',
          'MacBook Pro M3 Pro/Max 16"',
        ],
        required: true,
      },
      {
        id: 'ram',
        name: 'RAM',
        type: 'select',
        dependsOn: 'model',
        options: {
          'MacBook Air M4 13"': ['8GB', '16GB', '24GB'],
          'MacBook Air M4 15"': ['8GB', '16GB', '24GB'],
          'MacBook Pro M4 14"': ['8GB', '16GB', '24GB'],
          'MacBook Pro M4 Pro/Max 14"': ['18GB', '36GB', '48GB', '96GB'],
          'MacBook Pro M4 Pro/Max 16"': ['18GB', '36GB', '48GB', '96GB'],
          'MacBook Air M3 13"': ['8GB', '16GB', '24GB'],
          'MacBook Air M3 15"': ['8GB', '16GB', '24GB'],
          'MacBook Air M2 13"': ['8GB', '16GB', '24GB'],
          'MacBook Air M2 15"': ['8GB', '16GB', '24GB'],
          'MacBook Air M1 13"': ['8GB', '16GB'],
          'MacBook Pro M3 14"': ['8GB', '16GB', '24GB'],
          'MacBook Pro M3 Pro/Max 14"': ['18GB', '36GB', '48GB', '64GB', '96GB', '128GB'],
          'MacBook Pro M3 Pro/Max 16"': ['18GB', '36GB', '48GB', '64GB', '96GB', '128GB'],
        },
        required: true,
      },
      {
        id: 'storage',
        name: 'Almacenamiento',
        type: 'select',
        dependsOn: 'model',
        options: {
          'MacBook Air M4 13"': ['256GB', '512GB', '1TB', '2TB'],
          'MacBook Air M4 15"': ['256GB', '512GB', '1TB', '2TB'],
          'MacBook Pro M4 14"': ['512GB', '1TB', '2TB'],
          'MacBook Pro M4 Pro/Max 14"': ['512GB', '1TB', '2TB', '4TB'],
          'MacBook Pro M4 Pro/Max 16"': ['512GB', '1TB', '2TB', '4TB'],
          'MacBook Air M3 13"': ['256GB', '512GB', '1TB', '2TB'],
          'MacBook Air M3 15"': ['256GB', '512GB', '1TB', '2TB'],
          'MacBook Air M2 13"': ['256GB', '512GB', '1TB', '2TB'],
          'MacBook Air M2 15"': ['256GB', '512GB', '1TB', '2TB'],
          'MacBook Air M1 13"': ['256GB', '512GB', '1TB', '2TB'],
          'MacBook Pro M3 14"': ['512GB', '1TB', '2TB'],
          'MacBook Pro M3 Pro/Max 14"': ['512GB', '1TB', '2TB', '4TB', '8TB'],
          'MacBook Pro M3 Pro/Max 16"': ['512GB', '1TB', '2TB', '4TB', '8TB'],
        },
        required: true,
      },
      {
        id: 'grade',
        name: 'Grado',
        type: 'select',
        options: ['Caja Sellada', 'A+', 'A', 'B', 'C'],
        required: true,
      },
      { id: 'battery-cycles', name: 'Ciclos Batería', type: 'number', required: false },
    ],
  },
  {
    id: 'ipad',
    name: 'iPad',
    attributes: [
      {
        id: 'model',
        name: 'Producto',
        type: 'select',
        options: [
          'iPad Pro 13" (M4)',
          'iPad Pro 11" (M4)',
          'iPad Air 13" (M2)',
          'iPad Air 11" (M2)',
          'iPad (10th Gen)',
          'iPad Mini (6th Gen)',
        ],
        required: true,
      },
      {
        id: 'storage',
        name: 'Almacenamiento',
        type: 'select',
        dependsOn: 'model',
        options: {
          'iPad Pro 13" (M4)': ['256GB', '512GB', '1TB', '2TB'],
          'iPad Pro 11" (M4)': ['256GB', '512GB', '1TB', '2TB'],
          'iPad Air 13" (M2)': ['128GB', '256GB', '512GB', '1TB'],
          'iPad Air 11" (M2)': ['128GB', '256GB', '512GB', '1TB'],
          'iPad (10th Gen)': ['64GB', '256GB'],
          'iPad Mini (6th Gen)': ['64GB', '256GB'],
        },
        required: true,
      },
      {
        id: 'connectivity',
        name: 'Conectividad',
        type: 'select',
        options: ['Wi-Fi', 'Wi-Fi + Cellular'],
        required: true,
      },
      {
        id: 'grade',
        name: 'Grado',
        type: 'select',
        options: ['Caja Sellada', 'A+', 'A', 'B', 'C'],
        required: true,
      },
    ],
  },
  {
    id: 'apple-watch',
    name: 'Apple Watch',
    attributes: [
      {
        id: 'model',
        name: 'Producto',
        type: 'select',
        options: [
          'Apple Watch Ultra 3',
          'Apple Watch Series 10',
          'Apple Watch Ultra 2',
          'Apple Watch Series 9',
          'Apple Watch SE',
        ],
        required: true,
      },
      {
        id: 'size',
        name: 'Tamaño',
        type: 'select',
        dependsOn: 'model',
        options: {
          'Apple Watch Ultra 3': ['49mm'],
          'Apple Watch Series 10': ['41mm', '45mm'],
          'Apple Watch Ultra 2': ['49mm'],
          'Apple Watch Series 9': ['41mm', '45mm'],
          'Apple Watch SE': ['40mm', '44mm'],
        },
        required: true,
      },
      {
        id: 'material',
        name: 'Material',
        type: 'select',
        dependsOn: 'model',
        options: {
          'Apple Watch Ultra 3': ['Titanio'],
          'Apple Watch Series 10': ['Aluminio', 'Acero Inoxidable'],
          'Apple Watch Ultra 2': ['Titanio'],
          'Apple Watch Series 9': ['Aluminio', 'Acero Inoxidable'],
          'Apple Watch SE': ['Aluminio'],
        },
        required: true,
      },
      {
        id: 'grade',
        name: 'Grado',
        type: 'select',
        options: ['Caja Sellada', 'A+', 'A', 'B', 'C'],
        required: true,
      },
      { id: 'battery', name: 'Batería (%)', type: 'number', required: false },
    ],
  },
  // --- Xiaomi ---
  {
    id: 'xiaomi',
    name: 'Xiaomi',
    attributes: [
      { id: 'model', name: 'Producto', type: 'select', options: ['Redmi 14c'], required: true },
      {
        id: 'config',
        name: 'Configuración',
        type: 'select',
        dependsOn: 'model',
        options: {
          'Redmi 14c': ['128GB / 8GB RAM', '256GB / 16GB RAM'],
        },
        required: true,
      },
      { id: 'color', name: 'Color', type: 'text', required: false },
      { id: 'grade', name: 'Grado', type: 'select', options: ['Nuevo', 'Usado'], required: true },
    ],
  },
  // --- Consolas y Electrónica ---
  {
    id: 'consolas-electronica',
    name: 'Consolas y Electrónica',
    attributes: [
      {
        id: 'product',
        name: 'Producto',
        type: 'select',
        options: ['PlayStation 5', 'Android TV', 'Proyector Ultra HD'],
        required: true,
      },
      {
        id: 'spec',
        name: 'Especificación',
        type: 'select',
        dependsOn: 'product',
        options: {
          'PlayStation 5': ['Digital 1TB'],
          'Android TV': ['Calidad TOP (Magic Instalado)'],
          'Proyector Ultra HD': ['Estándar'],
        },
        required: true,
      },
    ],
  },
  // --- Auriculares ---
  {
    id: 'auriculares',
    name: 'Auriculares',
    attributes: [
      {
        id: 'model',
        name: 'Producto',
        type: 'select',
        options: ['AirPods Pro 2da Gen', 'AirPods 4ta Gen', 'AirPods Max', 'InPods 12'],
        required: true,
      },
      {
        id: 'type',
        name: 'Tipo',
        type: 'select',
        dependsOn: 'model',
        options: {
          'AirPods Pro 2da Gen': ['Original', 'Réplica'],
          'AirPods 4ta Gen': ['Original', 'Réplica'],
          'AirPods Max': ['Original', 'Réplica'],
          'InPods 12': ['Réplica'],
        },
        required: true,
      },
    ],
  },
  // --- Parlantes ---
  {
    id: 'parlantes',
    name: 'Parlantes',
    attributes: [
      {
        id: 'model',
        name: 'Producto',
        type: 'select',
        options: ['JBL GO 4', 'JBL Charge 6 Flip', 'JBL Charge 7 Flip', 'Astronauta Parlante'],
        required: true,
      },
      {
        id: 'spec',
        name: 'Especificación',
        type: 'select',
        dependsOn: 'model',
        options: {
          'JBL GO 4': ['Certificado'],
          'JBL Charge 6 Flip': ['Estándar'],
          'JBL Charge 7 Flip': ['Estándar'],
          'Astronauta Parlante': ['Estándar'],
        },
        required: true,
      },
    ],
  },
  // --- Smartwatches (Replicas) ---
  {
    id: 'smartwatches-replicas',
    name: 'Smartwatches (Réplicas)',
    attributes: [
      {
        id: 'model',
        name: 'Producto',
        type: 'select',
        options: ['Apple Watch Ultra 2 Réplica', 'Apple Watch Series 10 Réplica'],
        required: true,
      },
      {
        id: 'spec',
        name: 'Especificación',
        type: 'select',
        dependsOn: 'model',
        options: {
          'Apple Watch Ultra 2 Réplica': ['49mm'],
          'Apple Watch Series 10 Réplica': ['46mm'],
        },
        required: true,
      },
    ],
  },
  // --- Perfumería ---
  {
    id: 'perfumeria',
    name: 'Perfumería',
    attributes: [
      {
        id: 'product',
        name: 'Producto',
        type: 'select',
        options: ["Splash Victoria's Secret", "Crema Victoria's Secret", 'Perfume Árabe'],
        required: true,
      },
      {
        id: 'type',
        name: 'Tipo',
        type: 'select',
        dependsOn: 'product',
        options: {
          "Splash Victoria's Secret": ['Original', 'Réplica'],
          "Crema Victoria's Secret": ['Original'],
          'Perfume Árabe': ['Original'],
        },
        required: true,
      },
      { id: 'fragrance', name: 'Fragancia/Modelo', type: 'text', required: true },
    ],
  },
  // --- Accesorios Apple ---
  {
    id: 'accesorios-apple',
    name: 'Accesorios Apple',
    attributes: [
      {
        id: 'product',
        name: 'Producto',
        type: 'select',
        options: [
          'AirTag',
          'Cable USB-C a Lightning',
          'Cable USB-C a USB-C',
          'Cargador 20W',
          'Combo Cargador + Cable',
        ],
        required: true,
      },
      {
        id: 'type',
        name: 'Tipo',
        type: 'select',
        dependsOn: 'product',
        options: {
          AirTag: ['Original'],
          'Cable USB-C a Lightning': ['Original', 'Réplica'],
          'Cable USB-C a USB-C': ['Original', 'Réplica'],
          'Cargador 20W': ['Original', 'Réplica AAA+'],
          'Combo Cargador + Cable': ['Original', 'Réplica AAA+'],
        },
        required: true,
      },
    ],
  },
  // --- Accesorios Celulares ---
  {
    id: 'accesorios-celulares',
    name: 'Accesorios Celulares',
    attributes: [
      {
        id: 'product',
        name: 'Producto',
        type: 'select',
        options: ['Vidrio Templado', 'Funda Transparente', 'Funda Silicona'],
        required: true,
      },
      { id: 'spec', name: 'Modelo/Especificación', type: 'text', required: true },
    ],
  },
  // --- Hogar ---
  {
    id: 'hogar',
    name: 'Hogar',
    attributes: [
      {
        id: 'product',
        name: 'Producto',
        type: 'select',
        options: ['Aspiradora Robot', 'Inflador Portátil'],
        required: true,
      },
    ],
  },
  // --- Hidratación & Lifestyle ---
  {
    id: 'hidratacion-lifestyle',
    name: 'Hidratación & Lifestyle',
    attributes: [
      {
        id: 'product',
        name: 'Producto',
        type: 'select',
        options: ['Quencher STANLEY', 'Set STANLEY'],
        required: true,
      },
      {
        id: 'spec',
        name: 'Especificación',
        type: 'select',
        dependsOn: 'product',
        options: {
          'Quencher STANLEY': ['Estándar'],
          'Set STANLEY': ['Termo 1.2L + Mate 236ml'],
        },
        required: true,
      },
      { id: 'color', name: 'Color', type: 'text', required: false },
    ],
  },
  // --- Vapeadores ---
  {
    id: 'vapeadores',
    name: 'Vapeadores',
    attributes: [
      {
        id: 'model',
        name: 'Producto',
        type: 'select',
        options: ['Elfbar 40.000', 'Lost Mary Mixer 30k', 'Ignite V250', 'Otro'],
        required: true,
      },
      { id: 'flavor', name: 'Sabor/Especificación', type: 'text', required: true },
    ],
  },
  // --- Categoría Genérica ---
  {
    id: 'other',
    name: 'Otro (Personalizado)',
    attributes: [
      { id: 'product-type', name: 'Producto', type: 'text', required: true },
      { id: 'brand', name: 'Marca', type: 'text', required: false },
      { id: 'model', name: 'Especificación/Modelo', type: 'text', required: false },
      {
        id: 'condition',
        name: 'Condición',
        type: 'select',
        options: ['Nuevo', 'Usado'],
        required: false,
      },
    ],
  },
];
// =================================================================================
// >>>>>>>>>> FIN DE LA MODIFICACIÓN <<<<<<<<<<
// =================================================================================

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
  // INICIO CAMBIO: Se añade capitalHistory al estado inicial.
  capitalHistory: null,
  // FIN CAMBIO
  reservations: null,
  salespeople: null,
  userProviders: null,
  clientDebtPayments: null,
  providerDebtPayments: null,

  exchangeRate: 1000,

  clientSearchTerm: '',
  stockSearchTerm: '',
  salesSearchTerm: '',
  expensesSearchTerm: '',
  providersSearchTerm: '',
  notesSearchTerm: '',
  reservationsSearchTerm: '',
  salespeopleSearchTerm: '',
  userProvidersSearchTerm: '',

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
    // INICIO CAMBIO: Se añade el estado para la sub-pestaña de Billeteras.
    activeCapitalSubTab: 'principal',
    // FIN CAMBIO
    activeSalesSubTab: 'nueva',
    activeOperacionesSubTab: 'gastos',
    // =================================================================================
    // INICIO DE MODIFICACIÓN: Se añaden estados para las pestañas de deudas
    // =================================================================================
    activeClientesSubTab: 'lista',
    activeOperacionesDebtsTab: 'pendientes', // 'pendientes' o 'historial'
    activeClientesDebtsTab: 'pendientes', // 'pendientes' o 'historial'
    // =================================================================================
    // FIN DE MODIFICACIÓN
    // =================================================================================
    // INICIO DE LA MODIFICACIÓN
    capital: {
      capitalPeriod: 'month',
      capitalCustomStartDate: '',
      capitalCustomEndDate: '',
    },
    // FIN DE LA MODIFICACIÓN
    dashboard: {
      dashboardPeriod: 'month',
      dashboardCustomStartDate: '',
      dashboardCustomEndDate: '',
    },
    analysis: {
      analysisPeriod: 'month',
      analysisCustomStartDate: '',
      analysisCustomEndDate: '',
    },
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
    quantity: 1,
    isFormVisible: false,
    productSearchTerm: '', // Nuevo estado para el buscador
  },
  sale: {
    clientSearchTerm: '',
    stockSearchTerm: '',
    selectedClient: null,
    items: [],
    discount: 0,
    saleCosts: 0,
  },
  categoryManager: {
    selectedCategoryId: null,
    isEditingCategoryName: false,
    newAttribute: {
      name: '',
      type: 'text',
      options: '',
    },
  },
};

export let appState = { ...initialState };
let listeners = [];

export function subscribe(listener) {
  listeners.push(listener);
  return function unsubscribe() {
    listeners = listeners.filter((l) => l !== listener);
  };
}

function notify() {
  [...listeners].forEach((listener) => listener(appState));
}

export function setState(newState) {
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
      capital: { ...appState.ui.capital, ...newState.ui.capital },
      dashboard: { ...appState.ui.dashboard, ...newState.ui.dashboard },
      analysis: { ...appState.ui.analysis, ...newState.ui.analysis },
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
export function addFirebaseListener(unsubscribe) {
  firebaseUnsubscribes.push(unsubscribe);
}
export function clearFirebaseListeners() {
  firebaseUnsubscribes.forEach((unsub) => unsub());
  firebaseUnsubscribes = [];
}

export let charts = {
  performance: null,
  expenseBreakdown: null,
  netProfitCategory: null,
  salesMetrics: null,
  capitalGrowth: null,
  salesAnalysis: null,
};
