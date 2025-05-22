import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyB2snLblJfjxpdQzXsV56KEMMAMwXV1prY",
  authDomain: "sendingnotification-e08c8.firebaseapp.com",
  projectId: "sendingnotification-e08c8",
  storageBucket: "sendingnotification-e08c8.firebasestorage.app",
  messagingSenderId: "979972555401",
  appId: "1:979972555401:web:0bea82500725edd6427c58",
  measurementId: "G-Q5FBCMMGGM"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Get Auth instance
export const auth = getAuth(app);

// Initialize Firestore
export const db = getFirestore(app); 