import 'dotenv/config';
import { createClient } from 'contentful-management';

const CONTENT_TYPE_ID = 'catBreed';

function isCmaNotFound(err) {
  try {
    return JSON.parse(err.message).status === 404;
  } catch {
    return false;
  }
}

const fields = [
  {
    id: 'catApiId',
    name: 'Cat API ID',
    type: 'Symbol',
    required: true,
    validations: [{ unique: true }],
  },
  {
    id: 'name',
    name: 'Name',
    type: 'Symbol',
    required: true,
  },
  {
    id: 'altNames',
    name: 'Alt Names',
    type: 'Symbol',
    required: false,
  },
  {
    id: 'description',
    name: 'Description',
    type: 'Text',
    required: false,
  },
  {
    id: 'temperament',
    name: 'Temperament',
    type: 'Symbol',
    required: false,
  },
  {
    id: 'origin',
    name: 'Origin',
    type: 'Symbol',
    required: false,
  },
  {
    id: 'countryCode',
    name: 'Country Code',
    type: 'Symbol',
    required: false,
  },
  {
    id: 'lifeSpan',
    name: 'Life Span',
    type: 'Symbol',
    required: false,
  },
  {
    id: 'weightImperial',
    name: 'Weight (Imperial)',
    type: 'Symbol',
    required: false,
  },
  {
    id: 'weightMetric',
    name: 'Weight (Metric)',
    type: 'Symbol',
    required: false,
  },
  {
    id: 'wikipediaUrl',
    name: 'Wikipedia URL',
    type: 'Symbol',
    required: false,
    validations: [{ regexp: { pattern: '^https?://' } }],
  },
  {
    id: 'cfaUrl',
    name: 'CFA URL',
    type: 'Symbol',
    required: false,
  },
  {
    id: 'vetstreetUrl',
    name: 'VetStreet URL',
    type: 'Symbol',
    required: false,
  },
  {
    id: 'vcahospitalsUrl',
    name: 'VCA Hospitals URL',
    type: 'Symbol',
    required: false,
  },
  // Trait scores 1–5
  {
    id: 'adaptability',
    name: 'Adaptability',
    type: 'Integer',
    required: false,
    validations: [{ range: { min: 1, max: 5 } }],
  },
  {
    id: 'affectionLevel',
    name: 'Affection Level',
    type: 'Integer',
    required: false,
    validations: [{ range: { min: 1, max: 5 } }],
  },
  {
    id: 'childFriendly',
    name: 'Child Friendly',
    type: 'Integer',
    required: false,
    validations: [{ range: { min: 1, max: 5 } }],
  },
  {
    id: 'dogFriendly',
    name: 'Dog Friendly',
    type: 'Integer',
    required: false,
    validations: [{ range: { min: 1, max: 5 } }],
  },
  {
    id: 'energyLevel',
    name: 'Energy Level',
    type: 'Integer',
    required: false,
    validations: [{ range: { min: 1, max: 5 } }],
  },
  {
    id: 'grooming',
    name: 'Grooming',
    type: 'Integer',
    required: false,
    validations: [{ range: { min: 1, max: 5 } }],
  },
  {
    id: 'healthIssues',
    name: 'Health Issues',
    type: 'Integer',
    required: false,
    validations: [{ range: { min: 1, max: 5 } }],
  },
  {
    id: 'intelligence',
    name: 'Intelligence',
    type: 'Integer',
    required: false,
    validations: [{ range: { min: 1, max: 5 } }],
  },
  {
    id: 'sheddingLevel',
    name: 'Shedding Level',
    type: 'Integer',
    required: false,
    validations: [{ range: { min: 1, max: 5 } }],
  },
  {
    id: 'socialNeeds',
    name: 'Social Needs',
    type: 'Integer',
    required: false,
    validations: [{ range: { min: 1, max: 5 } }],
  },
  {
    id: 'strangerFriendly',
    name: 'Stranger Friendly',
    type: 'Integer',
    required: false,
    validations: [{ range: { min: 1, max: 5 } }],
  },
  {
    id: 'vocalisation',
    name: 'Vocalisation',
    type: 'Integer',
    required: false,
    validations: [{ range: { min: 1, max: 5 } }],
  },
  // Boolean flags
  {
    id: 'indoor',
    name: 'Indoor',
    type: 'Boolean',
    required: false,
  },
  {
    id: 'lap',
    name: 'Lap Cat',
    type: 'Boolean',
    required: false,
  },
  {
    id: 'experimental',
    name: 'Experimental',
    type: 'Boolean',
    required: false,
  },
  {
    id: 'hairless',
    name: 'Hairless',
    type: 'Boolean',
    required: false,
  },
  {
    id: 'natural',
    name: 'Natural',
    type: 'Boolean',
    required: false,
  },
  {
    id: 'rare',
    name: 'Rare',
    type: 'Boolean',
    required: false,
  },
  {
    id: 'rex',
    name: 'Rex',
    type: 'Boolean',
    required: false,
  },
  {
    id: 'suppressedTail',
    name: 'Suppressed Tail',
    type: 'Boolean',
    required: false,
  },
  {
    id: 'shortLegs',
    name: 'Short Legs',
    type: 'Boolean',
    required: false,
  },
  {
    id: 'hypoallergenic',
    name: 'Hypoallergenic',
    type: 'Boolean',
    required: false,
  },
  // Reference image asset link
  {
    id: 'referenceImage',
    name: 'Reference Image',
    type: 'Link',
    linkType: 'Asset',
    required: false,
  },
];

export async function createContentModel() {
  const { CONTENTFUL_MANAGEMENT_TOKEN, CONTENTFUL_SPACE_ID, CONTENTFUL_ENVIRONMENT_ID } =
    process.env;

  if (!CONTENTFUL_MANAGEMENT_TOKEN) {
    throw new Error('CONTENTFUL_MANAGEMENT_TOKEN is not set in environment');
  }

  const spaceId = CONTENTFUL_SPACE_ID;
  const environmentId = CONTENTFUL_ENVIRONMENT_ID || 'master';

  const client = createClient({ accessToken: CONTENTFUL_MANAGEMENT_TOKEN });

  // Check if content type already exists
  try {
    const existing = await client.contentType.get({ spaceId, environmentId, contentTypeId: CONTENT_TYPE_ID });
    console.log(`Content type "${CONTENT_TYPE_ID}" already exists (version ${existing.sys.version}). Skipping creation.`);
    return existing;
  } catch (err) {
    if (!isCmaNotFound(err)) throw err;
  }

  console.log(`Creating content type "${CONTENT_TYPE_ID}"...`);

  const contentType = await client.contentType.createWithId(
    { spaceId, environmentId, contentTypeId: CONTENT_TYPE_ID },
    {
      name: 'Cat Breed',
      description: 'A cat breed imported from The Cat API (thecatapi.com)',
      displayField: 'name',
      fields,
    }
  );

  const published = await client.contentType.publish(
    { spaceId, environmentId, contentTypeId: CONTENT_TYPE_ID, version: contentType.sys.version },
    contentType
  );

  console.log(`Content type "${CONTENT_TYPE_ID}" created and published (version ${published.sys.version}).`);
  return published;
}

// Allow running directly: node src/createContentModel.js
if (process.argv[1].endsWith('createContentModel.js')) {
  createContentModel().catch((err) => {
    console.error('Failed to create content model:', err.message);
    process.exit(1);
  });
}
