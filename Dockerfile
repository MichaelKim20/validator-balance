FROM node:16-alpine

WORKDIR /app/

ADD . /app/
RUN npm ci --prefix /app/

ENTRYPOINT [ "/app/docker/entrypoint.sh" ]
