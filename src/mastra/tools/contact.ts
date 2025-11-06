import { createTool } from '@mastra/core';
import { z } from 'zod';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { parse } from 'csv-parse/sync';
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
