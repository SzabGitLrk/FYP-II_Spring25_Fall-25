# app.py
import os
import time
import uuid
from pathlib import Path
# from flask import Flask, request, jsonify, send_from_directory, render_template, safe_join
from flask import Flask, request, jsonify, send_from_directory, render_template
from werkzeug.utils import safe_join

from flask_cors import CORS
from dotenv import load_dotenv

# Try to import Groq client (user requested)
GROQ_API_KEY = None
GROQ_MODEL = None
groq_client = None
try:
    load_dotenv()  # load .env early so env vars are available to imports if needed
    GROQ_API_KEY = os.getenv("GROQ_API_KEY", "").strip() or None
    GROQ_MODEL = os.getenv("GROQ_MODEL", "").strip() or os.getenv("GROQ_MODEL", "groq-alpha")
    # Attempt to import typical groq client
    try:
        from groq import Groq
        groq_client = Groq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None
    except Exception:
        # Some installs expose a different name; try alternative import if you have it.
        try:
            import groq as _groq_module
            # If module exposes a client constructor
            if hasattr(_groq_module, "Groq"):
                groq_client = _groq_module.Groq(api_key=GROQ_API_KEY)
            elif hasattr(_groq_module, "Client"):
                groq_client = _groq_module.Client(api_key=GROQ_API_KEY)
            else:
                groq_client = None
        except Exception:
            groq_client = None
except Exception:
    GROQ_API_KEY = None
    GROQ_MODEL = None
    groq_client = None

# TTS: prefer pyttsx3 (offline). If not available, fallback to gTTS if internet is present.
tts_backend = None
try:
    import pyttsx3
    tts_backend = "pyttsx3"
except Exception:
    try:
        from gtts import gTTS
        tts_backend = "gtts"
    except Exception:
        tts_backend = None

# If dotenv not loaded above (rare), load now
load_dotenv()

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
AUDIO_DIR = STATIC_DIR / "audio"
AUDIO_DIR.mkdir(parents=True, exist_ok=True)

app = Flask(__name__, static_folder=str(STATIC_DIR), static_url_path="/static")
CORS(app, resources={r"/api/*": {"origins": "*"}})  # open for local dev

# Serve your existing HTML (if you saved it to templates/index.html)
@app.route("/", methods=["GET"])
def index():
    index_path = BASE_DIR / "templates" / "index.html"
    if index_path.exists():
        return render_template("index.html")
    return (
        "Place your front-end HTML into templates/index.html to be served, "
        "or open the HTML directly in the browser. Backend API endpoints are under /api/ ."
    )

# Health
@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({
        "ok": True,
        "tts_backend": tts_backend,
        "groq_available": bool(GROQ_API_KEY and groq_client),
        "groq_model": GROQ_MODEL
    })

# Correct endpoint: accepts JSON {"text": "...", "mode": "practice" (optional)}
@app.route("/api/correct", methods=["POST"])
def api_correct():
    data = request.get_json(force=True, silent=True) or {}
    text = data.get("text", "")
    mode = data.get("mode", "practice")

    if not text or not text.strip():
        return jsonify({"error": "empty_text", "message": "No text provided."}), 400

    text = str(text).strip()

    # 1) Prepare system/prompt for correction based on mode
    if mode == "translate":
        system = (
            "You are an assistant that translates short Urdu sentences/transcripts into natural, "
            "idiomatic English; do not invent extra content. Keep tone simple and friendly."
        )
    elif mode == "exam":
        system = (
            "You are an assistant that corrects and polishes spoken English transcripts for exam simulation. "
            "Return a clear, concise corrected transcript, fixing grammar, punctuation, and clarity. "
            "Also return a brief single-sentence suggestion for improvement under the 'advice' field."
        )
    else:
        system = (
            "You are a friendly assistant that corrects spoken English transcripts. "
            "Return the cleaned corrected transcript only (no extra commentary)."
        )

    corrected = None
    advice = None

    # 2) Try Groq if GROQ_API_KEY present and client available
    if GROQ_API_KEY and groq_client:
        try:
            prompt = system + "\n\nPlease correct and clean this transcript:\n\n" + text
            # Try multiple common method names on the client to be robust across versions
            resp_text = None
            # method: generate(model=..., prompt=...)
            if hasattr(groq_client, "generate"):
                try:
                    # many clients return object with `.text` or plain string
                    r = groq_client.generate(model=GROQ_MODEL, prompt=prompt)
                    # attempt to extract text from various response shapes
                    if isinstance(r, str):
                        resp_text = r
                    elif hasattr(r, "text"):
                        resp_text = r.text
                    elif isinstance(r, dict) and r.get("text"):
                        resp_text = r.get("text")
                    else:
                        resp_text = str(r)
                except Exception:
                    resp_text = None

            # method: complete(model=..., prompt=...)
            if resp_text is None and hasattr(groq_client, "complete"):
                try:
                    r = groq_client.complete(model=GROQ_MODEL, prompt=prompt)
                    if isinstance(r, str):
                        resp_text = r
                    elif isinstance(r, dict) and "choices" in r and r["choices"]:
                        resp_text = r["choices"][0].get("text") or str(r)
                    else:
                        resp_text = str(r)
                except Exception:
                    resp_text = None

            # method: run(model, prompt) or predict
            if resp_text is None and hasattr(groq_client, "run"):
                try:
                    r = groq_client.run(GROQ_MODEL, prompt)
                    resp_text = r if isinstance(r, str) else str(r)
                except Exception:
                    resp_text = None

            if resp_text is None and hasattr(groq_client, "predict"):
                try:
                    r = groq_client.predict(model=GROQ_MODEL, prompt=prompt)
                    resp_text = r if isinstance(r, str) else str(r)
                except Exception:
                    resp_text = None

            # final fallback: if groq_client has __call__, try calling it
            if resp_text is None:
                try:
                    r = groq_client(prompt)
                    resp_text = r if isinstance(r, str) else str(r)
                except Exception:
                    resp_text = None

            if resp_text:
                # basic normalization: strip
                corrected = resp_text.strip()
                # if exam mode, naive split for advice
                if mode == "exam":
                    parts = corrected.split("\n\n")
                    if len(parts) > 1:
                        advice = parts[-1].strip()
                        corrected = "\n\n".join(parts[:-1]).strip()
            else:
                corrected = None
        except Exception as e:
            print("Groq call failed:", repr(e))
            corrected = None

    # 3) Fallback local correction (simple heuristics) if no Groq or call failed
    if not corrected:
        import re
        cleaned = re.sub(r"\b(u+m+|uh+|um+)\b", "", text, flags=re.I)
        cleaned = re.sub(r"\blike\b[,]?", "", cleaned, flags=re.I)
        cleaned = re.sub(r"\s{2,}", " ", cleaned).strip()
        if not re.search(r"[.?!]$", cleaned):
            cleaned = cleaned + "."
        cleaned = cleaned[0].upper() + cleaned[1:] if cleaned else cleaned
        corrected = cleaned
        if mode == "exam":
            advice = "Try to slow down slightly and connect sentences using linking words."

    # 4) Generate TTS to MP3 and return URL
    audio_filename = None
    if corrected:
        try:
            audio_filename = generate_tts_mp3(corrected)
        except Exception as e:
            print("TTS generation failed:", e)
            audio_filename = None

    result = {
        "corrected_text": corrected,
        "advice": advice,
        "audio_url": f"/static/audio/{audio_filename}" if audio_filename else None,
        "used_groq": bool(GROQ_API_KEY and groq_client and corrected is not None)
    }
    return jsonify(result)


def generate_tts_mp3(text: str) -> str:
    """
    Produces an MP3 (or WAV) file saved in static/audio and returns filename.
    Uses pyttsx3 (offline) if available, otherwise gTTS.
    """
    uid = uuid.uuid4().hex[:12]
    out_name = f"correction_{int(time.time())}_{uid}.mp3"
    out_path = AUDIO_DIR / out_name

    if tts_backend == "pyttsx3":
        import pyttsx3
        engine = pyttsx3.init()
        try:
            engine.setProperty('rate', 165)
            engine.setProperty('volume', 0.95)
        except Exception:
            pass

        tmp_wav = AUDIO_DIR / f"{uid}.wav"
        engine.save_to_file(text, str(tmp_wav))
        engine.runAndWait()
        engine.stop()

        # Try to convert wav -> mp3 using pydub if available
        try:
            from pydub import AudioSegment
            AudioSegment.from_wav(str(tmp_wav)).export(str(out_path), format="mp3")
            tmp_wav.unlink(missing_ok=True)
            return out_name
        except Exception:
            alt_name = f"correction_{int(time.time())}_{uid}.wav"
            alt_path = AUDIO_DIR / alt_name
            try:
                tmp_wav.rename(alt_path)
                return alt_name
            except Exception:
                # last resort: return None
                tmp_wav.unlink(missing_ok=True)
                raise RuntimeError("Failed to produce TTS audio (pydub/ffmpeg not installed).")

    elif tts_backend == "gtts":
        from gtts import gTTS
        tts = gTTS(text=text, lang="en")
        tts.save(str(out_path))
        return out_name

    else:
        raise RuntimeError("No TTS backend available. Install pyttsx3 or gTTS (and optionally pydub+ffmpeg).")


# Serve audio files explicitly (Flask static folder serves them already)
@app.route("/static/audio/<path:filename>")
def serve_audio(filename):
    safe = safe_join(str(AUDIO_DIR), filename)
    if safe and os.path.exists(safe):
        return send_from_directory(str(AUDIO_DIR), filename)
    return jsonify({"error": "not_found"}), 404


if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    debug = os.getenv("FLASK_DEBUG", "1") == "1"
    print(f"Starting Flask on port {port} (debug={debug}) - TTS backend={tts_backend} - groq={bool(GROQ_API_KEY and groq_client)}")
    app.run(host="0.0.0.0", port=port, debug=debug)
