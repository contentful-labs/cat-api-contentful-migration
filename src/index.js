import 'dotenv/config';
import { createContentModel } from './createContentModel.js';
import { migrateData } from './migrateData.js';

const required = ['CONTENTFUL_MANAGEMENT_TOKEN', 'CONTENTFUL_SPACE_ID'];

function validateEnv() {
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error('Missing required environment variables:');
    missing.forEach((key) => console.error(`  ${key}`));
    console.error('\nCopy .env.example to .env and fill in your values.');
    process.exit(1);
  }
}

async function main() {
  console.log('=== Cat API → Contentful Migration ===');
  console.log(`Space:       ${process.env.CONTENTFUL_SPACE_ID}`);
  console.log(`Environment: ${process.env.CONTENTFUL_ENVIRONMENT_ID || 'master'}`);
  console.log('');

  validateEnv();

  // Step 1: Create content model
  console.log('--- Step 1: Content Model ---');
  await createContentModel();
  console.log('');

  // Step 2: Migrate data
  console.log('--- Step 2: Data Migration ---');
  const stats = await migrateData();

  // Summary
  console.log('');
  console.log('=== Migration Complete ===');
  console.log(`  Entries created : ${stats.created}`);
  console.log(`  Entries skipped : ${stats.skipped} (already existed)`);
  console.log(`  Entries failed  : ${stats.failed}`);
  console.log(`  Assets created  : ${stats.assetsCreated}`);

  if (stats.failed > 0) {
    console.warn(`\nWarning: ${stats.failed} breed(s) failed. Check the logs above for details.`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('\nFatal error:', err.message);
  process.exit(1);
});
