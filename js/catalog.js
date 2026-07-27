import { db, storage } from './firebase.js';
import { collection, addDoc, getDocs, deleteDoc, doc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { ref, uploadBytesResumable, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";
import { formatUSD, showToast, createElement } from './utils.js';

let catalogItems = [];

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
}

export async function addCatalogItem() {
    const nameEl = document.getElementById('catName');
    const priceEl = document.getElementById('catPrice');
    const descEl = document.getElementById('catDesc');
    const imageEl = document.getElementById('catImage');
    const btnAdd = document.getElementById('btnAddCatalog');
    const statusEl = document.getElementById('catUploadStatus');
    
    if (!nameEl.value || !priceEl.value || !descEl.value) {
        return showToast("Completa los datos del producto");
    }

    if (!imageEl.files || imageEl.files.length === 0) {
        return showToast("Debes seleccionar una imagen");
    }

    const file = imageEl.files[0];
    
    btnAdd.disabled = true;
    statusEl.classList.remove('hidden');
    
    try {
        // Upload image to Storage
        const storageRef = ref(storage, `catalog/${Date.now()}_${file.name}`);
        const uploadTask = await uploadBytesResumable(storageRef, file);
        const imageUrl = await getDownloadURL(uploadTask.ref);

        // Save to Firestore
        await addDoc(collection(db, 'catalogo_publico'), {
            name: nameEl.value,
            price: parseFloat(priceEl.value),
            description: descEl.value,
            imageUrl: imageUrl,
            createdAt: Date.now()
        });

        showToast("Producto añadido al catálogo");
        
        // Reset form
        nameEl.value = '';
        priceEl.value = '';
        descEl.value = '';
        imageEl.value = '';
        
    } catch (error) {
        console.error("Error adding catalog item:", error);
        showToast("Error al subir el producto");
    } finally {
        btnAdd.disabled = false;
        statusEl.classList.add('hidden');
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
        const priceP = createElement('p', 'text-xs font-bold text-green', formatUSD(item.price));
        
        textDiv.appendChild(nameP);
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
