import { auth } from "./firebase-config.js";
import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

document.addEventListener("DOMContentLoaded", () => {
  const chatForm = document.getElementById("chatForm");
  const userInput = document.getElementById("userInput");
  const chatbox = document.getElementById("chatbox");
  const historyList = document.getElementById("historyList");
  const clearHistoryBtn = document.getElementById("clearHistory");

  let chats = [];
  let currentChatId = null;
  let currentUID = null;

  /* ===============================
     1. FIREBASE LOGIN CHECK
  ================================ */
  onAuthStateChanged(auth, (user) => {
    if (!user) {
      window.location.href = "/login";
    } else {
      currentUID = user.uid;

      //  LOAD USER-SPECIFIC CHAT HISTORY
      chats = JSON.parse(
        localStorage.getItem("chatHistory_" + currentUID)
      ) || [];

      loadHistory();
    }
  });

  /* ===============================
     2. CHAT SUBMIT
  ================================ */
  chatForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const message = userInput.value.trim();
    if (!message) return;

    if (!currentChatId) {
      currentChatId = "chat_" + Date.now();
      chats.push({
        id: currentChatId,
        title: message.substring(0, 25),
        messages: []
      });
    }

    addMessage("user", message);
    saveMessage("user", message);
    userInput.value = "";

    try {
      const response = await fetch("/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message })
      });

      const data = await response.json();
      const reply = data.reply || "No response";

      addMessage("bot", reply);
      saveMessage("bot", reply);

    } catch (error) {
      addMessage("bot", " Server error");
      saveMessage("bot", " Server error");
    }

    saveToStorage();
    loadHistory();
  });

  /* ===============================
     3. ADD MESSAGE (UI)
  ================================ */
  function addMessage(sender, text) {
    const msgWrapper = document.createElement("div");

    msgWrapper.style.maxWidth = "70%";
    msgWrapper.style.padding = "10px 14px";
    msgWrapper.style.margin = "8px";
    msgWrapper.style.borderRadius = "12px";
    msgWrapper.style.fontSize = "14px";
    msgWrapper.style.wordBreak = "break-word";

    const label = document.createElement("div");
    label.style.fontSize = "11px";
    label.style.fontWeight = "bold";
    label.style.marginBottom = "4px";
    label.innerText = sender === "user" ? " You" : " Assistant";

    if (sender === "user") {
      msgWrapper.style.marginLeft = "auto";
      msgWrapper.style.background = "#DCF8C6";
      label.style.textAlign = "right";
    } else {
      msgWrapper.style.marginRight = "auto";
      msgWrapper.style.background = "#F1F0F0";
      label.style.textAlign = "left";
    }

    const msgText = document.createElement("div");
    msgText.innerText = text;

    msgWrapper.appendChild(label);
    msgWrapper.appendChild(msgText);
    chatbox.appendChild(msgWrapper);
    chatbox.scrollTop = chatbox.scrollHeight;
  }

  /* ===============================
     4. SAVE MESSAGE
  ================================ */
  function saveMessage(sender, text) {
    const chat = chats.find(c => c.id === currentChatId);
    if (chat) chat.messages.push({ sender, text });
  }

  /* ===============================
     5. HISTORY SIDEBAR
  ================================ */
  function loadHistory() {
    historyList.innerHTML = "";
    chats.forEach(chat => {
      const li = document.createElement("li");
      li.innerText = chat.title;
      li.style.cursor = "pointer";
      li.onclick = () => loadChat(chat.id);
      historyList.appendChild(li);
    });
  }

  /* ===============================
     6. LOAD OLD CHAT
  ================================ */
  function loadChat(chatId) {
    chatbox.innerHTML = "";
    currentChatId = chatId;

    const chat = chats.find(c => c.id === chatId);
    if (!chat) return;

    chat.messages.forEach(msg => {
      addMessage(msg.sender, msg.text);
    });
  }

  /* ===============================
     7. CLEAR HISTORY (USER-WISE)
  ================================ */
  clearHistoryBtn.addEventListener("click", () => {
    if (!currentUID) return;

    localStorage.removeItem("chatHistory_" + currentUID);
    chats = [];
    currentChatId = null;

    historyList.innerHTML = "";
    chatbox.innerHTML = "";
  });

  /* ===============================
     8. SAVE TO STORAGE (USER-WISE)
  ================================ */
  function saveToStorage() {
    if (!currentUID) return;

    localStorage.setItem(
      "chatHistory_" + currentUID,
      JSON.stringify(chats)
    );
  }
});
