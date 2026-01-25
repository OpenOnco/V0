FROM mcr.microsoft.com/playwright:v1.52.0-jammy

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (--omit=dev is the modern replacement for --only=production)
RUN npm ci --omit=dev

# Copy source
COPY . .

# Run
CMD ["npm", "start"]
