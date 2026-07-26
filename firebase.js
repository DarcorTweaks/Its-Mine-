import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInWithCustomToken, signInWithEmailAndPassword, signOut, onAuthStateChanged, signInAnonymously } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, doc, setDoc, deleteDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

let firebaseConfig;
if (typeof __firebase_config !== 'undefined') {
    firebaseConfig = JSON.parse(__firebase_config); 
} else {
    firebaseConfig = {
        apiKey: "AIzaSyAmP2L1uVWOurAmic3A8eIecRPD6iv3FaA",
        authDomain: "its-mine-printer3d.firebaseapp.com",
        projectId: "its-mine-printer3d",
        storageBucket: "its-mine-printer3d.firebasestorage.app",
        messagingSenderId: "460313004830",
        appId: "1:460313004830:web:bcc7590dcf23722396170f"
    };
}

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const canvasAppId = typeof __app_id !== 'undefined' ? __app_id : 'its-mine-printer-3d';
let currentUserId = null;

// Nombre de la colección pública del catálogo (NO va bajo la ruta privada del usuario)
export const CATALOG_COLLECTION = 'catalogo_publico';

export { db, auth, currentUserId };

export function getColPath(colName) {
    if (typeof __app_id !== 'undefined') {
        return collection(db, 'artifacts', canvasAppId, 'users', currentUserId, colName);
    } else {
        return collection(db, `usuarios/${currentUserId}/${colName}`);
    }
}

export async function initAuth() {
    try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
            await signInWithCustomToken(auth, __initial_auth_token);
        } else {
            // we will let the UI handle email login, or attempt anonymous if needed
            // await signInAnonymously(auth);
        }
    } catch (e) { console.error("Error Auth:", e); }
}

export function onAuthReady(callback) {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUserId = user.uid;
        } else {
            currentUserId = null;
        }
        callback(user);
    });
}

export async function loginWithEmail(email, password) {
    await signInWithEmailAndPassword(auth, email, password);
}

export async function logout() {
    await signOut(auth);
}

export async function saveDoc(colName, docId, data) {
    if (!currentUserId) throw new Error("Not logged in");
    await setDoc(doc(getColPath(colName), docId), data, { merge: true });
}

export async function removeDoc(colName, docId) {
    if (!currentUserId) throw new Error("Not logged in");
    await deleteDoc(doc(getColPath(colName), docId));
}

export function listenCollection(colName, callback) {
    if (!currentUserId) return () => {};
    return onSnapshot(getColPath(colName), (snapshot) => {
        const data = [];
        snapshot.forEach(doc => data.push(doc.data()));
        data.sort((a, b) => a.timestamp - b.timestamp);
        callback(data);
    }, e => console.error(e));
}

export function listenDoc(colName, docId, callback) {
    if (!currentUserId) return () => {};
    return onSnapshot(doc(getColPath(colName), docId), (docSnap) => {
        if (docSnap.exists()) {
            callback(docSnap.data());
        } else {
            callback(null);
        }
    }, e => console.error(e));
}

// --- CATÁLOGO PÚBLICO (visible en index.html sin necesidad de login) ---
// La foto se guarda comprimida como texto (base64) dentro del mismo documento,
// así no necesitamos Firebase Storage ni el plan de pago.

export async function saveCatalogItem(itemId, data) {
    await setDoc(doc(db, CATALOG_COLLECTION, itemId), data, { merge: true });
}

export async function deleteCatalogItem(itemId) {
    await deleteDoc(doc(db, CATALOG_COLLECTION, itemId));
}

// No requiere login: cualquier visitante (o el propio admin) puede escuchar el catálogo público
export function listenPublicCatalog(callback) {
    return onSnapshot(collection(db, CATALOG_COLLECTION), (snapshot) => {
        const data = [];
        snapshot.forEach(d => data.push(d.data()));
        data.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        callback(data);
    }, e => console.error("Error leyendo catálogo:", e));
}
