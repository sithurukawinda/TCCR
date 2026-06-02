require('dotenv').config();
const fs       = require('fs');
const chokidar = require('chokidar');

const COLLECTION_FILE = 'postman/CMP_Backend.postman_collection.json';
const MAX_RETRIES     = 5;
const RETRY_DELAY_MS  = 3000;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function syncToPostman(attempt = 1) {
  try {
    let raw = fs.readFileSync(COLLECTION_FILE, 'utf8');
    if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
    const collection = JSON.parse(raw);

    const response = await fetch(
      `https://api.getpostman.com/collections/${process.env.POSTMAN_COLLECTION_ID}`,
      {
        method: 'PUT',
        headers: {
          'X-Api-Key':    process.env.POSTMAN_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ collection }),
      }
    );

    const result = await response.json();

    // 409 = Postman still processing a previous update — retry
    if (response.status === 409) {
      if (attempt <= MAX_RETRIES) {
        console.log(`⏳ Postman busy (attempt ${attempt}/${MAX_RETRIES}) — retrying in ${RETRY_DELAY_MS / 1000}s...`);
        await sleep(RETRY_DELAY_MS);
        return syncToPostman(attempt + 1);
      }
      console.error('❌ Sync failed after max retries:', result.error?.message);
      return;
    }

    if (!response.ok) {
      console.error('❌ Sync failed:', response.status, JSON.stringify(result));
      return;
    }

    console.log(`✅ Synced → "${result.collection?.name ?? result.collection?.id}"`);
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

chokidar
  .watch(COLLECTION_FILE, {
    ignoreInitial:  true,
    awaitWriteFinish: { stabilityThreshold: 500 },
  })
  .on('change', async () => {
    console.log('📄 Collection file changed...');
    console.log('🔄 Syncing collection to Postman...');
    await syncToPostman();
  });

console.log(`👀 Watching ${COLLECTION_FILE} — any save will auto-sync to Postman`);
