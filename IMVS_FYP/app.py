import os
import sqlite3
import time
import threading
from flask import Flask, render_template, request, jsonify, redirect, url_for, session
from werkzeug.utils import secure_filename
from werkzeug.security import generate_password_hash, check_password_hash
from PIL import Image
import torch
from transformers import AutoProcessor, LightOnOCRForConditionalGeneration
import requests
import json
from functools import wraps

# ---------------------------
# App config
# ---------------------------
app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'static/uploads'
app.config['SECRET_KEY'] = 'your-secret-key-here'
app.config['DEEPSEEK_API_KEY'] = 'sk-25e16c12e71643d48asas2343254229a3c0a0fa'
app.config['DEEPSEEK_API_URL'] = 'https://api.deepseek.com/v1/chat/completions'
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'bmp', 'tiff'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

########################################
# Database Setup
########################################
def init_db():
    conn = sqlite3.connect('imvs.db')
    cursor = conn.cursor()

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS evaluations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            student_name TEXT NOT NULL,
            batch TEXT NOT NULL,
            teacher_text TEXT NOT NULL,
            student_text TEXT NOT NULL,
            marks_weight INTEGER NOT NULL,
            marks_obtained INTEGER NOT NULL,
            feedback TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS advanced_evaluations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            student_name TEXT NOT NULL,
            batch TEXT NOT NULL,
            total_marks INTEGER NOT NULL,
            marks_obtained INTEGER NOT NULL,
            percentage REAL NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS question_results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            advanced_evaluation_id INTEGER,
            question_number INTEGER NOT NULL,
            question_text TEXT NOT NULL,
            max_marks INTEGER NOT NULL,
            marks_obtained INTEGER NOT NULL,
            feedback TEXT NOT NULL,
            FOREIGN KEY (advanced_evaluation_id) REFERENCES advanced_evaluations (id)
        )
    ''')

    conn.commit()
    conn.close()

init_db()

########################################
# Auth decorator
########################################
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function

########################################
# OCR / Model globals & device
########################################
ocr_model_id = "lightonai/LightOnOCR-1B-1025"
ocr_processor = None
ocr_model = None

# flags
model_ready = False
is_8bit = False

# device
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"[IMVS] Using device: {device}")

########################################
# Warm-up utility
########################################
def warm_up_model():
    """Run a tiny dummy inference so subsequent calls are faster."""
    global ocr_processor, ocr_model, model_ready
    try:
        if ocr_processor is None or ocr_model is None:
            return
        print("[IMVS] Warming up model...")
        dummy_image = Image.new('RGB', (128, 128), color='white')
        messages = [{"role": "user", "content": [{"type": "image"}]}]
        text_prompt = ocr_processor.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
        inputs = ocr_processor(text=[text_prompt], images=[dummy_image], return_tensors="pt")

        if torch.cuda.is_available():
            inputs = {k: v.to(device) for k, v in inputs.items()}
            if "pixel_values" in inputs:
                inputs["pixel_values"] = inputs["pixel_values"].half()

        with torch.no_grad():
            _ = ocr_model.generate(**inputs, max_new_tokens=8)

        print("[IMVS] Warm-up completed.")
        model_ready = True

    except Exception as e:
        print("[IMVS] Warm-up failed:", e)
        model_ready = False

########################################
# Load model (try 8-bit, fallback to fp16 .to(device))
########################################
def load_quantized_model():
    """Try loading 8-bit quantized model (if bitsandbytes available). Fallback to fp16 .to(device)."""
    global ocr_processor, ocr_model, model_ready, is_8bit

    try:
        print("[IMVS] Loading processor...")
        ocr_processor = AutoProcessor.from_pretrained(ocr_model_id)
    except Exception as e:
        print("[IMVS] Failed to load processor:", e)
        ocr_processor = None
        ocr_model = None
        model_ready = False
        return

    # Attempt 8-bit load (requires bitsandbytes & transformers support)
    if torch.cuda.is_available():
        try:
            print("[IMVS] Attempting 8-bit load (requires bitsandbytes)...")
            ocr_model = LightOnOCRForConditionalGeneration.from_pretrained(
                ocr_model_id,
                load_in_8bit=True,
                device_map="auto",
                torch_dtype=torch.float16,
                low_cpu_mem_usage=True,
            )
            is_8bit = True
            print("[IMVS] 8-bit quantized model loaded.")
            ocr_model.eval()
            warm_up_model()
            return
        except Exception as e:
            print("[IMVS] 8-bit load failed (maybe bitsandbytes not installed):", e)
            # fallthrough to fp16 load

    # Fallback: load normally then move to device (fp16 if GPU)
    try:
        print("[IMVS] Loading FP16/FP32 model and moving to device...")
        ocr_model = LightOnOCRForConditionalGeneration.from_pretrained(
            ocr_model_id,
            torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
            low_cpu_mem_usage=True
        )
        # Move to device (safe)
        ocr_model = ocr_model.to(device)
        is_8bit = False
        ocr_model.eval()
        print("[IMVS] Model loaded and moved to device.")
        warm_up_model()
    except Exception as e:
        print("[IMVS] Final fallback load failed:", e)
        ocr_processor = None
        ocr_model = None
        model_ready = False

# Start model loading in background thread (non-blocking)
model_thread = threading.Thread(target=load_quantized_model, daemon=True)
model_thread.start()

########################################
# Fast extraction function
########################################
def extract_text_from_image_fast(image_path):
    """Extract text quickly using the globally-loaded model."""
    global ocr_processor, ocr_model, model_ready

    if not model_ready:
        return "🔄 Model is still loading, please try again in a few seconds."

    try:
        start_time = time.time()
        print(f"[IMVS] Extracting from: {os.path.basename(image_path)}")

        image = Image.open(image_path).convert("RGB")
        messages = [{"role": "user", "content": [{"type": "image"}]}]
        text_prompt = ocr_processor.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)

        inputs = ocr_processor(text=[text_prompt], images=[image], return_tensors="pt")

        # Move inputs to GPU and convert pixel_values to half if GPU & model supports fp16
        if torch.cuda.is_available():
            inputs = {k: v.to(device) for k, v in inputs.items()}
            if "pixel_values" in inputs:
                # If model uses fp16 we convert pixel_values to half to save memory & speed up
                try:
                    inputs["pixel_values"] = inputs["pixel_values"].half()
                except Exception:
                    pass

        # Generation parameters tuned for speed
        with torch.no_grad():
            outputs = ocr_model.generate(
                **inputs,
                max_new_tokens=256,     # reduced from 512 to speed up
                do_sample=False,
                num_beams=1,
                early_stopping=True,
                pad_token_id=ocr_processor.tokenizer.eos_token_id
            )

        # Decode intelligently: skip prompt portion
        # If input_ids present, determine prompt length
        input_len = inputs.get("input_ids").shape[1] if "input_ids" in inputs else 0
        # outputs shape [1, seq_len]
        if outputs is not None and outputs.shape[1] > input_len:
            extracted = ocr_processor.tokenizer.decode(outputs[0, input_len:], skip_special_tokens=True)
        else:
            extracted = ocr_processor.batch_decode(outputs, skip_special_tokens=True)[0]

        proc_time = time.time() - start_time
        print(f"[IMVS] Extraction completed in {proc_time:.2f}s")
        return extracted.strip()

    except Exception as e:
        print("[IMVS] Extraction error:", e)
        return f"Error in OCR: {str(e)}"

def extract_text_from_image(image_path):
    return extract_text_from_image_fast(image_path)

########################################
# DeepSeek API Function
########################################
def call_deepseek_api(prompt):
    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {app.config["DEEPSEEK_API_KEY"]}'
    }

    data = {
        "model": "deepseek-chat",
        "messages": [
            {"role": "system", "content": "You are an expert educational evaluator. Compare teacher and student answers and provide marks and feedback in the exact format specified."},
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.1,
        "max_tokens": 150,
        "stream": False
    }

    try:
        response = requests.post(app.config['DEEPSEEK_API_URL'], headers=headers, json=data, timeout=30)
        response.raise_for_status()
        result = response.json()
        return result['choices'][0]['message']['content'].strip()
    except requests.exceptions.RequestException as e:
        print("[IMVS] API Request failed:", e)
        return None
    except (KeyError, IndexError) as e:
        print("[IMVS] API parsing failed:", e)
        return None

########################################
# Question counting & evaluation helpers
########################################
def count_questions_in_text(text, question_count):
    detected_questions = 0
    text_lower = text.lower()

    for i in range(1, question_count + 1):
        patterns = [
            f"question {i}",
            f"q.{i}",
            f"q {i}",
            f"{i}.",
            f"{i})",
            f"({i})",
            f"ques {i}",
            f"que {i}",
            f"q:{i}",
            f"q-{i}"
        ]
        if any(pattern in text_lower for pattern in patterns):
            detected_questions += 1
        else:
            if f"\n{i}." in text_lower or f"\n{i})" in text_lower:
                detected_questions += 1

    return detected_questions

def evaluate_single_question(teacher_full_text, student_full_text, max_marks, question_number):
    prompt = f"""Evaluate the student's answer for Question {question_number} from the exam:

**EVALUATION APPROACH:**
- Focus on CONCEPTUAL UNDERSTANDING primarily
- Be flexible with wording and expression
- Reward correct concepts even if expressed differently
- Grammar and spelling are secondary to conceptual correctness

**TEACHER'S REFERENCE MATERIAL:**
{teacher_full_text}

**STUDENT'S ANSWER SHEET:**
{student_full_text}

**SPECIFIC TASK:**
Evaluate the student's answer for Question {question_number} from the exam.
Award marks out of {max_marks} based on conceptual accuracy.

**REQUIRED OUTPUT FORMAT:**
Marks: [number]/{max_marks}
Feedback: [2-3 sentences focusing on conceptual accuracy]

DO NOT ADD ANY OTHER TEXT."""

    response = call_deepseek_api(prompt)

    if response is None:
        return {'question_number': question_number, 'question_text': f"Question {question_number}", 'marks_obtained': 0, 'max_marks': max_marks, 'feedback': 'Evaluation failed'}

    marks_obtained = 0
    feedback = "Evaluation incomplete"
    lines = [line.strip() for line in response.split('\n') if line.strip()]

    for line in lines:
        line_lower = line.lower()
        if line_lower.startswith('marks:'):
            marks_part = line.split(':', 1)[1].strip()
            if '/' in marks_part:
                try:
                    marks_obtained = int(marks_part.split('/')[0])
                except Exception:
                    marks_obtained = 0
        elif line_lower.startswith('feedback:'):
            feedback = line.split(':', 1)[1].strip()

    return {'question_number': question_number, 'question_text': f"Question {question_number}", 'marks_obtained': marks_obtained, 'max_marks': max_marks, 'feedback': feedback}

########################################
# Routes (authentication + main app)
########################################
@app.route('/')
def index():
    if 'user_id' in session:
        return redirect(url_for('dashboard'))
    return redirect(url_for('login'))

@app.route('/signup', methods=['GET', 'POST'])
def signup():
    if request.method == 'POST':
        username = request.form['username']
        email = request.form['email']
        password = request.form['password']

        conn = sqlite3.connect('imvs.db')
        cursor = conn.cursor()
        try:
            password_hash = generate_password_hash(password)
            cursor.execute('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)', (username, email, password_hash))
            conn.commit()
            conn.close()
            return redirect(url_for('login'))
        except sqlite3.IntegrityError:
            conn.close()
            return render_template('signup.html', error='Username or email already exists')

    return render_template('signup.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']

        conn = sqlite3.connect('imvs.db')
        cursor = conn.cursor()
        cursor.execute('SELECT id, password_hash FROM users WHERE username = ?', (username,))
        user = cursor.fetchone()
        conn.close()

        if user and check_password_hash(user[1], password):
            session['user_id'] = user[0]
            session['username'] = username
            return redirect(url_for('dashboard'))
        else:
            return render_template('login.html', error='Invalid credentials')

    return render_template('login.html')

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('login'))

@app.route('/dashboard')
@login_required
def dashboard():
    return render_template('dashboard.html', username=session['username'])

@app.route('/evaluation')
@login_required
def evaluation():
    return render_template('evaluation.html')

@app.route('/advanced_evaluation')
@login_required
def advanced_evaluation():
    return render_template('advanced_evaluation.html')

@app.route('/history')
@login_required
def history():
    conn = sqlite3.connect('imvs.db')
    cursor = conn.cursor()
    cursor.execute('''
        SELECT student_name, batch, marks_obtained, marks_weight, feedback, created_at, 'basic' as type
        FROM evaluations 
        WHERE user_id = ? 
        UNION ALL
        SELECT student_name, batch, marks_obtained, total_marks as marks_weight, 
               'Advanced evaluation with multiple questions' as feedback, created_at, 'advanced' as type
        FROM advanced_evaluations 
        WHERE user_id = ?
        ORDER BY created_at DESC
    ''', (session['user_id'], session['user_id']))
    evaluations = cursor.fetchall()
    conn.close()
    return render_template('history.html', evaluations=evaluations)

########################################
# API endpoints for OCR + evaluation
########################################
@app.route('/extract_text', methods=['POST'])
@login_required
def extract_text_route():
    if not model_ready:
        return jsonify({'error': 'OCR model is still loading. Please wait a few seconds and try again.'})

    img1 = request.files['image1']
    img2 = request.files['image2']

    filename1 = secure_filename(img1.filename)
    filename2 = secure_filename(img2.filename)

    path1 = os.path.join(app.config['UPLOAD_FOLDER'], filename1)
    path2 = os.path.join(app.config['UPLOAD_FOLDER'], filename2)

    img1.save(path1)
    img2.save(path2)

    text1 = extract_text_from_image(path1)
    text2 = extract_text_from_image(path2)

    return jsonify({'teacher_text': text1, 'student_text': text2})

@app.route('/evaluate', methods=['POST'])
@login_required
def evaluate():
    teacher_text = request.form['teacher_text']
    student_text = request.form['student_text']
    marks_weight = int(request.form['marks_weight'])
    student_name = request.form['student_name']
    batch = request.form['batch']

    if not app.config.get('DEEPSEEK_API_KEY') or app.config['DEEPSEEK_API_KEY'] == 'your-deepseek-api-key-here':
        return jsonify({'error': 'DeepSeek API key not configured'})

    prompt = f"""Evaluate the student's answer with EMPHASIS ON CONCEPTUAL UNDERSTANDING rather than exact wording:
    (prompt truncated here for brevity in code listing)"""

    response = call_deepseek_api(prompt)

    if response is None:
        return jsonify({'error': 'Evaluation service unavailable'})

    marks = f"0/{marks_weight}"
    feedback = "Evaluation failed. Please try again."
    lines = [line.strip() for line in response.split('\n') if line.strip()]

    for line in lines:
        line_lower = line.lower()
        if line_lower.startswith('marks:'):
            marks_part = line.split(':', 1)[1].strip()
            if '/' in marks_part:
                marks = marks_part
            else:
                marks = f"{marks_part}/{marks_weight}"
        elif line_lower.startswith('feedback:'):
            feedback = line.split(':', 1)[1].strip()

    try:
        marks_obtained = int(marks.split('/')[0])
    except Exception:
        marks_obtained = 0

    conn = sqlite3.connect('imvs.db')
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO evaluations (user_id, student_name, batch, teacher_text, student_text, marks_weight, marks_obtained, feedback)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ''', (session['user_id'], student_name, batch, teacher_text, student_text, marks_weight, marks_obtained, feedback))
    conn.commit()
    conn.close()

    final_output = f"Marks: {marks}\nFeedback: {feedback}"
    return jsonify({'evaluation': final_output})

@app.route('/advanced_extract_text', methods=['POST'])
@login_required
def advanced_extract_text():
    if not model_ready:
        return jsonify({'error': 'OCR model is still loading. Please wait a few seconds and try again.'})

    try:
        teacher_images = request.files.getlist('teacher_images[]')
        student_images = request.files.getlist('student_images[]')

        if not teacher_images or not student_images:
            return jsonify({'error': 'Please upload both teacher and student images'})

        question_count = request.form.get('question_count')
        if not question_count:
            return jsonify({'error': 'Question count is required'})

        question_count = int(question_count)

        teacher_text = ""
        for i, image in enumerate(teacher_images):
            if image and allowed_file(image.filename):
                filename = secure_filename(f"teacher_{i}_{image.filename}")
                path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                image.save(path)
                text = extract_text_from_image(path)
                teacher_text += f"Teacher Image {i+1}:\n{text}\n\n"

        student_text = ""
        for i, image in enumerate(student_images):
            if image and allowed_file(image.filename):
                filename = secure_filename(f"student_{i}_{image.filename}")
                path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                image.save(path)
                text = extract_text_from_image(path)
                student_text += f"Student Image {i+1}:\n{text}\n\n"

        detected_questions = count_questions_in_text(student_text, question_count)

        response_data = {
            'teacher_text': teacher_text,
            'student_text': student_text,
            'question_validation': {
                'expected_questions': question_count,
                'detected_questions': detected_questions,
                'all_questions_found': detected_questions >= question_count
            }
        }

        if detected_questions < question_count:
            response_data['warning'] = f"Only {detected_questions} out of {question_count} questions detected in the uploaded images. Please check if all answers are visible."

        return jsonify(response_data)

    except Exception as e:
        return jsonify({'error': str(e)})

@app.route('/advanced_evaluate', methods=['POST'])
@login_required
def advanced_evaluate():
    try:
        teacher_text = request.form['teacher_text']
        student_text = request.form['student_text']
        student_name = request.form['student_name']
        batch = request.form['batch']
        total_marks = int(request.form['total_marks'])
        questions = json.loads(request.form['questions'])

        if not teacher_text or not student_text:
            return jsonify({'error': 'No text extracted from images'})

        results = []
        for question in questions:
            result = evaluate_single_question(teacher_text, student_text, question['marks'], question['number'])
            results.append(result)

        total_obtained = sum(r['marks_obtained'] for r in results)
        percentage = (total_obtained / total_marks) * 100

        conn = sqlite3.connect('imvs.db')
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO advanced_evaluations (user_id, student_name, batch, total_marks, marks_obtained, percentage)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (session['user_id'], student_name, batch, total_marks, total_obtained, percentage))

        advanced_eval_id = cursor.lastrowid

        for result in results:
            cursor.execute('''
                INSERT INTO question_results (advanced_evaluation_id, question_number, question_text, max_marks, marks_obtained, feedback)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (advanced_eval_id, result['question_number'], result['question_text'], result['max_marks'], result['marks_obtained'], result['feedback']))

        conn.commit()
        conn.close()

        return jsonify({'results': results, 'total_obtained': total_obtained, 'percentage': percentage})

    except Exception as e:
        print("Advanced evaluation error:", str(e))
        return jsonify({'error': str(e)})

@app.route('/system_status')
@login_required
def system_status():
    status = {
        'gpu_available': torch.cuda.is_available(),
        'model_ready': model_ready,
        'ocr_model_loaded': ocr_model is not None,
        'quantization_8bit': bool(is_8bit)
    }
    if torch.cuda.is_available():
        status['gpu_name'] = torch.cuda.get_device_name(0)
        status['gpu_memory'] = f"{torch.cuda.get_device_properties(0).total_memory / 1024**3:.1f} GB"
    return jsonify(status)

if __name__ == '__main__':
    print("\n" + "="*50)
    print("🚀 IMVS Application Starting...")
    print("⚡ Attempting to load optimized OCR model (8-bit preferred, fallback to fp16)...")
    print("="*50)
    app.run(debug=True)
