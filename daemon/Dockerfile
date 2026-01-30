FROM mcr.microsoft.com/playwright:v1.52.0-jammy

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (--omit=dev is the modern replacement for --only=production)
ARG CACHEBUST=1
RUN npm ci --omit=dev

# Copy source
COPY . .

# Create persistent data directory with correct permissions
# This will be mounted as a Railway volume at /app/data
RUN mkdir -p /app/data && chmod 755 /app/data

# Run
CMD ["npm", "start"]
