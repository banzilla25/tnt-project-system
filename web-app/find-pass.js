const fs = require('fs');
const readline = require('readline');

async function processLineByLine() {
  const fileStream = fs.createReadStream('C:/Users/Hibban/.gemini/antigravity/brain/31d6ba9e-fe21-4801-b2b9-ae6085a3b8cd/.system_generated/logs/transcript.jsonl');

  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    if (line.includes('postgres://') && line.includes('eolisqycvpkzdzzaugkk')) {
      const parsed = JSON.parse(line);
      console.log(JSON.stringify(parsed.tool_calls, null, 2));
    }
  }
}

processLineByLine();
