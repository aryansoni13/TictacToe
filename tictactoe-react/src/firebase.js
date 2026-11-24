import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// These values identify the project and are safe in client code; the Firestore rules are what protect the data.
const app = initializeApp({
  apiKey: 'AIzaSyBChc3abIebDZ9QBeL_e6vBH-kCRo7g8wI',
  authDomain: 'tictactoe-742ff.firebaseapp.com',
  projectId: 'tictactoe-742ff',
  storageBucket: 'tictactoe-742ff.firebasestorage.app',
  messagingSenderId: '804831526667',
  appId: '1:804831526667:web:1ab417f7e5839924caec0e',
});

export const auth = getAuth(app);
export const db = getFirestore(app);
