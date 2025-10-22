#!/bin/bash
node build.js && \
rsync -avz --delete --exclude='node_modules' --exclude='.env' \
  -e "ssh -i ~/.ssh/drjjw.pub -p 7022" \
  dist/ root@162.246.254.111:/home/ukidney/bot.ukidney.com/ && \
ssh -i ~/.ssh/drjjw.pub -p 7022 root@162.246.254.111 \
  "chown -R ukidney:ukidney /home/ukidney/bot.ukidney.com && cd /home/ukidney/bot.ukidney.com && pm2 reload manual-bot"
