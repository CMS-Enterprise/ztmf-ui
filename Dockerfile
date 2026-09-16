# Frontend image for per-PR environments (ztmf-misc#343). Serves the
# path-agnostic bundle under PR_PATH_PREFIX and proxies its api/ calls to the
# API container; docker/entrypoint.sh writes config.js with a test-mode token.
FROM node:20-alpine AS build

WORKDIR /src
RUN corepack enable
COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn/releases ./.yarn/releases
COPY .yarn/plugins ./.yarn/plugins
RUN yarn install --immutable
COPY . .
# Bearer-token (local-dev) mode: PR environments authenticate with the token in
# config.js, not an IdP.
ENV VITE_IDP_ENABLED=false
RUN yarn build:dev

FROM public.ecr.aws/nginx/nginx:1.27-alpine

RUN apk add --no-cache openssl \
  && openssl req -x509 -newkey rsa:2048 -nodes -sha256 -days 3650 \
       -keyout /etc/nginx/key.pem -out /etc/nginx/cert.pem \
       -subj "/C=US/ST=Maryland/L=Baltimore/O=Centers for Medicare and Medicaid Services/OU=OIT\ISPG/CN=us-east-1.elb.amazonaws.com" \
       -addext "subjectAltName=DNS:*.us-east-1.elb.amazonaws.com,DNS:localhost" \
  && rm /etc/nginx/conf.d/default.conf

COPY --from=build /src/dist /usr/share/nginx/html
COPY docker/nginx.conf.template /etc/nginx/templates/ztmf.conf.template
COPY docker/entrypoint.sh /docker-entrypoint.d/40-ztmf-runtime-config.sh
RUN chmod +x /docker-entrypoint.d/40-ztmf-runtime-config.sh

ENV PR_PATH_PREFIX="" \
    API_UPSTREAM="http://127.0.0.1:8080" \
    TEST_USER_EMAIL="Grand.Moff@DeathStar.Empire"

EXPOSE 443
