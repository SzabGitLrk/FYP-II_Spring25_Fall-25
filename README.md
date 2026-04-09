# 🏥 AI Healthcare Assistant (FYP Project)

## 📌 Overview
The AI Healthcare Assistant is a web-based application that provides intelligent healthcare support using Artificial Intelligence. It helps users analyze medical reports, detect symptoms, and receive general health advice. 

**This system integrates:**
* 🤖 AI-based chatbot (DeepSeek API)
* 📄 OCR for medical report analysis
* 💊 Medication and symptom matching
* 🔐 Firebase Authentication system


## 🚀 Features

### 👤 User Authentication
* Secure login/signup using Firebase
* Session management

### 🤖 AI Chatbot
* Provides medical advice based on symptoms
* Uses DeepSeek API for intelligent responses

### 📄 Medical Report Analysis
* Upload medical reports (image format)
* Extract text using OCR (Tesseract)
* **Identify:**
  * Medications
  * Symptoms
  * Key medical information

### 💊 Medication Recommendation
* Matches symptoms with medication dataset
* **Provides:**
  * Dosage
  * Duration
  * Precautions

### ⏰ Reminder System
* Set medicine reminders
* Track schedules



## 🛠️ Technologies Used

### Frontend
* HTML, CSS, JavaScript
* Firebase Authentication
* Firebase Realtime Database

### Backend
* Python (Flask)
* DeepSeek API (via OpenAI client)
* Hugging Face Datasets

### Libraries
* Pandas, NumPy
* Scikit-learn (TF-IDF, similarity)
* OpenCV & Tesseract (OCR)
* Flask-CORS



## ⚙️ Installation & Setup

### 1. Clone Repository
```bash
git clone <repository-url>
cd your AiHealthassistant
```
2. Create a virtual Environment 
```
python -m venv venv
venv\Scripts\activate  # Windows
```
3. Install Dependencies
```
pip install -r requirements.txt
```
4. Setup Environment Variables
```
DEEPSEEK_API_KEY=your_api_key
Hf_token=your_hugging_face_token
Flask_secret_key=your_key
```
5. Configure Firebase 
```
Update firebase-config.js with your Firebase project credentials.
```
6. Run Code 
```
python app.py
``` 
Open browser: http://localhost:5000

📊 Dataset Used

•	Medical reasoning dataset from Hugging Face

•	Custom medication dataset (CSV)

🎯 Future Improvements

•	Mobile app integration

•	Doctor appointment booking

•	Advanced AI diagnosis

•	Voice-based interaction

