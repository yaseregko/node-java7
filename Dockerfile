FROM mkenney/npm:6.9-debian

npm install --silent -g \
    npm@5
    
VOLUME /src
WORKDIR /src

ENTRYPOINT ["/run-as-user"]
CMD ["/usr/local/bin/npm"]
