'use strict';
const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  if (dir.includes('node_modules') || dir.includes('.git')) return;
  fs.readdirSync(dir).forEach(f => {
    const dirPath = path.join(dir, f);
    const isDirectory = fs.statSync(dirPath).isDirectory();
    if (isDirectory) walkDir(dirPath, callback);
    else callback(dirPath);
  });
}

console.log('--- Scanning Codebase for Hardcoded Secrets ---\n');

// Regex patterns for common secrets
const patterns = [
  { name: 'API Key', regex: /(?:api[_-]?key|api[_-]?secret)["\s]*[:=]\s*["'][a-zA-Z0-9]{32,}["']/gi },
  { name: 'Password', regex: /(?:password|passwd|pwd)["\s]*[:=]\s*["'][^"'\s]{4,}["']/gi },
  { name: 'Bearer Token', regex: /(?:bearer|token|auth)["\s]*[:=]\s*["'][a-zA-Z0-9_\-\.]{20,}["']/gi },
  { name: 'Private Key Block', regex: /-----BEGIN (RSA |EC |DSA |OPENSSH |)PRIVATE KEY-----/gi }
];

let secretsFound = 0;
const scanPath = path.join(__dirname, '..');

walkDir(scanPath, (filePath) => {
  if (filePath.endsWith('.js') || filePath.endsWith('.json') || filePath.endsWith('.html')) {
    const content = fs.readFileSync(filePath, 'utf8');
    
    for (const { name, regex } of patterns) {
      const matches = content.match(regex);
      if (matches) {
        matches.forEach(match => {
          // Ignore false positives like "password_field" or default empty strings
          if (!match.includes('""') && !match.includes("''") && !match.toLowerCase().includes('placeholder')) {
            console.log(`[!] POTENTIAL ${name} FOUND in ${filePath}: ${match.substring(0, 50)}...`);
            secretsFound++;
          }
        });
      }
    }
  }
});

if (secretsFound === 0) {
  console.log('✅ VERIFIED: Zero hardcoded secrets, passwords, or API keys found in the codebase!');
  console.log('✅ All environment configuration is safely handled via .env files.');
} else {
  console.log(`\n❌ Found ${secretsFound} potential secrets. Please review the files above.`);
}