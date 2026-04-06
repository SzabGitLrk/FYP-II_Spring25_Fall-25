import { auth, db } from "./firebase-config.js";
import { ref, onValue } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";

document.addEventListener("DOMContentLoaded", () => {
    const tableBody = document.querySelector("tbody");

    auth.onAuthStateChanged((user) => {
        if (!user) return;

        // 🔴 CLEAR OLD DATA (IMPORTANT)
        tableBody.innerHTML = "";

        // ------------------------------
        // 1️⃣ Fetch Reminders
        // ------------------------------
        const remindersRef = ref(db, `reminders/${user.uid}`);
        onValue(remindersRef, (snapshot) => {
            snapshot.forEach((childSnapshot) => {
                const data = childSnapshot.val();
                const tr = document.createElement("tr");
                const dateTime = `${data.date || ""} ${data.time || ""}`.trim();

                tr.innerHTML = `
                    <td>${dateTime}</td>
                    <td>Reminder Set</td>
                    <td>${data.medicine || data.title || ""}</td>
                    <td><span class="status success">Active</span></td>
                `;
                tableBody.appendChild(tr);
            });
        });

        // ------------------------------
        // 2️⃣ Fetch Chat History
        // ------------------------------
        const chatRef = ref(db, `chat_history/${user.uid}`);
        onValue(chatRef, (snapshot) => {
            snapshot.forEach((childSnapshot) => {
                const data = childSnapshot.val();
                const tr = document.createElement("tr");

                tr.innerHTML = `
                    <td>--</td>
                    <td>Chatbot</td>
                    <td>${data.sender}: ${data.message}</td>
                    <td><span class="status info">Answered</span></td>
                `;
                tableBody.appendChild(tr);
            });
        });
    });
});
