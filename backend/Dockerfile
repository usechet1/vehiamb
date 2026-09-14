FROM node:22-alpine

# Chromium del sistema para el scraper de SIMIT (backend/src/scrapers/simit):
# el paquete "playwright" completo descarga un Chromium enlazado a glibc que
# no corre sobre musl libc (Alpine), por eso se usa "playwright-core" +
# el Chromium empaquetado por Alpine, apuntado via PLAYWRIGHT_CHROMIUM_PATH.
# ghostscript: compresion de PDFs adjuntos (ver middlewares/compress-image.js
# y GHOSTSCRIPT_PATH en .env.example) -- el paquete de Alpine expone "gs"
# directo en el PATH, coincide con el default de GHOSTSCRIPT_PATH.
RUN apk add --no-cache chromium nss freetype harfbuzz ca-certificates ttf-freefont ghostscript

ENV PLAYWRIGHT_CHROMIUM_PATH=/usr/bin/chromium-browser

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
