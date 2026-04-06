import { auth } from "./firebase-config.js";
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

document.addEventListener("DOMContentLoaded", function () {
  const form = document.getElementById("loginForm");
  const statusDiv = document.getElementById("loginStatus");

  // Safety check
  if (!form || !statusDiv) {
    console.error("Form or status div not found in DOM!");
    return;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();

    if (!email || !password) {
      statusDiv.textContent = "All fields are required!";
      statusDiv.style.color = "red";
      return;
    }

    try {
      await signInWithEmailAndPassword(auth,email, password);
      statusDiv.textContent = "Login successful!";
      statusDiv.style.color = "green";

      // Redirect to dashboard after 1 second
      setTimeout(() => {
        window.location.href = "/dashboard";
      }, 1000);

    } catch (err) {
      statusDiv.textContent = err.message;
      statusDiv.style.color = "red";
    }
  });
});