// src/modules/news/news.service.ts
import crypto from 'crypto';
import { prisma } from '../../utils/prisma';

export const newsSelect = {
  id: true,
  slug: true,
  title: true,
  excerpt: true,
  body: true,
  tag: true,
  coverImageUrl: true,
  status: true,
  publishedAt: true,
  authorId: true,
  authorName: true,
  createdAt: true,
  updatedAt: true,
} as const;

export interface NewsListParams {
  tag?: string;
  search?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export const slugify = (title: string): string => {
  const base = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-')
    .slice(0, 60)
    .replace(/-+$/, '');
  return base || 'article';
};

export const generateUniqueSlug = async (title: string): Promise<string> => {
  const base = slugify(title);
  let slug = base;
  for (let i = 0; i < 10; i++) {
    const existing = await prisma.news.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!existing) return slug;
    slug = `${base}-${crypto.randomBytes(2).toString('hex')}`;
  }
  return `${base}-${Date.now().toString(36)}-${crypto.randomBytes(2).toString('hex')}`;
};

export const buildExcerpt = (body: string, excerpt?: string | null): string => {
  if (excerpt && excerpt.trim()) return excerpt.trim();
  return body.trim().slice(0, 160);
};

export const resolvePublishedAt = (
  status: string,
  input?: string | null,
): Date | null => {
  if (input) {
    const d = new Date(input);
    if (!isNaN(d.getTime())) return d;
  }
  if (status === 'published') return new Date();
  return null;
};

const resolveAuthorName = async (userId: string): Promise<string> => {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { firstName: true, lastName: true, email: true },
  });
  if (!u) return 'LGA Admin';
  const full = `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim();
  return full || u.email || 'LGA Admin';
};

export const listPublicNews = async (params: NewsListParams) => {
  const { page, limit } = clampPageLimit(params.page, params.limit);
  const skip = (page - 1) * limit;

  const where: any = { status: 'published', deletedAt: null };
  if (params.tag && params.tag !== 'All') where.tag = params.tag;
  if (params.search && params.search.trim()) {
    const q = params.search.trim();
    where.OR = [
      { title: { contains: q, mode: 'insensitive' } },
      { excerpt: { contains: q, mode: 'insensitive' } },
    ];
  }

  const [data, total] = await Promise.all([
    prisma.news.findMany({
      where,
      skip,
      take: limit,
      select: newsSelect,
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
    }),
    prisma.news.count({ where }),
  ]);

  return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
};

export const listAdminNews = async (params: NewsListParams) => {
  const { page, limit } = clampPageLimit(params.page, params.limit);
  const skip = (page - 1) * limit;

  const where: any = { deletedAt: null };
  if (params.status) where.status = params.status;
  if (params.tag && params.tag !== 'All') where.tag = params.tag;
  if (params.search && params.search.trim()) {
    const q = params.search.trim();
    where.OR = [
      { title: { contains: q, mode: 'insensitive' } },
      { excerpt: { contains: q, mode: 'insensitive' } },
    ];
  }

  const [data, total] = await Promise.all([
    prisma.news.findMany({
      where,
      skip,
      take: limit,
      select: newsSelect,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.news.count({ where }),
  ]);

  return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
};

export const getPublicBySlug = async (slug: string) => {
  return prisma.news.findFirst({
    where: { slug, status: 'published', deletedAt: null },
    select: newsSelect,
  });
};

export const getById = async (id: string) => {
  return prisma.news.findFirst({
    where: { id, deletedAt: null },
    select: newsSelect,
  });
};

export const createNews = async (
  input: {
    title: string;
    excerpt?: string | null;
    body: string;
    tag: string;
    coverImageUrl?: string | null;
    status?: string;
    publishedAt?: string | null;
  },
  author: { id: string },
) => {
  const status = input.status ?? 'draft';
  const slug = await generateUniqueSlug(input.title);
  const authorName = await resolveAuthorName(author.id);

  const data: any = {
    slug,
    title: input.title,
    excerpt: buildExcerpt(input.body, input.excerpt),
    body: input.body,
    tag: input.tag,
    coverImageUrl: input.coverImageUrl ?? null,
    status,
    publishedAt: resolvePublishedAt(status, input.publishedAt),
    authorId: author.id,
    authorName,
  };

  try {
    return await prisma.news.create({ data, select: newsSelect });
  } catch (err: any) {
    // Unique slug race: retry once with a suffixed slug instead of 500.
    if (err?.code === 'P2002') {
      const retrySlug = `${slugify(input.title)}-${crypto.randomBytes(2).toString('hex')}`;
      return await prisma.news.create({
        data: { ...data, slug: retrySlug },
        select: newsSelect,
      });
    }
    throw err;
  }
};

export const updateNews = async (
  id: string,
  input: {
    title?: string;
    excerpt?: string | null;
    body?: string;
    tag?: string;
    coverImageUrl?: string | null;
    status?: string;
    publishedAt?: string | null;
  },
) => {
  const existing = await prisma.news.findFirst({ where: { id, deletedAt: null } });
  if (!existing) return null;

  const data: any = {};
  if (input.title !== undefined) data.title = input.title;
  if (input.body !== undefined) data.body = input.body;
  if (input.tag !== undefined) data.tag = input.tag;
  if (input.coverImageUrl !== undefined) data.coverImageUrl = input.coverImageUrl;

  if (input.excerpt !== undefined) {
    data.excerpt = input.excerpt && input.excerpt.trim()
      ? input.excerpt.trim()
      : (input.body ?? existing.body).trim().slice(0, 160);
  } else if (input.body !== undefined) {
    data.excerpt = input.body.trim().slice(0, 160);
  }

  const nextStatus = input.status ?? existing.status;
  if (input.status !== undefined) data.status = input.status;

  if (input.publishedAt !== undefined) {
    data.publishedAt = input.publishedAt ? new Date(input.publishedAt) : null;
  }
  // Publishing transition sets publishedAt = now() if null.
  if (nextStatus === 'published' && (existing.publishedAt === null || existing.publishedAt === undefined)) {
    if (data.publishedAt === undefined || data.publishedAt === null) {
      data.publishedAt = new Date();
    }
  }

  return prisma.news.update({ where: { id }, data, select: newsSelect });
};

export const softDeleteNews = async (id: string) => {
  const existing = await prisma.news.findFirst({ where: { id, deletedAt: null } });
  if (!existing) return null;
  await prisma.news.update({ where: { id }, data: { deletedAt: new Date() } });
  return true;
};

const clampPageLimit = (page?: number, limit?: number) => {
  const p = Number.isFinite(page) && (page as number) > 0 ? Math.floor(page as number) : 1;
  let l = Number.isFinite(limit) && (limit as number) > 0 ? Math.floor(limit as number) : 10;
  if (l > 50) l = 50;
  return { page: p, limit: l };
};
