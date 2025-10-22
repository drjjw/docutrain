#!/bin/bash
# Fix permissions on remote server for bot.ukidney.com

echo "🔧 Fixing permissions on remote server..."
ssh -i ~/.ssh/drjjw.pub -p 7022 root@162.246.254.111 \
  "chown -R ukidney:ukidney /home/ukidney/bot.ukidney.com && echo '✓ Permissions fixed: ukidney:ukidney'"

echo "✓ Done!"

