# 🚀 Complete Setup & Run Guide

## ⚠️ Current Issue: Pillow Installation Error

Your Python 3.13 might have compatibility issues. Let's fix this step-by-step.

## 📋 Solution: Install Dependencies Manually

### Step 1: Upgrade pip
```bash
python -m pip install --upgrade pip
```

### Step 2: Install Dependencies One by One

```bash
pip install fastapi
pip install "uvicorn[standard]"
pip install numpy
pip install pydantic
pip install python-multipart
pip install ultralytics
```

### Step 3: Fix Pillow Issue

**Option A - Try newer Pillow:**
```bash
pip install pillow --upgrade
```

**Option B - Use pre-built wheel:**
```bash
pip install pillow --only-binary=all
```

**Option C - If still fails, skip for now (YOLOv8 can work without it):**
```bash
pip install fastapi uvicorn ultralytics numpy pydantic python-multipart --no-deps
pip install pillow  # Try separately
```

## ✅ Once Installed, Start All 3 Services

### Terminal 1: YOLOv8 Service
```bash
cd C:\Users\Public\Weapon_Detection_IN_ATM_Using_CCTV\yolov8_service
python app.py
```
**Expected:** `🚀 Starting YOLOv8 detection service on port 5000`

### Terminal 2: ExpressJS Server  
```bash
cd C:\Users\Public\Weapon_Detection_IN_ATM_Using_CCTV\ExpressJS
npm run dev
```
**Expected:** `Server is running on port 3500`

### Terminal 3: React Frontend
```bash
cd C:\Users\Public\Weapon_Detection_IN_ATM_Using_CCTV\frontend
npm start
```
**Expected:** Browser opens at `http://localhost:3000`

## 🔄 Alternative: Use Simpler YOLOv8 Service

If Pillow keeps failing, I can create a simpler version that doesn't need image processing.

---

**Try the manual installation above and let me know what errors you get!**

