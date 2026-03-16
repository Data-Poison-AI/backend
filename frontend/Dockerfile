FROM nginx:alpine

# Remove default nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy static frontend directories to the Nginx internal public html registry
COPY . /usr/share/nginx/html

# Copy custom Nginx configuration to proxy /api requests to the backend
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
