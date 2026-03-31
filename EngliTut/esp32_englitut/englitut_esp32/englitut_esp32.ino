/*
 * EngliTut — ESP32 Firmware
 * ==========================
 * Hardware:
 *   Mic      : HW-484 v0.2 (analog) → GPIO 34
 *   Amplifier: GF1002 (analog)      ← driven by GPIO 25 DAC
 *   Trigger  : Auto-loop (no button)
 *
 * Flow:
 *   Boot → connect WiFi → loop forever:
 *     1. Record 5 sec from mic (GPIO 34)
 *     2. Build WAV header
 *     3. POST WAV to esp32_server.py on PC
 *     4. Read raw PCM bytes from response
 *     5. Play PCM bytes through DAC (GPIO 25) → GF1002 amp → speaker
 *     6. Short pause → repeat
 *
 * esp32_server.py must be running on your PC first.
 * Update WIFI_SSID, WIFI_PASS, and SERVER_IP below.
 */

#include <WiFi.h>

// ============================================================
// CONFIG — update these before uploading
// ============================================================

const char* WIFI_SSID  = "POWERHOUSE";       // your WiFi name
const char* WIFI_PASS  = "LoyalOne";         // your WiFi password

// Run esp32_server.py on your PC — it prints the IP at startup
// Paste that IP here
const char* SERVER_IP  = "192.168.100.3";
const int   SERVER_PORT = 5000;
const char* SERVER_PATH = "/api/esp32/process";

// "practice" → corrects your speech
// "learning"  → explains your mistakes
const char* MODE = "practice";

// ============================================================
// AUDIO SETTINGS
// ============================================================

#define MIC_PIN        34        // HW-484 analog output → GPIO 34
#define SPEAKER_PIN    25        // DAC output → GF1002 amp input

#define SAMPLE_RATE    8000      // 8 kHz — good for speech, fits RAM
#define RECORD_SECONDS 5         // seconds to record each round
#define SAMPLE_COUNT   (SAMPLE_RATE * RECORD_SECONDS)  // 40000 samples
#define SAMPLE_DELAY_US 125      // microseconds between samples (1/8000s)

// 8-bit samples → 40000 bytes ≈ 39 KB — fits in ESP32 RAM fine
uint8_t audioBuffer[SAMPLE_COUNT];

// ============================================================
// SILENCE DETECTION
// Skips sending if the user didn't say anything
// ============================================================

#define SILENCE_THRESHOLD  5     // max deviation from mid (128) to count as silence
#define SILENCE_RATIO      0.92  // if >92% of samples are silent → skip

bool isSilent() {
  int silentCount = 0;
  for (int i = 0; i < SAMPLE_COUNT; i++) {
    int deviation = abs((int)audioBuffer[i] - 128);
    if (deviation < SILENCE_THRESHOLD) silentCount++;
  }
  float ratio = (float)silentCount / SAMPLE_COUNT;
  return ratio > SILENCE_RATIO;
}

// ============================================================
// RECORD AUDIO from HW-484 (analog mic on GPIO 34)
// ============================================================

void recordMic() {
  Serial.println("[REC] Recording... speak now!");

  for (int i = 0; i < SAMPLE_COUNT; i++) {
    // analogRead = 0-4095 (12-bit ADC)
    // HW-484 output sits around mid-rail (~1.65V = ~2048 raw)
    // Shift right 4 to get 0-255 (8-bit PCM)
    // Then center around 128 for proper WAV unsigned 8-bit format
    int raw = analogRead(MIC_PIN);        // 0 – 4095
    audioBuffer[i] = (uint8_t)(raw >> 4); // 0 – 255
    delayMicroseconds(SAMPLE_DELAY_US);
  }

  Serial.println("[REC] Done.");
}

// ============================================================
// BUILD WAV HEADER (44 bytes)
// 8-bit unsigned PCM, mono, 8000 Hz
// ============================================================

void buildWavHeader(uint8_t* h, int numSamples, int sampleRate) {
  int dataBytes = numSamples;       // 1 byte per sample (8-bit)
  int fileSize  = 36 + dataBytes;   // RIFF chunk size

  // RIFF
  h[0]='R'; h[1]='I'; h[2]='F'; h[3]='F';
  h[4]= fileSize        & 0xFF;
  h[5]=(fileSize >>  8) & 0xFF;
  h[6]=(fileSize >> 16) & 0xFF;
  h[7]=(fileSize >> 24) & 0xFF;

  // WAVE
  h[8]='W'; h[9]='A'; h[10]='V'; h[11]='E';

  // fmt chunk
  h[12]='f'; h[13]='m'; h[14]='t'; h[15]=' ';
  h[16]=16; h[17]=0; h[18]=0; h[19]=0;  // chunk size = 16
  h[20]=1;  h[21]=0;                     // PCM format
  h[22]=1;  h[23]=0;                     // mono
  // sample rate
  h[24]= sampleRate        & 0xFF;
  h[25]=(sampleRate >>  8) & 0xFF;
  h[26]=(sampleRate >> 16) & 0xFF;
  h[27]=(sampleRate >> 24) & 0xFF;
  // byte rate = sampleRate * channels * bitsPerSample/8 = sampleRate * 1
  h[28]= sampleRate        & 0xFF;
  h[29]=(sampleRate >>  8) & 0xFF;
  h[30]=(sampleRate >> 16) & 0xFF;
  h[31]=(sampleRate >> 24) & 0xFF;
  h[32]=1;  h[33]=0;   // block align = 1
  h[34]=8;  h[35]=0;   // bits per sample = 8

  // data chunk
  h[36]='d'; h[37]='a'; h[38]='t'; h[39]='a';
  h[40]= dataBytes        & 0xFF;
  h[41]=(dataBytes >>  8) & 0xFF;
  h[42]=(dataBytes >> 16) & 0xFF;
  h[43]=(dataBytes >> 24) & 0xFF;
}

// ============================================================
// SEND WAV TO PC → RECEIVE PCM → PLAY THROUGH DAC
// ============================================================

void sendAndPlay() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[NET] WiFi lost — reconnecting...");
    WiFi.begin(WIFI_SSID, WIFI_PASS);
    int tries = 0;
    while (WiFi.status() != WL_CONNECTED && tries < 20) {
      delay(500); Serial.print("."); tries++;
    }
    Serial.println();
    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("[NET] Reconnect failed. Skipping.");
      return;
    }
  }

  WiFiClient client;
  Serial.printf("[NET] Connecting to %s:%d\n", SERVER_IP, SERVER_PORT);

  if (!client.connect(SERVER_IP, SERVER_PORT)) {
    Serial.println("[NET] Cannot connect to PC server!");
    Serial.println("      Make sure esp32_server.py is running.");
    return;
  }

  // Build WAV header
  uint8_t wavHeader[44];
  buildWavHeader(wavHeader, SAMPLE_COUNT, SAMPLE_RATE);
  int totalBytes = 44 + SAMPLE_COUNT;

  // Send HTTP POST
  client.printf("POST %s HTTP/1.1\r\n", SERVER_PATH);
  client.printf("Host: %s:%d\r\n", SERVER_IP, SERVER_PORT);
  client.printf("Content-Type: audio/wav\r\n");
  client.printf("X-Mode: %s\r\n", MODE);
  client.printf("Content-Length: %d\r\n", totalBytes);
  client.printf("Connection: close\r\n");
  client.printf("\r\n");

  // Send WAV header
  client.write(wavHeader, 44);

  // Send audio in 512-byte chunks (avoids stack overflow)
  for (int i = 0; i < SAMPLE_COUNT; i += 512) {
    int end = min(i + 512, SAMPLE_COUNT);
    client.write(audioBuffer + i, end - i);
  }

  Serial.println("[NET] Audio sent. Waiting for response...");

  // Wait up to 30 seconds for server to process
  unsigned long timeout = millis() + 30000;
  while (client.available() == 0) {
    if (millis() > timeout) {
      Serial.println("[NET] Timeout — server did not respond.");
      client.stop();
      return;
    }
    delay(10);
  }

  // ── Parse HTTP response headers ────────────────────────────
  int  responseCode  = 0;
  int  contentLength = 0;
  bool headersDone   = false;

  while (client.connected() && !headersDone) {
    String line = client.readStringUntil('\n');
    line.trim();

    if (line.startsWith("HTTP/") && responseCode == 0) {
      responseCode = line.substring(9, 12).toInt();
      Serial.printf("[NET] Server response: %d\n", responseCode);
    }
    if (line.startsWith("Content-Length:")) {
      contentLength = line.substring(15).toInt();
      Serial.printf("[NET] Audio response: %d bytes\n", contentLength);
    }
    if (line.length() == 0) {
      headersDone = true;
    }
  }

  if (responseCode != 200 || contentLength == 0) {
    Serial.println("[NET] Bad response from server. Skipping playback.");
    client.stop();
    return;
  }

  // ── Play PCM bytes directly through DAC → GF1002 amp ──────
  // Read each byte and write to DAC immediately (streaming playback)
  // This avoids needing a second large buffer in RAM
  Serial.println("[DAC] Playing response...");

  int bytesRemaining = contentLength;
  while (bytesRemaining > 0 && (client.available() > 0 || client.connected())) {
    if (client.available() > 0) {
      uint8_t b = client.read();
      dacWrite(SPEAKER_PIN, b);          // 8-bit value → DAC → GF1002 amp
      delayMicroseconds(SAMPLE_DELAY_US); // match 8kHz playback rate
      bytesRemaining--;
    }
  }

  // Silence the DAC output (mid-rail = 128 = ~1.65V = silent for AC-coupled amp)
  dacWrite(SPEAKER_PIN, 128);

  client.stop();
  Serial.println("[DAC] Playback done.");
}

// ============================================================
// SETUP
// ============================================================

void setup() {
  Serial.begin(115200);
  delay(500);

  // ADC setup for HW-484
  // GPIO 34 is input-only — no need to set pinMode for ADC
  // Set ADC resolution to 12-bit (default on ESP32)
  analogReadResolution(12);
  // Set ADC attenuation to handle HW-484 full swing (~0-3.3V)
  analogSetPinAttenuation(MIC_PIN, ADC_11db);

  // DAC pin (GPIO 25) is controlled by dacWrite() — no pinMode needed

  Serial.println("\n========================================");
  Serial.println("          EngliTut ESP32");
  Serial.println("========================================");
  Serial.printf("  Mic      : GPIO %d (HW-484 analog)\n", MIC_PIN);
  Serial.printf("  Speaker  : GPIO %d (DAC → GF1002)\n", SPEAKER_PIN);
  Serial.printf("  Mode     : %s\n", MODE);
  Serial.printf("  Server   : %s:%d\n", SERVER_IP, SERVER_PORT);
  Serial.println("========================================\n");

  // Connect to WiFi
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(400);
    Serial.print(".");
  }
  Serial.println("\nConnected!");
  Serial.printf("ESP32 IP : %s\n\n", WiFi.localIP().toString().c_str());

  Serial.println("Starting auto-loop. Speak after 'Recording...' appears.");
  delay(1000);
}

// ============================================================
// LOOP — auto-record, send, play, repeat
// ============================================================

void loop() {
  Serial.println("\n----------------------------------------");

  // Step 1: Record
  recordMic();

  // Step 2: Silence check — skip silent recordings
  if (isSilent()) {
    Serial.println("[SIL] No speech detected. Listening again...");
    delay(300);
    return;
  }

  // Step 3: Send to PC and play response
  sendAndPlay();

  // Step 4: Short pause before next round
  // Gives user time to get ready for next sentence
  Serial.println("[WAIT] Pause 2s before next round...");
  delay(2000);
}
