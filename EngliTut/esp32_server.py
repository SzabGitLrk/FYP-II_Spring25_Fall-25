"""
esp32_server.py — EngliTut
===========================
Flask server that runs on your PC.
ESP32 (HW-484 mic, GF1002 amp) sends WAV → server processes → returns PCM back.

ESP32 hardware:
  Mic      : HW-484 v0.2 analog → GPIO 34
  Amplifier: GF1002 analog      ← GPIO 25 DAC output
  Audio    : 8kHz, 8-bit unsigned PCM, mono

Run on your PC:
    python esp32_server.py

The server prints your PC's local IP at startup.
Paste that IP into SERVER_IP in your .ino file.
"""

import os
import tempfile
import numpy as np
import scipy.io.wavfile as wav_io
from flask import Flask, request, Response
from dotenv import load_dotenv

from audio_utils import bandpass_filter, reduce_noise, normalize_audio
from whisper_transcribe import transcribe_audio
from llm_client import correct_transcript, analyze_mistakes
from config import FS

load_dotenv()

app = Flask(__name__)

BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
VOICE_BASE = os.path.join(BASE_DIR, "EngliTut", "voices")
os.makedirs(VOICE_BASE, exist_ok=True)

# ============================================================
# ESP32 AUDIO FORMAT (must match .ino settings)
# ============================================================

ESP32_SAMPLE_RATE = 8000   # Hz  — matches SAMPLE_RATE in .ino
ESP32_BIT_DEPTH   = 8      # bits — 8-bit unsigned PCM from HW-484 ADC
ESP32_CHANNELS    = 1      # mono

# ============================================================
# HELPER — text → raw 8-bit PCM bytes at 8kHz for DAC playback
# ============================================================

def text_to_pcm_bytes(text: str) -> bytes:
    """
    Convert text to raw PCM bytes that the ESP32 DAC can play directly.

    Format out: 8-bit unsigned PCM, mono, 8000 Hz
    - ESP32 dacWrite() expects 0-255 values
    - GF1002 amp input is AC-coupled, so 128 = silence (mid-rail)
    - We use gTTS → mp3 → resample to 8kHz 8-bit via pydub
    """
    from gtts import gTTS
    from pydub import AudioSegment

    tts = gTTS(text=text, lang="en", slow=False)

    tmp_mp3 = tempfile.mktemp(suffix=".mp3")
    tmp_wav = tempfile.mktemp(suffix=".wav")

    try:
        tts.save(tmp_mp3)

        # Convert mp3 → 8kHz mono 8-bit WAV
        # set_sample_width(1) = 8-bit, which is unsigned 0-255
        audio = AudioSegment.from_mp3(tmp_mp3)
        audio = (audio
                 .set_frame_rate(ESP32_SAMPLE_RATE)   # 8000 Hz
                 .set_channels(ESP32_CHANNELS)         # mono
                 .set_sample_width(1))                 # 8-bit unsigned

        audio.export(tmp_wav, format="wav")

        # Skip 44-byte WAV header — return only raw PCM bytes
        with open(tmp_wav, "rb") as f:
            f.seek(44)
            pcm_bytes = f.read()

        return pcm_bytes

    finally:
        for p in (tmp_mp3, tmp_wav):
            try: os.remove(p)
            except: pass


# ============================================================
# HELPER — resample audio array to Whisper-friendly 16kHz
# ============================================================

def resample_to_16k(audio: np.ndarray, orig_rate: int) -> np.ndarray:
    """
    Simple linear resample from orig_rate to 16000 Hz.
    Whisper works best at 16kHz.
    """
    if orig_rate == 16000:
        return audio
    import scipy.signal as sig
    target_len = int(len(audio) * 16000 / orig_rate)
    resampled = sig.resample(audio, target_len)
    return resampled.astype(np.float32)


# ============================================================
# MAIN ENDPOINT — ESP32 POSTs WAV here
# ============================================================

@app.route("/api/esp32/process", methods=["POST"])
def process_audio():
    """
    1. Receive WAV from ESP32 (8kHz, 8-bit unsigned PCM, mono)
    2. Preprocess: convert → float32, denoise, normalize, resample to 16kHz
    3. Transcribe with Groq Whisper
    4. Practice or Learning mode via LLM
    5. Return raw 8-bit PCM bytes at 8kHz for DAC playback
    """
    mode = request.headers.get("X-Mode", "practice").strip().lower()

    tmp_input     = tempfile.mktemp(suffix=".wav")
    tmp_processed = tempfile.mktemp(suffix=".wav")

    try:
        audio_bytes = request.get_data()

        if len(audio_bytes) < 44:
            print("[EngliTut] ERROR: received too few bytes (no WAV header?)")
            return Response(
                text_to_pcm_bytes("Audio too short. Please try again."),
                mimetype="application/octet-stream"
            ), 400

        with open(tmp_input, "wb") as f:
            f.write(audio_bytes)

        print(f"\n[EngliTut] Received {len(audio_bytes)} bytes | mode={mode}")

        # ── Load WAV ───────────────────────────────────────────
        sample_rate, audio_data = wav_io.read(tmp_input)
        print(f"[EngliTut] WAV: {sample_rate}Hz, dtype={audio_data.dtype}, shape={audio_data.shape}")

        # HW-484 → 8-bit unsigned PCM (uint8, 0-255)
        # Convert to float32 in range [-1.0, 1.0]
        if audio_data.dtype == np.uint8:
            # unsigned 8-bit: subtract 128 to center, then divide by 128
            audio_float = (audio_data.astype(np.float32) - 128.0) / 128.0
        elif audio_data.dtype == np.int16:
            audio_float = audio_data.astype(np.float32) / 32768.0
        else:
            audio_float = audio_data.astype(np.float32)

        # Mono check
        if audio_float.ndim > 1:
            audio_float = audio_float.mean(axis=1)

        # ── Preprocess ─────────────────────────────────────────
        try:
            processed = normalize_audio(reduce_noise(bandpass_filter(audio_float)))
        except Exception as e:
            print(f"[EngliTut] Preprocessing warning: {e} — using raw audio")
            processed = normalize_audio(audio_float)

        # ── Resample to 16kHz for Whisper ──────────────────────
        audio_16k = resample_to_16k(processed, sample_rate)

        # Save as 16kHz 16-bit WAV for Whisper
        wav_io.write(tmp_processed, 16000, (audio_16k * 32767).astype(np.int16))

        # ── Transcribe ─────────────────────────────────────────
        transcript = transcribe_audio(tmp_processed)
        print(f"[EngliTut] Transcript: '{transcript}'")

        if not transcript or not transcript.strip():
            return Response(
                text_to_pcm_bytes("I could not understand. Please speak clearly and try again."),
                mimetype="application/octet-stream"
            )

        # ── Practice Mode ──────────────────────────────────────
        if mode == "practice":
            llm_result     = correct_transcript(transcript, speak=False)
            corrected_text = (
                llm_result.get("corrected") if isinstance(llm_result, dict) else llm_result
            ) or transcript
            print(f"[EngliTut] Corrected: '{corrected_text}'")
            response_audio = text_to_pcm_bytes(corrected_text)

        # ── Learning Mode ──────────────────────────────────────
        elif mode == "learning":
            analysis    = analyze_mistakes(transcript)
            mistakes    = analysis.get("mistakes", [])
            corrected   = analysis.get("corrected", transcript)
            overall_tip = analysis.get("overall_tip", "")

            if not mistakes:
                response_text = "Great job! No mistakes found. Your sentence was correct."
            else:
                parts = []
                for i, m in enumerate(mistakes, 1):
                    parts.append(
                        f"Mistake {i}. "
                        f"You said {m.get('wrong', '')}. "
                        f"It should be {m.get('correct', '')}. "
                        f"{m.get('reason', '')}. "
                        f"Tip: {m.get('tip', '')}."
                    )
                parts.append(f"The corrected sentence is: {corrected}.")
                parts.append(f"Overall tip: {overall_tip}.")
                response_text = " ".join(parts)

            print(f"[EngliTut] Feedback (first 120 chars): {response_text[:120]}")
            response_audio = text_to_pcm_bytes(response_text)

        else:
            response_audio = text_to_pcm_bytes(
                f"Unknown mode {mode}. Please set MODE to practice or learning in your ESP32 sketch."
            )

        print(f"[EngliTut] Sending {len(response_audio)} PCM bytes back to ESP32")
        return Response(response_audio, mimetype="application/octet-stream")

    except Exception as e:
        import traceback
        print(f"[EngliTut] ERROR: {e}")
        traceback.print_exc()
        return Response(
            text_to_pcm_bytes("Something went wrong. Please try again."),
            mimetype="application/octet-stream"
        ), 500

    finally:
        for p in (tmp_input, tmp_processed):
            try: os.remove(p)
            except: pass


# ============================================================
# HEALTH CHECK
# ============================================================

@app.route("/api/health", methods=["GET"])
def health():
    return {"status": "EngliTut ESP32 server running", "ok": True}


# ============================================================
# RUN
# ============================================================

if __name__ == "__main__":
    import socket
    hostname = socket.gethostname()
    try:
        local_ip = socket.gethostbyname(hostname)
    except Exception:
        local_ip = "127.0.0.1"

    print("\n" + "="*55)
    print("       EngliTut — ESP32 Server")
    print("="*55)
    print(f"  Local IP      : {local_ip}")
    print(f"  Port          : 5000")
    print(f"  ESP32 endpoint: http://{local_ip}:5000/api/esp32/process")
    print(f"  ESP32 audio   : {ESP32_SAMPLE_RATE}Hz, {ESP32_BIT_DEPTH}-bit, mono")
    print(f"  Whisper audio : 16000Hz, 16-bit (resampled internally)")
    print("")
    print("  → Paste the IP above into SERVER_IP in your .ino file")
    print("="*55 + "\n")

    app.run(host="0.0.0.0", port=5000, debug=False)
