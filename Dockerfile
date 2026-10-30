FROM node:24.22.1-alpine@sha256:6a1c190e17215d844926b0677f4bf87273ff7d5e54db06d3b5b5863ab0b09a3d AS base
COPY security/filter-emudhra.cjs /opt/security/filter-emudhra.cjs
RUN node /opt/security/filter-emudhra.cjs
ENV NODE_OPTIONS=--use-openssl-ca \
    SSL_CERT_FILE=/patched-trust/system/ca-certificates.crt \
    SSL_CERT_DIR=/patched-trust/system
WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@12.14.0 --activate

# Copy dependency files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

FROM base AS build
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm run build
RUN pnpm prune --prod

FROM node:24.22.1-alpine@sha256:6a1c190e17215d844926b0677f4bf87273ff7d5e54db06d3b5b5863ab0b09a3d AS runtime
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
VOLUME ["/app/data"]
EXPOSE 8080
CMD ["node", "server.mjs"]
