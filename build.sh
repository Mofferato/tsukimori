#!/bin/sh
# Rebuild index.html from the source parts (order matters).
cat src/01_head.html src/02_data.js src/03_art.js src/04_engine.js src/05_extra.js src/06_squad.js src/07_ui.js > index.html
echo "Built index.html"
