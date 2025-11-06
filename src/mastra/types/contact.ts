import { z } from 'zod';

/**
 * Contact State represents the interaction state in the prospecting funnel
 * Based on analysis of 1,452 Apollo contacts
 */
export const ContactStateEnum = z.enum([
  'NOT_CONTACTED',
  'INTERESTED_NOT_CONTACTED',
  'SENT',
  'OPENED',
  'BOUNCED',
  'REPLIED',
  'DEMOED',
  'INCOMPLETE',
]);

export type ContactState = z.infer<typeof ContactStateEnum>;

/**
 * Stage represents the manual classification/qualification stage
 */
export const StageEnum = z.enum([
  'Cold',
  'Interested',
  'Approaching',
  'Replied',
  'Qualified',
  'Negotiation',
  'Closed Won',
  'Closed Lost',
]);

export type Stage = z.infer<typeof StageEnum>;

/**
 * Seniority levels from Apollo data
 */
export const SeniorityEnum = z.enum([
  'Entry',
  'Manager',
  'Senior',
  'Director',
  'Head',
  'Vp',
  'C suite',
  'Founder',
  'Partner',
  'Owner',
]);

export type Seniority = z.infer<typeof SeniorityEnum>;

/**
 * Email status from Apollo
 */
export const EmailStatusEnum = z.enum([
  'Verified',
  'User Managed',
  'Unavailable',
  'Extrapolated',
  'Email No Longer Verified',
  'New Data Available',
]);

export type EmailStatus = z.infer<typeof EmailStatusEnum>;

/**
 * Catchall status indicates if email domain accepts all addresses
 */
export const CatchallStatusEnum = z.enum([
  'Not Catch-all',
  'Catch-all',
  'Unknown',
]);

export type CatchallStatus = z.infer<typeof CatchallStatusEnum>;

/**
 * Company size classification
 */
export const CompanySizeEnum = z.enum([
  'Unknown',
  '1-10 (Micro)',
  '11-50 (Small)',
  '51-200 (Medium)',
  '201-500 (Large)',
  '500+ (Enterprise)',
]);

export type CompanySize = z.infer<typeof CompanySizeEnum>;

/**
 * Core Contact schema - represents a prospect in the prospecting system
 */
export const ContactSchema = z.object({
  // Identity
  id: z.string().describe('Unique contact identifier (Apollo Contact Id)'),
  firstName: z.string().optional().describe('Contact first name'),
  lastName: z.string().optional().describe('Contact last name'),
  email: z.string().email().describe('Primary email address'),

  // Email metadata
  emailStatus: EmailStatusEnum.describe('Email verification status'),
  emailCatchall: CatchallStatusEnum.optional().describe('Whether email domain is catchall'),
  emailLastVerified: z.string().datetime().optional().describe('Last email verification timestamp'),
  secondaryEmail: z.string().email().optional().describe('Secondary email address'),

  // Professional info
  title: z.string().optional().describe('Job title'),
  seniority: SeniorityEnum.optional().describe('Seniority level'),
  departments: z.array(z.string()).optional().describe('Departments (e.g., C-Suite, Engineering)'),
  linkedinUrl: z.string().url().optional().describe('LinkedIn profile URL'),

  // Contact info
  mobilePhone: z.string().optional().describe('Mobile phone number'),
  workPhone: z.string().optional().describe('Work direct phone number'),
  corporatePhone: z.string().optional().describe('Corporate phone number'),

  // Location
  city: z.string().optional().describe('Contact city'),
  state: z.string().optional().describe('Contact state/province'),
  country: z.string().optional().describe('Contact country'),

  // Company info
  companyName: z.string().optional().describe('Company name'),
  companyWebsite: z.string().url().optional().describe('Company website'),
  companyLinkedinUrl: z.string().url().optional().describe('Company LinkedIn URL'),
  companyAddress: z.string().optional().describe('Full company address'),
  companyCity: z.string().optional().describe('Company city'),
  companyState: z.string().optional().describe('Company state'),
  companyCountry: z.string().optional().describe('Company country'),
  companyPhone: z.string().optional().describe('Company phone number'),
  companySize: z.number().optional().describe('Number of employees'),
  companySizeBucket: CompanySizeEnum.optional().describe('Company size classification'),
  industry: z.string().optional().describe('Company industry'),

  // Company enrichment
  technologies: z.array(z.string()).optional().describe('Technology stack used by company'),
  keywords: z.array(z.string()).optional().describe('Keywords associated with company/contact'),
  annualRevenue: z.number().optional().describe('Annual revenue in USD'),
  totalFunding: z.number().optional().describe('Total funding raised'),
  latestFunding: z.string().optional().describe('Latest funding round type'),
  latestFundingAmount: z.number().optional().describe('Latest funding amount'),
  lastRaisedAt: z.string().datetime().optional().describe('Date of last funding round'),

  // Social
  facebookUrl: z.string().url().optional().describe('Facebook profile/page URL'),
  twitterUrl: z.string().url().optional().describe('Twitter profile URL'),

  // Prospecting state
  stage: StageEnum.describe('Current stage in sales pipeline'),
  contactState: ContactStateEnum.describe('Current interaction state'),
  lists: z.array(z.string()).describe('Lists this contact belongs to'),

  // Interaction tracking
  emailSent: z.boolean().default(false).describe('Whether an email has been sent'),
  emailOpen: z.boolean().default(false).describe('Whether email was opened'),
  emailBounced: z.boolean().default(false).describe('Whether email bounced'),
  replied: z.boolean().default(false).describe('Whether contact replied'),
  demoed: z.boolean().default(false).describe('Whether a demo was conducted'),
  lastContacted: z.string().datetime().optional().describe('Last contact timestamp'),

  // Computed fields
  qualityScore: z.number().min(0).max(100).describe('Contact quality score (0-100)'),
  isExecutive: z.boolean().describe('Whether contact is C-suite/Founder'),

  // Metadata
  apolloAccountId: z.string().optional().describe('Apollo Account ID'),
  contactOwner: z.string().optional().describe('Owner/assignee of this contact'),
  accountOwner: z.string().optional().describe('Account owner'),

  // Timestamps
  createdAt: z.string().datetime().optional().describe('Record creation timestamp'),
  updatedAt: z.string().datetime().optional().describe('Last update timestamp'),
});

export type Contact = z.infer<typeof ContactSchema>;

/**
 * Contact interaction event - tracks all interactions with a contact
 */
export const InteractionSchema = z.object({
  id: z.string().describe('Unique interaction ID'),
  contactId: z.string().describe('Associated contact ID'),
  timestamp: z.string().datetime().describe('When the interaction occurred'),
  type: z.enum([
    'EMAIL_SENT',
    'EMAIL_OPENED',
    'EMAIL_BOUNCED',
    'EMAIL_REPLIED',
    'DEMO_SCHEDULED',
    'DEMO_COMPLETED',
    'CALL_MADE',
    'CALL_RECEIVED',
    'MEETING_SCHEDULED',
    'MEETING_COMPLETED',
    'NOTE_ADDED',
    'STAGE_CHANGED',
    'STATE_CHANGED',
  ]).describe('Type of interaction'),

  // Details
  subject: z.string().optional().describe('Email subject or interaction title'),
  content: z.string().optional().describe('Email body or interaction content'),
  metadata: z.record(z.string(), z.unknown()).optional().describe('Additional metadata'),

  // State transition
  previousState: ContactStateEnum.optional().describe('State before this interaction'),
  newState: ContactStateEnum.optional().describe('State after this interaction'),
  previousStage: StageEnum.optional().describe('Stage before this interaction'),
  newStage: StageEnum.optional().describe('Stage after this interaction'),

  // Attribution
  performedBy: z.string().optional().describe('Who performed the interaction'),
  channel: z.enum(['email', 'phone', 'linkedin', 'meeting', 'manual']).describe('Channel used'),
});

export type Interaction = z.infer<typeof InteractionSchema>;

/**
 * State transition definition
 */
export const StateTransitionSchema = z.object({
  from: ContactStateEnum,
  to: ContactStateEnum,
  trigger: z.string().describe('What triggered this transition'),
  conditions: z.array(z.string()).optional().describe('Conditions that must be met'),
  actions: z.array(z.string()).optional().describe('Actions to take on transition'),
});

export type StateTransition = z.infer<typeof StateTransitionSchema>;

/**
 * Valid state transitions based on analysis
 */
export const validStateTransitions: StateTransition[] = [
  {
    from: 'NOT_CONTACTED',
    to: 'SENT',
    trigger: 'send_initial_email',
    conditions: ['has_verified_email', 'not_bounced_before'],
    actions: ['record_email_sent', 'schedule_followup'],
  },
  {
    from: 'INTERESTED_NOT_CONTACTED',
    to: 'SENT',
    trigger: 'send_targeted_email',
    conditions: ['has_verified_email', 'stage_is_interested'],
    actions: ['record_email_sent', 'schedule_followup'],
  },
  {
    from: 'SENT',
    to: 'OPENED',
    trigger: 'email_opened',
    actions: ['record_email_open', 'update_engagement_score'],
  },
  {
    from: 'SENT',
    to: 'BOUNCED',
    trigger: 'email_bounced',
    actions: ['record_bounce', 'mark_email_invalid', 'research_correct_email'],
  },
  {
    from: 'SENT',
    to: 'REPLIED',
    trigger: 'email_replied',
    actions: ['record_reply', 'update_stage', 'schedule_followup'],
  },
  {
    from: 'OPENED',
    to: 'REPLIED',
    trigger: 'email_replied',
    actions: ['record_reply', 'update_stage', 'schedule_followup'],
  },
  {
    from: 'OPENED',
    to: 'DEMOED',
    trigger: 'demo_completed',
    actions: ['record_demo', 'update_stage_to_qualified'],
  },
  {
    from: 'REPLIED',
    to: 'DEMOED',
    trigger: 'demo_completed',
    actions: ['record_demo', 'update_stage_to_qualified'],
  },
  {
    from: 'BOUNCED',
    to: 'SENT',
    trigger: 'email_corrected_and_sent',
    conditions: ['new_email_verified'],
    actions: ['record_email_sent', 'clear_bounce_flag'],
  },
];

/**
 * Flexible query operator for dynamic filtering
 */
export const QueryOperatorEnum = z.enum([
  'equals',           // field === value
  'notEquals',        // field !== value
  'contains',         // string.includes(value)
  'notContains',      // !string.includes(value)
  'startsWith',       // string.startsWith(value)
  'endsWith',         // string.endsWith(value)
  'gt',               // field > value (greater than)
  'gte',              // field >= value (greater than or equal)
  'lt',               // field < value (less than)
  'lte',              // field <= value (less than or equal)
  'in',               // value in array
  'notIn',            // value not in array
  'arrayContains',    // array.includes(value) - for keywords, technologies, etc.
  'arrayContainsAny', // array.some(v => values.includes(v))
  'arrayContainsAll', // values.every(v => array.includes(v))
  'exists',           // field !== undefined && field !== null
  'notExists',        // field === undefined || field === null
]);

export type QueryOperator = z.infer<typeof QueryOperatorEnum>;

/**
 * Single where clause condition
 */
export const WhereClauseSchema = z.object({
  field: z.string().describe('Field name to query (e.g., "keywords", "companyName", "qualityScore")'),
  operator: QueryOperatorEnum.describe('Comparison operator'),
  value: z.any().optional().describe('Value to compare against (for single value operators)'),
  values: z.array(z.any()).optional().describe('Array of values (for arrayContainsAny, arrayContainsAll, in, notIn)'),
});

export type WhereClause = z.infer<typeof WhereClauseSchema>;

/**
 * Contact filter/query options
 */
export const ContactFilterSchema = z.object({
  // Legacy simple filters (kept for backward compatibility and convenience)
  stage: StageEnum.optional().describe('DEPRECATED: Use where clause instead'),
  contactState: ContactStateEnum.optional().describe('DEPRECATED: Use where clause instead'),
  seniority: SeniorityEnum.optional().describe('DEPRECATED: Use where clause instead'),
  emailStatus: EmailStatusEnum.optional().describe('DEPRECATED: Use where clause instead'),
  lists: z.array(z.string()).optional().describe('DEPRECATED: Use where clause instead'),
  country: z.string().optional().describe('DEPRECATED: Use where clause instead'),
  industry: z.string().optional().describe('DEPRECATED: Use where clause instead'),
  minQualityScore: z.number().min(0).max(100).optional().describe('DEPRECATED: Use where clause instead'),
  isExecutive: z.boolean().optional().describe('DEPRECATED: Use where clause instead'),
  companySizeBucket: CompanySizeEnum.optional().describe('DEPRECATED: Use where clause instead'),
  hasKeywords: z.boolean().optional().describe('DEPRECATED: Use where clause instead'),
  hasTechnologies: z.boolean().optional().describe('DEPRECATED: Use where clause instead'),
  notContactedOnly: z.boolean().optional().describe('DEPRECATED: Use where clause instead'),

  // New flexible query system (RECOMMENDED)
  where: z.array(WhereClauseSchema).optional().describe(
    'Flexible query conditions - supports ANY field with various operators. Multiple conditions are AND-ed together.'
  ),

  // Pagination
  limit: z.number().min(1).max(1000).default(100).describe('Maximum number of results to return'),
  offset: z.number().min(0).default(0).describe('Number of results to skip (for pagination)'),

  // Field selection to reduce context size
  fieldPreset: z.enum(['minimal', 'summary', 'detailed', 'full']).default('summary').describe(
    'Field preset: minimal (7 fields), summary (14 fields, default), detailed (22 fields), full (all fields)'
  ),
  includeFields: z.array(z.string()).optional().describe('Additional fields to include'),
  excludeFields: z.array(z.string()).optional().describe('Fields to exclude'),
});

export type ContactFilter = z.infer<typeof ContactFilterSchema>;

/**
 * Field selection for projecting contact data
 * Helps reduce context size by only returning needed fields
 */
export const ContactFieldsEnum = z.enum([
  // Identity
  'id',
  'firstName',
  'lastName',
  'email',
  // Email metadata (minimal)
  'emailStatus',
  'emailCatchall',
  // Professional info
  'title',
  'seniority',
  'departments',
  'linkedinUrl',
  // Location
  'city',
  'state',
  'country',
  // Company info (core)
  'companyName',
  'companyWebsite',
  'companySizeBucket',
  'industry',
  // Prospecting state
  'stage',
  'contactState',
  'lists',
  // Computed fields
  'qualityScore',
  'isExecutive',
  // Enrichment (typically excluded from summaries)
  'technologies',
  'keywords',
  // All other fields...
]);

/**
 * Predefined field sets for common use cases
 */
export const FieldPresets = {
  // Minimal: Just enough to identify and reach out to a contact
  minimal: ['id', 'firstName', 'lastName', 'email', 'title', 'companyName', 'qualityScore'] as const,

  // Summary: Good for lists and overviews
  summary: [
    'id',
    'firstName',
    'lastName',
    'email',
    'emailStatus',
    'title',
    'seniority',
    'companyName',
    'companySizeBucket',
    'industry',
    'country',
    'stage',
    'contactState',
    'qualityScore',
    'isExecutive',
  ] as const,

  // Detailed: Most fields except massive arrays
  detailed: [
    'id',
    'firstName',
    'lastName',
    'email',
    'emailStatus',
    'emailCatchall',
    'title',
    'seniority',
    'departments',
    'linkedinUrl',
    'city',
    'state',
    'country',
    'companyName',
    'companyWebsite',
    'companyLinkedinUrl',
    'companySizeBucket',
    'industry',
    'stage',
    'contactState',
    'lists',
    'qualityScore',
    'isExecutive',
    'totalFunding',
    'latestFunding',
  ] as const,

  // Full: Everything (use sparingly!)
  full: null, // null means return all fields
} as const;

export type ContactFieldPreset = keyof typeof FieldPresets;

/**
 * Field selection schema for queries
 */
export const FieldSelectionSchema = z.object({
  preset: z.enum(['minimal', 'summary', 'detailed', 'full']).default('summary').describe(
    'Predefined field set: minimal (7 fields), summary (14 fields), detailed (~22 fields), full (all fields)'
  ),
  includeFields: z.array(z.string()).optional().describe(
    'Additional fields to include beyond the preset'
  ),
  excludeFields: z.array(z.string()).optional().describe(
    'Fields to exclude from the preset'
  ),
});

export type FieldSelection = z.infer<typeof FieldSelectionSchema>;

/**
 * Outreach campaign configuration
 */
export const OutreachCampaignSchema = z.object({
  id: z.string(),
  name: z.string().describe('Campaign name'),
  targetFilter: ContactFilterSchema.describe('Filter criteria for target contacts'),
  emailTemplate: z.object({
    subject: z.string(),
    body: z.string(),
    variables: z.array(z.string()).optional().describe('Variables to personalize (e.g., {{firstName}})'),
  }),
  schedule: z.object({
    startDate: z.string().datetime(),
    endDate: z.string().datetime().optional(),
    maxPerDay: z.number().min(1).default(50),
  }),
  followupSequence: z.array(z.object({
    delayDays: z.number().min(1),
    condition: z.string().describe('Condition to send followup (e.g., "no_reply")'),
    emailTemplate: z.object({
      subject: z.string(),
      body: z.string(),
    }),
  })).optional(),
  status: z.enum(['draft', 'active', 'paused', 'completed']),
  stats: z.object({
    totalContacts: z.number().default(0),
    sent: z.number().default(0),
    opened: z.number().default(0),
    replied: z.number().default(0),
    bounced: z.number().default(0),
  }).optional(),
});

export type OutreachCampaign = z.infer<typeof OutreachCampaignSchema>;

/**
 * State update request - for tracking contact progression
 */
export const StateUpdateSchema = z.object({
  contactId: z.string().describe('Contact ID to update'),
  newState: ContactStateEnum.describe('New state to transition to'),
  note: z.string().optional().describe('Note about why state changed'),
  metadata: z.record(z.string(), z.any()).optional().describe('Additional context (campaign, template, etc.)'),
  timestamp: z.string().datetime().optional().describe('When this happened (defaults to now)'),
});

export type StateUpdate = z.infer<typeof StateUpdateSchema>;

/**
 * Outreach request for AI-powered message generation
 */
export const OutreachRequestSchema = z.object({
  contactId: z.string().describe('Contact ID to generate outreach for'),
  style: z.enum(['professional', 'casual', 'friendly', 'direct']).default('professional').describe('Tone of message'),
  focus: z.string().optional().describe('What to focus on (e.g., "payment integration", "LATAM expansion")'),
  channel: z.enum(['email', 'linkedin', 'twitter']).default('email').describe('Channel for outreach'),
  includeCallToAction: z.boolean().default(true).describe('Include a CTA'),
  maxLength: z.number().default(200).optional().describe('Max words for message'),
});

export type OutreachRequest = z.infer<typeof OutreachRequestSchema>;

/**
 * Generated outreach message
 */
export const GeneratedOutreachSchema = z.object({
  contactId: z.string(),
  subject: z.string().optional().describe('Email subject line (for email channel)'),
  message: z.string().describe('Generated message body'),
  personalizationUsed: z.array(z.string()).describe('Which data points were used (keywords, tech, etc.)'),
  reasoning: z.string().describe('Why this approach was chosen'),
  suggestedFollowUpDays: z.number().optional().describe('Suggested days before follow-up'),
});

export type GeneratedOutreach = z.infer<typeof GeneratedOutreachSchema>;
