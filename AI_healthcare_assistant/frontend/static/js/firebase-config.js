// Make sure this file is saved as firebase-config.js
// and that your HTML script includes type="module"

// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";

// Your Firebase configuration
const firebaseConfig = {
  apiKey: "your_key",
  authDomain: "your_domain_name",
  databaseURL: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// Export modules
export { app, auth, db };