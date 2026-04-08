# 🚀 YOLOv8 Service Start Karne Ka Tarika

## ⚠️ Problem:
Abhi **2 services** chal rahi hain:
- ✅ Frontend (port 3000)
- ✅ ExpressJS (port 3500)
- ❌ **YOLOv8 Service (port 5000) - MISSING!**

## ✅ Solution: 3rd Terminal Mein YOLOv8 Start Karo

### Step 1: Naya Terminal/CMD Window Kholein
**Windows PowerShell ya CMD open karein**

### Step 2: YOLOv8 Service Start Karo
```bash
cd C:\Users\Public\Weapon_Detection_IN_ATM_Using_CCTV\yolov8_service
python app.py
```

### Step 3: Dekho Output
Agar sab theek hai, to ye dikhega:
```
🔄 Loading YOLOv8 model from: yolov8n.pt
✅ YOLOv8 model loaded successfully
🚀 Starting YOLOv8 detection service on port 5000
```

## 📋 Complete Setup (3 Terminals):

### **Terminal 1: YOLOv8 Service** (Ye MISSING hai!)
```bash
cd C:\Users\Public\Weapon_Detection_IN_ATM_Using_CCTV\yolov8_service
python app.py
```

### **Terminal 2: ExpressJS** (Already running ✅)
```bash
cd C:\Users\Public\Weapon_Detection_IN_ATM_Using_CCTV\ExpressJS
npm run dev
```

### **Terminal 3: Frontend** (Already running ✅)
```bash
cd C:\Users\Public\Weapon_Detection_IN_ATM_Using_CCTV\frontend
npm start
```

---

## ❌ Agar YOLOv8 Service Na Chale:

### Option 1: Local Fallback Use Hoga
- Frontend local detection use karega
- Par ye accurate nahi hoga
- Red box center mein dikhega (gun location par nahi)

### Option 2: YOLOv8 Service Start Karo
- Real YOLOv8 detection hoga
- Accurate red boxes gun ke around
- Real accuracy percentages

---

**Ab 3rd terminal mein YOLOv8 service start karo, phir test karo!** 🎯

