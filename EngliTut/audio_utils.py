"""
audio_utils.py
==============
Core audio processing utilities.
- Translation module REMOVED
- Cleaned up unused imports
"""

import numpy as np
import scipy.io.wavfile as wav
from scipy.signal import butter, sosfiltfilt
import noisereduce as nr
import sounddevice as sd
import os
from datetime import datetime
from config import FS, DURATION, LOWCUT, HIGHCUT, FILTER_ORDER, NOISE_SAMPLE_DURATION

VOICES_DIR = "EngliTut/voices"
os.makedirs(VOICES_DIR, exist_ok=True)


# ============================================================
# RECORD AUDIO
# ============================================================

def record_audio(duration=None, fs=FS):
    if duration is None:
        duration = DURATION
    print(f"\n🎙️ Recording for {duration} seconds...")
    audio = sd.rec(int(duration * fs), samplerate=fs, channels=1, dtype='float32')
    sd.wait()
    print("✅ Recording done.\n")
    return audio.squeeze()


# ============================================================
# AUDIO PROCESSING
# ============================================================

def bandpass_filter(signal, fs=FS, lowcut=LOWCUT, highcut=HIGHCUT, order=FILTER_ORDER):
    nyquist = fs / 2.0
    low = max(1, lowcut) / nyquist
    high = min(highcut, nyquist - 1) / nyquist
    sos = butter(order, [low, high], btype='band', output='sos')
    return sosfiltfilt(sos, signal)


def reduce_noise(signal, fs=FS):
    noise_len = int(NOISE_SAMPLE_DURATION * fs)
    noise_profile = signal[:noise_len]
    reduced = nr.reduce_noise(y=signal, sr=fs, y_noise=noise_profile, prop_decrease=1.0)
    return reduced


def normalize_audio(signal, peak=0.98):
    max_val = np.max(np.abs(signal)) + 1e-9
    return signal / max_val * peak


def save_audio(signal, file_path, fs=FS):
    """Save audio signal to a given file path."""
    os.makedirs(os.path.dirname(os.path.abspath(file_path)), exist_ok=True)
    signal = np.clip(signal, -1.0, 1.0)
    wav.write(file_path, fs, (signal * 32767).astype(np.int16))
    print(f"💾 Saved audio to: {file_path}")
    return file_path


# ============================================================
# SAVE TRANSCRIPT
# ============================================================

def save_transcript_to_txt(transcript_text, user_name, mode="practice", folder_path=None):
    """Save the corrected transcript to a .txt file with timestamp."""
    if folder_path is None:
        safe_name = user_name.strip().replace(" ", "_")
        folder_path = os.path.join("EngliTut", "voices", safe_name, mode)
        os.makedirs(folder_path, exist_ok=True)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    txt_file_path = os.path.join(folder_path, f"transcript_{timestamp}.txt")

    with open(txt_file_path, "w", encoding="utf-8") as f:
        f.write(transcript_text)

    print(f"💾 Transcript saved to: {txt_file_path}")
    return txt_file_path
