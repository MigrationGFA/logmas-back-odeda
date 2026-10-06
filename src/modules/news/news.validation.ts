// src/modules/news/news.validation.ts
import { z } from 'zod';

export const NEWS_TAGS = [
  'Announcement',
  'Event',
  'Project',
  'Health',
  'Culture',
  'Empowerment',
  'Revenue',
] as const;

export const NEWS_STATUSES = ['draft', 'published', 'archived'] as const;

// POST /lga/news — client must never send authorId/authorName/slug
// (.strip() drops any such keys instead of rejecting, so legacy payloads pass).
export const createNewsSchema = z
  .object({
    title: z.string().min(5).max(180),
    excerpt: z.string().max(280).optional(),
    body: z.string().min(20),
    tag: z.enum(NEWS_TAGS),
    coverImageUrl: z.string().min(1).nullable().optional(),
    status: z.enum(NEWS_STATUSES).optional().default('draft'),
    publishedAt: z.string().min(1).nullable().optional(),
  })
  .strip();

// PATCH /lga/news/:id — partial of the above; same strip.
export const updateNewsSchema = createNewsSchema.partial();

export type CreateNewsInput = z.infer<typeof createNewsSchema>;
export type UpdateNewsInput = z.infer<typeof updateNewsSchema>;
