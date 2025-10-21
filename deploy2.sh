#!/bin/bash
node build.js && \
rsync -avz --delete --exclude='node_modules' --exclude='.env' \
  -e "ssh -i ~/.ssh/drjjw.pub -p 7022" \
  dist/ root@162.246.254.111:/home/doxcite/public_html/ && \
ssh -i ~/.ssh/drjjw.pub -p 7022 root@162.246.254.111 \
  "cd /home/doxcite/public_html && \
   chown -R doxcite:doxcite . && \
   find . -type d -exec chmod 755 {} \; && \
   find . -type f -exec chmod 644 {} \; && \
   chmod 755 server.js && \
   pm2 stop doxcite-bot 2>/dev/null; true
   pm2 delete doxcite-bot 2>/dev/null; true
   pm2 start ecosystem.config.js --env production"