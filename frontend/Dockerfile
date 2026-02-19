FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Берем маленький nginx, чтобы просто отдавать файлы
FROM nginx:stable-alpine
# Копируем биотку фронта в папку nginx (проверь, что билд падает в /dist или /build)
COPY --from=build /app/dist /usr/share/nginx/html
# Копируем дефолтный конфиг, если нужно (обычно хватает стандартного)
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]