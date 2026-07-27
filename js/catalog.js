import { db, storage } from './firebase.js';
import { collection, addDoc, getDocs, deleteDoc, doc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";
import { formatUSD, showToast, createElement } from './utils.js';

let catalogItems = [];
let categories = [];
let webServices = [];

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

export async function addCategory() {
    const nameEl = document.getElementById('catNameInput');
    const btnAdd = document.getElementById('btnAddCategory');
    
    if (!nameEl.value) {
        return showToast("Escribe el nombre de la categoría");
    }
    
    btnAdd.disabled = true;
    try {
        await addDoc(collection(db, 'categorias_publico'), {
            name: nameEl.value,
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
    categories.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat.name;
        opt.textContent = cat.name;
        select.appendChild(opt);
    });
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
        
        const nameP = createElement('p', 'text-sm font-bold text-white', item.name);
        
        const btnDelete = createElement('button', 'btn btn-sm btn-ghost text-red hover:text-white', 'X');
        btnDelete.onclick = () => deleteCategory(item.id);
        
        row.appendChild(nameP);
        row.appendChild(btnDelete);
        list.appendChild(row);
    });
}

// --- WEB SERVICES ---

export async function addWebSvc() {
    const nameEl = document.getElementById('webSvcName');
    const emojiEl = document.getElementById('webSvcEmoji');
    const priceEl = document.getElementById('webSvcPrice');
    const descEl = document.getElementById('webSvcDesc');
    const btnAdd = document.getElementById('btnAddWebSvc');
    
    if (!nameEl.value || !emojiEl.value || !priceEl.value || !descEl.value) {
        return showToast("Completa todos los campos");
    }
    
    btnAdd.disabled = true;
    try {
        await addDoc(collection(db, 'servicios_publico'), {
            name: nameEl.value,
            emoji: emojiEl.value,
            basePrice: parseFloat(priceEl.value),
            description: descEl.value,
            createdAt: Date.now()
        });
        showToast("Servicio añadido a la web");
        nameEl.value = '';
        emojiEl.value = '';
        priceEl.value = '';
        descEl.value = '';
    } catch (e) {
        showToast("Error al añadir servicio");
    } finally {
        btnAdd.disabled = false;
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
        
        const infoDiv = createElement('div', 'flex-col');
        const nameP = createElement('p', 'text-sm font-bold text-white', `${item.emoji} ${item.name}`);
        const detailsP = createElement('p', 'text-xxs text-muted', `Desde $${item.basePrice.toFixed(2)} - ${item.description}`);
        
        infoDiv.appendChild(nameP);
        infoDiv.appendChild(detailsP);
        
        const btnDelete = createElement('button', 'btn btn-sm btn-ghost text-red hover:text-white', 'X');
        btnDelete.onclick = () => deleteWebSvc(item.id);
        
        row.appendChild(infoDiv);
        row.appendChild(btnDelete);
        list.appendChild(row);
    });
}


export async function addCatalogItem() {
    const nameEl = document.getElementById('catName');
    const priceEl = document.getElementById('catPrice');
    const descEl = document.getElementById('catDesc');
    const imageEl = document.getElementById('catImage');
    const catEl = document.getElementById('catCategory');
    const btnAdd = document.getElementById('btnAddCatalog');
    const statusEl = document.getElementById('catUploadStatus');
    
    if (!nameEl.value || !priceEl.value || !descEl.value || !catEl.value) {
        return showToast("Completa los datos y selecciona una categoría");
    }

    if (!imageEl.files || imageEl.files.length === 0) {
        return showToast("Debes seleccionar una imagen");
    }

    const file = imageEl.files[0];
    
    btnAdd.disabled = true;
    statusEl.style.display = 'block';
    statusEl.textContent = 'Subiendo imagen a Firebase...';
    
    try {
        // Upload image to Storage using uploadBytes (more reliable for simple files)
        const storageRef = ref(storage, `catalog/${Date.now()}_${file.name}`);
        const uploadTask = await uploadBytes(storageRef, file);
        const imageUrl = await getDownloadURL(uploadTask.ref);

        // Save to Firestore
        await addDoc(collection(db, 'catalogo_publico'), {
            name: nameEl.value,
            price: parseFloat(priceEl.value),
            description: descEl.value,
            category: catEl.value,
            imageUrl: imageUrl,
            createdAt: Date.now()
        });

        showToast("Producto añadido al catálogo");
        
        // Reset form
        nameEl.value = '';
        priceEl.value = '';
        descEl.value = '';
        imageEl.value = '';
        catEl.value = '';
        
    } catch (error) {
        console.error("Error adding catalog item:", error);
        alert("ERROR SUBIENDO FOTO:\n" + error.message + "\n\n¿Activaste Storage en Firebase y pegaste las reglas correctamente?");
    } finally {
        btnAdd.disabled = false;
        statusEl.style.display = 'none';
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
        img.src = item.imageUrl;
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
        
        const btnDelete = createElement('button', 'btn btn-sm btn-ghost text-red hover:text-white hover:bg-red', 'Borrar');
        btnDelete.onclick = () => deleteCatalogItem(item.id);
        
        row.appendChild(info);
        row.appendChild(btnDelete);
        
        list.appendChild(row);
    });
}
