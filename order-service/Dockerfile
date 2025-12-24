FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
# use npm install in the build image to avoid requiring package-lock.json
RUN npm install --production
COPY . .
EXPOSE 4002
CMD [ "npm", "start" ]
