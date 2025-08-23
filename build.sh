#!/bin/bash

# Chrome Ugoira Downloader Build Script

echo "🚀 Building Chrome Ugoira Downloader..."

# Clean previous build
echo "📦 Cleaning previous build..."
npm run clean

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build the extension
echo "🔨 Building extension..."
npm run build

# Create icons if they don't exist
if [ ! -f "public/icons/icon16.png" ]; then
    echo "⚠️  Icons not found. Please generate icons using public/icons/generate-icons.html"
fi

# Check if build was successful
if [ -d "dist" ]; then
    echo "✅ Build successful! Extension is ready in the 'dist' folder."
    echo ""
    echo "📋 Next steps:"
    echo "1. Open Chrome and go to chrome://extensions/"
    echo "2. Enable 'Developer mode'"
    echo "3. Click 'Load unpacked'"
    echo "4. Select the 'dist' folder"
else
    echo "❌ Build failed. Please check the error messages above."
    exit 1
fi