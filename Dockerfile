# Use official Node.js image
FROM node:22

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy rest of the app
COPY . .

# Expose Render port
EXPOSE 10000

# Start app
CMD ["npm", "start"]
