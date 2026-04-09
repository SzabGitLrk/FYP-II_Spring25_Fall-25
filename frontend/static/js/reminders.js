// reminders.js
import { auth, db } from "./firebase-config.js";
import { ref, push, onValue, remove } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";

document.addEventListener("DOMContentLoaded", () => {
    const reminderForm = document.getElementById("reminderForm");
    const medicineInput = document.getElementById("medicine");
    const dateInput = document.getElementById("date");
    const timeInput = document.getElementById("time");
    const reminderList = document.getElementById("reminderList");

    // 🔔 Request notification permission
    if ("Notification" in window && Notification.permission !== "granted") {
        Notification.requestPermission();
    }

    auth.onAuthStateChanged(user => {
        if (!user) return;

        const remindersRef = ref(db, `reminders/${user.uid}`);

        // 🔄 Load reminders
        onValue(remindersRef, snapshot => {
            reminderList.innerHTML = "";

            snapshot.forEach(childSnapshot => {
                const data = childSnapshot.val();
                const li = document.createElement("li");
                li.textContent = `${data.medicine} at ${data.date} ${data.time}`;

                //  schedule popup
                scheduleNotification(data.medicine, data.date, data.time);

                // Delete reminder
                const deleteBtn = document.createElement("button");
                deleteBtn.textContent = "Delete";
                deleteBtn.classList.add("delete-btn");
                deleteBtn.onclick = async () => {
                    await remove(ref(db, `reminders/${user.uid}/${childSnapshot.key}`));
                };

                li.appendChild(deleteBtn);
                reminderList.appendChild(li);
            });
        });

        // ➕ Add reminder
        reminderForm.addEventListener("submit", async e => {
            e.preventDefault();

            const medicine = medicineInput.value.trim();
            const date = dateInput.value;
            const time = timeInput.value;

            if (!medicine || !date || !time) return;

            await push(remindersRef, { medicine, date, time });
            reminderForm.reset();
        });
    });
});

/* ===============================
   🔔 POPUP NOTIFICATION ONLY
================================ */
function scheduleNotification(medicine, date, time) {
    const reminderTime = new Date(`${date}T${time}`);
    const now = new Date();
    const delay = reminderTime - now;

    if (delay <= 0) return;

    setTimeout(() => {
        if (Notification.permission === "granted") {
            new Notification("Medicine Reminder", {
                body: `Time to take: ${medicine}`
            });
        } else {
            alert(`Time to take your medicine: ${medicine}`);
        }
    }, delay);
}
