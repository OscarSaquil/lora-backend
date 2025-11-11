/* Heltec LoRa32 — RECEIVER + OLED UI (sin images.h)
 * - Mantiene tu configuración original LoRa (Heltec LoRaWan_APP)
 * - Muestra estado, último mensaje, RSSI/SNR, conteos en OLED
 * - RX continuo
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

// Overlay: cronómetro simple en esquina superior derecha
void msOverlay(ScreenDisplay *d, DisplayUiState* s) {
  d->setTextAlignment(TEXT_ALIGN_RIGHT);
  d->setFont(ArialMT_Plain_10);
  d->drawString(d->getWidth(), 0, String(millis()/1000) + "s");
}

// Frames
void frameStatus(ScreenDisplay *d, DisplayUiState* s, int16_t x, int16_t y);
void frameText(ScreenDisplay *d, DisplayUiState* s, int16_t x, int16_t y);
void frameHex(ScreenDisplay *d, DisplayUiState* s, int16_t x, int16_t y);
FrameCallback frames[] = { frameStatus, frameText, frameHex };
OverlayCallback overlays[] = { msOverlay };
int frameCount = 3, overlaysCount = 1;

// ===================== LORA (tu configuración original) =====================
// ⚠️ Si tus placas son 433–510 MHz, cambia a 433000000UL
#define RF_FREQUENCY                 433000000UL // Hz  (cámbialo a 433000000 si usas 433 MHz)
#define TX_OUTPUT_POWER              14          // dBm (no se usa en RX, pero lo dejamos)
#define LORA_BANDWIDTH               0           // 125 kHz
#define LORA_SPREADING_FACTOR        10           // [SF7..SF12]
#define LORA_CODINGRATE              4           // 4/5
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

// Prototipo callback
void OnRxDone(uint8_t *payload, uint16_t size, int16_t rssi, int8_t snr);

// Utilidades Vext
void VextON(){ pinMode(Vext,OUTPUT); digitalWrite(Vext, LOW); }
void VextOFF(){ pinMode(Vext,OUTPUT); digitalWrite(Vext, HIGH); }

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
  if (lora_idle) {
    lora_idle = false;
    Serial.println("into RX mode");
    Radio.Rx(0); // RX continuo
  }
  Radio.IrqProcess();

  int remaining = ui.update();
  if (remaining > 0) delay(remaining);
}

void OnRxDone(uint8_t *payload, uint16_t size, int16_t rssi_cb, int8_t snr_cb) {
  // Copia segura
  uint16_t copy = (size < BUFFER_SIZE - 1) ? size : (BUFFER_SIZE - 1);
  memcpy(rxpacket, payload, copy);
  rxpacket[copy] = '\0';

  g_rssi = rssi_cb;      // fijamos globals (evitamos sombrear variables)
  g_snr  = snr_cb;
  g_rxLen = copy;
  g_rxCount++;

  Radio.Sleep();
  
  // Enviar datos en formato JSON estructurado para el backend
  Serial.print("{\"data\":\"");
  Serial.print(rxpacket);
  Serial.print("\",\"rssi\":");
  Serial.print(g_rssi);
  Serial.print(",\"snr\":");
  Serial.print(g_snr);
  Serial.print(",\"length\":");
  Serial.print(g_rxLen);
  Serial.print(",\"count\":");
  Serial.print(g_rxCount);
  Serial.println("}");
  
  // También mantener el formato original para debug (opcional)
  // Serial.printf("\r\nreceived packet \"%s\" with rssi %d , length %d\r\n",
  //               rxpacket, g_rssi, g_rxLen);
  
  lora_idle = true; // volverá a RX en loop()
}

// ===================== FRAMES UI =====================
void frameStatus(ScreenDisplay *d, DisplayUiState* s, int16_t x, int16_t y) {
  d->setTextAlignment(TEXT_ALIGN_LEFT);
  d->setFont(ArialMT_Plain_10);
  d->drawString(x, y,   String("LoRa RX @ ") + String(RF_FREQUENCY/1000000.0,3) + " MHz");
  d->drawString(x, y+12,"SF7 BW125 CR4/5  Preamble 8");
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

void frameHex(ScreenDisplay *d, DisplayUiState* s, int16_t x, int16_t y) {
  d->setTextAlignment(TEXT_ALIGN_LEFT);
  d->setFont(ArialMT_Plain_10);
  d->drawString(x, y, "Ult RX (hex):");
  String hx="";
  for (uint16_t i=0;i<g_rxLen;i++){
    char tmp[4]; sprintf(tmp, "%02X", (uint8_t)rxpacket[i]);
    hx += tmp; if (i<g_rxLen-1) hx += " ";
  }
  if (hx.length()==0) hx = "<vacio>";
  d->drawStringMaxWidth(x, y+12, d->getWidth(), hx);
}
