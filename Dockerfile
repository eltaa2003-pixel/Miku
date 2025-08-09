FROM node:20

# Install system dependencies including ffmpeg
RUN apt-get update && apt-get install -y \
    ffmpeg \
    imagemagick \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* ./

RUN npm install --legacy-peer-deps

COPY . .

# Northflank uses the PORT environment variable, which defaults to 3000 in the app
EXPOSE 3000

CMD ["node", "index.js"]