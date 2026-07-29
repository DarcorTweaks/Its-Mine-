import { db, storage } from './firebase.js';
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";
import { formatUSD, showToast, createElement } from './utils.js';

let catalogItems = [];
let rubros = [];
let categories = [];
let webServices = [];
let editingCatalogId = null;
let editingWebSvcId = null;

export function startCatalogSync() {
    onSnapshot(collection(db, 'catalogo_publico'), (snapshot) => {
        catalogItems = [];
        snapshot.forEach(doc => {
            catalogItems.push({ id: doc.id, ...doc.data() });
        });
        renderCatalogAdmin();
    }, (error) => {
        console.error("Error catalog sync:", error);
    });

    onSnapshot(collection(db, 'rubros_publico'), (snapshot) => {
        rubros = [];
        snapshot.forEach(doc => {
            rubros.push({ id: doc.id, ...doc.data() });
        });
        renderRubrosAdmin();
        updateRubroSelect();
        updateCategorySelects(); // Needs rubros to optgroup
    }, (error) => {
        console.error("Error rubros sync:", error);
    });

    onSnapshot(collection(db, 'categorias_publico'), (snapshot) => {
        categories = [];
        snapshot.forEach(doc => {
            categories.push({ id: doc.id, ...doc.data() });
        });
        renderCategoriesAdmin();
        updateCategorySelects();
    }, (error) => {
        console.error("Error categories sync:", error);
    });

    onSnapshot(collection(db, 'servicios_publico'), (snapshot) => {
        webServices = [];
        snapshot.forEach(doc => {
            webServices.push({ id: doc.id, ...doc.data() });
        });
        renderWebSvcAdmin();
    }, (error) => {
        console.error("Error web services sync:", error);
    });
}

// --- RUBROS ---
export async function addRubro() {
    const nameEl = document.getElementById('rubroNameInput');
    if (!nameEl || !nameEl.value) return showToast("Escribe el nombre del rubro");
    
    try {
        await addDoc(collection(db, 'rubros_publico'), {
            name: nameEl.value,
            createdAt: Date.now()
        });
        showToast("Rubro añadido");
        nameEl.value = '';
    } catch (e) { showToast("Error al añadir rubro"); }
}

export async function deleteRubro(id) {
    if (confirm("¿Seguro de borrar este rubro?")) {
        try {
            await deleteDoc(doc(db, 'rubros_publico', id));
            showToast("Rubro eliminado");
        } catch (e) { showToast("Error al eliminar"); }
    }
}

export function renderRubrosAdmin() {
    const list = document.getElementById('rubroList');
    if (!list) return;
    
    if (rubros.length === 0) {
        list.innerHTML = '<p class="text-sm text-muted text-center py-2">No hay rubros</p>';
        return;
    }
    
    list.innerHTML = '';
    rubros.sort((a,b) => b.createdAt - a.createdAt).forEach(item => {
        const row = createElement('div', 'flex justify-between items-center bg-white/5 p-2 rounded-xl border border-white/5 mb-1');
        row.appendChild(createElement('p', 'text-sm font-bold text-white uppercase', item.name));
        const btnDelete = createElement('button', 'btn btn-sm btn-ghost text-red hover:text-white', 'X');
        btnDelete.onclick = () => deleteRubro(item.id);
        row.appendChild(btnDelete);
        list.appendChild(row);
    });
}

function updateRubroSelect() {
    const rubroEl = document.getElementById('catRubroSelect');
    if (rubroEl) {
        rubroEl.innerHTML = '<option value="">Todos los Rubros</option>';
        rubros.forEach(r => {
            const opt = document.createElement('option');
            opt.value = r.name;
            opt.textContent = r.name;
            rubroEl.appendChild(opt);
        });
    }
}

// Helper to compress image
function compressImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = event => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                // Reducimos el tamaño máximo a 600 para que 5 fotos pesen menos
                const MAX_WIDTH = 600;
                const MAX_HEIGHT = 600;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }
                
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                // Convert to Base64 JPEG to save directly in Firestore (bypassing Storage issues)
                const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
                resolve(dataUrl);
            };
            img.onerror = error => reject(error);
        };
        reader.onerror = error => reject(error);
    });
}

// --- CATEGORIES ---
export async function addCategory() {
    const nameEl = document.getElementById('catNameInput');
    const rubroEl = document.getElementById('catRubroSelect');
    const btnAdd = document.getElementById('btnAddCategory');
    
    if (!nameEl.value || !rubroEl.value) {
        return showToast("Selecciona el rubro y escribe el nombre de la categoría");
    }
    
    btnAdd.disabled = true;
    try {
        await addDoc(collection(db, 'categorias_publico'), {
            name: nameEl.value,
            rubro: rubroEl.value,
            createdAt: Date.now()
        });
        showToast("Categoría añadida");
        nameEl.value = '';
    } catch (e) {
        showToast("Error al añadir categoría");
    } finally {
        btnAdd.disabled = false;
    }
}

export async function deleteCategory(id) {
    if (confirm("¿Estás seguro de borrar esta categoría?")) {
        try {
            await deleteDoc(doc(db, 'categorias_publico', id));
            showToast("Categoría eliminada");
        } catch (e) {
            showToast("Error al eliminar");
        }
    }
}

function updateCategorySelects() {
    const select = document.getElementById('catCategory');
    if (!select) return;
    
    select.innerHTML = '<option value="">Selecciona Categoría...</option>';
    
    rubros.forEach(r => {
        const catsInRubro = categories.filter(c => c.rubro === r.name);
        if (catsInRubro.length > 0) {
            const optgroup = document.createElement('optgroup');
            optgroup.label = r.name;
            catsInRubro.forEach(cat => {
                const opt = document.createElement('option');
                opt.value = cat.name;
                opt.textContent = cat.name;
                optgroup.appendChild(opt);
            });
            select.appendChild(optgroup);
        }
    });
    
    renderCategoriesAdmin();
}

export function renderCategoriesAdmin() {
    const list = document.getElementById('categoryList');
    if (!list) return;

    if (categories.length === 0) {
        list.innerHTML = '<p class="text-sm text-muted text-center py-4">No hay categorías</p>';
        return;
    }

    list.innerHTML = '';
    
    categories.sort((a, b) => b.createdAt - a.createdAt).forEach(item => {
        const row = createElement('div', 'flex justify-between items-center bg-white/5 p-2 rounded-xl border border-white/5 mb-2');
        
        const infoDiv = createElement('div', 'flex-col');
        infoDiv.appendChild(createElement('p', 'text-sm font-bold text-white', item.name));
        infoDiv.appendChild(createElement('p', 'text-xxs text-pink', item.rubro || 'Sin Rubro'));
        
        const btnDelete = createElement('button', 'btn btn-sm btn-ghost text-red hover:text-white', 'X');
        btnDelete.onclick = () => deleteCategory(item.id);
        
        row.appendChild(infoDiv);
        row.appendChild(btnDelete);
        list.appendChild(row);
    });
}

// --- WEB SERVICES ---

export async function addWebSvc() {
    const nameEl = document.getElementById('webSvcName');
    const priceEl = document.getElementById('webSvcPrice');
    const descEl = document.getElementById('webSvcDesc');
    const imageEl = document.getElementById('webSvcImage');
    const btnAdd = document.getElementById('btnAddWebSvc');
    const statusEl = document.getElementById('webSvcUploadStatus');
    
    if (!nameEl.value || !priceEl.value || !descEl.value) {
        return showToast("Completa todos los campos");
    }

    if (!editingWebSvcId && imageEl.files.length === 0) {
        return showToast("Debes seleccionar una foto para el servicio");
    }
    
    btnAdd.disabled = true;
    statusEl.style.display = 'block';
    
    let base64Image = null;
    try {
        if (imageEl.files.length > 0) {
            statusEl.textContent = 'Procesando imagen...';
            base64Image = await compressImage(imageEl.files[0]);
        }
    } catch (e) {
        showToast("Error al procesar la imagen");
        btnAdd.disabled = false;
        statusEl.style.display = 'none';
        return;
    }

    statusEl.textContent = 'Guardando...';

    const payload = {
        name: nameEl.value,
        basePrice: parseFloat(priceEl.value),
        description: descEl.value,
    };
    if (base64Image) {
        payload.imageUrl = base64Image;
    }
    
    try {
        if (editingWebSvcId) {
            await updateDoc(doc(db, 'servicios_publico', editingWebSvcId), payload);
            showToast("Servicio actualizado");
        } else {
            payload.createdAt = Date.now();
            await addDoc(collection(db, 'servicios_publico'), payload);
            showToast("Servicio añadido a la web");
        }
        window.cancelEditWebSvc();
    } catch (e) {
        showToast("Error al procesar servicio");
        btnAdd.disabled = false;
        statusEl.style.display = 'none';
    }
}

export async function deleteWebSvc(id) {
    if (confirm("¿Seguro de borrar este servicio de la web?")) {
        try {
            await deleteDoc(doc(db, 'servicios_publico', id));
            showToast("Servicio eliminado");
        } catch (e) {
            showToast("Error al eliminar");
        }
    }
}

export function renderWebSvcAdmin() {
    const list = document.getElementById('webSvcList');
    if (!list) return;

    if (webServices.length === 0) {
        list.innerHTML = '<p class="text-sm text-muted text-center py-4">No hay servicios web</p>';
        return;
    }

    list.innerHTML = '';
    
    webServices.sort((a, b) => b.createdAt - a.createdAt).forEach(item => {
        const row = createElement('div', 'flex justify-between items-center bg-white/5 p-2 rounded-xl border border-white/5 mb-2');
        
        const infoDiv = createElement('div', 'flex gap-3 items-center');
        const img = createElement('img', 'w-10 h-10 rounded-md object-cover bg-black');
        img.src = item.imageUrl || '';
        
        const textDiv = createElement('div', 'flex-col');
        const nameP = createElement('p', 'text-sm font-bold text-white', item.name);
        const detailsP = createElement('p', 'text-xxs text-muted', `Desde $${(item.basePrice || 0).toFixed(2)} - ${item.description}`);
        
        textDiv.appendChild(nameP);
        textDiv.appendChild(detailsP);
        
        infoDiv.appendChild(img);
        infoDiv.appendChild(textDiv);
        
        const actionsDiv = createElement('div', 'flex gap-2');
        const btnEdit = createElement('button', 'btn btn-sm btn-secondary text-white', 'Editar');
        btnEdit.onclick = () => window.editWebSvc(item.id);
        const btnDelete = createElement('button', 'btn btn-sm btn-ghost text-red hover:text-white', 'X');
        btnDelete.onclick = () => deleteWebSvc(item.id);
        
        actionsDiv.appendChild(btnEdit);
        actionsDiv.appendChild(btnDelete);
        
        row.appendChild(infoDiv);
        row.appendChild(actionsDiv);
        list.appendChild(row);
    });
}

window.editWebSvc = function(id) {
    const item = webServices.find(i => i.id === id);
    if (!item) return;
    
    editingWebSvcId = id;
    
    document.getElementById('webSvcName').value = item.name || '';
    document.getElementById('webSvcPrice').value = item.basePrice || '';
    document.getElementById('webSvcDesc').value = item.description || '';
    
    document.getElementById('webSvcImage').value = '';
    const preview = document.getElementById('webSvcImagePreview');
    if (item.imageUrl) {
        preview.src = item.imageUrl;
        preview.classList.remove('hidden');
    } else {
        preview.classList.add('hidden');
    }
    
    document.getElementById('btnAddWebSvc').textContent = 'Actualizar Servicio';
    document.getElementById('btnCancelEditWebSvc').classList.remove('hidden');
};

window.cancelEditWebSvc = function() {
    editingWebSvcId = null;
    document.getElementById('webSvcName').value = '';
    document.getElementById('webSvcPrice').value = '';
    document.getElementById('webSvcDesc').value = '';
    document.getElementById('webSvcImage').value = '';
    document.getElementById('webSvcImagePreview').classList.add('hidden');
    
    document.getElementById('btnAddWebSvc').textContent = 'Añadir Servicio Público';
    document.getElementById('btnAddWebSvc').disabled = false;
    document.getElementById('btnCancelEditWebSvc').classList.add('hidden');
    document.getElementById('webSvcUploadStatus').style.display = 'none';
};


export async function addCatalogItem() {
    try {
        const nameEl = document.getElementById('catName');
        const priceEl = document.getElementById('catPrice');
        const descEl = document.getElementById('catDesc');
        const imageEl = document.getElementById('catImage');
        const catEl = document.getElementById('catCategory');
        const wholesalePriceEl = document.getElementById('catWholesalePrice');
        const wholesaleQtyEl = document.getElementById('catWholesaleQty');
        const btnAdd = document.getElementById('btnAddCatalog');
        const statusEl = document.getElementById('catUploadStatus');
        
        if (!nameEl || !priceEl || !descEl || !imageEl || !catEl || !btnAdd || !statusEl) {
            alert("Error interno: No se encontraron los campos del formulario.");
            return;
        }

        if (!nameEl.value || !priceEl.value || !catEl.value) {
            return showToast("Rellena todos los campos obligatorios");
        }

        if (!editingCatalogId && imageEl.files.length === 0) {
            return showToast("Debes seleccionar al menos una foto para el nuevo producto");
        }

        if (imageEl.files.length > 5) {
            return showToast("Solo puedes subir un máximo de 5 fotos por producto");
        }

        btnAdd.disabled = true;
        statusEl.style.display = 'block';
        
        let base64Images = [];
        
        try {
            if (imageEl.files.length > 0) {
                statusEl.textContent = 'Procesando imágenes...';
                const fileArray = Array.from(imageEl.files).slice(0, 5);
                for (let i = 0; i < fileArray.length; i++) {
                    statusEl.textContent = `Procesando imagen ${i+1} de ${fileArray.length}...`;
                    const b64 = await compressImage(fileArray[i]);
                    base64Images.push(b64);
                }
            }
        } catch (imgError) {
            alert("Error al procesar las imágenes: " + imgError.message);
            btnAdd.disabled = false;
            statusEl.style.display = 'none';
            return;
        }
            
        statusEl.textContent = 'Guardando en base de datos...';
        
        const payload = {
            name: nameEl.value,
            price: parseFloat(priceEl.value),
            description: descEl.value,
            category: catEl.value,
            wholesalePrice: wholesalePriceEl.value ? parseFloat(wholesalePriceEl.value) : null,
            wholesaleQty: wholesaleQtyEl.value ? parseInt(wholesaleQtyEl.value) : null,
        };
        
        if (base64Images.length > 0) {
            payload.imageUrl = base64Images[0];
            payload.imageUrls = base64Images;
        }
        
        if (editingCatalogId) {
            // Update
            await updateDoc(doc(db, 'catalogo_publico', editingCatalogId), payload);
            showToast("Producto actualizado");
        } else {
            // Create
            payload.createdAt = Date.now();
            await addDoc(collection(db, 'catalogo_publico'), payload);
            showToast("Producto añadido al catálogo");
        }
        
        // Reset form
        window.cancelEditCatalog();
        nameEl.value = '';
        priceEl.value = '';
        descEl.value = '';
        imageEl.value = '';
        catEl.value = '';
        if(wholesalePriceEl) wholesalePriceEl.value = '';
        if(wholesaleQtyEl) wholesaleQtyEl.value = '';
        
        const previewContainer = document.getElementById('catImagePreviewContainer');
        if (previewContainer) {
            previewContainer.innerHTML = '';
            previewContainer.classList.add('hidden');
        }
        
        btnAdd.disabled = false;
        statusEl.style.display = 'none';

    } catch (error) {
        console.error("Error FATAL adding catalog item:", error);
        alert("ERROR FATAL GUARDANDO PRODUCTO:\n" + error.message);
        const btnAdd = document.getElementById('btnAddCatalog');
        const statusEl = document.getElementById('catUploadStatus');
        if (btnAdd) btnAdd.disabled = false;
        if (statusEl) statusEl.style.display = 'none';
    }
}

export async function deleteCatalogItem(id) {
    if (confirm("¿Estás seguro de borrar este producto del catálogo público?")) {
        try {
            await deleteDoc(doc(db, 'catalogo_publico', id));
            showToast("Producto eliminado");
        } catch (e) {
            console.error("Error deleting product", e);
            showToast("Error al eliminar");
        }
    }
}

export function renderCatalogAdmin() {
    const list = document.getElementById('catalogList');
    if (!list) return;

    if (catalogItems.length === 0) {
        list.innerHTML = '<p class="text-sm text-muted text-center py-4">Catálogo vacío</p>';
        return;
    }

    list.innerHTML = '';
    
    catalogItems.sort((a, b) => b.createdAt - a.createdAt).forEach(item => {
        const row = createElement('div', 'flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/5');
        
        const info = createElement('div', 'flex gap-3 items-center');
        const img = createElement('img', 'w-12 h-12 rounded-lg object-cover bg-black');
        img.src = (item.imageUrls && item.imageUrls.length > 0) ? item.imageUrls[0] : (item.imageUrl || '');
        img.alt = item.name;
        
        const textDiv = createElement('div', 'flex-col');
        const nameP = createElement('p', 'text-sm font-bold text-white', item.name);
        const catP = createElement('p', 'text-xxs text-pink', item.category || 'Sin Categoría');
        const priceP = createElement('p', 'text-xs font-bold text-green', formatUSD(item.price));
        
        textDiv.appendChild(nameP);
        textDiv.appendChild(catP);
        textDiv.appendChild(priceP);
        
        info.appendChild(img);
        info.appendChild(textDiv);
        
        const actionsDiv = createElement('div', 'flex gap-2');
        
        const btnEdit = createElement('button', 'btn btn-sm btn-secondary text-white', 'Editar');
        btnEdit.onclick = () => window.editCatalogItem(item.id);
        
        const btnDelete = createElement('button', 'btn btn-sm btn-ghost text-red hover:text-white hover:bg-red', 'Borrar');
        btnDelete.onclick = () => deleteCatalogItem(item.id);
        
        actionsDiv.appendChild(btnEdit);
        actionsDiv.appendChild(btnDelete);
        
        row.appendChild(info);
        row.appendChild(actionsDiv);
        
        list.appendChild(row);
    });
}

// Window functions for Edit
window.editCatalogItem = function(id) {
    const item = catalogItems.find(i => i.id === id);
    if (!item) return;
    
    editingCatalogId = id;
    
    document.getElementById('catName').value = item.name || '';
    document.getElementById('catPrice').value = item.price || '';
    document.getElementById('catDesc').value = item.description || '';
    document.getElementById('catCategory').value = item.category || '';
    document.getElementById('catWholesalePrice').value = item.wholesalePrice || '';
    document.getElementById('catWholesaleQty').value = item.wholesaleQty || '';
    
    // Clear images logic
    document.getElementById('catImage').value = '';
    const previewContainer = document.getElementById('catImagePreviewContainer');
    if (previewContainer) {
        previewContainer.innerHTML = '';
        previewContainer.classList.add('hidden');
    }
    
    document.getElementById('btnAddCatalog').textContent = 'Actualizar Producto';
    document.getElementById('btnCancelEditCatalog').classList.remove('hidden');
    
    // Scroll up to form
    document.getElementById('catName').scrollIntoView({ behavior: 'smooth' });
};

window.cancelEditCatalog = function() {
    editingCatalogId = null;
    
    document.getElementById('catName').value = '';
    document.getElementById('catPrice').value = '';
    document.getElementById('catDesc').value = '';
    document.getElementById('catCategory').value = '';
    document.getElementById('catWholesalePrice').value = '';
    document.getElementById('catWholesaleQty').value = '';
    document.getElementById('catImage').value = '';
    
    const previewContainer = document.getElementById('catImagePreviewContainer');
    if (previewContainer) {
        previewContainer.innerHTML = '';
        previewContainer.classList.add('hidden');
    }
    
    document.getElementById('btnAddCatalog').textContent = 'Añadir Producto';
    document.getElementById('btnCancelEditCatalog').classList.add('hidden');
    
    const statusEl = document.getElementById('catUploadStatus');
    if (statusEl) {
        statusEl.style.display = 'none';
        document.getElementById('btnAddCatalog').disabled = false;
    }
};
