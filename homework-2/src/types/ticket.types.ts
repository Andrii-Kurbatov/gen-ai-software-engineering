import { z } from 'zod';

export const CategorySchema = z.enum([
  'account_access',
  'technical_issue',
  'billing_question',
  'feature_request',
  'bug_report',
  'other',
]);

export const PrioritySchema = z.enum(['urgent', 'high', 'medium', 'low']);

export const StatusSchema = z.enum([
  'new',
  'in_progress',
  'waiting_customer',
  'resolved',
  'closed',
]);

export const SourceSchema = z.enum(['web_form', 'email', 'api', 'chat', 'phone']);

export const DeviceTypeSchema = z.enum(['desktop', 'mobile', 'tablet']);

export const MetadataSchema = z
  .object({
    source: SourceSchema.optional(),
    browser: z.string().optional(),
    device_type: DeviceTypeSchema.optional(),
  })
  .default({});

export const TicketSchema = z.object({
  id: z.string().uuid(),
  customer_id: z.string().nullable(),
  customer_email: z.string().email(),
  customer_name: z.string().nullable(),
  subject: z.string().min(1).max(200),
  description: z.string().min(10).max(2000),
  category: CategorySchema.nullable(),
  priority: PrioritySchema,
  status: StatusSchema,
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  resolved_at: z.string().datetime().nullable(),
  assigned_to: z.string().nullable(),
  tags: z.array(z.string()),
  metadata: MetadataSchema,
  classification_confidence: z.number().min(0).max(1).nullable(),
});

export const CreateTicketSchema = z.object({
  customer_id: z.string().optional(),
  customer_email: z.string().email(),
  customer_name: z.string().optional(),
  subject: z.string().min(1).max(200),
  description: z.string().min(10).max(2000),
  category: CategorySchema.optional(),
  priority: PrioritySchema.optional().default('medium'),
  status: StatusSchema.optional().default('new'),
  assigned_to: z.string().optional(),
  tags: z.array(z.string()).optional().default([]),
  metadata: MetadataSchema.optional().default({}),
});

export const UpdateTicketSchema = z
  .object({
    customer_id: z.string().optional(),
    customer_email: z.string().email().optional(),
    customer_name: z.string().optional(),
    subject: z.string().min(1).max(200).optional(),
    description: z.string().min(10).max(2000).optional(),
    category: CategorySchema.nullable().optional(),
    priority: PrioritySchema.optional(),
    status: StatusSchema.optional(),
    assigned_to: z.string().nullable().optional(),
    tags: z.array(z.string()).optional(),
    metadata: MetadataSchema.optional(),
  })
  .strict()
  .refine(
    (data) => Object.keys(data).length > 0,
    { message: 'At least one field must be provided for update' }
  );

export const TicketFiltersSchema = z.object({
  status: StatusSchema.optional(),
  category: CategorySchema.optional(),
  priority: PrioritySchema.optional(),
  assigned_to: z.string().optional(),
});

export const ClassificationResultSchema = z.object({
  ticket_id: z.string().uuid(),
  category: CategorySchema,
  priority: PrioritySchema,
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
  keywords: z.array(z.string()),
});

export const ImportErrorSchema = z.object({
  row: z.number().int().positive(),
  record: z.record(z.string(), z.unknown()),
  errors: z.array(z.string()),
});

export const ImportResultSchema = z.object({
  total: z.number().int().nonnegative(),
  successful: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  errors: z.array(ImportErrorSchema),
});

export type Category = z.infer<typeof CategorySchema>;
export type Priority = z.infer<typeof PrioritySchema>;
export type Status = z.infer<typeof StatusSchema>;
export type Source = z.infer<typeof SourceSchema>;
export type DeviceType = z.infer<typeof DeviceTypeSchema>;
export type Metadata = z.infer<typeof MetadataSchema>;
export type Ticket = z.infer<typeof TicketSchema>;
export type CreateTicketDTO = z.infer<typeof CreateTicketSchema>;
export type UpdateTicketDTO = z.infer<typeof UpdateTicketSchema>;
export type TicketFilters = z.infer<typeof TicketFiltersSchema>;
export type ClassificationResult = z.infer<typeof ClassificationResultSchema>;
export type ImportError = z.infer<typeof ImportErrorSchema>;
export type ImportResult = z.infer<typeof ImportResultSchema>;

export type ImportFormat = 'csv' | 'json' | 'xml';
export type RawRecord = Record<string, unknown>;

// Internal type used by TicketService → TicketRepository.
// Not exposed via HTTP — resolved_at is set by service logic, not by callers.
export type InternalUpdatePatch = UpdateTicketDTO & { resolved_at?: string | null };
