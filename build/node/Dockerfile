FROM node:22-slim
WORKDIR /app
COPY app/package.json ./

RUN apt-get update && \
    apt-get install -y curl jq && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /app/src/bin && \
    cd /app/src/bin && \
    API_URL="https://api.github.com/repos/YudaiKitamura/McpX/releases/latest" && \
    ASSET_NAME="McpXInterop-linux-x64.so" && \
    curl -sSL "$API_URL" \
      | jq -r ".assets[] | select(.name == \"${ASSET_NAME}\") | .browser_download_url" \
      | xargs curl -LO

RUN npm install
