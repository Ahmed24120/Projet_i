# Use Node.js lts
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source
COPY . .

# Expose port (adjust if needed)
EXPOSE 3001

# Start command
CMD ["npm", "start"]
