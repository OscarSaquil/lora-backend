#!/bin/bash
# Script para iniciar el backend LoRa en Linux/Mac

echo "========================================"
echo " Backend LoRa - WiFi LoRa 32 V3"
echo "========================================"
echo ""

# Verificar si Node.js está instalado
if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js no está instalado"
    echo "Descárgalo desde: https://nodejs.org/"
    exit 1
fi

# Verificar si las dependencias están instaladas
if [ ! -d "node_modules" ]; then
    echo "Instalando dependencias..."
    npm install
    if [ $? -ne 0 ]; then
        echo "ERROR: No se pudieron instalar las dependencias"
        exit 1
    fi
    echo ""
fi

# Verificar si existe el archivo .env
if [ ! -f ".env" ]; then
    echo "ADVERTENCIA: No existe el archivo .env"
    echo "Copiando desde .env.example..."
    cp .env.example .env
    echo ""
    echo "IMPORTANTE: Edita el archivo .env con tu configuración"
    echo "  - SERIAL_PORT: puerto de tu dispositivo (ej: /dev/ttyUSB0)"
    echo "  - MONGODB_URI: URI de tu base de datos"
    echo ""
    read -p "Presiona Enter para continuar..."
fi

echo "Iniciando servidor..."
echo ""
echo "Presiona Ctrl+C para detener el servidor"
echo ""

# Iniciar el servidor
node src/index.js
