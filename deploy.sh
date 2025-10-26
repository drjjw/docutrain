#!/bin/bash
npm run build && \
rsync -avz --delete --exclude='node_modules' --exclude='.env' \
  -e "ssh -i ~/.ssh/drjjw.pub -p 7022" \
  dist/ root@162.246.254.111:/home/brightbeanio/public_html && \
ssh -i ~/.ssh/drjjw.pub -p 7022 root@162.246.254.111 \
  "chown -R brightbeanio:brightbeanio /home/brightbeanio/public_html && cd /home/brightbeanio/public_html && pm2 delete brightbean-bot 2>/dev/null; pm2 start start.sh --name brightbean-bot && pm2 save"
