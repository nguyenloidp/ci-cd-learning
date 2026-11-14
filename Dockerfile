# Image nhỏ gọn chạy Node.js
FROM node:22-alpine

WORKDIR /app

# Cài dependency trước để tận dụng cache của Docker
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY public ./public

# Pipeline CD truyền commit SHA vào đây để website hiển thị phiên bản đang chạy
ARG APP_VERSION=dev
ENV APP_VERSION=$APP_VERSION \
    NODE_ENV=production \
    PORT=3000

EXPOSE 3000
USER node

HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "src/server.js"]
