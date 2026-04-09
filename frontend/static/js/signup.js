import { auth } from "./firebase-config.js";
import { createUserWithEmailAndPassword, updateProfile } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

document.addEventListener("DOMContentLoaded", function () {
  const form = document.getElementById("signupForm");
  const statusDiv = document.getElementById("signupStatus");

  if (!form || !statusDiv) {
    console.error("Signup form or status div not found!");
    return;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const fullname = document.getElementById("fullname").value.trim();
    const age = document.getElementById("age").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();
    const confirmPassword = document.getElementById("confirmPassword").value.trim();

    // Basic validation
    if (!fullname || !age || !email || !password || !confirmPassword) {
      statusDiv.textContent = "All fields are required!";
      statusDiv.style.color = "red";
      return;
    }

    if (password !== confirmPassword) {
      statusDiv.textContent = "Passwords do not match!";
      statusDiv.style.color = "red";
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(userCredential.user, { displayName: fullname });

      statusDiv.textContent = "Signup successful!";
      statusDiv.style.color = "green";

      setTimeout(() => {
        window.location.href = "/login";
      }, 1500);

    } catch (err) {
      statusDiv.textContent = err.message;
      statusDiv.style.color = "red";
    }
  });
});