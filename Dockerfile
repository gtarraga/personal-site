FROM node:lts-alpine AS base
COPY security/filter-emudhra.cjs /opt/security/filter-emudhra.cjs
RUN node /opt/security/filter-emudhra.cjs
ENV NODE_OPTIONS=--use-openssl-ca \
    SSL_CERT_FILE=/patched-trust/system/ca-certificates.crt \
    SSL_CERT_DIR=/patched-trust/system
WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy dependency files
COPY package.json pnpm-lock.yaml ./

FROM base AS build
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm run build
RUN pnpm prune --prod

FROM node:lts-alpine AS runtime
COPY security/filter-emudhra.cjs /opt/security/filter-emudhra.cjs
RUN node /opt/security/filter-emudhra.cjs
ENV NODE_OPTIONS=--use-openssl-ca \
    SSL_CERT_FILE=/patched-trust/system/ca-certificates.crt \
    SSL_CERT_DIR=/patched-trust/system
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/server.mjs ./server.mjs
COPY --from=build /app/scripts ./scripts
EXPOSE 8080
CMD ["node", "server.mjs"]
