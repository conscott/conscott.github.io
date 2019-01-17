#!/bin/bash

# clean site
rm -rf _site  conscott.info.tar

# Build site to _site
bundle exec jekyll build

tar -cvf conscott.info.tar _site

# Upload it to remote node
scp conscott.info.tar root@webnode:~

# Untar it in webserver dir
ssh root@webnode "tar -xvf ~/conscott.info.tar -C /var/www/conscott.info/ --transform='s/_site\///g'"
