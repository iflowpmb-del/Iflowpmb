import { appState, setState, DEFAULT_CATEGORIES } from '../state.js';
import { formatCurrency, escapeHTML } from './utils.js';
import { showModal } from './modales.js';

/**
 * Renderiza todas las sub-secciones de la pestaña de Inventario.
 * @param {object} state El estado actual de la aplicación.
 */
export function renderInventorySections(state) {
  renderStockSection(state);
  renderAddStockForm(state);
  renderCategoryManagerSection(state);
}

/**
 * Renderiza la lista de productos en stock, con diseño adaptable.
 * @param {object} state El estado actual de la aplicación.
 */
function renderStockSection(state) {
  if (!state.stock) return;
  const stockListContainer = document.getElementById('stock-list-container-consultas');
  const noStockMessage = document.getElementById('no-stock-message-consultas');
  const searchInput = document.getElementById('stock-search-input');
  if (!stockListContainer || !noStockMessage || !searchInput) return;

  if (searchInput.value !== state.stockSearchTerm) {
    searchInput.value = state.stockSearchTerm;
  }
  const searchTerm = (state.stockSearchTerm || '').toLowerCase();
  const filteredStock = state.stock.filter((item) => {
    return (
      (item.model || '').toLowerCase().includes(searchTerm) ||
      (item.serialNumber || '').toLowerCase().includes(searchTerm) ||
      (item.category || '').toLowerCase().includes(searchTerm)
    );
  });
  const groupedStock = filteredStock.reduce((acc, item) => {
    const category = item.category || 'Sin Categoría';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(item);
    return acc;
  }, {});

  const sortedCategories = Object.keys(groupedStock).sort();
  noStockMessage.classList.toggle('hidden', state.stock.length > 0);
  if (filteredStock.length === 0 && searchTerm) {
    stockListContainer.innerHTML = `<p class="text-center text-gray-500 py-8">No se encontraron productos para "${escapeHTML(
      state.stockSearchTerm
    )}".</p>`;
    return;
  }

  if (sortedCategories.length > 0) {
    stockListContainer.innerHTML = sortedCategories
      .map((category) => {
        // --- HTML para la vista de tarjetas (móvil) ---
        const cardsHTML = groupedStock[category]
          .map((item) => {
            const isReserved = item.status === 'reservado';
            const cardClass = isReserved ? 'opacity-60 bg-yellow-50' : 'bg-white';
            const reservedTag = isReserved
              ? '<span class="text-xs bg-yellow-400 text-yellow-900 font-bold px-2 py-1 rounded-full absolute top-2 right-2">Reservado</span>'
              : '';

            const attributesHtml = item.attributes
              ? Object.entries(item.attributes)
                  .filter(([key, value]) => value)
                  .sort((a, b) => a[0].localeCompare(b[0]))
                  .map(
                    ([key, value]) =>
                      `<span class="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded-full">${escapeHTML(
                        key
                      )}: ${escapeHTML(String(value))}</span>`
                  )
                  .join(' ')
              : '';

            const providerHtml = item.providerName
              ? `<p class="text-xs text-gray-500 mt-1"><i class="fas fa-truck mr-1"></i> ${escapeHTML(
                  item.providerName
                )}</p>`
              : '';

            return `
            <div class="stock-item-card card p-4 relative ${cardClass} hover:shadow-lg transition-shadow">
                ${reservedTag}
                <div class="flex-grow">
                    <p class="font-bold text-lg pr-20">${escapeHTML(item.model)}</p>
                    <p class="text-sm text-gray-500 font-mono">${escapeHTML(item.serialNumber)}</p>
                    ${providerHtml}
                    <div class="flex flex-wrap gap-1 mt-2">
                        ${attributesHtml}
                    </div>
                </div>
                <div class="grid grid-cols-3 gap-2 mt-4 pt-4 border-t text-center">
                    <div>
                        <p class="text-xs text-gray-500">Cantidad</p>
                        <p class="font-bold text-lg">${item.quantity || 1}</p>
                    </div>
                    <div>
                        <p class="text-xs text-gray-500">Costo</p>
                        <p class="font-semibold">${formatCurrency(item.phoneCost, 'USD')}</p>
                    </div>
                    <div>
                        <p class="text-xs text-gray-500">P. Sugerido</p>
                        <p class="font-semibold text-green-600">${formatCurrency(
                          item.suggestedSalePrice || 0,
                          'USD'
                        )}</p>
                    </div>
                </div>
                <div class="absolute top-2 right-2 flex items-center gap-2">
                    <button class="edit-stock-btn text-blue-500 hover:text-blue-700 p-2" data-id="${
                      item.id
                    }"><i class="fas fa-edit"></i></button>
                    <button class="delete-stock-btn text-red-500 hover:text-red-700 p-2" data-id="${
                      item.id
                    }"><i class="fas fa-trash-alt"></i></button>
                </div>
            </div>`;
          })
          .join('');

        // --- HTML para la vista de tabla (escritorio) ---
        const rowsHTML = groupedStock[category]
          .map((item) => {
            const isReserved = item.status === 'reservado';
            const reservedDesktopTag = isReserved
              ? '<span class="text-xs bg-yellow-200 text-yellow-800 px-2 rounded-full ml-2">Reservado</span>'
              : '';

            const attributesHtml = item.attributes
              ? Object.entries(item.attributes)
                  .filter(([key, value]) => value)
                  .map(([key, value]) => `${escapeHTML(key)}: ${escapeHTML(String(value))}`)
                  .join(', ')
              : '';

            return `
            <tr class="stock-item-row ${isReserved ? 'bg-yellow-50' : ''}">
                <td>
                    <p class="font-semibold">${escapeHTML(item.model)}${reservedDesktopTag}</p>
                    <p class="text-xs text-gray-500 font-mono">${escapeHTML(item.serialNumber)}</p>
                    <p class="text-xs text-gray-500">${attributesHtml}</p>
                </td>
                <td class="text-center">${item.quantity || 1}</td>
                <td class="text-center">${formatCurrency(item.phoneCost, 'USD')}</td>
                <td class="text-center text-green-600 font-semibold">${formatCurrency(
                  item.suggestedSalePrice || 0,
                  'USD'
                )}</td>
                <td class="text-right whitespace-nowrap">
                    <button class="edit-stock-btn text-blue-500 hover:text-blue-700 p-2" data-id="${
                      item.id
                    }"><i class="fas fa-edit"></i></button>
                    <button class="delete-stock-btn text-red-500 hover:text-red-700 p-2" data-id="${
                      item.id
                    }"><i class="fas fa-trash-alt"></i></button>
                </td>
            </tr>
            `;
          })
          .join('');

        return `
        <div class="category-group">
            <h4 class="text-xl font-bold text-gray-700 mb-3 pb-2 border-b">${escapeHTML(
              category
            )}</h4>
            
            <!-- Contenedor para vista móvil (Tarjetas) -->
            <div class="stock-list-grid">
                ${cardsHTML}
            </div>

            <!-- Contenedor para vista escritorio (Tabla) -->
            <table class="stock-table-container w-full">
                <thead class="stock-table-header">
                    <tr>
                        <th>Producto</th>
                        <th class="text-center">Cantidad</th>
                        <th class="text-center">Costo</th>
                        <th class="text-center">P. Sugerido</th>
                        <th class="text-right">Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHTML}
                </tbody>
            </table>
        </div>
        `;
      })
      .join('');
  } else if (state.stock.length > 0) {
    stockListContainer.innerHTML = `<p class="text-center text-gray-500 py-8">No se encontraron productos que coincidan con la búsqueda.</p>`;
  } else {
    stockListContainer.innerHTML = '';
  }
}

/**
 * Renderiza el formulario para añadir un nuevo producto al stock.
 * @param {object} state El estado actual de la aplicación.
 */
export function renderAddStockForm(state) {
  const form = document.getElementById('stock-form-register');
  if (!form) return;

  const { addStockForm, categories, userProviders } = state;
  const { productSearchTerm, autofillData } = addStockForm;

  const allCategories = [...DEFAULT_CATEGORIES];
  const userCategories = categories || [];
  userCategories.forEach((uc) => {
    const existingIndex = allCategories.findIndex((dc) => dc.id === uc.id);
    if (existingIndex > -1) {
      allCategories[existingIndex] = uc;
    } else {
      allCategories.push(uc);
    }
  });

  const currentValues = {};
  form.querySelectorAll('select, input, textarea').forEach((el) => {
    if (el.id) currentValues[el.id] = el.value;
  });

  const selectedCategoryName =
    autofillData?.category || currentValues['stock-category-reg'] || 'iPhone';
  const selectedCategory = allCategories.find((c) => c.name === selectedCategoryName);

  const searchInput = document.getElementById('product-search-reg');
  const searchResultsContainer = document.getElementById('product-search-results-reg');
  if (searchInput && searchResultsContainer) {
    if (searchInput.value !== productSearchTerm) {
      searchInput.value = productSearchTerm;
    }

    if (productSearchTerm && productSearchTerm.length > 2) {
      const results = [];
      allCategories.forEach((cat) => {
        const productAttr = cat.attributes.find(
          (attr) => attr.id === 'model' || attr.id === 'product'
        );
        if (productAttr && Array.isArray(productAttr.options)) {
          productAttr.options.forEach((prodName) => {
            if (prodName.toLowerCase().includes(productSearchTerm.toLowerCase())) {
              results.push({ category: cat.name, product: prodName });
            }
          });
        }
      });
      searchResultsContainer.innerHTML =
        results.length > 0
          ? results
              .map(
                (r) =>
                  `<div class="p-3 hover:bg-gray-100 cursor-pointer product-search-result" data-category="${escapeHTML(
                    r.category
                  )}" data-product="${escapeHTML(r.product)}">${escapeHTML(
                    r.product
                  )} <span class="text-xs text-gray-500">(${escapeHTML(r.category)})</span></div>`
              )
              .join('')
          : '<div class="p-3 text-gray-500">No se encontraron productos.</div>';
      searchResultsContainer.classList.remove('hidden');
    } else {
      searchResultsContainer.classList.add('hidden');
    }
  }

  const selectedProviderId = currentValues['stock-provider-reg'];
  const providerOptions = `
        <option value="no-asignar" ${
          selectedProviderId === 'no-asignar' ? 'selected' : ''
        }>No Asignar</option>
        <option value="parte-de-pago" ${
          selectedProviderId === 'parte-de-pago' ? 'selected' : ''
        }>Parte de pago/Otro</option>
        ${(userProviders || [])
          .map(
            (p) =>
              `<option value="${p.id}" ${
                selectedProviderId === p.id ? 'selected' : ''
              }>${escapeHTML(p.name)}</option>`
          )
          .join('')}
    `;

  const formHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label class="block text-sm">Categoría</label>
                <select id="stock-category-reg" class="form-select w-full" required>
                    ${allCategories
                      .map(
                        (cat) =>
                          `<option value="${escapeHTML(cat.name)}" ${
                            cat.name === selectedCategoryName ? 'selected' : ''
                          }>${escapeHTML(cat.name)}</option>`
                      )
                      .join('')}
                </select>
            </div>
            <div>
                <label class="block text-sm">N/S (Número de Serie)</label>
                <input type="text" id="stock-serial-reg" class="form-input w-full" value="${
                  currentValues['stock-serial-reg'] || ''
                }" required>
            </div>
        </div>
        <div class="border-t my-4"></div>
        <div id="dynamic-attributes-container" class="space-y-4">
            ${
              selectedCategory?.attributes
                ?.map((attr) =>
                  generateAttributeInputHTML(attr, currentValues, 'reg', autofillData)
                )
                .join('') || ''
            }
        </div>
        <div class="border-t my-4"></div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div><label class="block text-sm">Cantidad</label><input type="number" id="stock-quantity-reg" class="form-input w-full" value="${
              currentValues['stock-quantity-reg'] || '1'
            }" min="1" required></div>
            <div><label class="block text-sm">Costo (USD)</label><input type="number" id="stock-cost-reg" class="form-input w-full" value="${
              currentValues['stock-cost-reg'] || ''
            }" required></div>
            <div><label class="block text-sm">P. Venta Sugerido (USD)</label><input type="number" id="stock-price-reg" class="form-input w-full" value="${
              currentValues['stock-price-reg'] || ''
            }"></div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label class="block text-sm">Asignar Proveedor</label>
                <select id="stock-provider-reg" class="form-select w-full">${providerOptions}</select>
            </div>
            <div>
                <label class="block text-sm">Detalles Adicionales</label>
                <textarea id="stock-details-reg" class="form-textarea w-full">${
                  currentValues['stock-details-reg'] || ''
                }</textarea>
            </div>
        </div>
        <button type="submit" class="btn-primary py-2 px-6">Añadir a Stock</button>
    `;
  form.innerHTML = formHTML;

  if (autofillData) {
    setTimeout(() => {
      setState({ addStockForm: { autofillData: null } });
    }, 0);
  }
}

/**
 * Genera el HTML para un campo de atributo dinámico (input, select, etc.).
 * @param {object} attribute El objeto de configuración del atributo.
 * @param {object} [currentValues={}] Valores actuales del formulario para repoblar.
 * @param {string} [formSuffix='reg'] El sufijo para los IDs de los inputs ('reg' o 'edit').
 * @param {object|null} [autofillData=null] Datos para autocompletar el campo.
 * @returns {string} El HTML del campo del formulario.
 */
export function generateAttributeInputHTML(
  attribute,
  currentValues = {},
  formSuffix = 'reg',
  autofillData = null
) {
  const { id, name, type, options, dependsOn, required } = attribute;
  const inputId = `attr_${id}_${formSuffix}`;

  let value = autofillData?.[id] || currentValues[inputId] || '';

  const label = `<label for="${inputId}" class="block text-sm">${escapeHTML(name)}</label>`;
  const requiredAttr = required ? 'required' : '';
  let inputHTML = '';

  let isDisabled = false;
  if (id === 'battery') {
    const gradeValue = autofillData?.grade || currentValues[`attr_grade_${formSuffix}`] || '';
    if (gradeValue === 'Caja Sellada') {
      isDisabled = true;
      value = 100;
    }
  }

  let currentOptions = Array.isArray(options) ? options : [];
  if (dependsOn && typeof options === 'object') {
    const parentInput = document.getElementById(`attr_${dependsOn}_${formSuffix}`);
    const parentValue = parentInput
      ? parentInput.value
      : autofillData?.[dependsOn] || currentValues[`attr_${dependsOn}_${formSuffix}`];

    if (parentValue && options[parentValue]) {
      currentOptions = options[parentValue];
    } else if (parentValue) {
      const fallbackInputId = `attr_${id}_${formSuffix}`;
      const fallbackValue = currentValues[fallbackInputId] || '';
      const fallbackLabel = `<label for="${fallbackInputId}" class="block text-sm">${escapeHTML(
        name
      )}</label>`;
      const fallbackInputHTML = `<input type="text" id="${fallbackInputId}" data-attr-id="${id}" data-attr-name="${name}" class="form-input w-full" value="${escapeHTML(
        fallbackValue
      )}" placeholder="Valor personalizado" ${required ? 'required' : ''}>`;
      return `<div>${fallbackLabel}${fallbackInputHTML}</div>`;
    } else {
      const allCategories = [...(appState.categories || []), ...DEFAULT_CATEGORIES];
      const parentAttr = allCategories.flatMap((c) => c.attributes).find((a) => a.id === dependsOn);
      const parentName = parentAttr ? parentAttr.name : 'la opción anterior';
      return `<div>${label}<select id="${inputId}" class="form-select w-full" disabled><option>Selecciona primero ${parentName}</option></select></div>`;
    }
  }

  switch (type) {
    case 'text':
      inputHTML = `<input type="text" id="${inputId}" data-attr-id="${id}" data-attr-name="${name}" class="form-input w-full" value="${escapeHTML(
        value
      )}" ${requiredAttr} ${isDisabled ? 'disabled' : ''}>`;
      break;
    case 'number':
      inputHTML = `<input type="number" id="${inputId}" data-attr-id="${id}" data-attr-name="${name}" class="form-input w-full" value="${escapeHTML(
        value
      )}" ${requiredAttr} ${isDisabled ? 'disabled' : ''}>`;
      break;
    case 'select':
      const optionsHTML = currentOptions
        .map(
          (opt) =>
            `<option value="${escapeHTML(opt)}" ${opt === value ? 'selected' : ''}>${escapeHTML(
              opt
            )}</option>`
        )
        .join('');
      inputHTML = `<select id="${inputId}" data-attr-id="${id}" data-attr-name="${name}" class="form-select w-full" ${requiredAttr} ${
        isDisabled ? 'disabled' : ''
      }><option value="">-- Seleccionar --</option>${optionsHTML}</select>`;
      break;
  }

  return `<div>${label}${inputHTML}</div>`;
}

/**
 * Renderiza la sección de gestión de categorías con el nuevo diseño de dos paneles.
 * @param {object} state El estado actual de la aplicación.
 */
function renderCategoryManagerSection(state) {
  const { categories, categoryManager } = state;
  if (!categories) return;

  const listContainer = document.getElementById('category-manager-list');
  if (!listContainer) return;

  listContainer.innerHTML = categories
    .map(
      (cat) => `
        <div class="category-manager-item p-3 rounded-lg flex justify-between items-center cursor-pointer border-2 ${
          categoryManager.selectedCategoryId === cat.id
            ? 'border-green-500 bg-green-50'
            : 'border-transparent hover:bg-gray-100'
        }" data-category-id="${cat.id}">
            <span class="font-semibold">${escapeHTML(cat.name)}</span>
        </div>
    `
    )
    .join('');

  const attributesContainer = document.getElementById('category-attributes-manager');
  const placeholder = document.getElementById('category-manager-placeholder');
  if (!attributesContainer || !placeholder) return;

  const selectedCategory = categories.find((c) => c.id === categoryManager.selectedCategoryId);

  if (selectedCategory) {
    attributesContainer.classList.remove('hidden');
    placeholder.classList.add('hidden');
    renderCategoryProductsAndAttributes(selectedCategory);
  } else {
    attributesContainer.classList.add('hidden');
    placeholder.classList.remove('hidden');
  }
}

/**
 * Renderiza el panel derecho del gestor: la lista de productos y los atributos generales.
 * @param {object} category La categoría seleccionada.
 */
function renderCategoryProductsAndAttributes(category) {
  const container = document.getElementById('category-attributes-content');
  if (!container) return;

  const { categoryManager } = appState;
  const isEditingName = categoryManager.isEditingCategoryName;

  const nameDisplay = isEditingName
    ? `<input type="text" id="edit-category-name-input" class="text-2xl font-bold form-input" value="${escapeHTML(
        category.name
      )}">`
    : `<h3 class="text-2xl font-bold">${escapeHTML(category.name)}</h3>`;

  const productAttribute = category.attributes.find(
    (attr) => attr.id.startsWith('attr-product-') || attr.name === 'Producto'
  );
  const productList = productAttribute ? productAttribute.options : [];

  const productListHTML =
    productList.length > 0
      ? productList
          .map(
            (productName) => `
        <div class="bg-white p-3 rounded-lg flex justify-between items-center border hover:shadow-sm">
            <span class="font-medium">${escapeHTML(productName)}</span>
            <div class="flex items-center gap-2">
                <button class="edit-product-options-btn btn-secondary text-xs py-1 px-3" data-product-name="${escapeHTML(
                  productName
                )}">Editar Opciones</button>
                <button class="delete-product-from-category-btn text-gray-400 hover:text-red-500" data-product-name="${escapeHTML(
                  productName
                )}"><i class="fas fa-trash"></i></button>
            </div>
        </div>
    `
          )
          .join('')
      : '<p class="text-gray-400 text-center py-4">Aún no hay productos en esta categoría. ¡Añade uno!</p>';

  const generalAttributes = category.attributes.filter(
    (attr) => !attr.dependsOn && attr.id !== productAttribute?.id
  );
  const generalAttributesHTML =
    generalAttributes.length > 0
      ? generalAttributes
          .map(
            (attr) => `
        <div class="bg-gray-50 p-3 rounded-lg flex justify-between items-center border">
            <p class="font-medium">${escapeHTML(attr.name)} <span class="text-xs text-gray-500">(${
              attr.type
            })</span></p>
            <div class="flex items-center gap-2">
                <button class="edit-attribute-btn text-blue-500 hover:text-blue-700" data-attr-id="${
                  attr.id
                }"><i class="fas fa-edit"></i></button>
                <button class="delete-attribute-btn text-red-500 hover:text-red-700" data-attr-id="${
                  attr.id
                }"><i class="fas fa-times"></i></button>
            </div>
        </div>
    `
          )
          .join('')
      : '<p class="text-gray-400 text-center py-4">No hay atributos generales.</p>';

  container.innerHTML = `
        <div class="flex justify-between items-start mb-6">
            <div class="flex items-center gap-3">
                ${nameDisplay}
                ${
                  isEditingName
                    ? `<button id="save-category-name-btn" class="text-green-600 hover:text-green-800"><i class="fas fa-check-circle fa-lg"></i></button>`
                    : `<button id="edit-category-name-btn" class="text-gray-400 hover:text-gray-600"><i class="fas fa-pencil-alt"></i></button>`
                }
            </div>
            <button id="delete-category-btn" class="btn-danger py-1 px-3 text-sm"><i class="fas fa-trash"></i> Eliminar Categoría</button>
        </div>

        <div class="space-y-6">
            <div>
                <div class="flex justify-between items-center mb-3">
                    <h4 class="font-semibold text-lg">Productos en "${escapeHTML(
                      category.name
                    )}"</h4>
                    <button id="add-new-product-to-category-btn" class="btn-primary py-1 px-3 text-sm"><i class="fas fa-plus"></i> Añadir Producto</button>
                </div>
                <div class="space-y-2">${productListHTML}</div>
            </div>

            <div class="border-t pt-6">
                <h4 class="font-semibold text-lg mb-3">Atributos Generales de la Categoría</h4>
                <div class="space-y-2 mb-4">${generalAttributesHTML}</div>
                <form id="add-attribute-form" class="grid grid-cols-1 md:grid-cols-3 gap-4 items-end bg-gray-50 p-4 rounded-lg border">
                    <div>
                        <label class="block text-sm">Nombre del Atributo</label>
                        <input type="text" id="new-attribute-name" class="form-input w-full" required>
                    </div>
                    <div>
                        <label class="block text-sm">Tipo de Campo</label>
                        <select id="new-attribute-type" class="form-select w-full">
                            <option value="text">Texto</option>
                            <option value="number">Número</option>
                            <option value="select">Lista Desplegable</option>
                        </select>
                    </div>
                    <div id="new-attribute-options-container" class="hidden">
                        <label class="block text-sm">Opciones (separadas por coma)</label>
                        <input type="text" id="new-attribute-options" class="form-input w-full">
                    </div>
                    <div class="md:col-span-3">
                        <button type="submit" class="btn-primary py-2 px-6">Añadir Atributo General</button>
                    </div>
                </form>
            </div>
        </div>
    `;
}

// --- Modales Específicos de Inventario ---

/**
 * Abre el modal para editar un producto del stock.
 * @param {object} item El objeto del producto a editar.
 * @param {object} state El estado actual de la aplicación.
 * @param {object|null} [formValues=null] Valores actuales del formulario para repoblar si ya estaba abierto.
 */
export function openEditStockModal(item, state, formValues = null) {
  const { categories, userProviders } = state;

  const allCategories = [...DEFAULT_CATEGORIES];
  const userCategories = categories || [];
  userCategories.forEach((uc) => {
    const existingIndex = allCategories.findIndex((dc) => dc.id === uc.id);
    if (existingIndex > -1) {
      allCategories[existingIndex] = uc;
    } else {
      allCategories.push(uc);
    }
  });

  const currentCategoryName = formValues ? formValues['edit-stock-category'] : item.category;
  const itemCategory = allCategories.find((c) => c.name === currentCategoryName);

  const currentValues = {};
  if (formValues) {
    Object.assign(currentValues, formValues);
  } else {
    currentValues[`edit-stock-category`] = item.category;
    currentValues[`edit-stock-serial`] = item.serialNumber;
    currentValues[`edit-stock-quantity`] = item.quantity;
    currentValues[`edit-stock-cost`] = item.phoneCost;
    currentValues[`edit-stock-price`] = item.suggestedSalePrice;
    currentValues[`edit-stock-details`] = item.details;
    currentValues[`edit-stock-provider`] = item.providerId;

    if (itemCategory && itemCategory.attributes) {
      itemCategory.attributes.forEach((attr) => {
        const inputId = `attr_${attr.id}_edit`;
        if (item.attributes && item.attributes[attr.name] !== undefined) {
          currentValues[inputId] = item.attributes[attr.name];
        }
      });
    }
  }

  const providerOptions = `
      <option value="no-asignar" ${
        !currentValues['edit-stock-provider'] ||
        currentValues['edit-stock-provider'] === 'no-asignar'
          ? 'selected'
          : ''
      }>No Asignar</option>
      <option value="parte-de-pago" ${
        currentValues['edit-stock-provider'] === 'parte-de-pago' ? 'selected' : ''
      }>Parte de pago/Otro</option>
      ${(userProviders || [])
        .map(
          (p) =>
            `<option value="${p.id}" ${
              currentValues['edit-stock-provider'] === p.id ? 'selected' : ''
            }>${escapeHTML(p.name)}</option>`
        )
        .join('')}
  `;

  const content = `
        <form id="edit-stock-form" class="space-y-4" data-id="${item.id}">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label class="block text-sm">Categoría</label>
                    <select id="edit-stock-category" class="form-select w-full" required>
                        ${allCategories
                          .map(
                            (cat) =>
                              `<option value="${escapeHTML(cat.name)}" ${
                                currentCategoryName === cat.name ? 'selected' : ''
                              }>${escapeHTML(cat.name)}</option>`
                          )
                          .join('')}
                    </select>
                </div>
                <div>
                    <label class="block text-sm">N/S (Número de Serie)</label>
                    <input type="text" id="edit-stock-serial" class="form-input w-full" value="${escapeHTML(
                      currentValues['edit-stock-serial'] || ''
                    )}" required>
                </div>
            </div>
            <div class="border-t my-4"></div>
            <div id="dynamic-attributes-container-modal" class="space-y-4">
                ${
                  itemCategory?.attributes
                    ?.map((attr) => generateAttributeInputHTML(attr, currentValues, 'edit'))
                    .join('') || ''
                }
            </div>
            <div class="border-t my-4"></div>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                 <div><label>Cantidad</label><input type="number" id="edit-stock-quantity" class="form-input w-full" value="${
                   currentValues['edit-stock-quantity'] || 1
                 }" min="0" required></div>
                 <div><label>Costo (USD)</label><input type="number" id="edit-stock-cost" class="form-input w-full" value="${
                   currentValues['edit-stock-cost'] || 0
                 }" required></div>
                 <div><label>P. Venta (USD)</label><input type="number" id="edit-stock-price" class="form-input w-full" value="${
                   currentValues['edit-stock-price'] || 0
                 }"></div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label>Proveedor</label>
                    <select id="edit-stock-provider" class="form-select w-full">${providerOptions}</select>
                </div>
                <div>
                    <label>Detalles</label>
                    <textarea id="edit-stock-details" class="form-textarea w-full">${escapeHTML(
                      currentValues['edit-stock-details'] || ''
                    )}</textarea>
                </div>
            </div>
        </form>
    `;
  const footer = `
        <button type="button" class="btn-secondary close-modal-btn px-4 py-2">Cancelar</button>
        <button type="submit" form="edit-stock-form" class="btn-primary px-4 py-2">Guardar Cambios</button>
    `;
  showModal(content, `Editar Producto`, footer);
}

/**
 * Muestra un modal con los detalles de un producto.
 * @param {object} item El objeto del producto.
 */
export function showItemDetailsModal(item) {
  if (!item) return;

  const attributesHTML =
    item.attributes && Object.keys(item.attributes).length > 0
      ? Object.entries(item.attributes)
          .map(
            ([key, value]) =>
              `<div class="flex justify-between py-1"><span class="text-gray-600">${escapeHTML(
                key
              )}:</span><span class="font-semibold">${escapeHTML(value)}</span></div>`
          )
          .join('')
      : '<p class="text-gray-500">No hay atributos específicos para este producto.</p>';

  const providerHTML = item.providerName
    ? `
        <div class="border-t pt-3">
            <h4 class="font-semibold mb-1">Proveedor</h4>
            <p class="text-sm text-gray-600">${escapeHTML(item.providerName)}</p>
        </div>`
    : '';

  const content = `
        <div class="space-y-3">
            <div class="bg-gray-100 p-3 rounded-lg">
                <div class="flex justify-between text-lg"><span class="font-bold">${escapeHTML(
                  item.model
                )}</span><span class="text-gray-500">${escapeHTML(item.category)}</span></div>
                <div class="text-sm text-center text-gray-500 font-mono">${escapeHTML(
                  item.serialNumber
                )}</div>
            </div>
            <div class="border-t pt-3">
                <h4 class="font-semibold mb-2">Atributos</h4>
                <div class="text-sm space-y-1">${attributesHTML}</div>
            </div>
            ${providerHTML}
             <div class="border-t pt-3">
                <h4 class="font-semibold mb-2">Detalles Adicionales</h4>
                <p class="text-sm text-gray-600">${escapeHTML(
                  item.details || 'Sin detalles adicionales.'
                )}</p>
            </div>
        </div>
    `;
  showModal(content, 'Detalles del Producto');
}

/**
 * Abre el modal para editar un atributo de una categoría.
 * @param {string} categoryId El ID de la categoría.
 * @param {object} attribute El objeto del atributo a editar.
 */
export function openEditAttributeModal(categoryId, attribute) {
  const isSelect = attribute.type === 'select';
  const optionsValue =
    attribute.options && Array.isArray(attribute.options) ? attribute.options.join(', ') : '';
  const content = `
        <form id="edit-attribute-form" class="space-y-4" data-category-id="${categoryId}" data-attr-id="${
    attribute.id
  }">
            <div>
                <label class="block text-sm">Nombre del Atributo</label>
                <input type="text" id="edit-attribute-name" class="form-input w-full" value="${escapeHTML(
                  attribute.name
                )}" required>
            </div>
            <div>
                <label class="block text-sm">Tipo de Campo</label>
                <select id="edit-attribute-type" class="form-select w-full">
                    <option value="text" ${
                      attribute.type === 'text' ? 'selected' : ''
                    }>Texto</option>
                    <option value="number" ${
                      attribute.type === 'number' ? 'selected' : ''
                    }>Número</option>
                    <option value="select" ${
                      attribute.type === 'select' ? 'selected' : ''
                    }>Lista Desplegable</option>
                </select>
            </div>
            <div id="edit-attribute-options-container" class="${isSelect ? '' : 'hidden'}">
                <label class="block text-sm">Opciones (separadas por coma)</label>
                <input type="text" id="edit-attribute-options" class="form-input w-full" value="${escapeHTML(
                  optionsValue
                )}">
            </div>
        </form>
    `;
  const footer = `
        <button type="button" class="btn-secondary close-modal-btn px-4 py-2">Cancelar</button>
        <button type="submit" form="edit-attribute-form" class="btn-primary px-4 py-2">Guardar Cambios</button>
    `;
  showModal(content, `Editar Atributo: ${attribute.name}`, footer);
}

/**
 * Abre un modal para editar las opciones de los atributos dependientes de un producto específico.
 * @param {string} categoryId El ID de la categoría a la que pertenece el producto.
 * @param {string} productName El nombre del producto a editar.
 */
export function openEditProductOptionsModal(categoryId, productName) {
  const category = appState.categories.find((c) => c.id === categoryId);
  if (!category) return;

  const productAttribute = category.attributes.find(
    (attr) => attr.id.startsWith('attr-product-') || attr.name === 'Producto'
  );
  if (!productAttribute) return;

  const dependentAttributes = category.attributes.filter(
    (attr) => attr.dependsOn === productAttribute.id
  );

  // =================================================================================
  // INICIO DE MODIFICACIÓN: Se cambia el renderizado de textarea a una lista interactiva.
  // =================================================================================
  const editorsHTML = dependentAttributes
    .map((attr) => {
      const currentOptions =
        typeof attr.options === 'object' && attr.options[productName]
          ? attr.options[productName]
          : [];

      const optionsListHTML = currentOptions
        .map(
          (opt) => `
            <div class="attribute-option-item flex items-center justify-between bg-gray-100 p-2 rounded" data-option-value="${escapeHTML(
              opt
            )}">
                <span>${escapeHTML(opt)}</span>
                <button type="button" class="delete-attribute-option-btn text-red-500 hover:text-red-700" 
                        data-category-id="${categoryId}" 
                        data-product-name="${escapeHTML(productName)}" 
                        data-attr-id="${attr.id}" 
                        data-option-value="${escapeHTML(opt)}">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `
        )
        .join('');

      return `
            <div class="dependent-attribute-editor border p-3 rounded-lg bg-white" data-attr-id="${
              attr.id
            }">
                <div class="flex justify-between items-center mb-2">
                     <label class="block text-sm font-medium text-gray-700">${escapeHTML(
                       attr.name
                     )}</label>
                     <button type="button" class="delete-dependent-attribute-btn text-gray-400 hover:text-red-600" title="Eliminar este atributo" 
                             data-category-id="${categoryId}" 
                             data-product-name="${escapeHTML(productName)}" 
                             data-attr-id-to-delete="${attr.id}">
                        <i class="fas fa-trash-alt"></i>
                     </button>
                </div>
                <div class="space-y-2 mb-2">${optionsListHTML}</div>
                <div class="flex items-center gap-2 mt-3 pt-3 border-t">
                    <input type="text" class="add-option-input form-input flex-grow p-2 text-sm" placeholder="Añadir nueva opción...">
                    <button type="button" class="add-attribute-option-btn btn-secondary py-2 px-3 text-sm" 
                            data-category-id="${categoryId}" 
                            data-product-name="${escapeHTML(productName)}" 
                            data-attr-id="${attr.id}">
                        <i class="fas fa-plus"></i>
                    </button>
                </div>
            </div>
        `;
    })
    .join('');
  // =================================================================================
  // FIN DE MODIFICACIÓN
  // =================================================================================

  const content = `
        <form id="edit-product-options-form" class="space-y-4" data-category-id="${categoryId}" data-product-attribute-id="${
    productAttribute.id
  }" data-product-name="${escapeHTML(productName)}">
            <p>Define las opciones disponibles para cada atributo cuando el producto seleccionado sea <strong>${escapeHTML(
              productName
            )}</strong>.</p>
            ${editorsHTML}
        </form>
        <div class="border-t pt-4 mt-4">
            <h4 class="font-semibold text-sm mb-2">Añadir Nuevo Atributo Dependiente</h4>
            <form id="add-dependent-attribute-form" class="flex items-end gap-2" data-category-id="${categoryId}" data-product-attribute-id="${
    productAttribute.id
  }" data-product-name="${escapeHTML(productName)}">
                <div class="flex-grow">
                    <label class="block text-xs">Nombre del Atributo</label>
                    <input type="text" id="new-dependent-attr-name" class="form-input w-full p-2 text-sm" required>
                </div>
                <button type="submit" class="btn-primary py-2 px-3 text-sm"><i class="fas fa-plus"></i></button>
            </form>
        </div>
    `;

  const footer = `
        <button type="button" class="btn-secondary close-modal-btn px-4 py-2">Cancelar</button>
        <button type="submit" form="edit-product-options-form" class="btn-primary px-4 py-2">Guardar Opciones</button>
    `;

  showModal(content, `Editar Opciones de ${productName}`, footer);

  // =================================================================================
  // INICIO DE MODIFICACIÓN: Se añade un event listener local para el botón de añadir opción.
  // =================================================================================
  const modal = document.getElementById('app-modal');
  if (modal) {
    modal.addEventListener('click', async (e) => {
      if (e.target.closest('.add-attribute-option-btn')) {
        const button = e.target.closest('.add-attribute-option-btn');
        const { categoryId, productName, attrId } = button.dataset;
        const input = button.previousElementSibling;
        const newOptionValue = input.value.trim();

        if (newOptionValue) {
          const category = appState.categories.find((c) => c.id === categoryId);
          if (!category) return;

          const updatedAttributes = JSON.parse(JSON.stringify(category.attributes));
          const attributeToUpdate = updatedAttributes.find((attr) => attr.id === attrId);

          if (attributeToUpdate && typeof attributeToUpdate.options === 'object') {
            if (!attributeToUpdate.options[productName]) {
              attributeToUpdate.options[productName] = [];
            }
            // Evitar duplicados
            if (!attributeToUpdate.options[productName].includes(newOptionValue)) {
              attributeToUpdate.options[productName].push(newOptionValue);
              await updateData('categories', categoryId, { attributes: updatedAttributes });
              openEditProductOptionsModal(categoryId, productName); // Refresca el modal
            } else {
              input.value = ''; // Limpiar si ya existe
            }
          }
        }
      }
    });
  }
  // =================================================================================
  // FIN DE MODIFICACIÓN
  // =================================================================================
}
