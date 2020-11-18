FROM ruby

RUN gem install ronn-ng
RUN apt-get update && apt-get install -y groff

ENV MANPAGER=cat

ENTRYPOINT ["/usr/local/bundle/bin/ronn"]
