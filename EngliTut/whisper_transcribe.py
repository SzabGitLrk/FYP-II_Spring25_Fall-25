"""
whisper_transcribe.py
=====================
Uses Groq Whisper API for fast transcription (~1-2 seconds).
Replaces the slow local Whisper large model.
"""

import os
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
client = Groq(api_key=GROQ_API_KEY)


def transcribe_audio(file_path, language="en"):
    """
    Transcribe audio file using Groq Whisper API.
    ~1-2 seconds vs 15-30 seconds with local Whisper large.

    Args:
        file_path (str): Path to .wav audio file
        language (str): Language code, default 'en'

    Returns:
        str: Transcribed text
    """
    print(f"⚡ Transcribing via Groq Whisper API: {file_path}")

    try:
        with open(file_path, "rb") as audio_file:
            transcription = client.audio.transcriptions.create(
                file=(os.path.basename(file_path), audio_file.read()),
                model="whisper-large-v3",
                language=language,
                response_format="text",
                temperature=0.0
            )

        text = transcription.strip() if isinstance(transcription, str) else transcription.text.strip()
        print(f"✅ Transcription done: {text[:80]}{'...' if len(text) > 80 else ''}")
        return text

    except Exception as e:
        print(f"❌ Groq Whisper API error: {e}")
        return ""
