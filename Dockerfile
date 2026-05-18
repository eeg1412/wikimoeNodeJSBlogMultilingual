FROM node:20-alpine AS builder
WORKDIR /app
COPY . .
RUN cd admin && \
    yarn install && \
    yarn build && \
    cd ../server && \
    yarn install 

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/server /app
COPY --from=builder /app/blog/public /blog/public
COPY --from=builder /app/blog/public-root /blog/public-root
RUN chmod +x /app/entrypoint.sh && \
    mkdir -p /app/ailog && \
    apk add --no-cache bash
CMD ["/app/entrypoint.sh"]
EXPOSE 3010