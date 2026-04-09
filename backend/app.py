from flask import Flask, render_template, request, jsonify, send_file
from flask_cors import CORS
from dotenv import load_dotenv
import os
from openai import OpenAI
from datasets import load_dataset
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import re
import time
import pickle
import json
import pandas as pd
import pytesseract
from PIL import Image
import cv2
import tempfile
import shutil
from werkzeug.utils import secure_filename
from datetime import datetime

# ----------------------
# Load environment variables
# ----------------------
load_dotenv()
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY")

client = OpenAI(
    api_key=DEEPSEEK_API_KEY,
    base_url="https://api.deepseek.com/v1"
)


app = Flask(__name__, 
            template_folder="../frontend/templates", 
            static_folder="../frontend/static")

CORS(app)
# Configuration - REMOVED PDF SUPPORT
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg'}
UPLOAD_FOLDER = 'uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

# Global variables
dataset_data = []
vectorizer = None
tfidf_matrix = None
dataset_loaded = False
medication_db = None
symptom_index = {}  # Store symptom index separately


# 1. LOAD MEDICAL REASONING DATASET (DeepSeek)

def load_and_preprocess_dataset():
    global dataset_data, vectorizer, tfidf_matrix, dataset_loaded
    
    start_time = time.time()
    
    # Try to load from cache first
    if os.path.exists('tfidf_cache.pkl'):
        print(" Loading TF-IDF from cache...")
        try:
            with open('tfidf_cache.pkl', 'rb') as f:
                cached_data = pickle.load(f)
                dataset_data = cached_data['dataset_data']
                vectorizer = cached_data['vectorizer']
                tfidf_matrix = cached_data['tfidf_matrix']
                dataset_loaded = True
            print(f"Loaded {len(dataset_data)} samples from cache in {time.time() - start_time:.2f}s")
            return
        except Exception as e:
            print(f" Cache load failed: {e}. Rebuilding...")
    
    # If no cache, build from scratch
    try:
        print(" Loading dataset from source...")
        dataset = load_dataset("FreedomIntelligence/medical-o1-reasoning-SFT", "en")
        print("Dataset loaded successfully!")
        
        dataset_data = []
        texts_for_vectorizer = []
        
        max_samples = 500
        
        for i, item in enumerate(dataset["train"]):
            if i >= max_samples:
                break
                
            question = item.get("Question", "")
            complex_cot = item.get("Complex_CoT", "")
            response = item.get("Response", "")
            
            if question and response:
                combined_text = f"{question} {response}"
                dataset_data.append({
                    "question": question,
                    "complex_cot": complex_cot,
                    "response": response,
                    "combined_text": combined_text
                })
                texts_for_vectorizer.append(combined_text)
        
        print(f" Processed {len(dataset_data)} dataset items")
        
        if texts_for_vectorizer:
            print(" Building TF-IDF vectorizer...")
            vectorizer = TfidfVectorizer(
                stop_words='english',
                max_features=1000,
                ngram_range=(1, 1)
            )
            tfidf_matrix = vectorizer.fit_transform(texts_for_vectorizer)
            dataset_loaded = True
            
            # Save to cache for next time
            try:
                with open('tfidf_cache.pkl', 'wb') as f:
                    pickle.dump({
                        'dataset_data': dataset_data,
                        'vectorizer': vectorizer,
                        'tfidf_matrix': tfidf_matrix
                    }, f)
                print(" TF-IDF cache saved for future runs!")
            except Exception as e:
                print(f" Could not save cache: {e}")
            
            print(f"TF-IDF ready! Total time: {time.time() - start_time:.2f}s")
            
    except Exception as e:
        print(" Dataset load error:", e)
        dataset_data = []
        dataset_loaded = False

# ----------------------
# 2. LOAD MEDICATION DATASET (CSV)
# ----------------------
def load_medication_dataset():
    """Load medication dataset from CSV"""
    global medication_db, symptom_index
    
    try:
        # Fix: Use raw string or forward slashes for Windows path
        csv_path = os.path.join('dataset', 'medical_dataset.csv')
        medication_db = pd.read_csv(csv_path)
        print(f"Medication dataset loaded: {len(medication_db)} entries")
        
        # Process symptom keywords
        medication_db['symptom_keywords_list'] = medication_db['symptom_keywords'].apply(
            lambda x: process_symptoms(x) if pd.notna(x) else []
        )
        
        # Create inverted index for symptoms
        symptom_index = {}
        for idx, row in medication_db.iterrows():
            for symptom in row['symptom_keywords_list']:
                if symptom not in symptom_index:
                    symptom_index[symptom] = []
                symptom_index[symptom].append(idx)
        
        # Print some stats
        total_symptoms = sum(len(symptoms) for symptoms in medication_db['symptom_keywords_list'])
        unique_symptoms = len(symptom_index)
        print(f" Processed {total_symptoms} symptoms ({unique_symptoms} unique)")
        print(f"Sample symptoms: {list(symptom_index.keys())[:10]}")
        
        return True
        
    except Exception as e:
        print(f"Error loading medication dataset: {e}")
        import traceback
        traceback.print_exc()
        medication_db = pd.DataFrame()
        return False

def process_symptoms(symptom_text):
    """Process symptom text into clean list"""
    if pd.isna(symptom_text):
        return []
    
    # Convert to string and clean
    symptoms = str(symptom_text)
    
    # Simple comma splitting for your CSV format
    symptom_list = [s.strip().lower() for s in symptoms.split(',')]
    
    # Remove empty strings and duplicates
    return list(set([s for s in symptom_list if s and len(s) > 1]))

# ----------------------
# 3. MEDICAL REASONING HELPER FUNCTIONS
# ----------------------
def fast_keyword_search(query, top_k=3):
    if not dataset_data:
        return None
    
    query_terms = set(re.findall(r'\b\w+\b', query.lower()))
    scored_items = []
    
    for item in dataset_data:
        question = item["question"].lower()
        response = item["response"].lower()
        
        question_matches = sum(1 for term in query_terms if term in question)
        response_matches = sum(1 for term in query_terms if term in response)
        
        score = question_matches * 3 + response_matches
        
        if score > 0:
            scored_items.append((score, item))
    
    scored_items.sort(key=lambda x: x[0], reverse=True)
    return [item for score, item in scored_items[:top_k]]

def build_context_from_search_results(results):
    if not results:
        return ""
    
    context_parts = ["\n\nRelevant medical information from dataset:"]
    
    for i, result in enumerate(results[:2]):
        context_parts.append(f"\n{i+1}. Question: {result['question']}")
        context_parts.append(f"   Response: {result['response']}")
    
    return "\n".join(context_parts)

# ------------------ Medical Safety Checks ------------------
def contains_emergency_symptoms(text):
    """Check if the query contains emergency symptoms"""
    emergency_patterns = [
        r"heart attack", r"stroke", r"chest pain", r"difficulty breathing", 
        r"can't breathe", r"severe bleeding", r"unconscious", r"passed out",
        r"severe pain", r"suicide", r"self harm", r"seizure", r"convulsion",
        r"choking", r"not breathing", r"high fever", r"unable to swallow",
        r"sudden weakness", r"vision loss", r"confusion", r"severe headache"
    ]
    text_lower = text.lower()
    return any(re.search(pattern, text_lower) for pattern in emergency_patterns)

def contains_serious_symptoms(text):
    """Check if the query contains symptoms that require doctor visit"""
    serious_patterns = [
        r"fever.*more than.*3 days", r"fever.*above.*102", r"severe.*pain",
        r"worsening.*symptoms", r"symptoms.*getting worse", r"can't eat",
        r"can't drink", r"dehydrated", r"rash", r"swelling", r"infection",
        r"blood.*cough", r"blood.*vomit", r"yellow.*skin", r"jaundice"
    ]
    text_lower = text.lower()
    return any(re.search(pattern, text_lower) for pattern in serious_patterns)

def is_non_medical_query(text):
    """Check if the query is non-medical"""
    non_medical_patterns = [
        r"\b(legal|law|lawyer|court|programming|code|technical|computer)\b",
        r"\b(politics|government|celebrity|movie|sports|weather)\b"
    ]
    text_lower = text.lower()
    return any(re.search(pattern, text_lower) for pattern in non_medical_patterns)

def format_response(text):
    """Format the response to ensure bullet points are on separate lines"""
    # Split the text into lines
    lines = text.split('\n')
    formatted_lines = []
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
            
        # Check if this line contains bullet points that need to be separated
        if '•' in line:
            # Split by bullet points
            parts = line.split('•')
            # First part before any bullet
            if parts[0].strip():
                formatted_lines.append(parts[0].strip())
            
            # Add each bullet point on a new line
            for part in parts[1:]:
                if part.strip():
                    formatted_lines.append('• ' + part.strip())
        else:
            formatted_lines.append(line)
    
    # Join with proper spacing
    result = []
    for i, line in enumerate(formatted_lines):
        result.append(line)
        # Add spacing after explanation before bullet points
        if i < len(formatted_lines) - 1 and formatted_lines[i+1].startswith('•') and not line.startswith('•'):
            result.append('')  # Add empty line before bullet points
    
    return '\n'.join(result).strip()


# 4. OCR PROCESSOR CLASS

class MedicalReportOCR:
    def __init__(self):
        """Initialize OCR processor"""
        # Configure Tesseract path if needed (for Windows)
        try:
            # Windows path
            if os.name == 'nt':
                tesseract_path = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
                if os.path.exists(tesseract_path):
                    pytesseract.pytesseract.tesseract_cmd = tesseract_path
                    print(" Tesseract configured for Windows")
                else:
                    # Try to find tesseract in PATH
                    print(" Tesseract not found at default Windows path, checking PATH...")
            else:
                # Linux/Mac - usually in PATH
                print(" Using system Tesseract")
        except Exception as e:
            print(f" Tesseract configuration warning: {e}")
    
    def preprocess_image(self, image_path):
        """Preprocess image for better OCR accuracy"""
        try:
            # Read image
            img = cv2.imread(image_path)
            if img is None:
                print(f" Failed to read image: {image_path}")
                return None
            
            # Convert to grayscale
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            
            # Apply thresholding
            _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
            
            # Apply denoising
            denoised = cv2.fastNlMeansDenoising(thresh, h=30)
            
            return denoised
        except Exception as e:
            print(f" Image preprocessing error: {e}")
            return None
    
    def extract_text_from_image(self, image_path):
        """Extract text from image using Tesseract"""
        try:
            # Check if file exists
            if not os.path.exists(image_path):
                print(f" Image file does not exist: {image_path}")
                return ""
            
            # Preprocess image
            processed_img = self.preprocess_image(image_path)
            
            if processed_img is None:
                # Try to load as is
                img = cv2.imread(image_path)
                if img is None:
                    print(f" Failed to load image: {image_path}")
                    return ""
                if len(img.shape) == 3:
                    processed_img = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
                else:
                    processed_img = img
            
            # OCR with medical text optimization
            custom_config = r'--oem 3 --psm 6 -l eng'
            text = pytesseract.image_to_string(processed_img, config=custom_config)
            
            if text:
                print(f" OCR extracted {len(text)} characters")
                return text.strip()
            else:
                print(" OCR returned empty text")
                return ""
                
        except pytesseract.TesseractNotFoundError:
            print("Tesseract OCR is not installed. Please install it first.")
            return "Error: Tesseract OCR is not installed. Please install it first."
        except Exception as e:
            print(f" OCR error: {e}")
            return f"OCR Error: {str(e)}"
    
    def extract_medical_info(self, text):
        """Extract medical information from OCR text"""
        medical_info = {
            'medications': [],
            'symptoms': [],
            'diagnoses': [],
            'patient_info': {},
            'lab_results': {}
        }
        
        if not text or text.startswith("Error:"):
            return medical_info
        
        # Medication patterns - improved
        medication_patterns = [
            r'\b([A-Z][a-zA-Z\s\-]+)\s*(?:\d+\s*(?:mg|g|ml))?\s*(?:once|twice|daily|weekly|monthly)\b',
            r'\b(?:Rx|Prescription|Medication|Drug)[:\s]+([A-Z][a-zA-Z\s\-]+)',
            r'\b(?:Take|Take one|Take two)\s+([A-Z][a-zA-Z\s\-]+)',
            r'\b([A-Z][a-zA-Z\s\-]+)\s+(?:tablet|pill|capsule|injection)\b',
            r'\b(?:Paracetamol|Ibuprofen|Aspirin|Amoxicillin|Metformin|Insulin)\b'
        ]
        
        # Extract medications
        for pattern in medication_patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            for match in matches:
                if isinstance(match, tuple):
                    match = match[0]
                medication_info = self.extract_medication_details(match, text)
                if medication_info:
                    # Check for duplicates
                    existing_names = [m['name'].lower() for m in medical_info['medications']]
                    if medication_info['name'].lower() not in existing_names:
                        medical_info['medications'].append(medication_info)
        
        # Extract symptoms from text
        text_lower = text.lower()
        
        # Check against known symptoms from database
        if symptom_index:
            for symptom in symptom_index.keys():
                if symptom in text_lower and len(symptom) > 3:
                    medical_info['symptoms'].append(symptom)
        
        # Also look for common symptom patterns
        symptom_patterns = [
            r'\bfever\b', r'\bheadache\b', r'\bcough\b', r'\bcold\b', r'\bpain\b',
            r'\bnausea\b', r'\bvomit\b', r'\bfatigue\b', r'\bweakness\b',
            r'\brash\b', r'\bitching\b', r'\bsweating\b', r'\bdizziness\b'
        ]
        
        for pattern in symptom_patterns:
            if re.search(pattern, text_lower):
                symptom = re.search(pattern, text_lower).group()
                if symptom not in medical_info['symptoms']:
                    medical_info['symptoms'].append(symptom)
        
        return medical_info
    
    def extract_medication_details(self, medication_match, full_text):
        """Extract detailed medication information"""
        try:
            # Clean medication name
            med_name = medication_match.strip()
            
            # Look for dosage near the medication mention
            dosage_pattern = r'(\d+\s*(?:mg|g|ml|mcg))\s*(?:once|twice|daily|weekly|monthly)'
            
            # Search in a window around the match
            match_idx = full_text.lower().find(med_name.lower())
            if match_idx != -1:
                window_start = max(0, match_idx - 150)
                window_end = min(len(full_text), match_idx + 150)
                context = full_text[window_start:window_end]
                
                dosage_match = re.search(dosage_pattern, context, re.IGNORECASE)
                dosage = dosage_match.group(1) if dosage_match else "Not specified"
                
                frequency_match = re.search(r'(once|twice|daily|weekly|monthly)', context, re.IGNORECASE)
                frequency = frequency_match.group(1) if frequency_match else "Not specified"
                
                return {
                    'name': med_name,
                    'dosage': dosage,
                    'frequency': frequency,
                    'context': context.strip()
                }
            
            return {
                'name': med_name,
                'dosage': "Not specified",
                'frequency': "Not specified",
                'context': ""
            }
        except Exception as e:
            print(f"Error extracting medication details: {e}")
            return None

# Initialize OCR processor
ocr_processor = MedicalReportOCR()

# ----------------------
# 5. MEDICATION MATCHER
# ----------------------
def find_matching_medications(extracted_info):
    """Find matching medications from the dataset"""
    if medication_db is None or medication_db.empty:
        return []
    
    matches = []
    
    # Match by medication name
    for med_info in extracted_info.get('medications', []):
        med_name = med_info['name'].lower()
        
        # Direct name matching
        direct_matches = medication_db[
            medication_db['recommended_medicine'].str.lower().str.contains(med_name, na=False)
        ]
        
        if not direct_matches.empty:
            for _, row in direct_matches.iterrows():
                matches.append({
                    'source': 'direct_match',
                    'extracted_medication': med_info['name'],
                    'recommended_medicine': row['recommended_medicine'],
                    'condition': row['condition'],
                    'dosage': row['dosage'],
                    'duration': row['duration'],
                    'precautions': row['precautions'],
                    'notes': row['notes'],
                    'confidence': 'high'
                })
    
    # Match by symptoms using symptom_index
    symptoms = extracted_info.get('symptoms', [])
    if symptoms and symptom_index:
        symptom_scores = {}
        
        for symptom in symptoms:
            symptom_lower = symptom.lower()
            if symptom_lower in symptom_index:
                for idx in symptom_index[symptom_lower]:
                    symptom_scores[idx] = symptom_scores.get(idx, 0) + 1
        
        # Get top matches
        sorted_indices = sorted(symptom_scores.items(), key=lambda x: x[1], reverse=True)[:5]
        
        for idx, score in sorted_indices:
            row = medication_db.iloc[idx]
            matches.append({
                'source': 'symptom_match',
                'matched_symptoms': symptoms,
                'recommended_medicine': row['recommended_medicine'],
                'condition': row['condition'],
                'dosage': row['dosage'],
                'duration': row['duration'],
                'precautions': row['precautions'],
                'notes': row['notes'],
                'confidence': 'medium',
                'match_score': score
            })
    
    # Remove duplicates
    unique_matches = []
    seen = set()
    for match in matches:
        key = (match['recommended_medicine'], match['condition'])
        if key not in seen:
            unique_matches.append(match)
            seen.add(key)
    
    return unique_matches

def allowed_file(filename):
    """Check if file extension is allowed"""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# ----------------------
# 6. ROUTES
# ----------------------
@app.route("/")
def home():
    return render_template("login.html")

@app.route("/login")
def login():
    return render_template("login.html")

@app.route("/signup")
def signup():
    return render_template("signup.html")

@app.route("/dashboard")
def dashboard():
    return render_template("dashboard.html")

@app.route("/chatbot")
def chatbot_page():
    return render_template("chatbot.html")

@app.route("/upload")
def upload_report():
    return render_template("upload.html")

@app.route("/reminders")
def reminders():
    return render_template("reminders.html")

@app.route("/history")
def history():
    return render_template("history.html")

 
#  OCR Route 

@app.route("/upload_report", methods=["POST"])  
def upload_medical_report():
    """Upload and analyze medical report"""
    try:
        if 'file' not in request.files:
            return jsonify({
                "success": False,
                "error": "No file provided"
            }), 400
        
        file = request.files['file']
        query = request.form.get('query', '')
        
        if file.filename == '':
            return jsonify({
                "success": False,
                "error": "No file selected"
            }), 400
        
        if file and allowed_file(file.filename):
            # Secure filename and create timestamp
            filename = secure_filename(file.filename)
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            unique_filename = f"{timestamp}_{filename}"
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
            
            # Save file
            file.save(filepath)
            print(f" File saved: {filepath}")
            
            # Extract text from image
            extracted_text = ocr_processor.extract_text_from_image(filepath)
            
            if not extracted_text or extracted_text.startswith("Error:"):
                return jsonify({
                    "success": False,
                    "error": extracted_text if extracted_text else "Could not extract text from the image",
                    "filename": unique_filename
                }), 400
            
            # Extract medical information
            medical_info = ocr_processor.extract_medical_info(extracted_text)
            
            # Find matching medications
            matched_medications = find_matching_medications(medical_info)
            
            # Generate DeepSeek response if query provided
            deepseek_response = ""
            if query:
                search_results = fast_keyword_search(query)
                context = build_context_from_search_results(search_results)
                
                # Add OCR context to the query
                enhanced_query = f"""
                Medical Report Analysis:
                Extracted Text: {extracted_text[:500]}...
                Found Medications: {[m['name'] for m in medical_info['medications']]}
                Found Symptoms: {medical_info['symptoms']}
                
                User Question: {query}
                """
                
                try:
                    medical_prompt_template = """You are a healthcare medical assistant. Use the following medical context to answer the user's question.

Context:
{context}

Question:
{question}

Provide helpful medical advice based on the report analysis."""
                    
                    messages = [
                        {"role": "system", "content": medical_prompt_template.format(context=context, question=enhanced_query)}
                    ]
                    
                    response = client.chat.completions.create(
                        model="deepseek-chat",
                        messages=messages,
                        temperature=0.3,
                        max_tokens=500
                    )
                    
                    deepseek_response = format_response(response.choices[0].message.content)
                except Exception as e:
                    print(f"DeepSeek error: {e}")
                    deepseek_response = "Could not generate medical advice at this time."
            
            # Prepare response
            response_data = {
                "success": True,
                "filename": unique_filename,
                "extracted_text": extracted_text[:1000] + "..." if len(extracted_text) > 1000 else extracted_text,
                "medical_info": medical_info,
                "matched_medications": matched_medications,
                "medical_advice": deepseek_response,
                "summary": {
                    "medications_found": len(medical_info['medications']),
                    "symptoms_detected": len(medical_info['symptoms']),
                    "medication_matches": len(matched_medications)
                }
            }
            
            print(f" Analysis complete. Found {len(medical_info['medications'])} medications, {len(medical_info['symptoms'])} symptoms")
            return jsonify(response_data)
        
        return jsonify({
            "success": False,
            "error": "File type not allowed. Use PNG, JPG, or JPEG only"
        }), 400
        
    except Exception as e:
        print(f" Error in upload_medical_report: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            "success": False,
            "error": f"Server error: {str(e)}"
        }), 500

# ----------------------
# Debug and Test Endpoints
# ----------------------
@app.route("/api/test-ocr", methods=["GET"])
def test_ocr():
    """Test OCR functionality"""
    try:
        return jsonify({
            "status": "OCR Ready",
            "medication_db_loaded": medication_db is not None and not medication_db.empty,
            "medication_count": len(medication_db) if medication_db is not None else 0,
            "symptom_index_count": len(symptom_index),
            "allowed_extensions": list(ALLOWED_EXTENSIONS),
            "upload_folder": app.config['UPLOAD_FOLDER']
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/test-upload", methods=["POST"])
def test_upload():
    """Test file upload without analysis"""
    if 'file' not in request.files:
        return jsonify({"error": "No file provided"}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No file selected"}), 400
    
    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)
        
        # Check file
        file_size = os.path.getsize(filepath)
        file_exists = os.path.exists(filepath)
        
        return jsonify({
            "success": True,
            "filename": filename,
            "filepath": filepath,
            "file_size": file_size,
            "file_exists": file_exists,
            "message": "File uploaded successfully"
        })
    
    return jsonify({"error": "Invalid file type"}), 400

@app.route("/api/analyze-medication", methods=["POST"])
def analyze_medication():
    """Analyze a specific medication from the dataset"""
    data = request.get_json()
    medication_name = data.get("medication", "").strip()
    
    if not medication_name:
        return jsonify({"error": "No medication name provided"}), 400
    
    if medication_db is None or medication_db.empty:
        return jsonify({"error": "Medication database not loaded"}), 500
    
    # Search for medication
    matches = medication_db[
        medication_db['recommended_medicine'].str.lower().str.contains(medication_name.lower(), na=False)
    ]
    
    if matches.empty:
        return jsonify({
            "medication": medication_name,
            "found": False,
            "message": "No information found for this medication"
        })
    
    # Get all conditions this medication treats
    conditions = matches['condition'].unique().tolist()
    
    # Get most common dosage
    common_dosage = matches['dosage'].mode()
    common_dosage = common_dosage[0] if not common_dosage.empty else "Not specified"
    
    # Get precautions
    precautions = matches['precautions'].unique().tolist()
    
    # Get notes
    notes = matches['notes'].unique().tolist()
    
    return jsonify({
        "medication": medication_name,
        "found": True,
        "conditions_treated": conditions[:10],  # Top 10
        "common_dosage": common_dosage,
        "precautions": precautions[:5],
        "notes": notes[:5],
        "total_entries": len(matches),
        "details": matches.head(3).to_dict('records')
    })

@app.route("/api/search-medications", methods=["POST"])
def search_medications():
    """Search medications by symptoms"""
    data = request.get_json()
    symptoms = data.get("symptoms", [])
    
    if not symptoms:
        return jsonify({"error": "No symptoms provided"}), 400
    
    if medication_db is None or medication_db.empty:
        return jsonify({"error": "Medication database not loaded"}), 500
    
    matched_medications = []
    
    for symptom in symptoms:
        symptom_lower = symptom.lower().strip()
        
        # Search in symptom keywords
        matches = medication_db[
            medication_db['symptom_keywords'].str.contains(symptom_lower, case=False, na=False)
        ]
        
        if not matches.empty:
            for _, row in matches.head(3).iterrows():  # Get top 3 per symptom
                matched_medications.append({
                    "symptom": symptom,
                    "medicine": row['recommended_medicine'],
                    "condition": row['condition'],
                    "dosage": row['dosage'],
                    "duration": row['duration']
                })
    
    # Remove duplicates
    unique_medications = []
    seen = set()
    for med in matched_medications:
        key = (med['medicine'], med['condition'])
        if key not in seen:
            unique_medications.append(med)
            seen.add(key)
    
    return jsonify({
        "symptoms_searched": symptoms,
        "medications_found": unique_medications[:10],  # Limit to 10
        "total_matches": len(unique_medications)
    })

# ----------------------
# Health Check Routes
# ----------------------
@app.route("/health")
def health_check():
    return jsonify({
        "dataset_loaded": dataset_loaded,
        "dataset_items": len(dataset_data),
        "medication_db_loaded": medication_db is not None and not medication_db.empty,
        "medication_items": len(medication_db) if medication_db is not None else 0,
        "symptom_index_count": len(symptom_index),
        "cached": os.path.exists('tfidf_cache.pkl'),
        "ocr_ready": True,
        "allowed_extensions": list(ALLOWED_EXTENSIONS)
    })

@app.route("/clear_cache")
def clear_cache():
    if os.path.exists('tfidf_cache.pkl'):
        os.remove('tfidf_cache.pkl')
        return jsonify({"message": "Cache cleared successfully"})
    return jsonify({"message": "No cache found"})

@app.route("/chat", methods=["POST"])
def chat():
    data = request.get_json(force=True)
    user_message = data.get("message", "").strip()
    
    if not user_message:
        return jsonify({"reply": "Please provide a message."})

    # Emergency symptom check
    if contains_emergency_symptoms(user_message):
        return jsonify({"reply": " EMERGENCY: These symptoms could be serious. Please call emergency services immediately or go to the nearest hospital. Do not delay seeking medical help."})

    # Non-medical query check
    if is_non_medical_query(user_message):
        return jsonify({"reply": "I'm here to help with medical and health-related queries only. Please ask a health-related question."})

    # Handle greetings and thanks with Islamic greetings
    greetings = ["hi", "hello", "hey"]
    islamic_greetings = ["salam", "assalam", "as-salam", "assalam walikum", "assalamualaikum"]
    thanks = ["thanks", "thank you", "shukriya"]
    
    if user_message.lower() in greetings:
        return jsonify({"reply": "Hello! I'm your healthcare assistant. How can I help you with a medical concern today?"})
    elif any(greeting in user_message.lower() for greeting in islamic_greetings):
        return jsonify({"reply": "Walikum Salam! I'm your healthcare assistant. How can I help you with a medical concern today?"})
    elif user_message.lower() in thanks:
        return jsonify({"reply": "You're welcome! Stay healthy and let me know if you have any other medical questions."})

    search_results = fast_keyword_search(user_message)
    context = build_context_from_search_results(search_results)
    
    # Check if it's a medication-related query
    medication_query = False
    medication_response = ""
    
    if any(word in user_message.lower() for word in ['medicine', 'medication', 'drug', 'pill', 'tablet', 'dose', 'dosage']):
        medication_query = True
        # Try to extract medication name
        medication_patterns = [
            r'\b(?:what is|tell me about|information about)\s+([A-Z][a-zA-Z\s\-]+)\b',
            r'\b([A-Z][a-zA-Z]+)\s+(?:medicine|medication|drug)\b'
        ]
        
        for pattern in medication_patterns:
            match = re.search(pattern, user_message, re.IGNORECASE)
            if match:
                med_name = match.group(1)
                # Search in medication database
                if medication_db is not None:
                    matches = medication_db[
                        medication_db['recommended_medicine'].str.contains(med_name, case=False, na=False)
                    ]
                    if not matches.empty:
                        medication_response = f"\n\n **Medication Information for {med_name}:**\n"
                        for _, row in matches.head(2).iterrows():
                            medication_response += f"• **Condition:** {row['condition']}\n"
                            medication_response += f"• **Dosage:** {row['dosage']}\n"
                            medication_response += f"• **Duration:** {row['duration']}\n"
                            medication_response += f"• **Precautions:** {row['precautions']}\n\n"
    
    # Medical Prompt Template
    medical_prompt_template = """You are a healthcare medical assistant. Use the following medical context to answer the user's question.

IMPORTANT FORMATTING RULES:
1. Start with explanatory causes (2-3 sentences explaining potential reasons)
2. After the explanation, add a blank line
3. Then provide 2-3 recommendations in bullet points with EACH BULLET POINT ON ITS OWN SEPARATE LINE
4. Each bullet point must start with • and a space
5. For complex medical terms, provide simple explanations in brackets like this: (meaning: easy explanation)
6. Keep responses concise but explanatory
7. ONLY recommend visiting a doctor if symptoms are serious or persistent
8. If you don't know the answer, just say you don't know
9. DO NOT provide specific medication names or drug recommendations
10. Focus on general recommendations like rest, hydration, lifestyle changes, etc.

Context:
{context}

Question:
{question}

EXAMPLE FORMAT:
Difficulty sleeping can be caused by stress, poor sleep habits, or consuming caffeine late in the day. Your body's natural sleep-wake cycle might be disrupted.

• Establish a consistent bedtime routine
• Avoid screens for at least an hour before bed
• Try relaxation techniques like deep breathing

If sleep problems persist, consider consulting a healthcare professional.
"""

    try:
        messages = [
            {"role": "system", "content": medical_prompt_template.format(context=context, question=user_message)}
        ]
        
        response = client.chat.completions.create(
            model="deepseek-chat",
            messages=messages,
            temperature=0.3,
            max_tokens=500
        )

        reply = response.choices[0].message.content

        # Format the response to ensure bullet points are on separate lines
        reply = format_response(reply)

        # Add medication information if found
        if medication_response:
            reply += medication_response

        # Only add doctor visit advice for serious symptoms
        if contains_serious_symptoms(user_message):
            if "visit a doctor" not in reply.lower() and "consult a doctor" not in reply.lower() and "see a doctor" not in reply.lower():
                reply += "\n\nSince your symptoms seem persistent or serious, it would be best to consult a healthcare professional."

    except Exception as e:
        reply = "I apologize, but I'm experiencing technical difficulties. Please try again later."

    return jsonify({"reply": reply})

# ----------------------
# INITIALIZATION
# ----------------------
print("="*60)
print("Initializing Healthcare Chatbot with OCR Integration")
print("="*60)

print("\n Loading medical reasoning dataset...")
load_and_preprocess_dataset()

print("\n Loading medication database...")
if load_medication_dataset():
    print("\n Medication Database Statistics:")
    print(f"   • Total medications: {len(medication_db)}")
    print(f"   • Unique conditions: {medication_db['condition'].nunique()}")
    print(f"   • Unique medicines: {medication_db['recommended_medicine'].nunique()}")
    print(f"   • Unique symptoms: {len(symptom_index)}")

print("\n Testing OCR configuration...")
try:
    # Test if Tesseract is working
    test_image = np.ones((100, 300, 3), dtype=np.uint8) * 255
    cv2.putText(test_image, "Test OCR", (50, 50), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 0), 2)
    temp_path = "test_ocr.png"
    cv2.imwrite(temp_path, test_image)
    
    test_text = ocr_processor.extract_text_from_image(temp_path)
    if os.path.exists(temp_path):
        os.remove(temp_path)
    
    print(f"OCR system ready (test output: '{test_text}')")
except Exception as e:
    print(f" OCR test warning: {e}")

print("\n" + "="*60)
print("Healthcare Chatbot Ready!")
print("="*60)
print(f" Supported file types: {', '.join(ALLOWED_EXTENSIONS)}")
print(f"Upload folder: {UPLOAD_FOLDER}")

if __name__ == "__main__":
    app.run(debug=True, port=50001, host='0.0.0.0')