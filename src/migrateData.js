import 'dotenv/config';
import { createClient } from 'contentful-management';

const CAT_API_BASE = 'https://api.thecatapi.com/v1';
const CONTENT_TYPE_ID = 'catBreed';
const ASSET_PROCESS_RETRIES = 10;
const ASSET_PROCESS_DELAY_MS = 2000;
const BREED_DELAY_MS = 500;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchBreeds(apiKey) {
  const res = await fetch(`${CAT_API_BASE}/breeds`, {
    headers: { 'x-api-key': apiKey },
  });
  if (!res.ok) throw new Error(`Cat API breeds fetch failed: ${res.status} ${res.statusText}`);
  return res.json();
}

async function fetchImageUrl(imageId, apiKey) {
  if (!imageId) return null;
  try {
    const res = await fetch(`${CAT_API_BASE}/images/${imageId}`, {
      headers: { 'x-api-key': apiKey },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.url || null;
  } catch {
    return null;
  }
}

async function createAndPublishAsset(client, spaceId, environmentId, breed, imageUrl, locale) {
  if (!imageUrl) return null;

  const ext = imageUrl.split('?')[0].split('.').pop().toLowerCase();
  const mimeType = ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : 'image/jpeg';

  let asset = await client.asset.create(
    { spaceId, environmentId },
    {
      fields: {
        title: { [locale]: `${breed.name} - Reference Image` },
        description: { [locale]: `Reference image for ${breed.name} (${breed.id}) from The Cat API` },
        file: {
          [locale]: {
            contentType: mimeType,
            fileName: `${breed.id}.${ext}`,
            upload: imageUrl,
          },
        },
      },
    }
  );

  // Trigger remote image processing
  await client.asset.processForLocale(
    { spaceId, environmentId, assetId: asset.sys.id, version: asset.sys.version },
    asset,
    locale
  );

  // Poll until Contentful has processed the remote file
  for (let attempt = 0; attempt < ASSET_PROCESS_RETRIES; attempt++) {
    await delay(ASSET_PROCESS_DELAY_MS);
    try {
      const fetched = await client.asset.get({ spaceId, environmentId, assetId: asset.sys.id });
      const fileDetails = fetched.fields?.file?.[locale]?.details;
      if (fileDetails) {
        asset = fetched;
        break;
      }
    } catch {
      // keep polling
    }
    if (attempt === ASSET_PROCESS_RETRIES - 1) {
      console.warn(`  Warning: asset processing timed out for ${breed.name}. Skipping asset.`);
      return null;
    }
  }

  const published = await client.asset.publish(
    { spaceId, environmentId, assetId: asset.sys.id, version: asset.sys.version },
    asset
  );
  return published;
}

function buildEntryFields(breed, asset, locale) {
  const intOrNull = (v) => (v != null && v !== '' ? parseInt(v, 10) : undefined);
  const boolOrNull = (v) => (v != null ? Boolean(v) : undefined);
  const strOrNull = (v) => (v != null && v !== '' ? String(v) : undefined);

  const fields = {};

  const set = (key, value) => {
    if (value !== undefined && value !== null) {
      fields[key] = { [locale]: value };
    }
  };

  set('catApiId', strOrNull(breed.id));
  set('name', strOrNull(breed.name));
  set('altNames', strOrNull(breed.alt_names));
  set('description', strOrNull(breed.description));
  set('temperament', strOrNull(breed.temperament));
  set('origin', strOrNull(breed.origin));
  set('countryCode', strOrNull(breed.country_code));
  set('lifeSpan', strOrNull(breed.life_span));
  set('weightImperial', strOrNull(breed.weight?.imperial));
  set('weightMetric', strOrNull(breed.weight?.metric));
  set('wikipediaUrl', strOrNull(breed.wikipedia_url));
  set('cfaUrl', strOrNull(breed.cfa_url));
  set('vetstreetUrl', strOrNull(breed.vetstreet_url));
  set('vcahospitalsUrl', strOrNull(breed.vcahospitals_url));

  // Trait scores
  set('adaptability', intOrNull(breed.adaptability));
  set('affectionLevel', intOrNull(breed.affection_level));
  set('childFriendly', intOrNull(breed.child_friendly));
  set('dogFriendly', intOrNull(breed.dog_friendly));
  set('energyLevel', intOrNull(breed.energy_level));
  set('grooming', intOrNull(breed.grooming));
  set('healthIssues', intOrNull(breed.health_issues));
  set('intelligence', intOrNull(breed.intelligence));
  set('sheddingLevel', intOrNull(breed.shedding_level));
  set('socialNeeds', intOrNull(breed.social_needs));
  set('strangerFriendly', intOrNull(breed.stranger_friendly));
  set('vocalisation', intOrNull(breed.vocalisation));

  // Boolean flags (0/1 in the API → true/false)
  set('indoor', boolOrNull(breed.indoor));
  set('lap', boolOrNull(breed.lap));
  set('experimental', boolOrNull(breed.experimental));
  set('hairless', boolOrNull(breed.hairless));
  set('natural', boolOrNull(breed.natural));
  set('rare', boolOrNull(breed.rare));
  set('rex', boolOrNull(breed.rex));
  set('suppressedTail', boolOrNull(breed.suppressed_tail));
  set('shortLegs', boolOrNull(breed.short_legs));
  set('hypoallergenic', boolOrNull(breed.hypoallergenic));

  // Asset link
  if (asset) {
    fields.referenceImage = {
      [locale]: {
        sys: { type: 'Link', linkType: 'Asset', id: asset.sys.id },
      },
    };
  }

  return fields;
}

async function entryExistsForBreed(client, spaceId, environmentId, breedId) {
  const result = await client.entry.getMany({
    spaceId,
    environmentId,
    query: {
      content_type: CONTENT_TYPE_ID,
      'fields.catApiId': breedId,
      limit: 1,
    },
  });
  return result.total > 0 ? result.items[0] : null;
}

export async function migrateData() {
  const {
    CONTENTFUL_MANAGEMENT_TOKEN,
    CONTENTFUL_SPACE_ID,
    CONTENTFUL_ENVIRONMENT_ID,
    CAT_API_KEY,
  } = process.env;

  if (!CONTENTFUL_MANAGEMENT_TOKEN) {
    throw new Error('CONTENTFUL_MANAGEMENT_TOKEN is not set in environment');
  }

  const apiKey = CAT_API_KEY || 'DEMO-API-KEY';
  const spaceId = CONTENTFUL_SPACE_ID;
  const environmentId = CONTENTFUL_ENVIRONMENT_ID || 'master';

  const client = createClient({ accessToken: CONTENTFUL_MANAGEMENT_TOKEN });

  // Detect default locale
  const localesResult = await client.locale.getMany({ spaceId, environmentId });
  const defaultLocale = localesResult.items.find((l) => l.default)?.code || 'en-US';
  console.log(`Using locale: ${defaultLocale}`);

  console.log('Fetching breeds from The Cat API...');
  const breeds = await fetchBreeds(apiKey);
  console.log(`Fetched ${breeds.length} breeds.`);

  const stats = { created: 0, skipped: 0, failed: 0, assetsCreated: 0 };

  for (let i = 0; i < breeds.length; i++) {
    const breed = breeds[i];
    console.log(`\n[${i + 1}/${breeds.length}] Processing: ${breed.name} (${breed.id})`);

    try {
      // Skip if entry already exists
      const existing = await entryExistsForBreed(client, spaceId, environmentId, breed.id);
      if (existing) {
        console.log(`  Skipped — entry already exists.`);
        stats.skipped++;
        continue;
      }

      // Resolve image
      let asset = null;
      const imageId = breed.reference_image_id || breed.image?.id;
      if (imageId) {
        console.log(`  Fetching image: ${imageId}`);
        const imageUrl = await fetchImageUrl(imageId, apiKey);
        if (imageUrl) {
          console.log(`  Uploading asset from: ${imageUrl}`);
          asset = await createAndPublishAsset(client, spaceId, environmentId, breed, imageUrl, defaultLocale);
          if (asset) {
            console.log(`  Asset published: ${asset.sys.id}`);
            stats.assetsCreated++;
          }
        } else {
          console.warn(`  Could not resolve image URL for image ID: ${imageId}`);
        }
      } else {
        console.log(`  No reference image for this breed.`);
      }

      // Create entry
      const entryFields = buildEntryFields(breed, asset, defaultLocale);
      const entry = await client.entry.create(
        { spaceId, environmentId, contentTypeId: CONTENT_TYPE_ID },
        { fields: entryFields }
      );

      await client.entry.publish(
        { spaceId, environmentId, entryId: entry.sys.id, version: entry.sys.version },
        entry
      );

      console.log(`  Entry published: ${entry.sys.id}`);
      stats.created++;
    } catch (err) {
      console.error(`  ERROR for ${breed.name}: ${err.message}`);
      stats.failed++;
    }

    // Rate-limit CMA calls between breeds
    if (i < breeds.length - 1) {
      await delay(BREED_DELAY_MS);
    }
  }

  return stats;
}

// Allow running directly: node src/migrateData.js
if (process.argv[1].endsWith('migrateData.js')) {
  migrateData()
    .then((stats) => {
      console.log('\n--- Migration complete ---');
      console.log(`  Created : ${stats.created}`);
      console.log(`  Skipped : ${stats.skipped}`);
      console.log(`  Failed  : ${stats.failed}`);
      console.log(`  Assets  : ${stats.assetsCreated}`);
    })
    .catch((err) => {
      console.error('Migration failed:', err.message);
      process.exit(1);
    });
}
