//  LoRaReceiver-WiFi.ino
/* Heltec LoRa32 — RECEIVER + WiFi + OLED UI
 * - Recibe datos por LoRa
 * - Se conecta a WiFi
 * - Envía datos al backend por HTTP POST
 * - Muestra estado en OLED
 */

#include "LoRaWan_APP.h"
#include "Arduino.h"
#include <WiFi.h>
#include <HTTPClient.h>
#include <Wire.h>
#include "HT_SSD1306Wire.h"
#include "HT_DisplayUi.h"

// ===================== CONFIGURACIÓN WiFi =====================
const char* WIFI_SSID = "TU_RED_WIFI";        // ⚠️ CAMBIA ESTO
const char* WIFI_PASSWORD = "TU_PASSWORD";    // ⚠️ CAMBIA ESTO

// URL del backend (cambia la IP si tu backend está en otra PC)
const char* BACKEND_URL = "http://192.168.1.100:3007/api/data/lora";  // ⚠️ CAMBIA LA IP

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
void frameText(ScreenDisplay *d, DisplayUiState* s, int16_t x, int16_t y);
void frameWiFi(ScreenDisplay *d, DisplayUiState* s, int16_t x, int16_t y);
FrameCallback frames[] = { frameStatus, frameText, frameWiFi };
OverlayCallback overlays[] = { msOverlay };
int frameCount = 3, overlaysCount = 1;

// ===================== LORA =====================
#define RF_FREQUENCY                 433000000UL
#define TX_OUTPUT_POWER              14
#define LORA_BANDWIDTH               0
#define LORA_SPREADING_FACTOR        10
#define LORA_CODINGRATE              4
#define LORA_PREAMBLE_LENGTH         12
#define LORA_SYMBOL_TIMEOUT          0
#define LORA_FIX_LENGTH_PAYLOAD_ON   false
#define LORA_IQ_INVERSION_ON         false

#define RX_TIMEOUT_VALUE             1000
#define BUFFER_SIZE                  64

static RadioEvents_t RadioEvents;

// Estado/variables
char     rxpacket[BUFFER_SIZE] = {0};
volatile bool lora_idle = true;

int16_t  g_rssi = 0;
int8_t   g_snr  = 0;
uint16_t g_rxLen = 0;
uint32_t g_rxCount = 0;
uint32_t g_wifiSent = 0;
uint32_t g_wifiErrors = 0;

// WiFi
bool wifiConnected = false;

void OnRxDone(uint8_t *payload, uint16_t size, int16_t rssi, int8_t snr);
void VextON(){ pinMode(Vext,OUTPUT); digitalWrite(Vext, LOW); }
void VextOFF(){ pinMode(Vext,OUTPUT); digitalWrite(Vext, HIGH); }

// ===================== WiFi Setup =====================
void setupWiFi() {
  Serial.println("\n🌐 Conectando a WiFi...");
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    wifiConnected = true;
    Serial.println("\n✅ WiFi conectado!");
    Serial.print("📍 IP: ");
    Serial.println(WiFi.localIP());
  } else {
    wifiConnected = false;
    Serial.println("\n❌ No se pudo conectar a WiFi");
    Serial.println("⚠️ Continuará recibiendo LoRa pero sin enviar al backend");
  }
}

// ===================== Enviar datos al backend =====================
void sendToBackend(const char* data, int16_t rssi, int8_t snr) {
  if (!wifiConnected) {
    Serial.println("⚠️ WiFi no conectado, no se puede enviar al backend");
    return;
  }

  HTTPClient http;
  http.begin(BACKEND_URL);
  http.addHeader("Content-Type", "application/json");

  // Construir JSON
  String jsonPayload = "{";
  jsonPayload += "\"data\":\"" + String(data) + "\",";
  jsonPayload += "\"rssi\":" + String(rssi) + ",";
  jsonPayload += "\"snr\":" + String(snr) + ",";
  jsonPayload += "\"length\":" + String(g_rxLen) + ",";
  jsonPayload += "\"count\":" + String(g_rxCount);
  jsonPayload += "}";

  Serial.println("📤 Enviando al backend: " + jsonPayload);

  int httpResponseCode = http.POST(jsonPayload);

  if (httpResponseCode > 0) {
    String response = http.getString();
    Serial.println("✅ Backend respondió (" + String(httpResponseCode) + "): " + response);
    g_wifiSent++;
  } else {
    Serial.println("❌ Error enviando al backend: " + String(httpResponseCode));
    g_wifiErrors++;
  }

  http.end();
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

  // WiFi
  setupWiFi();

  // LoRa
  RadioEvents.RxDone = OnRxDone;
  Radio.Init(&RadioEvents);
  Radio.SetChannel(RF_FREQUENCY);
  Radio.SetRxConfig(MODEM_LORA, LORA_BANDWIDTH, LORA_SPREADING_FACTOR,
                    LORA_CODINGRATE, 0, LORA_PREAMBLE_LENGTH,
                    LORA_SYMBOL_TIMEOUT, LORA_FIX_LENGTH_PAYLOAD_ON,
                    0, true, 0, 0, LORA_IQ_INVERSION_ON, true);

  Serial.println("Receiver listo → RX continuo");
}

void loop() {
  // Mantener WiFi conectado
  if (WiFi.status() != WL_CONNECTED && wifiConnected) {
    Serial.println("⚠️ WiFi desconectado, reconectando...");
    wifiConnected = false;
    setupWiFi();
  }

  if (lora_idle) {
    lora_idle = false;
    Serial.println("into RX mode");
    Radio.Rx(0);
  }
  Radio.IrqProcess();

  int remaining = ui.update();
  if (remaining > 0) delay(remaining);
}

void OnRxDone(uint8_t *payload, uint16_t size, int16_t rssi_cb, int8_t snr_cb) {
  uint16_t copy = (size < BUFFER_SIZE - 1) ? size : (BUFFER_SIZE - 1);
  memcpy(rxpacket, payload, copy);
  rxpacket[copy] = '\0';

  g_rssi = rssi_cb;
  g_snr  = snr_cb;
  g_rxLen = copy;
  g_rxCount++;

  Radio.Sleep();
  
  Serial.printf("\n📦 Paquete LoRa recibido: \"%s\" (RSSI: %d, SNR: %d)\n", 
                rxpacket, g_rssi, g_snr);

  // Enviar al backend por WiFi
  sendToBackend(rxpacket, g_rssi, g_snr);
  
  lora_idle = true;
}

// ===================== FRAMES UI =====================
void frameStatus(ScreenDisplay *d, DisplayUiState* s, int16_t x, int16_t y) {
  d->setTextAlignment(TEXT_ALIGN_LEFT);
  d->setFont(ArialMT_Plain_10);
  d->drawString(x, y,   String("LoRa RX @ ") + String(RF_FREQUENCY/1000000.0,3) + " MHz");
  d->drawString(x, y+12,"SF" + String(LORA_SPREADING_FACTOR) + " BW125 CR4/5");
  d->drawString(x, y+24,"Ult RSSI: " + String(g_rssi) + " dBm");
  d->drawString(x, y+36,"Ult SNR : " + String(g_snr));
  d->drawString(x, y+48,"RxCnt   : " + String(g_rxCount));
}

void frameText(ScreenDisplay *d, DisplayUiState* s, int16_t x, int16_t y) {
  d->setTextAlignment(TEXT_ALIGN_LEFT);
  d->setFont(ArialMT_Plain_10);
  d->drawString(x, y, "Ult RX (texto):");
  String t = (g_rxLen>0) ? String(rxpacket) : String("<vacio>");
  d->drawStringMaxWidth(x, y+12, d->getWidth(), t);
}

void frameWiFi(ScreenDisplay *d, DisplayUiState* s, int16_t x, int16_t y) {
  d->setTextAlignment(TEXT_ALIGN_LEFT);
  d->setFont(ArialMT_Plain_10);
  
  if (wifiConnected) {
    d->drawString(x, y, "WiFi: ✓ " + WiFi.localIP().toString());
    d->drawString(x, y+12, "SSID: " + String(WIFI_SSID));
  } else {
    d->drawString(x, y, "WiFi: ✗ Desconectado");
  }
  
  d->drawString(x, y+24, "Enviados: " + String(g_wifiSent));
  d->drawString(x, y+36, "Errores : " + String(g_wifiErrors));
  d->drawString(x, y+48, "Backend: " + String(wifiConnected ? "OK" : "OFF"));
}
