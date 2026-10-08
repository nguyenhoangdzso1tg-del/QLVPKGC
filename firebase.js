import { initializeApp } from
"https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";

import { getFirestore } from
"https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

import { getAuth } from 
"https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
  const firebaseConfig = {
    apiKey: "AIzaSyAXRG_vQa1TFgFk7o4x07uTiIKpU3qg2IU",
    authDomain: "fir-7ab56.firebaseapp.com",
    projectId: "fir-7ab56",
    storageBucket: "fir-7ab56.firebasestorage.app",
    messagingSenderId: "565671620833",
    appId: "1:565671620833:web:ea0c0b92b1264e87d887a0"
  };
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);