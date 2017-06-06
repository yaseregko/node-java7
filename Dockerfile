FROM alpine:3.6
    
RUN addgroup -g 1000 jenkins \
    && adduser -u 1000 -G jenkins -s /bin/sh -D jenkins 

RUN apk upgrade --update
RUN apk add --no-cache \
        libstdc++ openjdk7 git tar zip openssh-client libpng-dev python \
        nodejs-current nodejs-current-npm yarn 

CMD ["/bin/sh"]
