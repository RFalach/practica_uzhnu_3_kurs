import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';


const firebaseConfig = {
    apiKey: "AIzaSyBqEvh1Hpu4dGLKNDqOjlkIx8RLdag4lo0",
    authDomain: "practica-3-kurs.firebaseapp.com",
    projectId: "practica-3-kurs",
    storageBucket: "practica-3-kurs.firebasestorage.app",
    messagingSenderId: "352440434967",
    appId: "1:352440434967:web:4cfef4bf6d04973eb63752"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();

