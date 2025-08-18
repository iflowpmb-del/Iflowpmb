import { formatCurrency, escapeHTML } from './utils.js';
import { showModal } from './modales.js';

/**
 * Formatea un timestamp de Firebase a un formato de "hace X tiempo".
 * @param {object} timestamp El objeto Timestamp de Firebase.
 * @returns {string|null} La cadena de tiempo relativo o null si es inválido.
 */
function formatTimeAgo(timestamp) {
  if (!timestamp || !timestamp.toDate) {
    return null;
  }
  const now = new Date();
  const date = timestamp.toDate();
  const seconds = Math.floor((now - date) / 1000);
  let interval = seconds / 31536000;
  if (interval > 1) return `hace ${Math.floor(interval)} años`;
  interval = seconds / 2592000;
  if (interval > 1) return `hace ${Math.floor(interval)} meses`;
  interval = seconds / 86400;
  if (interval > 1) return `hace ${Math.floor(interval)} días`;
  interval = seconds / 3600;
  if (interval > 1) return `hace ${Math.floor(interval)} horas`;
  interval = seconds / 60;
  if (interval > 1) return `hace ${Math.floor(interval)} minutos`;
  return 'hace unos segundos';
}

/**
 * Renderiza la sección de proveedores públicos recomendados.
 * @param {object} state El estado actual de la aplicación.
 */
export function renderPublicProvidersSection(state) {
  if (!state.providers) return;

  const container = document.getElementById('public-providers-list-container');
  const noProvidersMessage = document.getElementById('no-public-providers-message');
  const searchInput = document.getElementById('public-providers-search-input');

  if (!container || !noProvidersMessage || !searchInput) return;

  if (searchInput.value !== state.providersSearchTerm) {
    searchInput.value = state.providersSearchTerm;
  }

  const searchTerm = (state.providersSearchTerm || '').toLowerCase();
  const filteredProviders = state.providers.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm) ||
      (p.tagline && p.tagline.toLowerCase().includes(searchTerm))
  );

  noProvidersMessage.classList.toggle('hidden', state.providers.length > 0);
  container.innerHTML = '';

  if (filteredProviders.length === 0) {
    if (searchTerm) {
      container.innerHTML = `<p class="text-center text-gray-500 py-8 col-span-full">No se encontraron proveedores para "${escapeHTML(
        searchTerm
      )}".</p>`;
    }
    return;
  }

  filteredProviders.forEach((provider) => {
    const providerCard = document.createElement('div');
    providerCard.className = 'card flex flex-col';

    const whatsappLink = `https://wa.me/${provider.whatsapp.replace(/\D/g, '')}`;
    const instagramLink = `https://instagram.com/${provider.instagram.replace('@', '')}`;

    const verifiedBadge = provider.isVerified
      ? `<i class="fas fa-check-circle text-blue-500 ml-2" title="Proveedor Verificado"></i>`
      : '';

    const lastUpdated = formatTimeAgo(provider.lastUpdatedAt);

    const priceList = provider.priceList || [];
    let priceListHtml = '';

    if (priceList.length > 0) {
      const groupedByCategory = priceList.reduce((acc, item) => {
        const category = item.category || 'General';
        if (!acc[category]) {
          acc[category] = [];
        }
        acc[category].push(item);
        return acc;
      }, {});

      const sortedCategories = Object.keys(groupedByCategory).sort();

      priceListHtml = sortedCategories
        .map(
          (category) => `
                <div class="mb-4 price-list-category">
                    <h5 class="font-semibold text-md text-gray-700 bg-gray-100 p-2 rounded-t-md sticky top-0">${escapeHTML(
                      category
                    )}</h5>
                    <table class="min-w-full text-sm">
                        <tbody>
                            ${groupedByCategory[category]
                              .map(
                                (item) => `
                                <tr class="border-b price-list-item">
                                    <td class="p-2 item-name">${escapeHTML(item.name)}</td>
                                    <td class="p-2 text-right font-mono">${formatCurrency(
                                      item.price,
                                      'USD'
                                    )}</td>
                                </tr>
                            `
                              )
                              .join('')}
                        </tbody>
                    </table>
                </div>
            `
        )
        .join('');
    } else {
      priceListHtml = '<p class="text-center text-gray-400 py-4">No hay productos en la lista.</p>';
    }

    providerCard.innerHTML = `
            <div class="p-6">
                <div class="flex items-start mb-4">
                    <img src="${
                      provider.logoUrl || 'https://placehold.co/64x64/e2e8f0/64748b?text=Logo'
                    }" alt="Logo de ${escapeHTML(
      provider.name
    )}" class="w-16 h-16 rounded-full mr-4 border">
                    <div class="flex-1">
                        <div class="flex items-center">
                            <h3 class="text-2xl font-bold text-gray-800">${escapeHTML(
                              provider.name
                            )}</h3>
                            ${verifiedBadge}
                        </div>
                        <p class="text-gray-500">${escapeHTML(provider.tagline || '')}</p>
                    </div>
                </div>
                <div class="flex justify-center gap-4 my-4">
                    <a href="${whatsappLink}" target="_blank" class="btn-primary flex-1 text-center py-2 px-4 flex items-center justify-center gap-2"><i class="fab fa-whatsapp"></i> WhatsApp</a>
                    <a href="${instagramLink}" target="_blank" class="btn-secondary flex-1 text-center py-2 px-4 flex items-center justify-center gap-2">
                        <i class="fab fa-instagram"></i>
                        <span>@${escapeHTML(provider.instagram)}</span>
                    </a>
                </div>
            </div>
            <div class="flex-grow p-6 border-t bg-gray-50 rounded-b-xl">
                <div class="flex flex-col sm:flex-row justify-between items-center mb-3 gap-4">
                    <div class="flex items-center">
                        <h4 class="font-semibold text-lg">Lista de Precios</h4>
                        ${
                          lastUpdated
                            ? `<span class="text-xs text-gray-400 ml-2" title="${provider.lastUpdatedAt
                                ?.toDate()
                                .toLocaleString()}">Actualizado ${lastUpdated}</span>`
                            : ''
                        }
                    </div>
                    <div class="relative w-full sm:w-auto">
                        <input type="text" class="form-input w-full sm:w-48 p-2 pl-8 text-sm provider-price-list-search" placeholder="Buscar en lista..." data-provider-id="${
                          provider.id
                        }">
                        <i class="fas fa-search absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs"></i>
                    </div>
                </div>
                <div class="overflow-y-auto max-h-80 pr-2 price-list-container">
                    ${priceListHtml}
                </div>
            </div>
        `;
    container.appendChild(providerCard);
  });
}

/**
 * Renderiza la sección de los proveedores personales del usuario.
 * @param {object} state El estado actual de la aplicación.
 */
export function renderUserProvidersSection(state) {
  if (!state.userProviders) return;
  const { userProviders, userProvidersSearchTerm } = state;
  const container = document.getElementById('user-providers-list-container');
  const noMessage = document.getElementById('no-user-providers-message');
  const searchInput = document.getElementById('user-providers-search-input');
  if (!container || !noMessage || !searchInput) return;

  if (searchInput.value !== userProvidersSearchTerm) {
    searchInput.value = userProvidersSearchTerm;
  }

  const searchTerm = (userProvidersSearchTerm || '').toLowerCase();
  const filteredProviders = userProviders.filter(
    (p) =>
      (p.name || '').toLowerCase().includes(searchTerm) ||
      (p.contact || '').toLowerCase().includes(searchTerm)
  );
  noMessage.classList.toggle('hidden', userProviders.length > 0);
  container.innerHTML = '';

  if (filteredProviders.length === 0) {
    if (searchTerm) {
      container.innerHTML = `<p class="text-center text-gray-500 py-8 col-span-full">No se encontraron proveedores para "${escapeHTML(
        searchTerm
      )}".</p>`;
    }
    return;
  }

  container.innerHTML = filteredProviders
    .map(
      (provider) => `
        <div class="card p-4 flex flex-col justify-between">
            <div>
                <p class="font-bold text-lg">${escapeHTML(provider.name)}</p>
                <p class="text-sm text-gray-500">${escapeHTML(
                  provider.contact || 'Sin contacto'
                )}</p>
                <p class="text-xs text-gray-400 mt-2">${escapeHTML(
                  provider.notes || 'Sin notas'
                )}</p>
            </div>
            <div class="flex items-center justify-end mt-4">
                <button class="edit-provider-btn text-gray-400 hover:text-blue-500" data-provider='${JSON.stringify(
                  provider
                )}'><i class="fas fa-edit"></i></button>
                <button class="delete-provider-btn ml-2 text-gray-400 hover:text-red-500" data-id="${
                  provider.id
                }" data-name="${escapeHTML(provider.name)}"><i class="fas fa-trash"></i></button>
            </div>
        </div>
    `
    )
    .join('');
}

// --- Modales Específicos de Proveedores ---

/**
 * Abre el modal para añadir un nuevo proveedor personal.
 */
export function openAddProviderModal() {
  const content = `
        <form id="provider-form-modal" class="space-y-4">
            <div><label class="block text-sm">Nombre del Proveedor</label><input type="text" id="provider-name-modal" class="form-input w-full" required></div>
            <div><label class="block text-sm">Contacto (Teléfono/Email)</label><input type="text" id="provider-contact-modal" class="form-input w-full"></div>
            <div><label class="block text-sm">Notas</label><textarea id="provider-notes-modal" class="form-textarea w-full"></textarea></div>
        </form>`;
  const footer = `
        <button type="button" class="btn-secondary close-modal-btn px-4 py-2">Cancelar</button>
        <button type="submit" form="provider-form-modal" class="btn-primary px-4 py-2">Guardar Proveedor</button>
    `;
  showModal(content, 'Añadir Nuevo Proveedor', footer);
}

/**
 * Abre el modal para editar un proveedor personal existente.
 * @param {object} provider El objeto del proveedor a editar.
 */
export function openEditProviderModal(provider) {
  const content = `
        <form id="edit-provider-form-modal" class="space-y-4" data-id="${provider.id}">
            <div><label class="block text-sm">Nombre del Proveedor</label><input type="text" id="edit-provider-name-modal" class="form-input w-full" value="${escapeHTML(
              provider.name
            )}" required></div>
            <div><label class="block text-sm">Contacto (Teléfono/Email)</label><input type="text" id="edit-provider-contact-modal" class="form-input w-full" value="${escapeHTML(
              provider.contact || ''
            )}"></div>
            <div><label class="block text-sm">Notas</label><textarea id="edit-provider-notes-modal" class="form-textarea w-full">${escapeHTML(
              provider.notes || ''
            )}</textarea></div>
        </form>`;
  const footer = `
        <button type="button" class="btn-secondary close-modal-btn px-4 py-2">Cancelar</button>
        <button type="submit" form="edit-provider-form-modal" class="btn-primary px-4 py-2">Guardar Cambios</button>
    `;
  showModal(content, 'Editar Proveedor', footer);
}
