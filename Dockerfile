FROM ignicaodigital/node-java7

ENV DEBIAN_FRONTEND noninteractive

RUN \
    groupadd -g 1000 jenkins && \
    useradd -u 1000 -g jenkins jenkins
    
ENTRYPOINT ["/bin/bash"]
