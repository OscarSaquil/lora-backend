/* Heltec LoRa32 — SENDER por Monitor Serial (sin envío automático)
 * + Comando ULTRA: mide con HC-SR04 y envía JSON {dist_cm, depth_cm, h_cm, ts}
 */

#include "LoRaWan_APP.h"
#include "Arduino.h"
#include <Wire.h>
#include "HT_SSD1306Wire.h"
#include "HT_DisplayUi.h"

// ===================== DISPLAY =====================
#ifdef WIRELESS_STICK_V3
static SSD1306Wire display(0x3c, 500000, SDA_OLED, SCL_OLED, GEOMETRY_64_32, RST_OLED);
#else
static SSD1306Wire display(0x3c, 500000, SDA_OLED, SCL_OLED, GEOMETRY_128_64, RST_OLED);
#endif
DisplayUi ui(&display);

void msOverlay(ScreenDisplay *d, DisplayUiState* s) {
  d->setTextAlignment(TEXT_ALIGN_RIGHT);
  d->setFont(ArialMT_Plain_10);
  d->drawString(d->getWidth(), 0, String(millis()/1000) + "s");
}
void frameStatus(ScreenDisplay *d, DisplayUiState* s, int16_t x, int16_t y);
void frameLastTx(ScreenDisplay *d, DisplayUiState* s, int16_t x, int16_t y);
void frameUltra(ScreenDisplay *d, DisplayUiState* s, int16_t x, int16_t y);
FrameCallback frames[] = { frameStatus, frameLastTx, frameUltra };
OverlayCallback overlays[] = { msOverlay };
int frameCount = 3, overlaysCount = 1;

// ===================== LORA =====================
// ⚠️ Ajusta a tu región (GT normalmente 915 MHz).
#define RF_FREQUENCY                 433000000UL  // 915 MHz
#define TX_OUTPUT_POWER              14           // dBm
#define LORA_BANDWIDTH               0            // 125 kHz
#define LORA_SPREADING_FACTOR        5            // SF7
#define LORA_CODINGRATE              1            // 4/5
#define LORA_PREAMBLE_LENGTH         8
#define LORA_SYMBOL_TIMEOUT          0
#define LORA_FIX_LENGTH_PAYLOAD_ON   false
#define LORA_IQ_INVERSION_ON         false

#define BUFFER_SIZE                  160

char txpacket[BUFFER_SIZE];
bool lora_idle = true;

static RadioEvents_t RadioEvents;
void OnTxDone(void);
void OnTxTimeout(void);

// Utilidades Vext (alimentación OLED en Heltec)
void VextON(){ pinMode(Vext,OUTPUT); digitalWrite(Vext, LOW); }
void VextOFF(){ pinMode(Vext,OUTPUT); digitalWrite(Vext, HIGH); }

// Estado para UI
uint32_t g_txCount = 0;

// ===== Entrada por Serial (no bloqueante) =====
static char inBuf[BUFFER_SIZE];
static size_t inLen = 0;

static bool hasPending = false;
static char pendingBuf[BUFFER_SIZE];

// ===================== ULTRASÓNICO =====================
// Pinea TRIG/ECHO (cámbialos si lo necesitas)
#define ULTRA_TRIG_PIN  4   // J2 IO4 (salida 3.3V)
#define ULTRA_ECHO_PIN  5   // J2 IO5 (ENTRADA 3.3V, usar divisor de 5V->3.3V)

// Altura fija del sensor sobre el nivel "0" del agua (cm)
#define SENSOR_HEIGHT_CM  120.0f

// Timeout de medición (us): 30 ms ~ 5 m máx
#define ULTRA_TIMEOUT_US  30000UL

volatile float g_lastDistCm = NAN;
volatile float g_lastDepthCm = NAN;

static inline float microsecondsToCm(unsigned long us) {
  // Velocidad del sonido ~343 m/s. Ida y vuelta → 58 us/cm aprox (o 29.1 us por cm y dividir entre 2).
  return (float)us / 58.0f;
}

float ultraMeasureCm() {
  // Pulso TRIG: LOW 2us → HIGH 10us → LOW
  digitalWrite(ULTRA_TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(ULTRA_TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(ULTRA_TRIG_PIN, LOW);

  // Espera pulso en ECHO (HIGH). Timeout para no bloquear.
  unsigned long dur = pulseIn(ULTRA_ECHO_PIN, HIGH, ULTRA_TIMEOUT_US);
  if (dur == 0) return NAN; // timeout
  return microsecondsToCm(dur);
}

void ultraReadAndCache() {
  float d = ultraMeasureCm();
  if (isnan(d) || d <= 0) {
    g_lastDistCm  = NAN;
    g_lastDepthCm = NAN;
    return;
  }
  g_lastDistCm = d;
  float depth = SENSOR_HEIGHT_CM - d;   // profundidad positiva si el agua está más cerca que la altura del sensor
  if (depth < 0) depth = 0;
  g_lastDepthCm = depth;
}

// ===================== COLA / TX =====================
void queueOrSend(const char* msg) {
  if (!msg || !*msg) return;

  if (lora_idle) {
    size_t n = strlcpy(txpacket, msg, sizeof(txpacket));
    Radio.Send((uint8_t*)txpacket, n);
    lora_idle = false;
    g_txCount++;
    Serial.printf("\r\nEnviando: \"%s\"  (%u bytes)\r\n", txpacket, (unsigned)n);
  } else {
    // cola simple de 1 mensaje
    strlcpy(pendingBuf, msg, sizeof(pendingBuf));
    hasPending = true;
    Serial.println("⏳ Radio ocupado: mensaje en cola. Se enviará al terminar el TX actual.");
  }
}

// Envía JSON con última medición
void sendUltraJson() {
  unsigned long ts = millis();
  char payload[BUFFER_SIZE];
  if (isnan(g_lastDistCm)) {
    snprintf(payload, sizeof(payload),
             "{\"type\":\"ultra\",\"ok\":false,\"ts\":%lu}", ts);
  } else {
    snprintf(payload, sizeof(payload),
             "{\"type\":\"ultra\",\"ok\":true,\"dist_cm\":%.1f,\"depth_cm\":%.1f,\"h_cm\":%.1f,\"ts\":%lu}",
             g_lastDistCm, g_lastDepthCm, (double)SENSOR_HEIGHT_CM, ts);
  }
  queueOrSend(payload);
}

void flushLineAndSend() {
  // Recorta espacios finales e iniciales simples
  while (inLen && (inBuf[inLen-1] == ' ')) inLen--;
  size_t start = 0;
  while (start < inLen && inBuf[start] == ' ') start++;

  if (inLen >= BUFFER_SIZE) inLen = BUFFER_SIZE - 1;
  inBuf[inLen] = '\0';

  if (start >= inLen) { inLen = 0; return; }

  // Copia línea sin espacios iniciales
  char line[BUFFER_SIZE];
  strlcpy(line, &inBuf[start], sizeof(line));
  inLen = 0;

  // --- PARSER DE COMANDOS ---
  // ULTRA / u → mide y envía JSON
  if (!strcasecmp(line, "ULTRA") || !strcasecmp(line, "u")) {
    ultraReadAndCache();
    if (isnan(g_lastDistCm)) {
      Serial.println("⚠️ ULTRA: timeout/lectura inválida");
    } else {
      Serial.printf("ULTRA: dist=%.1f cm  depth=%.1f cm (H=%.1f cm)\r\n",
                    g_lastDistCm, g_lastDepthCm, (double)SENSOR_HEIGHT_CM);
    }
    sendUltraJson();
    return;
  }

  // Cualquier otro texto → se envía tal cual
  queueOrSend(line);
}

void setup() {
  Serial.begin(115200);
  Mcu.begin(HELTEC_BOARD, SLOW_CLK_TPYE);

  // OLED
  VextON(); delay(100);
  ui.setTargetFPS(60);
  ui.setIndicatorPosition(BOTTOM);
  ui.setIndicatorDirection(LEFT_RIGHT);
  ui.setFrameAnimation(SLIDE_LEFT);
  ui.setFrames(frames, frameCount);
  ui.setOverlays(overlays, overlaysCount);
  ui.init();

  // ULTRASÓNICO
  pinMode(ULTRA_TRIG_PIN, OUTPUT);
  pinMode(ULTRA_ECHO_PIN, INPUT);  // IMPORTANTE: ECHO con divisor a 3.3V

  // LoRa
  RadioEvents.TxDone    = OnTxDone;
  RadioEvents.TxTimeout = OnTxTimeout;

  Radio.Init(&RadioEvents);
  Radio.SetChannel(RF_FREQUENCY);
  Radio.SetTxConfig(MODEM_LORA, TX_OUTPUT_POWER, 0, LORA_BANDWIDTH,
                    LORA_SPREADING_FACTOR, LORA_CODINGRATE,
                    LORA_PREAMBLE_LENGTH, LORA_FIX_LENGTH_PAYLOAD_ON,
                    true, 0, 0, LORA_IQ_INVERSION_ON, 3000);

  Serial.println();
  Serial.println("===============================================");
  Serial.println(" Heltec LoRa32 — Envío por Monitor Serial");
  Serial.println(" Comando ULTRA (o 'u') para medir HC-SR04 y enviar JSON.");
  Serial.println(" Cualquier otro texto se envía tal cual.");
  Serial.println("===============================================");
}

void loop() {
  // Lectura no bloqueante del Monitor Serial
  while (Serial.available() > 0) {
    char c = (char)Serial.read();
    if (c == '\r') continue;
    else if (c == '\n') { flushLineAndSend(); }
    else {
      if (inLen < sizeof(inBuf) - 1) inBuf[inLen++] = c;
    }
  }

  // Si terminó un TX y hay pendiente, envíalo
  if (lora_idle && hasPending) {
    hasPending = false;
    queueOrSend(pendingBuf);
  }

  // Procesa IRQ del radio
  Radio.IrqProcess();

  // UI
  int remaining = ui.update();
  if (remaining > 0) delay(remaining);
}

void OnTxDone(void) {
  Serial.println("✅ TX completado");
  lora_idle = true;
}

void OnTxTimeout(void) {
  Radio.Sleep();
  Serial.println("⛔ TX Timeout");
  lora_idle = true;
}

// ===================== FRAMES UI =====================
void frameStatus(ScreenDisplay *d, DisplayUiState* s, int16_t x, int16_t y) {
  d->setTextAlignment(TEXT_ALIGN_LEFT);
  d->setFont(ArialMT_Plain_10);
  d->drawString(x, y,   String("LoRa TX @ ") + String(RF_FREQUENCY/1000000.0,3) + " MHz");
  d->drawString(x, y+12, String("SF") + String(LORA_SPREADING_FACTOR) + " BW125 CR4/5");
  d->drawString(x, y+24, String("Estado: ") + (lora_idle ? "IDLE" : "TX..."));
  d->drawString(x, y+36, "TxCnt : " + String(g_txCount));
  d->drawString(x, y+48, "Serial->Enter para TX");
}

void frameLastTx(ScreenDisplay *d, DisplayUiState* s, int16_t x, int16_t y) {
  d->setTextAlignment(TEXT_ALIGN_LEFT);
  d->setFont(ArialMT_Plain_10);
  d->drawString(x, y, "Ult TX (texto):");
  String t = (strlen(txpacket)>0) ? String(txpacket) : String("<vacio>");
  d->drawStringMaxWidth(x, y+12, d->getWidth(), t);

  String hx="";
  for (size_t i=0; i<strlen(txpacket); i++){
    char tmp[4]; sprintf(tmp, "%02X", (uint8_t)txpacket[i]);
    hx += tmp; if (i<strlen(txpacket)-1) hx += " ";
  }
  if (hx.length()==0) hx = "<vacio>";
  d->drawString(x, y+36, "Hex:");
  d->drawStringMaxWidth(x, y+48, d->getWidth(), hx);
}

void frameUltra(ScreenDisplay *d, DisplayUiState* s, int16_t x, int16_t y) {
  d->setTextAlignment(TEXT_ALIGN_LEFT);
  d->setFont(ArialMT_Plain_10);
  d->drawString(x, y, "HC-SR04:");
  if (isnan(g_lastDistCm)) {
    d->drawString(x, y+12, "Dist: --");
    d->drawString(x, y+24, "Prof: --");
  } else {
    d->drawString(x, y+12, "Dist: " + String(g_lastDistCm, 1) + " cm");
    d->drawString(x, y+24, "Prof: " + String(g_lastDepthCm, 1) + " cm");
    d->drawString(x, y+36, "H: " + String((double)SENSOR_HEIGHT_CM, 1) + " cm");
  }
}
