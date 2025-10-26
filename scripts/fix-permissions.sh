#!/bin/bash
# Fix permissions on remote server for brightbean.io

echo "🔧 Fixing permissions on remote server..."
ssh -i ~/.ssh/drjjw.pub -p 7022 root@162.246.254.111 \
  "chown -R brightbeanio:brightbeanio /home/brightbeanio/public_html && echo '✓ Permissions fixed: brightbeanio:brightbeanio'"

echo "✓ Done!"

