FROM alpine:latest

RUN \
    groupadd -g 1000 jenkins && \
    useradd -u 1000 -m -g jenkins jenkins

RUN apk update
RUN apk add openjdk7
RUN apk add git tar mksh socat

CMD ["/usr/bin/java", "-version"]
    
ENTRYPOINT ["/bin/bash"]
