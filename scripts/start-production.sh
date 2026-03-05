#!/bin/bash
# =============================================================================
# FK-App Production Start Script für Raspberry Pi
# =============================================================================
# Startet die App als optimierten Production Build statt dev mode.
# 
# Nutzung:
#   Erster Start / nach Code-Änderungen:
#     ./scripts/start-production.sh --build
#
#   Normaler Start (ohne neu zu bauen):
#     ./scripts/start-production.sh
#
# Der Production Build kompiliert alles EINMAL vor und serviert dann
# statische + vorgerenderte Seiten. Das ist 10-50x schneller als dev mode.
# =============================================================================

set -e

# Projekt-Root ermitteln
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

echo "📂 Arbeitsverzeichnis: $PROJECT_DIR"

# .env.local prüfen
if [ ! -f ".env.local" ]; then
    echo "❌ Fehlt: .env.local – Bitte zuerst anlegen!"
    exit 1
fi

# Prüfen ob --build Flag gesetzt ist
BUILD=false
for arg in "$@"; do
    case $arg in
        --build|-b)
            BUILD=true
            shift
            ;;
    esac
done

# Build wenn nötig
if [ "$BUILD" = true ] || [ ! -d ".next" ]; then
    echo ""
    echo "🔨 Building production app..."
    echo "   (Das dauert auf dem Pi 2-5 Minuten, danach ist alles schnell)"
    echo ""
    npm run build
    echo ""
    echo "✅ Build erfolgreich!"
fi

# Datenbank prüfen
if [ ! -f "data/fk.db" ]; then
    echo ""
    echo "⚠️  Keine Datenbank gefunden. Führe 'npm run seed' aus um sie zu erstellen."
    echo "   Beispiel: npm run seed -- 'admin@email.de' 'passwort' 'Admin Name'"
    exit 1
fi

echo ""
echo "🚀 Starte FK-App im Production Mode..."
echo "   Lokal:  http://localhost:3000"
echo "   Netz:   http://$(hostname -I 2>/dev/null | awk '{print $1}' || echo 'IP'):3000"
echo ""
echo "   Zum Stoppen: Ctrl+C"
echo ""

# Standalone Server starten (viel effizienter als 'next start')
if [ -f ".next/standalone/server.js" ]; then
    # Standalone mode: Kopiere public + static falls nötig
    if [ ! -d ".next/standalone/public" ] && [ -d "public" ]; then
        cp -r public .next/standalone/public
    fi
    if [ ! -d ".next/standalone/.next/static" ] && [ -d ".next/static" ]; then
        mkdir -p .next/standalone/.next
        cp -r .next/static .next/standalone/.next/static
    fi
    
    # .env.local für standalone verfügbar machen
    if [ ! -f ".next/standalone/.env.local" ] && [ -f ".env.local" ]; then
        cp .env.local .next/standalone/.env.local
    fi
    
    cd .next/standalone
    PORT=3000 HOSTNAME=0.0.0.0 node server.js
else
    # Fallback auf next start
    npx next start -p 3000 -H 0.0.0.0
fi
