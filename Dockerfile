FROM node:12.16
RUN apt-get update && apt-get install -y poppler-utils imagemagick exiftool parallel rename
WORKDIR /app
COPY package.json npm-shrinkwrap.json ./
RUN npm install
COPY . .
EXPOSE 4433
CMD npm start
