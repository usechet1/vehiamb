FROM nginx:1.27-alpine

# Changed from 'nginx/nginx.conf' to just 'nginx.conf'
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY . /usr/share/nginx/html

EXPOSE 80