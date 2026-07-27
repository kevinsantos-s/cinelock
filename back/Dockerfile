# ---- build: instala tudo (com Prisma CLI), gera o client e compila o TS ----
FROM node:22-alpine AS build

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY prisma ./prisma
COPY src ./src
COPY scripts ./scripts
# O tsc não copia .json; o seed compilado precisa do snapshot ao lado dele.
RUN npx prisma generate && npm run build && cp prisma/movies.json dist/prisma/movies.json

# ---- runtime: só o que roda (sem Prisma CLI, sem typescript/tsx/eslint) ----
FROM node:22-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production

# Só dependências de produção; --omit=optional derruba o CLI do Prisma (peer opcional).
COPY package*.json ./
RUN npm ci --omit=dev --omit=optional

# O client já gerado (com o query engine) vem do estágio de build.
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/dist ./dist

# Padrão é a API; o consumer sobrescreve o comando no docker-compose.
CMD ["node", "dist/src/server.js"]
