# # recorder.py
import sounddevice as sd
import numpy as np
from config import FS, DURATION

# def record_audio(duration=DURATION, fs=FS):
#     print(f"\n Recording for {duration} seconds... Please keep silent for first 0.8s.")
#     audio = sd.rec(int(duration * fs), samplerate=fs, channels=1, dtype='float32')
#     sd.wait()
#     print("Recording done.\n")
#     return audio.squeeze()

def record_audio(duration=None, fs=FS):
    if duration is None:
        duration = DURATION   

    print(f"\n Recording for {duration} seconds...")
    audio = sd.rec(int(duration * fs), samplerate=fs, channels=1, dtype='float32')
    sd.wait()
    print("Recording done.\n")
    return audio.squeeze()
