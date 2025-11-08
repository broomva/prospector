#!/usr/bin/env bun
/**
 * Script to generate and store embeddings for all contacts
 * Run with: bun run src/mastra/scripts/generate-embeddings.ts
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { parse } from 'csv-parse/sync';
import { embedMany } from 'ai';
import { openai } from '@ai-sdk/openai';
import { getVectorStore, CONTACT_VECTOR_CONFIG, contactToText } from '../lib/vector-store';
import type { Contact } from '../types/contact';

// Path helpers
function getContactsPath(): string {
  let projectRoot = process.cwd();

  if (projectRoot.endsWith('.mastra/output')) {
    projectRoot = join(projectRoot, '../..');
  }

  const paths = [
    join(projectRoot, 'data/apollo-contacts-export.csv'),
    join(projectRoot, 'src/data/apollo-contacts-export.csv'),
    join(projectRoot, 'src/mastra/data/apollo-contacts-export.csv'),
  ];

  for (const path of paths) {
    if (existsSync(path)) {
      return path;
    }
  }

  throw new Error(`Could not find contacts CSV. Tried: ${paths.join(', ')}`);
}

function transformApolloToContact(apolloRecord: any): Contact {
  const technologies = apolloRecord['Technologies']
    ? apolloRecord['Technologies'].split(',').map((t: string) => t.trim())
    : [];

  const keywords = apolloRecord['Keywords']
    ? apolloRecord['Keywords'].split(',').map((k: string) => k.trim())
    : [];

  const companySize = parseInt(apolloRecord['# Employees'] || '0');
  let companySizeBucket: any = 'Unknown';
  if (companySize > 0) {
    if (companySize <= 10) companySizeBucket = '1-10 (Micro)';
    else if (companySize <= 50) companySizeBucket = '11-50 (Small)';
    else if (companySize <= 200) companySizeBucket = '51-200 (Medium)';
    else if (companySize <= 500) companySizeBucket = '201-500 (Large)';
    else companySizeBucket = '500+ (Enterprise)';
  }

  return {
    id: apolloRecord['Apollo Contact Id'] || '',
    firstName: apolloRecord['First Name'] || undefined,
    lastName: apolloRecord['Last Name'] || undefined,
    email: apolloRecord['Email'] || '',
    emailStatus: apolloRecord['Email Status'] || 'User Managed',
    title: apolloRecord['Title'] || undefined,
    seniority: apolloRecord['Seniority'] || undefined,
    linkedinUrl: apolloRecord['Person Linkedin Url'] || undefined,
    city: apolloRecord['City'] || undefined,
    state: apolloRecord['State'] || undefined,
    country: apolloRecord['Country'] || undefined,
    companyName: apolloRecord['Company Name'] || undefined,
    companyWebsite: apolloRecord['Website'] || undefined,
    companySize: companySize || undefined,
    companySizeBucket,
    industry: apolloRecord['Industry'] || undefined,
    technologies: technologies.length > 0 ? technologies : undefined,
    keywords: keywords.length > 0 ? keywords : undefined,
    totalFunding: apolloRecord['Total Funding'] ? parseInt(apolloRecord['Total Funding']) : undefined,
    stage: apolloRecord['Stage'] || 'Cold',
    contactState: 'NOT_CONTACTED',
    qualityScore: 0,
    isExecutive: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as Contact;
}

function loadContactsFromCSV(): Contact[] {
  const csvPath = getContactsPath();
  console.log(`📄 Loading contacts from: ${csvPath}`);

  const csvContent = readFileSync(csvPath, 'utf-8');
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
  });

  return records.map((record: any) => transformApolloToContact(record));
}

async function generateEmbeddings() {
  console.log('🚀 Starting embedding generation for contacts...\n');

  try {
    // Load contacts
    const contacts = loadContactsFromCSV();
    console.log(`✅ Loaded ${contacts.length} contacts\n`);

    // Initialize vector store
    console.log('🔧 Initializing vector store...');
    const vectorStore = getVectorStore();

    // Check if index exists, if not create it
    try {
      await vectorStore.describeIndex({ indexName: CONTACT_VECTOR_CONFIG.indexName });
      console.log(`✅ Index '${CONTACT_VECTOR_CONFIG.indexName}' already exists\n`);
    } catch (error) {
      console.log(`📝 Creating index '${CONTACT_VECTOR_CONFIG.indexName}'...`);
      await vectorStore.createIndex({
        indexName: CONTACT_VECTOR_CONFIG.indexName,
        dimension: CONTACT_VECTOR_CONFIG.dimension,
        metric: CONTACT_VECTOR_CONFIG.metric,
      });
      console.log(`✅ Index created successfully\n`);
    }

    // Generate embeddings in batches
    const BATCH_SIZE = 50;
    const batches = Math.ceil(contacts.length / BATCH_SIZE);

    console.log(`🔄 Processing ${batches} batches of ${BATCH_SIZE} contacts each...\n`);

    for (let i = 0; i < batches; i++) {
      const start = i * BATCH_SIZE;
      const end = Math.min(start + BATCH_SIZE, contacts.length);
      const batch = contacts.slice(start, end);

      console.log(`  Batch ${i + 1}/${batches}: Processing contacts ${start + 1}-${end}...`);

      // Convert contacts to text
      const texts = batch.map(contact => contactToText(contact));

      // Generate embeddings using OpenAI (text-embedding-3-small, 1536-dim)
      const { embeddings } = await embedMany({
        model: openai.embedding('text-embedding-3-small'),
        values: texts,
      });

      // Prepare metadata
      const metadata = batch.map(contact => ({
        contactId: contact.id,
        email: contact.email,
        firstName: contact.firstName || '',
        lastName: contact.lastName || '',
        title: contact.title || '',
        companyName: contact.companyName || '',
        industry: contact.industry || '',
        country: contact.country || '',
        seniority: contact.seniority || '',
        isExecutive: contact.isExecutive || false,
        qualityScore: contact.qualityScore || 0,
        contactState: contact.contactState,
      }));

      // Prepare IDs
      const ids = batch.map(contact => contact.id);

      // Upsert to vector store
      await vectorStore.upsert({
        indexName: CONTACT_VECTOR_CONFIG.indexName,
        vectors: embeddings,
        metadata,
        ids,
      });

      console.log(`  ✅ Batch ${i + 1}/${batches} completed (${end} total contacts processed)`);
    }

    // Get final stats
    const stats = await vectorStore.describeIndex({ indexName: CONTACT_VECTOR_CONFIG.indexName });
    console.log(`\n🎉 Successfully generated and stored embeddings!`);
    console.log(`📊 Final stats:`, stats);
    console.log(`\n✅ All done! Vector search is now available.\n`);
  } catch (error) {
    console.error('❌ Error generating embeddings:', error);
    process.exit(1);
  }
}

// Run the script
generateEmbeddings();
