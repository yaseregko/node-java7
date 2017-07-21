FROM mkenney/npm:7.0-debian

npm install --silent -g \
    npm@latest 

VOLUME /src
WORKDIR /src

ENTRYPOINT ["/run-as-user"]
CMD ["/usr/local/bin/npm"]
