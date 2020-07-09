FROM nginx:1
RUN apt-get update && apt-get install -y certbot python-certbot-nginx
COPY nginx.conf /etc/nginx/nginx.conf
COPY entrypoint.sh /
ENTRYPOINT /entrypoint.sh
