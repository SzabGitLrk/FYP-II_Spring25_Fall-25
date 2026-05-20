import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyCR4waFGDjzq10I0qjcdNCdbDPhcHhP9pY",
  authDomain: "medilink-app-a214e.firebaseapp.com",
  projectId: "medilink-app-a214e",
  storageBucket: "medilink-app-a214e.appspot.com",
  messagingSenderId: "100650646873",
  appId: "1:100650646873:web:your-app-id"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export default app;