# Build docker images:
+ Build base image:
   docker build --platform=linux/amd64 -t n8nio/base:20 -f  docker/images/n8n-base/Dockerfile  .

+ Build n8n image:
   docker build --platform=linux/amd64 -t vnp-n8n -f  docker/images/n8n-custom/Dockerfile --build-arg TARGETPLATFORM=linux/amd64   --no-cache .

# Dev
- Run with .env

cd packages/cli && ./bin/n8n start

-
