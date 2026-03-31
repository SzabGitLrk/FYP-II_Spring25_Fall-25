from groq import Groq
import pyttsx3
from gtts import gTTS
import os
import tempfile
import time
from playsound import playsound
from pydub import AudioSegment
import pygame
from dotenv import load_dotenv


load_dotenv()
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
MODEL = os.getenv("GROQ_MODEL")

client = Groq(api_key=GROQ_API_KEY)

# TTS Engine
tts_engine = None

# ============================
# TTS FUNCTIONS
# ============================
# def initialize_tts():
#     """Initialize pyttsx3 engine"""
#     global tts_engine
#     if tts_engine is None:
#         try:
#             tts_engine = pyttsx3.init()
#             voices = tts_engine.getProperty('voices')
#             tts_engine.setProperty('voice', voices[1].id)  # Female voice
#             tts_engine.setProperty('rate', 150)
#             tts_engine.setProperty('volume', 1.0)
#         except Exception as e:
#             print(f"⚠️ TTS init failed: {e}")
#     return tts_engine
def initialize_tts():
    """Initialize pyttsx3 engine with female voice (closest to Pakistani accent)"""
    global tts_engine
    if tts_engine is None:
        try:
            tts_engine = pyttsx3.init()
            voices = tts_engine.getProperty('voices')

            # female voice search
            selected = None
            for v in voices:
                if 'female' in v.name.lower() or 'zira' in v.name.lower():
                    selected = v.id
                    break

            if selected:
                tts_engine.setProperty('voice', selected)
            else:
                tts_engine.setProperty('voice', voices[0].id)  # fallback

            tts_engine.setProperty('rate', 150)
            tts_engine.setProperty('volume', 1.0)
            print(f"✅ TTS initialized with voice: {selected or voices[0].name}")
        except Exception as e:
            print(f"⚠️ TTS init failed: {e}")
    return tts_engine



# def speak_offline(text):
#     """Speak using pyttsx3 (offline)"""
#     try:
#         engine = initialize_tts()
#         if engine:
#             print("🔊 Speaking (Offline)...")
#             for chunk in text.split('. '):  # split by sentences
#                 engine.say(chunk)
#                 engine.runAndWait()
#             return True
#     except Exception as e:
#         print(f"❌ Offline TTS Error: {e}")
#     return False


def speak_online(text, lang='en'):
    if not text.strip():
        return False
    try:
        print("🔊 Generating speech (Online)...")
        tts = gTTS(text=text, lang=lang, slow=False)

        # Save temp mp3
        with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as fp:
            temp_mp3 = fp.name
        tts.save(temp_mp3)

        # Convert mp3 -> wav
        audio = AudioSegment.from_mp3(temp_mp3)
        temp_wav = temp_mp3.replace(".mp3", ".wav")
        audio.export(temp_wav, format="wav")

        print("▶️ Playing audio...")
        pygame.mixer.init()
        pygame.mixer.music.load(temp_wav)
        pygame.mixer.music.play()

        while pygame.mixer.music.get_busy():
            pygame.time.Clock().tick(10)

        # 🔥 VERY IMPORTANT: release audio properly
        pygame.mixer.music.stop()
        pygame.mixer.quit()

        import time
        time.sleep(0.5)  # Windows file unlock delay

        # cleanup (SAFE)
        try:
            os.remove(temp_mp3)
        except:
            pass

        try:
            os.remove(temp_wav)
        except:
            pass

        return True

    except Exception as e:
        print(f"❌ Online TTS Error: {e}")
        return False



def speak_text(text, method='auto', lang='en'):
    """
    Play text once using chosen method. Guard against concurrent double-play.
    Returns True if playback attempted.
    """
    if not text:
        return False

    # simple lock to avoid overlapping calls in same process
    if _speak_lock["busy"]:
        # already speaking — skip to avoid double-play
        print("⚠️ speak_text called while another TTS in progress; skipping to avoid duplicate audio.")
        return False

    _speak_lock["busy"] = True
    try:
        if method == 'auto':
            # prefer online, fallback to offline
            played = False
            try:
                played = speak_online(text, lang)
            except Exception:
                played = False
            # if not played:
                # speak_offline(text)
        # elif method == 'offline':
        #     speak_offline(text)
        elif method == 'online':
            speak_online(text, lang)
        else:
            # unknown method -> fallback
            speak_online(text, lang)
    finally:
        _speak_lock["busy"] = False

    return True

def speak_text_chunked(text, method='auto', lang='en', chunk_size=200):
    """
    Speak long text in chunks to ensure complete output
    """
    import re, time
    
    if not text:
        return False
    
    # Split text into sentences (Urdu and English punctuation considered)
    sentences = re.split(r'(?<=[.!?؟])\s+', text)
    
    chunk = ""
    for s in sentences:
        if len(chunk) + len(s) > chunk_size:
            speak_text(chunk.strip(), method=method, lang=lang)
            time.sleep(0.1)  # optional small pause
            chunk = s
        else:
            chunk += " " + s
    if chunk:
        speak_text(chunk.strip(), method=method, lang=lang)
    
    return True



# ============================
# LLM CORRECTION (ORIGINAL)
# ============================
def call_groq_llm(transcript):
    """
    Improve sentence naturally without explanation.
    """

    try:
        completion = client.chat.completions.create(
            model=MODEL,
            messages=[
                {
                    "role": "system",
                    "content": """
You are a professional English speaking coach.

Your task:
- Improve the sentence to sound natural and fluent.
- Correct grammar and structure.
- Complete the sentence if it sounds incomplete.
- Make it sound like natural spoken English.
- Do NOT explain anything.
- Do NOT add extra background information.
- Output ONLY the improved sentence.
"""
                },
                {
                    "role": "user",
                    "content": transcript
                }
            ],
            temperature=0.4,
            max_completion_tokens=300
        )

        return completion.choices[0].message.content.strip()

    except Exception as e:
        print(f"🔥 LLM Error: {e}")
        return transcript
# def call_groq_llm(transcript):
#     """
#     Send transcript to Groq LLM for MINIMAL corrections:
#     - Only fix grammar, spelling, fluency
#     - Preserve meaning/context completely
#     - Show mistakes (optional)
#     - Output corrected transcript at the end
#     """
#     try:
#         completion = client.chat.completions.create(
#             model=MODEL,
#             messages=[
#                 {
#                     "role": "system",
#                     "content": """
# You are an expert transcription corrector. 
# Your task is to analyze the input transcript and:

# 1. Identify any grammar or spelling mistakes.
# 2. Suggest improvements for fluency and readability.
# 3. **Do NOT change the meaning, context, or important details.**
# 4. At the end, provide the corrected transcript in full sentences.
# 5. Output in this format:

# Mistakes found:
# - ...

# Fluency improvements:
# - ...

# Corrected transcript:
# <corrected transcript here>
# """
#                 },
#                 {
#                     "role": "user",
#                     "content": f"Transcript:\n{transcript}"
#                 }
#             ],
#             temperature=0.0,  # deterministic
#             max_completion_tokens=1024,
#             top_p=0.95,
#             stream=False
#         )

#         return completion.choices[0].message.content.strip()

#     except Exception as e:
#         print(f"🔥 LLM Error: {e}")
#         return ""


# ============================
# MAIN PUBLIC FUNCTION (ORIGINAL)
# ============================
def _extract_corrected_text_from_llm(output: str) -> str:
    """
    Try multiple heuristics to extract the corrected transcript from raw LLM output.
    Returns a best-effort corrected_text (falls back to the full output).
    """
    if not output:
        return ""

    # common markers
    markers = [
        "Corrected transcript:",
        "Corrected:",
        "Corrected text:",
        "Corrected version:",
        "Corrected sentence:",
        "Corrected output:"
    ]

    # 1) If any marker exists, take text after last occurrence of that marker
    for m in markers:
        if m in output:
            return output.split(m)[-1].strip()

    # 2) If output contains a JSON-like block with "corrected", try to parse it
    try:
        import json, re
        # find a {...} block
        json_match = re.search(r"(\{[\s\S]{20,}\})", output)
        if json_match:
            blob = json_match.group(1)
            parsed = json.loads(blob)
            if isinstance(parsed, dict):
                # try common keys
                for key in ("corrected","corrected_text","corrected_transcript","text"):
                    if key in parsed:
                        return parsed[key].strip()
    except Exception:
        pass

    # 3) Heuristic: choose the longest single line (often corrected sentence is a single clean line)
    lines = [ln.strip() for ln in output.splitlines() if ln.strip()]
    if lines:
        # prefer lines that are sentence-like (contain spaces and punctuation)
        lines_sorted = sorted(lines, key=lambda s: (len(s), s.count(' ')), reverse=True)
        return lines_sorted[0]

    # 4) fallback: return whole output trimmed
    return output.strip()


def correct_transcript(transcript, speak=False, tts_method='auto', lang='en'):
    """
    Correct transcript using Groq LLM.
    - Prints corrected transcript once.
    - Plays TTS once if speak=True.
    - Returns dict: {'corrected': <str>, 'raw': <llm_raw_output>}
    """

    if not transcript:
        return {"corrected": "", "raw": ""}

    print(" Sending to Groq LLM for correction...")

    try:
        output = call_groq_llm(transcript)
    except Exception as e:
        print(f" LLM call error: {e}")
        return {"corrected": transcript, "raw": transcript}

    # Extract corrected text safely
    try:
        corrected_text = _extract_corrected_text_from_llm(output)
        if not corrected_text:
            corrected_text = transcript
    except Exception:
        corrected_text = transcript

    # Print final corrected version once
    print("\n" + "=" * 60)
    print(" LLM corrected transcript (final):")
    print("=" * 60)
    print(corrected_text)
    print("=" * 60 + "\n")

    # Speak only once (prevent double execution)
    global _speak_lock
    if speak and corrected_text and not _speak_lock["busy"]:
        try:
            _speak_lock["busy"] = True
            speak_text(corrected_text, method=tts_method, lang=lang)
            print(" TTS finished (played corrected text once).")
        except Exception as e:
            print(f" TTS play error: {e}")
        finally:
            _speak_lock["busy"] = False

    return {"corrected": corrected_text, "raw": output}


# Lock to prevent double TTS
_speak_lock = {"busy": False}





# ============================
# OPTIONAL: Few-Shot Version (ORIGINAL)
# ============================
def correct_transcript_with_examples(transcript, speak=False, tts_method='auto', lang='en'):
    """
    Enhanced version with few-shot learning examples for better accuracy.
    Speaks ONLY the corrected sentence if speak=True.
    
    Args:
        transcript (str): Raw transcript
        speak (bool): Enable voice output
        tts_method (str): TTS method - 'auto', 'offline', 'online'
        lang (str): Language code for TTS
    
    Returns:
        str: Corrected transcript
    """
    try:
        completion = client.chat.completions.create(
            model=MODEL,
            messages=[
                {
                    "role": "system",
                    "content": "You are an expert transcription corrector. Fix grammar, spelling, and contextual errors."
                },
                {
                    "role": "user",
                    "content": "Correct: Today it's my working hour FIP project Vice Mentor"
                },
                {
                    "role": "assistant",
                    "content": "Today is my working hour for the FYP (Final Year Project) as Vice Mentor."
                },
                {
                    "role": "user",
                    "content": "Correct: tomorrow it's my meeting for my supervisor it's very strict and he said may complete our work"
                },
                {
                    "role": "assistant",
                    "content": "Tomorrow I have a meeting with my supervisor who is very strict, and he said we must complete our work."
                },
                {
                    "role": "user",
                    "content": "Correct: I need finish the report by next week supervisor want see progress"
                },
                {
                    "role": "assistant",
                    "content": "I need to finish the report by next week because my supervisor wants to see progress."
                },
                {
                    "role": "user",
                    "content": f"Correct: {transcript}"
                }
            ],
            temperature=0.1,
            max_completion_tokens=2048,
            top_p=0.95,
            stream=False
        )

        output = completion.choices[0].message.content.strip()

        # Extract only the corrected transcript
        corrected_text = transcript  # fallback
        try:
            if "Corrected:" in output:
                corrected_text = output.split("Corrected:")[-1].strip()
            else:
                corrected_text = output.strip().split("\n")[-1].strip()
        except Exception as e:
            print(f"⚠️ Failed to extract corrected text: {e}")
            corrected_text = output.strip()

        # Speak ONLY the corrected sentence
        if speak and corrected_text:
            try:
              speak_text(f"This is a corrected version: {corrected_text}", method=tts_method, lang=lang)
            except Exception as e:
              print(f"⚠️ TTS play error: {e}")

        return corrected_text

    except Exception as e:
        print(f"🔥 LLM Error: {e}")
        return ""


# ============================
# TEST CASES (ORIGINAL)
# ============================
if __name__ == "__main__":
    # Test cases
    test_cases = [
        "Hello, how are you? How can I help you today? Today it's my working hour FIP project Vice Mentor and because tomorrow it's my meeting for my supervisor it's very strict and he said may complete our work",
        "I need submit the report by Friday supervisor want see all data",
        "weismantor told me fix all bugs before deadline",
        "FIP project presentation will be next week it's very important",
    ]
    
    print("=" * 60)
    print("TESTING BASIC VERSION")
    print("=" * 60)
    for i, test in enumerate(test_cases, 1):
        print(f"\n Test {i}:")
        print(f"Input:  {test}")
        result = correct_transcript(test)
        print(f"Output: {result}\n")
    
    print("\n" + "=" * 60)
    print("TESTING FEW-SHOT VERSION")
    print("=" * 60)
    test = test_cases[0]
    print(f"\n Input: {test}")
    result = correct_transcript_with_examples(test)
    print(f" Output: {result}")

# ============================================================
# LEARNING MODE — LLM FUNCTION
# ============================================================

def analyze_mistakes(transcript):
    """
    Sends transcript to Groq LLM with a teaching-focused prompt.
    Returns a structured dict with:
      - mistakes: list of {wrong, correct, reason, tip}
      - corrected: full corrected sentence
      - overall_tip: one overall advice line
    """
    if not transcript or not transcript.strip():
        return {"mistakes": [], "corrected": transcript, "overall_tip": ""}

    prompt = f"""You are a friendly English speaking coach teaching a student who speaks English as a second language.

Analyze this spoken sentence for mistakes:
\"{transcript}\"

Your response MUST be valid JSON only. No extra text outside JSON.

Return this exact structure:
{{
    "mistakes": [
        {{
            "wrong": "the wrong word or phrase the student said",
            "correct": "the right word or phrase",
            "reason": "simple explanation of why it is wrong (1 sentence)",
            "tip": "a simple memory tip to avoid this mistake in future (1 sentence)"
        }}
    ],
    "corrected": "the full corrected sentence",
    "overall_tip": "one overall advice for this student based on their mistake pattern"
}}

Rules:
- If there are NO mistakes, return empty mistakes list and set corrected = original sentence.
- Keep explanations simple and friendly, like explaining to a beginner.
- Focus on grammar, tense, prepositions, articles, word choice.
- Maximum 5 mistakes listed.
- overall_tip must always have a value.
"""

    try:
        completion = client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            max_completion_tokens=800
        )
        raw = completion.choices[0].message.content.strip()

        # Parse JSON safely
        import json, re
        match = re.search(r"\{.*\}", raw, re.DOTALL)
        if match:
            result = json.loads(match.group())
            return result
        else:
            return {"mistakes": [], "corrected": transcript, "overall_tip": "Keep practicing!"}

    except Exception as e:
        print(f"❌ Learning mode LLM error: {e}")
        return {"mistakes": [], "corrected": transcript, "overall_tip": "Keep practicing!"}


def speak_learning_feedback(analysis):
    """
    Converts learning analysis dict into spoken + printed feedback.
    Speaks each mistake explanation out loud.
    """
    mistakes = analysis.get("mistakes", [])
    corrected = analysis.get("corrected", "")
    overall_tip = analysis.get("overall_tip", "")

    print("\n" + "="*60)
    print("         📚 LEARNING FEEDBACK")
    print("="*60)

    if not mistakes:
        msg = "Great job! No mistakes found. Your sentence was correct."
        print(f"\n✅ {msg}")
        speak_text_chunked(msg)
        return   # ← skip corrected sentence + overall tip, move on immediately
    else:
        print(f"\n❌ Found {len(mistakes)} mistake(s):\n")
        for i, m in enumerate(mistakes, 1):
            wrong   = m.get("wrong", "")
            correct = m.get("correct", "")
            reason  = m.get("reason", "")
            tip     = m.get("tip", "")

            # Print to terminal
            print(f"  Mistake {i}:")
            print(f"    ✗ You said   : \"{wrong}\"")
            print(f"    ✓ Should be  : \"{correct}\"")
            print(f"    📖 Why       : {reason}")
            print(f"    💡 Tip       : {tip}")
            print()

            # Speak each mistake
            spoken = (
                f"Mistake {i}. "
                f"You said {wrong}. "
                f"The correct form is {correct}. "
                f"{reason}. "
                f"Tip: {tip}."
            )
            speak_text_chunked(spoken)

    # Corrected version
    print(f"  ✅ Corrected sentence : \"{corrected}\"")
    print(f"  🎯 Overall tip        : {overall_tip}")
    print("="*60)

    speak_text_chunked(f"The corrected sentence is: {corrected}")
    speak_text_chunked(f"Overall tip: {overall_tip}")
