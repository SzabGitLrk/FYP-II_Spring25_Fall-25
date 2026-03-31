"""
EngliTut - Main Entry Point
================================
Two modes:
  1. Practice Mode  — speaks corrected version of what you said
  2. Learning Mode  — explains every mistake + asks you to repeat

Pipeline (both modes):
  Record → Preprocess → Transcribe (Groq Whisper API) → LLM → Speak
"""

import os
import numpy as np
import scipy.io.wavfile as wav
from datetime import datetime

from audio_utils import (
    record_audio,
    bandpass_filter,
    reduce_noise,
    normalize_audio,
    save_audio,
    save_transcript_to_txt
)
from whisper_transcribe import transcribe_audio
from llm_client import (
    correct_transcript,
    speak_text_chunked,
    analyze_mistakes,
    speak_learning_feedback
)
from config import FS

# ============================================================
# PATHS
# ============================================================

BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
VOICE_BASE = os.path.join(BASE_DIR, "EngliTut", "voices")
os.makedirs(VOICE_BASE, exist_ok=True)


# ============================================================
# SHARED — Record + Preprocess + Transcribe
# ============================================================

def record_and_transcribe(folder, prefix="audio"):
    """
    Records audio, preprocesses it, saves it, and returns (transcript, audio_path).
    Returns (None, None) if something fails.
    """
    print("\n🎙️  Listening... (speak now)")
    raw_audio = record_audio()

    if raw_audio is None:
        print("⚠️  No audio detected.")
        return None, None

    # Stereo → Mono
    if hasattr(raw_audio, "ndim") and raw_audio.ndim > 1:
        raw_audio = raw_audio.mean(axis=1)

    # Preprocess
    try:
        normalized = normalize_audio(reduce_noise(bandpass_filter(raw_audio)))
    except Exception as e:
        print(f"⚠️  Audio processing error: {e}")
        return None, None

    # Save
    timestamp  = datetime.now().strftime("%Y%m%d_%H%M%S")
    audio_path = os.path.join(folder, f"{prefix}_{timestamp}.wav")
    try:
        save_audio(normalized, audio_path)
    except Exception as e:
        print(f"⚠️  Could not save audio: {e}")
        return None, None

    # Transcribe
    try:
        transcript = transcribe_audio(audio_path)
    except Exception as e:
        print(f"⚠️  Transcription error: {e}")
        return None, audio_path

    if not transcript:
        speak_text_chunked("I could not understand. Please try again.")
        return None, audio_path

    print(f"\n🗣️  You said: \"{transcript}\"")
    return transcript, audio_path


# ============================================================
# MODE 1 — PRACTICE MODE
# ============================================================

def run_practice_mode(user_name, user_folder):
    """
    Practice loop:
    Speak → Transcribe → LLM Corrects → Speaks correction → Repeat
    """
    practice_folder = os.path.join(user_folder, "practice")
    os.makedirs(practice_folder, exist_ok=True)

    speak_text_chunked(
        f"Practice mode started. Speak freely and I will correct you. Say exit to stop."
    )

    print("\n" + "="*60)
    print("     🎯 PRACTICE MODE  —  say 'exit' to quit")
    print("="*60)

    while True:
        transcript, _ = record_and_transcribe(practice_folder, prefix="practice")

        if transcript is None:
            continue

        if "exit" in transcript.lower():
            speak_text_chunked("Goodbye! Practice session ended.")
            break

        # LLM correction
        try:
            llm_result     = correct_transcript(transcript, speak=False)
            corrected_text = (
                llm_result.get("corrected") if isinstance(llm_result, dict) else llm_result
            ) or transcript
        except Exception as e:
            print(f"⚠️  LLM error: {e}")
            corrected_text = transcript

        print(f"\n✅ Corrected: \"{corrected_text}\"")

        # Save transcript
        try:
            save_transcript_to_txt(corrected_text, user_name=user_name,
                                   mode="practice", folder_path=practice_folder)
        except Exception as e:
            print(f"⚠️  Transcript save error: {e}")

        # Speak corrected version
        try:
            speak_text_chunked(corrected_text, method='auto', lang='en')
        except Exception as e:
            print(f"⚠️  TTS error: {e}")

    print("\n🎯 Practice session ended.\n")


# ============================================================
# MODE 2 — LEARNING MODE
# ============================================================

def run_learning_mode(user_name, user_folder):
    """
    Learning loop:
    Speak → Transcribe → LLM finds mistakes → Explains each mistake
    → Asks you to repeat → Re-evaluates → Moves on → Repeat
    """
    learning_folder = os.path.join(user_folder, "learning")
    os.makedirs(learning_folder, exist_ok=True)

    speak_text_chunked(
        "Learning mode started. Speak a sentence. "
        "I will explain your mistakes and ask you to repeat. "
        "Say exit to stop."
    )

    print("\n" + "="*60)
    print("     📚 LEARNING MODE  —  say 'exit' to quit")
    print("="*60)

    sentence_count = 0

    while True:
        sentence_count += 1
        print(f"\n--- Sentence {sentence_count} ---")

        # ── Step 1: First attempt ──────────────────────────────
        transcript, _ = record_and_transcribe(learning_folder, prefix=f"s{sentence_count}_attempt1")

        if transcript is None:
            continue

        if "exit" in transcript.lower():
            speak_text_chunked("Goodbye! Learning session ended. Keep practising!")
            break

        # ── Step 2: Analyze mistakes & give feedback ───────────
        print("\n⏳ Analyzing your sentence...")
        try:
            analysis = analyze_mistakes(transcript)
        except Exception as e:
            print(f"⚠️  Analysis error: {e}")
            analysis = {"mistakes": [], "corrected": transcript, "overall_tip": "Keep practising!"}

        speak_learning_feedback(analysis)

        mistakes   = analysis.get("mistakes", [])
        corrected  = analysis.get("corrected", transcript)

        # ── Step 3: Ask to repeat only if there were mistakes ──
        if mistakes:
            speak_text_chunked(
                f"Now please repeat the corrected sentence: {corrected}"
            )
            print(f"\n🔁 Repeat this: \"{corrected}\"")
            print("🎙️  Recording your repeated attempt...")

            # ── Step 4: Record the repeated attempt ───────────
            repeated, _ = record_and_transcribe(
                learning_folder, prefix=f"s{sentence_count}_attempt2"
            )

            if repeated is None:
                msg = "I did not hear anything. Please say something when it is your turn."
                print(f"\n⚠️  {msg}")
                speak_text_chunked(msg)
            elif "exit" in repeated.lower():
                speak_text_chunked("Goodbye! Learning session ended.")
                break
            else:
                # ── Step 5: Re-evaluate the repeated attempt ──
                print("\n⏳ Re-evaluating your repeated sentence...")
                try:
                    re_analysis = analyze_mistakes(repeated)
                except Exception as e:
                    print(f"⚠️  Re-analysis error: {e}")
                    re_analysis = {"mistakes": [], "corrected": repeated, "overall_tip": ""}

                re_mistakes = re_analysis.get("mistakes", [])

                if not re_mistakes:
                    msg = "Excellent! You repeated it correctly. Well done!"
                    print(f"\n🌟 {msg}")
                    speak_text_chunked(msg)
                else:
                    remaining = len(re_mistakes)
                    msg = (
                        f"Good effort! You still have {remaining} "
                        f"{'mistake' if remaining == 1 else 'mistakes'}. "
                        f"Keep practising this pattern."
                    )
                    print(f"\n💪 {msg}")
                    # Show remaining mistakes in terminal only (don't re-speak all)
                    for m in re_mistakes:
                        print(f"   Still wrong: \"{m.get('wrong','')}\" → \"{m.get('correct','')}\"")
                    speak_text_chunked(msg)

        else:
            # No mistakes — praise and immediately move to next sentence, no tips shown
            msg = "Great job! No mistakes found. Your sentence was correct."
            print(f"\n✅ {msg}")
            speak_text_chunked(msg)
            speak_text_chunked("Speak your next sentence.")
            continue

        # ── Step 6: Move on ────────────────────────────────────
        speak_text_chunked("Moving on. Speak your next sentence.")

    print("\n📚 Learning session ended.\n")


# ============================================================
# MAIN
# ============================================================

def main():
    print("\n" + "="*60)
    print("            🎙️  ENGLITUT")
    print("="*60)

    # ── Get user name ──────────────────────────────────────────
    speak_text_chunked("Welcome to EngliTut. Please tell me your name.")

    print("\n🎙️  Recording your name (4 seconds)...")
    name_audio = record_audio(duration=4)

    if name_audio is None:
        user_name = "User"
    else:
        name_audio = normalize_audio(reduce_noise(bandpass_filter(name_audio)))
        temp_path  = os.path.join(VOICE_BASE, "temp_name.wav")
        wav.write(temp_path, FS, (name_audio * 32767).astype(np.int16))

        try:
            name_text = transcribe_audio(temp_path).strip()
            words     = name_text.split()
            user_name = "_".join(words[:2]) if len(words) >= 2 else (words[0] if words else "User")
        except Exception:
            user_name = "User"

        try:
            os.remove(temp_path)
        except Exception:
            pass

    display_name = user_name.replace("_", " ")
    print(f"\n👤 Hello, {display_name}!")

    # ── Set up user folder ─────────────────────────────────────
    user_folder = os.path.join(VOICE_BASE, user_name)
    os.makedirs(user_folder, exist_ok=True)

    # Save intro voice on first run
    intro_file = os.path.join(user_folder, "intro.wav")
    if not os.path.exists(intro_file):
        intro_audio = record_audio(duration=3)
        if intro_audio is not None:
            intro_audio = normalize_audio(reduce_noise(bandpass_filter(intro_audio)))
            save_audio(intro_audio, intro_file)

    # ── Mode selection ─────────────────────────────────────────
    speak_text_chunked(
        f"Hello {display_name}. "
        "Say practice mode or learning mode to begin."
    )

    print("\n" + "="*60)
    print("  Choose mode:")
    print("  🎯 Say 'practice mode'  — I correct your speech")
    print("  📚 Say 'learning mode'  — I explain your mistakes")
    print("="*60)

    print("\n🎙️  Listening for mode selection (5 seconds)...")
    mode_audio = record_audio(duration=5)

    mode = "practice"  # default
    if mode_audio is not None:
        mode_audio  = normalize_audio(reduce_noise(bandpass_filter(mode_audio)))
        mode_path   = os.path.join(user_folder, "mode_selection.wav")
        wav.write(mode_path, FS, (mode_audio * 32767).astype(np.int16))
        try:
            mode_text = transcribe_audio(mode_path).lower()
            if "learn" in mode_text:
                mode = "learning"
            else:
                mode = "practice"
        except Exception:
            mode = "practice"

    # ── Launch mode ────────────────────────────────────────────
    if mode == "learning":
        print("\n📚 Starting Learning Mode...")
        run_learning_mode(user_name, user_folder)
    else:
        print("\n🎯 Starting Practice Mode...")
        run_practice_mode(user_name, user_folder)


if __name__ == "__main__":
    main()
