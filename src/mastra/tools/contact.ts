import { createTool } from '@mastra/core';
import { embedMany } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { parse } from 'csv-parse/sync';
import { anthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';
import {
  ContactSchema,
  ContactFilterSchema,
  FieldPresets,
  InteractionSchema,
  StateUpdateSchema,
  OutreachRequestSchema,
  GeneratedOutreachSchema,
  type Contact,
  type ContactFilter,
  type ContactState,
  type WhereClause,
  type QueryOperator,
  type Interaction,
  type StateUpdate,
  type GeneratedOutreach,
} from '../types/contact';
import { getVectorStore, CONTACT_VECTOR_CONFIG, contactToText } from '../lib/vector-store';

// Path to the contacts CSV file - use absolute path from project root
function getContactsPath(): string {
  let projectRoot = process.cwd();

  // If we're running from .mastra/output, go up two levels to project root
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

const CONTACTS_CSV_PATH = getContactsPath();

// Path to state tracking file
function getStateTrackingPath(): string {
  let projectRoot = process.cwd();
  if (projectRoot.endsWith('.mastra/output')) {
    projectRoot = join(projectRoot, '../..');
  }

  const dataDir = join(projectRoot, 'data');
  return join(dataDir, 'contact-state.json');
}

const STATE_TRACKING_PATH = getStateTrackingPath();

/**
 * State tracking structure
 */
interface ContactStateTracking {
  contactId: string;
  currentState: ContactState;
  stateHistory: StateUpdate[];
  interactions: Interaction[];
  lastUpdated: string;
}

interface StateTrackingData {
  contacts: Record<string, ContactStateTracking>;
  version: string;
}

/**
 * Load state tracking data
 */
function loadStateTracking(): StateTrackingData {
  if (!existsSync(STATE_TRACKING_PATH)) {
    return { contacts: {}, version: '1.0' };
  }

  try {
    const data = readFileSync(STATE_TRACKING_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading state tracking:', error);
    return { contacts: {}, version: '1.0' };
  }
}

/**
 * Save state tracking data
 */
function saveStateTracking(data: StateTrackingData): void {
  try {
    writeFileSync(STATE_TRACKING_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error saving state tracking:', error);
    throw error;
  }
}

/**
 * Helper function to load all contacts from CSV
 */
function loadContactsFromCSV(): Contact[] {
  const csvContent = readFileSync(CONTACTS_CSV_PATH, 'utf-8');
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
  });

  return records.map((record: any) => transformApolloToContact(record));
}

/**
 * Transform Apollo CSV record to Contact type
 */
function transformApolloToContact(apolloRecord: any): Contact {
  // Calculate quality score
  const qualityScore = calculateQualityScore(apolloRecord);

  // Determine contact state
  const contactState = determineContactState(apolloRecord);

  // Check if executive
  const isExecutive = isExecutiveContact(apolloRecord);

  // Parse arrays
  const technologies = apolloRecord['Technologies']
    ? apolloRecord['Technologies'].split(',').map((t: string) => t.trim())
    : [];

  const keywords = apolloRecord['Keywords']
    ? apolloRecord['Keywords'].split(',').map((k: string) => k.trim())
    : [];

  const departments = apolloRecord['Departments']
    ? apolloRecord['Departments'].split(',').map((d: string) => d.trim())
    : [];

  const lists = apolloRecord['Lists']
    ? apolloRecord['Lists'].split(',').map((l: string) => l.trim())
    : [];

  // Determine company size bucket
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
    emailCatchall:
      apolloRecord['Primary Email Catch-all Status'] === 'Not Catch-all'
        ? 'Not Catch-all'
        : apolloRecord['Primary Email Catch-all Status'] === 'Catch-all'
          ? 'Catch-all'
          : 'Unknown',
    emailLastVerified: apolloRecord['Primary Email Last Verified At'] || undefined,
    secondaryEmail: apolloRecord['Secondary Email'] || undefined,

    title: apolloRecord['Title'] || undefined,
    seniority: apolloRecord['Seniority'] || undefined,
    departments: departments.length > 0 ? departments : undefined,
    linkedinUrl: apolloRecord['Person Linkedin Url'] || undefined,

    mobilePhone: apolloRecord['Mobile Phone'] || undefined,
    workPhone: apolloRecord['Work Direct Phone'] || undefined,
    corporatePhone: apolloRecord['Corporate Phone'] || undefined,

    city: apolloRecord['City'] || undefined,
    state: apolloRecord['State'] || undefined,
    country: apolloRecord['Country'] || undefined,

    companyName: apolloRecord['Company Name'] || undefined,
    companyWebsite: apolloRecord['Website'] || undefined,
    companyLinkedinUrl: apolloRecord['Company Linkedin Url'] || undefined,
    companyAddress: apolloRecord['Company Address'] || undefined,
    companyCity: apolloRecord['Company City'] || undefined,
    companyState: apolloRecord['Company State'] || undefined,
    companyCountry: apolloRecord['Company Country'] || undefined,
    companyPhone: apolloRecord['Company Phone'] || undefined,
    companySize: companySize || undefined,
    companySizeBucket,
    industry: apolloRecord['Industry'] || undefined,

    technologies: technologies.length > 0 ? technologies : undefined,
    keywords: keywords.length > 0 ? keywords : undefined,
    annualRevenue: apolloRecord['Annual Revenue'] ? parseInt(apolloRecord['Annual Revenue']) : undefined,
    totalFunding: apolloRecord['Total Funding'] ? parseInt(apolloRecord['Total Funding']) : undefined,
    latestFunding: apolloRecord['Latest Funding'] || undefined,
    latestFundingAmount: apolloRecord['Latest Funding Amount']
      ? parseInt(apolloRecord['Latest Funding Amount'])
      : undefined,
    lastRaisedAt: apolloRecord['Last Raised At'] || undefined,

    facebookUrl: apolloRecord['Facebook Url'] || undefined,
    twitterUrl: apolloRecord['Twitter Url'] || undefined,

    stage: apolloRecord['Stage'] || 'Cold',
    contactState,
    lists,

    emailSent: apolloRecord['Email Sent'] === 'true' || apolloRecord['Email Sent'] === true,
    emailOpen: apolloRecord['Email Open'] === 'true' || apolloRecord['Email Open'] === true,
    emailBounced: apolloRecord['Email Bounced'] === 'true' || apolloRecord['Email Bounced'] === true,
    replied: apolloRecord['Replied'] === 'true' || apolloRecord['Replied'] === true,
    demoed: apolloRecord['Demoed'] === 'true' || apolloRecord['Demoed'] === true,
    lastContacted: apolloRecord['Last Contacted'] || undefined,

    qualityScore,
    isExecutive,

    apolloAccountId: apolloRecord['Apollo Account Id'] || undefined,
    contactOwner: apolloRecord['Contact Owner'] || undefined,
    accountOwner: apolloRecord['Account Owner'] || undefined,

    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Calculate quality score based on data completeness and email verification
 */
function calculateQualityScore(record: any): number {
  let score = 0;

  // Basic info (40 points)
  if (record['First Name']) score += 5;
  if (record['Last Name']) score += 5;
  if (record['Email']) score += 10;
  if (record['Title']) score += 10;
  if (record['Company Name']) score += 10;

  // Contact details (20 points)
  if (record['Person Linkedin Url']) score += 10;
  if (record['Mobile Phone'] || record['Work Direct Phone']) score += 10;

  // Rich data (20 points)
  if (record['Keywords']) score += 5;
  if (record['Technologies']) score += 5;
  if (record['Industry']) score += 5;
  if (record['# Employees']) score += 5;

  // Verification (20 points)
  if (record['Email Status'] === 'Verified') score += 10;
  if (record['Primary Email Catch-all Status'] === 'Not Catch-all') score += 10;

  return score;
}

/**
 * Determine current contact state based on interactions
 */
function determineContactState(record: any): ContactState {
  const replied = record['Replied'] === 'true' || record['Replied'] === true;
  const demoed = record['Demoed'] === 'true' || record['Demoed'] === true;
  const bounced = record['Email Bounced'] === 'true' || record['Email Bounced'] === true;
  const opened = record['Email Open'] === 'true' || record['Email Open'] === true;
  const sent = record['Email Sent'] === 'true' || record['Email Sent'] === true;
  const hasEmail = !!record['Email'];
  const stage = record['Stage'];

  if (replied) return 'REPLIED';
  if (demoed) return 'DEMOED';
  if (bounced) return 'BOUNCED';
  if (opened) return 'OPENED';
  if (sent) return 'SENT';
  if (hasEmail) {
    if (stage === 'Interested') return 'INTERESTED_NOT_CONTACTED';
    return 'NOT_CONTACTED';
  }
  return 'INCOMPLETE';
}

/**
 * Check if contact is executive level
 */
function isExecutiveContact(record: any): boolean {
  const seniority = record['Seniority'] || '';
  const title = record['Title'] || '';

  return (
    seniority.toLowerCase().includes('suite') ||
    seniority.toLowerCase().includes('founder') ||
    title.toLowerCase().includes('ceo') ||
    title.toLowerCase().includes('cto') ||
    title.toLowerCase().includes('cfo') ||
    title.toLowerCase().includes('coo') ||
    title.toLowerCase().includes('chief') ||
    title.toLowerCase().includes('founder')
  );
}

/**
 * Evaluate a single where clause against a contact
 */
function evaluateWhereClause(contact: Contact, clause: WhereClause): boolean {
  const fieldValue = (contact as any)[clause.field];
  const { operator, value, values } = clause;

  // Helper to convert to lowercase for case-insensitive string comparisons
  const toLower = (v: any): string => (typeof v === 'string' ? v.toLowerCase() : String(v));

  switch (operator) {
    case 'equals':
      return fieldValue === value;

    case 'notEquals':
      return fieldValue !== value;

    case 'contains':
      if (typeof fieldValue !== 'string') return false;
      return toLower(fieldValue).includes(toLower(value));

    case 'notContains':
      if (typeof fieldValue !== 'string') return false;
      return !toLower(fieldValue).includes(toLower(value));

    case 'startsWith':
      if (typeof fieldValue !== 'string') return false;
      return toLower(fieldValue).startsWith(toLower(value));

    case 'endsWith':
      if (typeof fieldValue !== 'string') return false;
      return toLower(fieldValue).endsWith(toLower(value));

    case 'gt':
      return typeof fieldValue === 'number' && fieldValue > value;

    case 'gte':
      return typeof fieldValue === 'number' && fieldValue >= value;

    case 'lt':
      return typeof fieldValue === 'number' && fieldValue < value;

    case 'lte':
      return typeof fieldValue === 'number' && fieldValue <= value;

    case 'in':
      if (!values || !Array.isArray(fieldValue)) return false;
      return values.includes(fieldValue);

    case 'notIn':
      if (!values || !Array.isArray(fieldValue)) return false;
      return !values.includes(fieldValue);

    case 'arrayContains':
      if (!Array.isArray(fieldValue)) return false;
      return fieldValue.some(item => toLower(item) === toLower(value));

    case 'arrayContainsAny':
      if (!Array.isArray(fieldValue) || !values) return false;
      return values.some(v => fieldValue.some(item => toLower(item) === toLower(v)));

    case 'arrayContainsAll':
      if (!Array.isArray(fieldValue) || !values) return false;
      return values.every(v => fieldValue.some(item => toLower(item) === toLower(v)));

    case 'exists':
      return fieldValue !== undefined && fieldValue !== null;

    case 'notExists':
      return fieldValue === undefined || fieldValue === null;

    default:
      return false;
  }
}

/**
 * Filter contacts based on criteria
 */
function filterContacts(contacts: Contact[], filter: ContactFilter): Contact[] {
  let filtered = contacts;

  // Apply flexible where clauses first (RECOMMENDED)
  if (filter.where && filter.where.length > 0) {
    filtered = filtered.filter(contact => {
      // All where clauses must match (AND logic)
      return filter.where!.every(clause => evaluateWhereClause(contact, clause));
    });
  }

  if (filter.stage) {
    filtered = filtered.filter((c) => c.stage === filter.stage);
  }

  if (filter.contactState) {
    filtered = filtered.filter((c) => c.contactState === filter.contactState);
  }

  if (filter.seniority) {
    filtered = filtered.filter((c) => c.seniority === filter.seniority);
  }

  if (filter.emailStatus) {
    filtered = filtered.filter((c) => c.emailStatus === filter.emailStatus);
  }

  if (filter.lists && filter.lists.length > 0) {
    filtered = filtered.filter((c) => c.lists.some((list) => filter.lists!.includes(list)));
  }

  if (filter.country) {
    filtered = filtered.filter((c) => c.country === filter.country);
  }

  if (filter.industry) {
    filtered = filtered.filter((c) => c.industry === filter.industry);
  }

  if (filter.minQualityScore !== undefined) {
    filtered = filtered.filter((c) => c.qualityScore >= filter.minQualityScore!);
  }

  if (filter.isExecutive !== undefined) {
    filtered = filtered.filter((c) => c.isExecutive === filter.isExecutive);
  }

  if (filter.companySizeBucket) {
    filtered = filtered.filter((c) => c.companySizeBucket === filter.companySizeBucket);
  }

  if (filter.hasKeywords) {
    filtered = filtered.filter((c) => c.keywords && c.keywords.length > 0);
  }

  if (filter.hasTechnologies) {
    filtered = filtered.filter((c) => c.technologies && c.technologies.length > 0);
  }

  if (filter.notContactedOnly) {
    filtered = filtered.filter(
      (c) => c.contactState === 'NOT_CONTACTED' || c.contactState === 'INTERESTED_NOT_CONTACTED'
    );
  }

  // Apply pagination
  const start = filter.offset || 0;
  const end = start + (filter.limit || 100);

  return filtered.slice(start, end);
}

/**
 * Project contact fields based on field selection
 * Reduces context size by only returning requested fields
 */
function projectContactFields(contact: Contact, filter: ContactFilter): Partial<Contact> {
  const preset = filter.fieldPreset || 'summary';

  // If full, return everything
  if (preset === 'full' && !filter.excludeFields) {
    return contact;
  }

  // Get base fields from preset
  let fields: readonly string[] = FieldPresets[preset] || FieldPresets.summary;

  // Apply includeFields and excludeFields
  const fieldsSet = new Set(fields);

  if (filter.includeFields) {
    filter.includeFields.forEach(f => fieldsSet.add(f));
  }

  if (filter.excludeFields) {
    filter.excludeFields.forEach(f => fieldsSet.delete(f));
  }

  // Project contact to only include selected fields
  const projected: any = {};
  for (const field of fieldsSet) {
    if (field in contact) {
      projected[field] = (contact as any)[field];
    }
  }

  return projected as Partial<Contact>;
}

/**
 * Tool: Query contacts from the Apollo export
 */
export const queryContactsTool = createTool({
  id: 'query-contacts',
  description: `Query and filter contacts from the Apollo export with flexible, dynamic filtering.

FLEXIBLE WHERE CLAUSE (RECOMMENDED):
Use the 'where' parameter to query ANY field with powerful operators:
- Search keywords: {field: "keywords", operator: "arrayContains", value: "fintech"}
- Search technologies: {field: "technologies", operator: "arrayContainsAny", values: ["Stripe", "PayPal"]}
- Company name: {field: "companyName", operator: "contains", value: "Tech"}
- Quality filter: {field: "qualityScore", operator: "gte", value: 70}
- Combine multiple: [{field: "country", operator: "equals", value: "Colombia"}, {field: "isExecutive", operator: "equals", value: true}]

Available operators: equals, contains, startsWith, gt/gte/lt/lte, arrayContains, arrayContainsAny, arrayContainsAll, exists, and more.

FIELD SELECTION (IMPORTANT):
By default, returns 'summary' fields (14 fields) to minimize context usage.
- fieldPreset='minimal' (7 fields): For lists/counts
- fieldPreset='summary' (14 fields, default): Balanced view
- fieldPreset='detailed' (22 fields): More context
- fieldPreset='full' (all fields): Only for <10 contacts!`,
  inputSchema: ContactFilterSchema,
  outputSchema: z.object({
    contacts: z.array(ContactSchema.partial()),
    total: z.number().describe('Total contacts matching filter (before pagination)'),
    returned: z.number().describe('Number of contacts returned'),
    fieldsReturned: z.array(z.string()).describe('List of fields included in each contact'),
  }),
  execute: async ({ context }) => {
    const contacts = loadContactsFromCSV();
    const filtered = filterContacts(contacts, context);

    // Project fields to reduce context size
    const projected = filtered.map(c => projectContactFields(c, context));

    // Get list of fields being returned
    const fieldsReturned = projected.length > 0 ? Object.keys(projected[0]) : [];

    return {
      contacts: projected,
      total: contacts.length,
      returned: projected.length,
      fieldsReturned,
    };
  },
});

/**
 * Tool: Get contact statistics and summary
 */
export const getContactStatsTool = createTool({
  id: 'get-contact-stats',
  description: 'Get summary statistics about the contact database',
  inputSchema: z.object({
    groupBy: z
      .enum(['stage', 'contactState', 'seniority', 'industry', 'country', 'companySizeBucket'])
      .optional()
      .describe('Field to group statistics by'),
  }),
  outputSchema: z.object({
    total: z.number(),
    byState: z.record(z.string(), z.number()),
    byStage: z.record(z.string(), z.number()),
    highValueTargets: z.object({
      executives: z.number(),
      verifiedNotContacted: z.number(),
      highQualityNotContacted: z.number(),
    }),
    avgQualityScore: z.number(),
    breakdown: z.record(z.string(), z.number()).optional(),
  }),
  execute: async ({ context }) => {
    const contacts = loadContactsFromCSV();

    // Count by state
    const byState: Record<string, number> = {};
    contacts.forEach((c) => {
      byState[c.contactState] = (byState[c.contactState] || 0) + 1;
    });

    // Count by stage
    const byStage: Record<string, number> = {};
    contacts.forEach((c) => {
      byStage[c.stage] = (byStage[c.stage] || 0) + 1;
    });

    // High value targets
    const executives = contacts.filter((c) => c.isExecutive).length;
    const verifiedNotContacted = contacts.filter(
      (c) => c.emailStatus === 'Verified' && c.contactState === 'NOT_CONTACTED'
    ).length;
    const highQualityNotContacted = contacts.filter(
      (c) =>
        c.qualityScore >= 70 &&
        (c.contactState === 'NOT_CONTACTED' || c.contactState === 'INTERESTED_NOT_CONTACTED')
    ).length;

    // Average quality score
    const avgQualityScore = contacts.reduce((sum, c) => sum + c.qualityScore, 0) / contacts.length;

    // Optional breakdown
    let breakdown: Record<string, number> | undefined;
    if (context.groupBy) {
      breakdown = {};
      contacts.forEach((c) => {
        const key = String(c[context.groupBy!] || 'Unknown');
        breakdown![key] = (breakdown![key] || 0) + 1;
      });
    }

    return {
      total: contacts.length,
      byState,
      byStage,
      highValueTargets: {
        executives,
        verifiedNotContacted,
        highQualityNotContacted,
      },
      avgQualityScore: Math.round(avgQualityScore * 10) / 10,
      breakdown,
    };
  },
});

/**
 * Tool: Get detailed contact by ID or email
 */
export const getContactDetailsTool = createTool({
  id: 'get-contact-details',
  description: 'Get detailed information about a specific contact by ID or email',
  inputSchema: z.object({
    contactId: z.string().optional().describe('Apollo Contact ID'),
    email: z.string().email().optional().describe('Contact email address'),
  }),
  outputSchema: z.union([ContactSchema, z.object({ found: z.literal(false) })]),
  execute: async ({ context }): Promise<Contact | { found: false }> => {
    const contacts = loadContactsFromCSV();

    let contact: Contact | undefined;

    if (context.contactId) {
      contact = contacts.find((c) => c.id === context.contactId);
    } else if (context.email) {
      contact = contacts.find((c) => c.email.toLowerCase() === context.email!.toLowerCase());
    }

    if (!contact) {
      return { found: false } as const;
    }

    return contact;
  },
});

/**
 * Tool: Search contacts by company names (batch company search)
 */
export const searchCompaniesTool = createTool({
  id: 'search-companies',
  description: `Search for contacts from multiple companies at once using flexible string matching.

Perfect for queries like:
- "Find contacts from Stripe, PayPal, and Square"
- "Show me all SaaS companies with 'tech' in the name"
- "Get contacts from companies containing 'payment' or 'fintech'"

Uses case-insensitive partial matching by default.`,
  inputSchema: z.object({
    companyNames: z.array(z.string()).describe('List of company names to search for (partial matches supported)'),
    exactMatch: z.boolean().default(false).describe('If true, requires exact company name match (case-insensitive)'),
    fieldPreset: z.enum(['minimal', 'summary', 'detailed', 'full']).default('summary').describe('Field preset to return'),
    limit: z.number().default(100).describe('Max contacts to return per company'),
    includeStats: z.boolean().default(true).describe('Include per-company statistics'),
  }),
  outputSchema: z.object({
    contacts: z.array(ContactSchema.partial()),
    totalMatched: z.number(),
    companiesFound: z.array(z.object({
      searchedFor: z.string(),
      matchedName: z.string(),
      contactCount: z.number(),
    })),
    companiesNotFound: z.array(z.string()),
  }),
  execute: async ({ context }) => {
    const allContacts = loadContactsFromCSV();
    const matchedContacts: Contact[] = [];
    const companiesFound = new Map<string, { matchedName: string; contacts: Contact[] }>();
    const companiesNotFound: string[] = [];

    // Search for each company
    for (const searchTerm of context.companyNames) {
      const searchLower = searchTerm.toLowerCase().trim();

      const matches = allContacts.filter(contact => {
        if (!contact.companyName) return false;

        const companyLower = contact.companyName.toLowerCase();

        if (context.exactMatch) {
          return companyLower === searchLower;
        } else {
          // Partial match
          return companyLower.includes(searchLower);
        }
      });

      if (matches.length > 0) {
        // Group by actual company name (in case of partial matches)
        const grouped = new Map<string, Contact[]>();
        matches.forEach(contact => {
          const companyName = contact.companyName!;
          if (!grouped.has(companyName)) {
            grouped.set(companyName, []);
          }
          grouped.get(companyName)!.push(contact);
        });

        // Store all matches
        grouped.forEach((contacts, companyName) => {
          companiesFound.set(companyName, {
            matchedName: companyName,
            contacts: contacts.slice(0, context.limit),
          });
          matchedContacts.push(...contacts.slice(0, context.limit));
        });
      } else {
        companiesNotFound.push(searchTerm);
      }
    }

    // Project fields
    const filter: ContactFilter = {
      fieldPreset: context.fieldPreset,
      limit: 1000,
      offset: 0,
    };
    const projected = matchedContacts.map(c => projectContactFields(c, filter));

    // Build stats
    const stats = Array.from(companiesFound.entries()).map(([companyName, data]) => ({
      searchedFor: context.companyNames.find(s =>
        companyName.toLowerCase().includes(s.toLowerCase())
      ) || companyName,
      matchedName: companyName,
      contactCount: data.contacts.length,
    }));

    return {
      contacts: projected,
      totalMatched: matchedContacts.length,
      companiesFound: stats,
      companiesNotFound,
    };
  },
});

/**
 * Tool: Search contacts by keywords or technologies (batch enrichment search)
 */
export const searchByEnrichmentTool = createTool({
  id: 'search-by-enrichment',
  description: `Search contacts by keywords, technologies, or industries using flexible matching.

Perfect for queries like:
- "Find all contacts working with payments, fintech, or blockchain"
- "Show me companies using Stripe or PayPal"
- "Get contacts in SaaS, software, or IT services"

Searches across keywords, technologies, and industry fields.`,
  inputSchema: z.object({
    searchTerms: z.array(z.string()).describe('Terms to search for in keywords, technologies, and industry'),
    searchFields: z.array(z.enum(['keywords', 'technologies', 'industry', 'title', 'companyName']))
      .default(['keywords', 'technologies', 'industry'])
      .describe('Which fields to search in'),
    matchAll: z.boolean().default(false).describe('If true, contact must match ALL terms (AND logic). If false, match ANY term (OR logic)'),
    fieldPreset: z.enum(['minimal', 'summary', 'detailed', 'full']).default('summary'),
    limit: z.number().default(100).describe('Max contacts to return'),
    additionalFilters: z.object({
      minQualityScore: z.number().optional(),
      isExecutive: z.boolean().optional(),
      country: z.string().optional(),
      contactState: z.string().optional(),
    }).optional().describe('Additional filters to apply'),
  }),
  outputSchema: z.object({
    contacts: z.array(ContactSchema.partial()),
    totalMatched: z.number(),
    matchBreakdown: z.record(z.string(), z.number()).describe('How many contacts matched each search term'),
  }),
  execute: async ({ context }) => {
    const allContacts = loadContactsFromCSV();
    const searchLower = context.searchTerms.map(s => s.toLowerCase().trim());

    const matchedContacts = allContacts.filter(contact => {
      // Helper to check if any search term matches a value
      const matchesValue = (value: string | string[] | undefined): boolean => {
        if (!value) return false;

        const values = Array.isArray(value) ? value : [value];
        const valuesLower = values.map(v => v.toLowerCase());

        if (context.matchAll) {
          // ALL search terms must match
          return searchLower.every(term =>
            valuesLower.some(val => val.includes(term))
          );
        } else {
          // ANY search term matches
          return searchLower.some(term =>
            valuesLower.some(val => val.includes(term))
          );
        }
      };

      // Check each field
      const matches: boolean[] = [];

      if (context.searchFields.includes('keywords') && contact.keywords) {
        matches.push(matchesValue(contact.keywords));
      }

      if (context.searchFields.includes('technologies') && contact.technologies) {
        matches.push(matchesValue(contact.technologies));
      }

      if (context.searchFields.includes('industry') && contact.industry) {
        matches.push(matchesValue(contact.industry));
      }

      if (context.searchFields.includes('title') && contact.title) {
        matches.push(matchesValue(contact.title));
      }

      if (context.searchFields.includes('companyName') && contact.companyName) {
        matches.push(matchesValue(contact.companyName));
      }

      // Must match in at least one field
      const fieldMatch = matches.some(m => m === true);
      if (!fieldMatch) return false;

      // Apply additional filters
      if (context.additionalFilters) {
        const filters = context.additionalFilters;

        if (filters.minQualityScore !== undefined && contact.qualityScore < filters.minQualityScore) {
          return false;
        }

        if (filters.isExecutive !== undefined && contact.isExecutive !== filters.isExecutive) {
          return false;
        }

        if (filters.country && contact.country !== filters.country) {
          return false;
        }

        if (filters.contactState && contact.contactState !== filters.contactState) {
          return false;
        }
      }

      return true;
    });

    // Calculate match breakdown
    const matchBreakdown: Record<string, number> = {};
    context.searchTerms.forEach(term => {
      const termLower = term.toLowerCase();
      matchBreakdown[term] = matchedContacts.filter(contact => {
        const checkValue = (value: string | string[] | undefined): boolean => {
          if (!value) return false;
          const values = Array.isArray(value) ? value : [value];
          return values.some(v => v.toLowerCase().includes(termLower));
        };

        return context.searchFields.some(field => {
          switch (field) {
            case 'keywords': return checkValue(contact.keywords);
            case 'technologies': return checkValue(contact.technologies);
            case 'industry': return checkValue(contact.industry);
            case 'title': return checkValue(contact.title);
            case 'companyName': return checkValue(contact.companyName);
            default: return false;
          }
        });
      }).length;
    });

    // Apply limit and project fields
    const limited = matchedContacts.slice(0, context.limit);
    const filter: ContactFilter = {
      fieldPreset: context.fieldPreset,
      limit: 1000,
      offset: 0,
    };
    const projected = limited.map(c => projectContactFields(c, filter));

    return {
      contacts: projected,
      totalMatched: matchedContacts.length,
      matchBreakdown,
    };
  },
});

/**
 * Tool: Get unique values for a field (useful for understanding data distribution)
 */
export const getUniqueValuesTool = createTool({
  id: 'get-unique-values',
  description: `Get all unique values for a specific field, useful for understanding what data is available.

Use this to discover:
- All company names in the database
- All industries represented
- All countries/cities available
- All technologies or keywords present

Returns sorted by frequency (most common first).`,
  inputSchema: z.object({
    field: z.enum([
      'companyName', 'industry', 'country', 'city', 'seniority',
      'companySizeBucket', 'stage', 'contactState', 'emailStatus'
    ]).describe('Field to get unique values for'),
    limit: z.number().default(100).describe('Max unique values to return'),
    minOccurrences: z.number().default(1).describe('Only return values that appear at least this many times'),
  }),
  outputSchema: z.object({
    field: z.string(),
    uniqueValues: z.array(z.object({
      value: z.string(),
      count: z.number(),
      percentage: z.number(),
    })),
    totalUnique: z.number(),
    totalContacts: z.number(),
  }),
  execute: async ({ context }) => {
    const contacts = loadContactsFromCSV();
    const valueCounts = new Map<string, number>();

    // Count occurrences
    contacts.forEach(contact => {
      const value = (contact as any)[context.field];
      if (value !== undefined && value !== null && value !== '') {
        const stringValue = String(value);
        valueCounts.set(stringValue, (valueCounts.get(stringValue) || 0) + 1);
      }
    });

    // Filter by min occurrences and sort by frequency
    const filtered = Array.from(valueCounts.entries())
      .filter(([_, count]) => count >= context.minOccurrences)
      .sort((a, b) => b[1] - a[1])
      .slice(0, context.limit);

    const uniqueValues = filtered.map(([value, count]) => ({
      value,
      count,
      percentage: Math.round((count / contacts.length) * 1000) / 10,
    }));

    return {
      field: context.field,
      uniqueValues,
      totalUnique: valueCounts.size,
      totalContacts: contacts.length,
    };
  },
});

/**
 * Tool: Semantic vector search for contacts
 */
export const vectorSearchContactsTool = createTool({
  id: 'vector-search-contacts',
  description: `Perform semantic vector search to find contacts based on natural language queries.

Perfect for queries like:
- "Find contacts similar to fintech payment companies"
- "Show me prospects working on AI-powered financial services"
- "Get contacts in the travel booking space"
- "Find CFOs at companies doing cross-border payments"

Uses semantic similarity instead of exact keyword matching, so it can understand context and intent.

IMPORTANT: You must run the embedding generation script first:
  bun run embeddings:generate

This searches across contact titles, companies, industries, keywords, and technologies.

Note: Uses OpenAI text-embedding-3-small model (requires OPENAI_API_KEY env var).`,
  inputSchema: z.object({
    query: z.string().describe('Natural language search query describing the contacts you want to find'),
    topK: z.number().default(20).describe('Number of similar contacts to return'),
    minScore: z.number().default(0.3).describe('Minimum similarity score (0-1). Higher = more similar. Default 0.3 filters weak matches.'),
    fieldPreset: z.enum(['minimal', 'summary', 'detailed', 'full']).default('summary'),
    additionalFilters: z.object({
      minQualityScore: z.number().optional(),
      isExecutive: z.boolean().optional(),
      country: z.string().optional(),
      contactState: z.string().optional(),
    }).optional().describe('Additional filters to apply after vector search'),
  }),
  outputSchema: z.object({
    contacts: z.array(ContactSchema.partial()),
    totalMatched: z.number(),
    searchQuery: z.string(),
    avgSimilarityScore: z.number(),
  }),
  execute: async ({ context }) => {
    try {
      // Generate embedding for the query
      const { embeddings } = await embedMany({
        model: openai.embedding('text-embedding-3-small'), // Must match the model used in generation (1536-dim)
        values: [context.query],
      });

      const queryVector = embeddings[0];

      // Query vector store
      const vectorStore = getVectorStore();
      const vectorResults = await vectorStore.query({
        indexName: CONTACT_VECTOR_CONFIG.indexName,
        queryVector,
        topK: context.topK,
        minScore: context.minScore,
        includeVector: false,
      });

      // Load full contact data
      const allContacts = loadContactsFromCSV();
      const contactMap = new Map(allContacts.map(c => [c.id, c]));

      // Match vector results to contacts
      let matchedContacts = vectorResults
        .map(result => {
          if (!result.metadata) return null;

          const contact = contactMap.get(result.metadata.contactId as string);
          if (!contact) return null;

          // Store similarity score
          (contact as any)._similarityScore = result.score;

          return contact;
        })
        .filter((c): c is Contact => c !== null);

      // Apply additional filters
      if (context.additionalFilters) {
        const filters = context.additionalFilters;

        matchedContacts = matchedContacts.filter(contact => {
          if (filters.minQualityScore !== undefined && contact.qualityScore < filters.minQualityScore) {
            return false;
          }

          if (filters.isExecutive !== undefined && contact.isExecutive !== filters.isExecutive) {
            return false;
          }

          if (filters.country && contact.country !== filters.country) {
            return false;
          }

          if (filters.contactState && contact.contactState !== filters.contactState) {
            return false;
          }

          return true;
        });
      }

      // Calculate average similarity
      const avgSimilarityScore = matchedContacts.length > 0
        ? matchedContacts.reduce((sum, c) => sum + ((c as any)._similarityScore || 0), 0) / matchedContacts.length
        : 0;

      // Project fields
      const filter: ContactFilter = {
        fieldPreset: context.fieldPreset,
        limit: 1000,
        offset: 0,
      };
      const projected = matchedContacts.map(c => {
        const proj = projectContactFields(c, filter);
        // Include similarity score in results
        (proj as any).similarityScore = (c as any)._similarityScore;
        return proj;
      });

      return {
        contacts: projected,
        totalMatched: matchedContacts.length,
        searchQuery: context.query,
        avgSimilarityScore: Math.round(avgSimilarityScore * 1000) / 1000,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';

      // Check if it's because embeddings haven't been generated yet
      if (message.includes('Table not found') || message.includes('no such table')) {
        throw new Error(
          `Vector index not found. Please run the embedding generation script first:\n` +
          `  bun run src/mastra/scripts/generate-embeddings.ts`
        );
      }

      throw new Error(`Vector search failed: ${message}`);
    }
  },
});

/**
 * Tool: Update contact state and track progression
 */
export const updateContactStateTool = createTool({
  id: 'update-contact-state',
  description: `Update a contact's state in the prospecting pipeline and track the change.

Use this to record when you:
- Send an email (NOT_CONTACTED → SENT)
- Get a response (SENT → REPLIED)
- Schedule a demo (REPLIED → DEMOED)
- Email bounces (SENT → BOUNCED)

This creates an audit trail of all contact state changes.`,
  inputSchema: StateUpdateSchema,
  outputSchema: z.object({
    success: z.boolean(),
    previousState: z.string(),
    newState: z.string(),
    message: z.string(),
  }),
  execute: async ({ context }) => {
    const contacts = loadContactsFromCSV();
    const contact = contacts.find((c) => c.id === context.contactId);

    if (!contact) {
      return {
        success: false,
        previousState: 'UNKNOWN',
        newState: context.newState,
        message: `Contact ${context.contactId} not found`,
      };
    }

    const previousState = contact.contactState;
    const timestamp = context.timestamp || new Date().toISOString();

    // Load state tracking
    const stateData = loadStateTracking();

    // Initialize contact tracking if doesn't exist
    if (!stateData.contacts[context.contactId]) {
      stateData.contacts[context.contactId] = {
        contactId: context.contactId,
        currentState: previousState,
        stateHistory: [],
        interactions: [],
        lastUpdated: timestamp,
      };
    }

    // Add state update to history
    const stateUpdate: StateUpdate = {
      contactId: context.contactId,
      newState: context.newState,
      note: context.note,
      metadata: context.metadata,
      timestamp,
    };

    stateData.contacts[context.contactId].currentState = context.newState;
    stateData.contacts[context.contactId].stateHistory.push(stateUpdate);
    stateData.contacts[context.contactId].lastUpdated = timestamp;

    // Save state tracking
    saveStateTracking(stateData);

    return {
      success: true,
      previousState,
      newState: context.newState,
      message: `Updated contact ${context.contactId} from ${previousState} to ${context.newState}`,
    };
  },
});

/**
 * Tool: Record an interaction with a contact
 */
export const recordInteractionTool = createTool({
  id: 'record-interaction',
  description: `Record any interaction with a contact for tracking and analysis.

Use this to log:
- Emails sent/received
- Calls made
- LinkedIn messages
- Meetings scheduled
- Notes added

This builds a complete interaction history for each contact.`,
  inputSchema: InteractionSchema,
  outputSchema: z.object({
    success: z.boolean(),
    interactionId: z.string(),
    message: z.string(),
  }),
  execute: async ({ context }) => {
    const contacts = loadContactsFromCSV();
    const contact = contacts.find((c) => c.id === context.contactId);

    if (!contact) {
      return {
        success: false,
        interactionId: '',
        message: `Contact ${context.contactId} not found`,
      };
    }

    // Generate interaction ID
    const interactionId = `int_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = context.timestamp || new Date().toISOString();

    // Load state tracking
    const stateData = loadStateTracking();

    // Initialize contact tracking if doesn't exist
    if (!stateData.contacts[context.contactId]) {
      stateData.contacts[context.contactId] = {
        contactId: context.contactId,
        currentState: contact.contactState,
        stateHistory: [],
        interactions: [],
        lastUpdated: timestamp,
      };
    }

    // Create interaction record
    const interaction: Interaction = {
      id: interactionId,
      contactId: context.contactId,
      timestamp,
      type: context.type,
      subject: context.subject,
      content: context.content,
      metadata: context.metadata,
      previousState: context.previousState,
      newState: context.newState,
      previousStage: context.previousStage,
      newStage: context.newStage,
      performedBy: context.performedBy,
      channel: context.channel,
    };

    // Add interaction to history
    stateData.contacts[context.contactId].interactions.push(interaction);
    stateData.contacts[context.contactId].lastUpdated = timestamp;

    // If state changed, update it
    if (context.newState && context.newState !== stateData.contacts[context.contactId].currentState) {
      stateData.contacts[context.contactId].currentState = context.newState;
    }

    // Save state tracking
    saveStateTracking(stateData);

    return {
      success: true,
      interactionId,
      message: `Recorded ${context.type} interaction for contact ${context.contactId}`,
    };
  },
});

/**
 * Tool: Get contact history (state changes and interactions)
 */
export const getContactHistoryTool = createTool({
  id: 'get-contact-history',
  description: `Get the complete history of state changes and interactions for a contact.

Use this to:
- Review what's been done with a contact
- Check when last contacted
- Analyze interaction patterns
- Plan next steps`,
  inputSchema: z.object({
    contactId: z.string().describe('Contact ID to get history for'),
    includeInteractions: z.boolean().default(true).describe('Include full interaction log'),
    includeStateHistory: z.boolean().default(true).describe('Include state change history'),
  }),
  outputSchema: z.object({
    contactId: z.string(),
    currentState: z.string(),
    stateHistory: z.array(StateUpdateSchema).optional(),
    interactions: z.array(InteractionSchema).optional(),
    lastUpdated: z.string(),
    totalInteractions: z.number(),
    found: z.boolean(),
  }),
  execute: async ({ context }) => {
    const stateData = loadStateTracking();
    const tracking = stateData.contacts[context.contactId];

    if (!tracking) {
      return {
        contactId: context.contactId,
        currentState: 'UNKNOWN',
        stateHistory: [],
        interactions: [],
        lastUpdated: new Date().toISOString(),
        totalInteractions: 0,
        found: false,
      };
    }

    return {
      contactId: tracking.contactId,
      currentState: tracking.currentState,
      stateHistory: context.includeStateHistory ? tracking.stateHistory : undefined,
      interactions: context.includeInteractions ? tracking.interactions : undefined,
      lastUpdated: tracking.lastUpdated,
      totalInteractions: tracking.interactions.length,
      found: true,
    };
  },
});

/**
 * Tool: Generate personalized outreach using AI
 */
export const generateOutreachTool = createTool({
  id: 'generate-outreach',
  description: `Generate personalized outreach messages using AI based on contact data.

The AI analyzes:
- Contact's role, seniority, company
- Keywords associated with their work
- Technologies they use
- Company industry and size
- Previous interactions (if any)

And creates tailored messages that:
- Reference relevant pain points
- Mention specific technologies/tools
- Use appropriate tone for their seniority
- Include compelling CTAs

Use this to create highly personalized outreach at scale.`,
  inputSchema: OutreachRequestSchema,
  outputSchema: GeneratedOutreachSchema,
  execute: async ({ context, mastra }) => {
    const contacts = loadContactsFromCSV();
    const contact = contacts.find((c) => c.id === context.contactId);

    if (!contact) {
      throw new Error(`Contact ${context.contactId} not found`);
    }

    // Get interaction history
    const stateData = loadStateTracking();
    const tracking = stateData.contacts[context.contactId];

    // Build context for AI
    const contextData = {
      contact: {
        name: `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || 'there',
        title: contact.title,
        seniority: contact.seniority,
        company: contact.companyName,
        industry: contact.industry,
        companySize: contact.companySizeBucket,
        location: contact.country,
      },
      enrichment: {
        keywords: contact.keywords?.slice(0, 10) || [], // Top 10 keywords
        technologies: contact.technologies?.slice(0, 8) || [], // Top 8 technologies
        funding: contact.totalFunding,
        linkedIn: contact.linkedinUrl,
      },
      history: tracking ? {
        interactions: tracking.interactions.length,
        lastContacted: tracking.lastUpdated,
        currentState: tracking.currentState,
      } : null,
    };

    // Generate outreach using AI
    const prompt = `You are an expert sales outreach specialist for Wedi Pay, a payment orchestration platform focused on LATAM markets.

Generate a ${context.style} ${context.channel} message for this prospect:

PROSPECT INFO:
Name: ${contextData.contact.name}
Title: ${contextData.contact.title || 'Unknown'}
Company: ${contextData.contact.company || 'Unknown'}
Industry: ${contextData.contact.industry || 'Unknown'}
Company Size: ${contextData.contact.companySize || 'Unknown'}
Location: ${contextData.contact.location || 'Unknown'}

ENRICHMENT DATA:
Keywords: ${contextData.enrichment.keywords.length > 0 ? contextData.enrichment.keywords.join(', ') : 'None'}
Technologies: ${contextData.enrichment.technologies.length > 0 ? contextData.enrichment.technologies.join(', ') : 'None'}
Funding: ${contextData.enrichment.funding ? `$${contextData.enrichment.funding.toLocaleString()}` : 'Unknown'}

${contextData.history ? `INTERACTION HISTORY:
Previous interactions: ${contextData.history.interactions}
Last contacted: ${contextData.history.lastContacted}
Current state: ${contextData.history.currentState}` : 'This is a first contact.'}

${context.focus ? `FOCUS AREA: ${context.focus}` : ''}

WEDI PAY VALUE PROP:
- Payment orchestration for LATAM markets
- Support for local payment methods
- Multi-currency processing
- Simplified integration
- Reduces payment complexity

INSTRUCTIONS:
1. ${context.channel === 'email' ? 'Create subject line and email body' : 'Create message'}
2. Use ${context.style} tone appropriate for ${contextData.contact.seniority || 'their role'}
3. Reference their specific tech stack or keywords if relevant
4. ${context.includeCallToAction ? 'Include a clear, specific call-to-action' : 'Keep it informational'}
5. Keep under ${context.maxLength || 200} words
6. Be genuine, not salesy
7. Focus on their pain points, not features

Return a JSON object with:
- subject (for email) or null
- message (the body)
- personalizationUsed (array of strings: which data points you leveraged)
- reasoning (brief explanation of your approach)
- suggestedFollowUpDays (number of days before follow-up if no response)`;

    try {
      const model = anthropic('claude-sonnet-4-5');
      const { text } = await generateText({
        model,
        prompt,
        temperature: 0.7,
      });

      // Parse AI response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('AI did not return valid JSON');
      }

      const result = JSON.parse(jsonMatch[0]);

      return {
        contactId: context.contactId,
        subject: result.subject || undefined,
        message: result.message,
        personalizationUsed: result.personalizationUsed || [],
        reasoning: result.reasoning || 'Generated based on contact data',
        suggestedFollowUpDays: result.suggestedFollowUpDays || 3,
      };
    } catch (error) {
      console.error('Error generating outreach:', error);
      throw new Error(`Failed to generate outreach: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },
});
