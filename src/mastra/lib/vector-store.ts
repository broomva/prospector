import { LibSQLVector } from '@mastra/libsql';
import { join } from 'path';

/**
 * Vector store instance for contact embeddings
 * Uses LibSQL with vector extensions for semantic search
 */
export function getVectorStore(): LibSQLVector {
  let projectRoot = process.cwd();

  // If we're running from .mastra/output, go up two levels to project root
  if (projectRoot.endsWith('.mastra/output')) {
    projectRoot = join(projectRoot, '../..');
  }

  // Use a local file-based database for vector storage
  const dbPath = join(projectRoot, 'data/contacts-vectors.db');

  return new LibSQLVector({
    connectionUrl: `file:${dbPath}`,
  });
}

/**
 * Contact vector index configuration
 */
export const CONTACT_VECTOR_CONFIG = {
  indexName: 'contacts_embeddings',
  dimension: 1536, // OpenAI text-embedding-3-small dimension
  metric: 'cosine' as const,
} as const;

/**
 * Generate a text representation of a contact for embedding
 * Combines key fields into a searchable text
 */
export function contactToText(contact: {
  firstName?: string;
  lastName?: string;
  title?: string;
  companyName?: string;
  industry?: string;
  keywords?: string[];
  technologies?: string[];
  seniority?: string;
  country?: string;
}): string {
  const parts: string[] = [];

  // Basic info
  if (contact.firstName || contact.lastName) {
    parts.push(`${contact.firstName || ''} ${contact.lastName || ''}`.trim());
  }

  if (contact.title) {
    parts.push(`Title: ${contact.title}`);
  }

  if (contact.companyName) {
    parts.push(`Company: ${contact.companyName}`);
  }

  if (contact.industry) {
    parts.push(`Industry: ${contact.industry}`);
  }

  if (contact.seniority) {
    parts.push(`Seniority: ${contact.seniority}`);
  }

  if (contact.country) {
    parts.push(`Location: ${contact.country}`);
  }

  // Keywords and technologies
  if (contact.keywords && contact.keywords.length > 0) {
    parts.push(`Keywords: ${contact.keywords.slice(0, 10).join(', ')}`);
  }

  if (contact.technologies && contact.technologies.length > 0) {
    parts.push(`Technologies: ${contact.technologies.slice(0, 10).join(', ')}`);
  }

  return parts.join('. ');
}
