#!/bin/bash

if [ -n "$LETSENCRYPT_DOMAINS" ]; then
  # won't get killed properly when the main process exists. meh.
  (
    sleep 5 &&
    certbot --nginx -d $LETSENCRYPT_DOMAINS \
            --redirect --hsts \
            --non-interactive --agree-tos --register-unsafely-without-email &&
    sed -i "s/listen 443 ssl;/listen 443 ssl http2;/" /etc/nginx/nginx.conf &&
    service nginx reload &&
    while :; do sleep 7d; certbot renew || true; done
  ) > /var/log/certbot.log 2>&1 &
fi

exec nginx -g 'daemon off;'
