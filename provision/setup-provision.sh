#!/bin/bash

# Create .gitignore
cat > .gitignore << 'EOF'
.env
storage/
failures/
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*
EOF

# Init Node project & install deps
npm init -y
npm i playwright express dotenv
npx playwright install

# Create folders
mkdir -p storage failures

# Add placeholder selectors file
echo '{}' > selectors.example.json
cp selectors.example.json selectors.json

echo "Provision setup complete."

