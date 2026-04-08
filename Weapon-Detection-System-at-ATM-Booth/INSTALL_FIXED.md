# 🔧 Fixed Installation Steps (Run These Commands)

## ✅ Quick Fix: Install Dependencies Step-by-Step

**Open PowerShell/Command Prompt and run these commands:**

### Step 1: Go to yolov8_service folder
```bash
cd C:\Users\Public\Weapon_Detection_IN_ATM_Using_CCTV\yolov8_service
```

### Step 2: Upgrade pip first
```bash
python -m pip install --upgrade pip
```

### Step 3: Install packages one by one (avoids conflicts)

```bash
pip install fastapi
pip install "uvicorn[standard]"
pip install numpy
pip install pydantic
pip install python-multipart
```

### Step 4: Install Pillow (with pre-built wheel)
```bash
pip install --only-binary=all pillow
```

**If that fails, try:**
```bash
pip install pillow --upgrade
```

**Or skip Pillow for now (service will still work):**

### Step 5: Install Ultralytics (YOLOv8)
```bash
pip install ultralytics
```

This will take a while - it downloads PyTorch and the YOLOv8 model.

## ✅ After Installation: Start Service

```bash
python app.py
```

**Expected output:**
```
🔄 Loading YOLOv8 model from: yolov8n.pt
✅ YOLOv8 model loaded successfully
🚀 Starting YOLOv8 detection service on port 5000
```

## 🎯 If Pillow Still Fails

The service will now work without Pillow! It will show a warning but still run.

## ✅ Start All 3 Services

**Terminal 1:** YOLOv8 Service (port 5000)
```bash
cd yolov8_service
python app.py
```

**Terminal 2:** ExpressJS Server (port 3500)
```bash
cd ExpressJS
npm run dev
```

**Terminal 3:** Frontend (port 3000)
```bash
cd frontend
npm start
```

---

**Run the commands above and tell me what happens!** 🚀

