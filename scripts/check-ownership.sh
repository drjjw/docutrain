#!/bin/bash
echo "=========================================="
echo "File Ownership Check"
echo "=========================================="
echo ""

echo "1. WHO IS RUNNING THE PM2 PROCESS?"
echo "-------------------------------------------"
pm2 list
ps aux | grep "node.*server.js" | grep -v grep
echo ""

echo "2. CURRENT USER"
echo "-------------------------------------------"
whoami
echo ""

echo "3. OWNERSHIP OF APP DIRECTORY"
echo "-------------------------------------------"
ls -ld /home/brightbeanio/public_html/
ls -ld /home/brightbeanio/public_html/app/
ls -lah /home/brightbeanio/public_html/app/
echo ""

echo "4. OWNERSHIP OF SERVER FILES"
echo "-------------------------------------------"
ls -lah /home/brightbeanio/public_html/ | grep -E "server.js|ecosystem|package.json"
echo ""

echo "5. OWNERSHIP OF ASSETS"
echo "-------------------------------------------"
ls -lah /home/brightbeanio/public_html/app/assets/
echo ""

echo "6. CHECK PM2 USER"
echo "-------------------------------------------"
pm2 info brightbean-bot | grep -E "user|username|exec mode"
echo ""

echo "=========================================="
echo "RECOMMENDATION:"
echo "All files should be owned by: brightbeanio:brightbeanio"
echo "PM2 process should run as: brightbeanio"
echo "=========================================="

