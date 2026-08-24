const fs = require('fs');

console.log("Copying AI models...");
fs.cpSync('./node_modules/@imgly/background-removal/dist', './public/imgly', { recursive: true });
console.log("Success! Models are now stored locally in your public folder.");