# EngliTut — Config
# ==================

# Audio recording settings
FS                    = 16000   # sample rate (Hz)
DURATION              = 10      # default recording duration (seconds)

# Audio filter settings
LOWCUT                = 80
HIGHCUT               = 8000
FILTER_ORDER          = 6
NOISE_SAMPLE_DURATION = 0.8     # seconds used as noise profile

# Whisper — now handled by Groq API (see whisper_transcribe.py)
# No local model config needed
WHISPER_LANG          = "en"
WHISPER_TEMPERATURE   = 0.0
