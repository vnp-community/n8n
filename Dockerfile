ARG NODE_VERSION=22-slim
ARG LAUNCHER_VERSION=1.4.3
ARG N8N_VERSION=snapshot
ARG TARGETPLATFORM

# ==============================================================================
# STAGE 1: Download task-runner-launcher binary
# ==============================================================================
FROM registry.vnpay.vn/base/alpine:m-tsf5 AS launcher-downloader
ARG TARGETPLATFORM
ARG LAUNCHER_VERSION

RUN set -e; \
    if [ -n "$TARGETPLATFORM" ]; then \
      case "$TARGETPLATFORM" in \
        "linux/amd64") ARCH_NAME="amd64" ;; \
        "linux/arm64") ARCH_NAME="arm64" ;; \
        *) echo "Unsupported platform: $TARGETPLATFORM" && exit 1 ;; \
      esac; \
    else \
      ARCH_NAME=$(uname -m | sed 's/x86_64/amd64/;s/aarch64/arm64/'); \
    fi; \
    mkdir /launcher-temp && cd /launcher-temp; \
    wget -q "https://github.com/n8n-io/task-runner-launcher/releases/download/${LAUNCHER_VERSION}/task-runner-launcher-${LAUNCHER_VERSION}-linux-${ARCH_NAME}.tar.gz"; \
    wget -q "https://github.com/n8n-io/task-runner-launcher/releases/download/${LAUNCHER_VERSION}/task-runner-launcher-${LAUNCHER_VERSION}-linux-${ARCH_NAME}.tar.gz.sha256"; \
    echo "$(cat task-runner-launcher-${LAUNCHER_VERSION}-linux-${ARCH_NAME}.tar.gz.sha256) task-runner-launcher-${LAUNCHER_VERSION}-linux-${ARCH_NAME}.tar.gz" > checksum.sha256; \
    sha256sum -c checksum.sha256; \
    mkdir -p /launcher-bin; \
    tar xzf task-runner-launcher-${LAUNCHER_VERSION}-linux-${ARCH_NAME}.tar.gz -C /launcher-bin; \
    cd / && rm -rf /launcher-temp

# ==============================================================================
# STAGE 2: Runtime base — mirrors n8nio/base image
# ==============================================================================
FROM registry.vnpay.vn/base/node:${NODE_VERSION} AS system-deps

RUN echo https://artifact.vnpay.vn/repository/apk-proxy_dl-cdn.alpinelinux.org/alpine/v3.22/main > /etc/apk/repositories && \
    echo https://artifact.vnpay.vn/repository/apk-proxy_dl-cdn.alpinelinux.org/alpine/v3.22/community >> /etc/apk/repositories

RUN apk --no-cache add --virtual .build-deps-fonts msttcorefonts-installer fontconfig && \
    update-ms-fonts && \
    fc-cache -f && \
    apk del .build-deps-fonts && \
    find /usr/share/fonts/truetype/msttcorefonts/ -type l -exec unlink {} \;

RUN apk update && \
    apk upgrade --no-cache && \
    apk add --no-cache libxml2 && \
    apk add --no-cache \
        git \
        openssh \
        openssl \
        graphicsmagick=1.3.45-r0 \
        tini \
        tzdata \
        ca-certificates \
        libc6-compat \
        jq=1.8.1-r0

ENV NPM_CONFIG_REGISTRY=https://artifact.vnpay.vn/nexus/repository/npm-group/

RUN npm install -g full-icu@1.5.0

RUN rm -rf /tmp/* /root/.npm /root/.cache/node /opt/yarn* && \
    apk del apk-tools

WORKDIR /home/node
ENV NODE_ICU_DATA=/usr/local/lib/node_modules/full-icu
EXPOSE 5678/tcp

# ==============================================================================
# STAGE 3: Final runtime image
# Requires ./compiled to exist locally (run scripts/build-n8n.mjs first)
# ==============================================================================
FROM system-deps AS runtime

ARG N8N_VERSION
ARG N8N_RELEASE_TYPE=dev
ENV NODE_ENV=production
ENV N8N_RELEASE_TYPE=${N8N_RELEASE_TYPE}
ENV NODE_ICU_DATA=/usr/local/lib/node_modules/full-icu
ENV SHELL=/bin/sh

WORKDIR /home/node

COPY compiled/                                  /usr/local/lib/node_modules/n8n
COPY --from=launcher-downloader /launcher-bin/* /usr/local/bin/
COPY docker/images/n8n/docker-entrypoint.sh     /
COPY docker/images/n8n/n8n-task-runners.json    /etc/n8n-task-runners.json

RUN cd /usr/local/lib/node_modules/n8n && \
    npm rebuild sqlite3 && \
    ln -s /usr/local/lib/node_modules/n8n/bin/n8n /usr/local/bin/n8n && \
    mkdir -p /home/node/.n8n && \
    chown -R node:node /home/node

RUN cd /usr/local/lib/node_modules/n8n/node_modules/pdfjs-dist && npm install @napi-rs/canvas

# Patch npm bundled tar to 7.5.7 (CVE-2026-23745, CVE-2026-23950, CVE-2026-24842)
RUN set -e; \
    TAR_TGZ=$(mktemp); \
    wget -qO "$TAR_TGZ" https://artifact.vnpay.vn/nexus/repository/npm-group/tar/-/tar-7.5.7.tgz; \
    for dir in \
      /usr/local/lib/node_modules/npm/node_modules/tar \
      /usr/local/lib/node_modules/npm/node_modules/cacache/node_modules/tar \
      /usr/local/lib/node_modules/npm/node_modules/node-gyp/node_modules/tar; \
    do \
      [ -d "$dir" ] && rm -rf "$dir" && mkdir -p "$dir" && tar -xzf "$TAR_TGZ" --strip-components=1 -C "$dir"; \
    done; \
    rm -f "$TAR_TGZ"

EXPOSE 5678/tcp
USER node
ENTRYPOINT ["tini", "--", "/docker-entrypoint.sh"]

LABEL org.opencontainers.image.title="n8n" \
      org.opencontainers.image.description="Workflow Automation Tool" \
      org.opencontainers.image.source="https://github.com/n8n-io/n8n" \
      org.opencontainers.image.url="https://n8n.io" \
      org.opencontainers.image.version=${N8N_VERSION}
