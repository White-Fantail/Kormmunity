import { createHash, randomUUID } from 'node:crypto';

import { Prisma, type CategoryType, type PostStatus } from '@prisma/client';

import type { AgentPrincipal } from '@/lib/agent/auth';
import { AgentApiError } from '@/lib/agent/http';
import { prisma } from '@/lib/db/prisma';
import { getPostCreationFormOptions } from '@/lib/permissions';

type AutomationSettings = {
  allowPosts: boolean;
  allowComments: boolean;
  maxPostsPerDay: number;
  minPostIntervalMinutes: number;
};

const DEFAULT_AUTOMATION: AutomationSettings = {
  allowPosts: true,
  allowComments: false,
  maxPostsPerDay: 5,
  minPostIntervalMinutes: 30,
};

type ManagedAccount = Awaited<ReturnType<typeof loadManagedAccount>>;

type AgentRequestRow = {
  requestHash: string;
  response: unknown;
};

function clampInteger(value: unknown, fallback: number, min: number, max: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(value)));
}

function automationForAccount(accountId: string): AutomationSettings {
  const raw = process.env.KORMMUNITY_AGENT_AUTOMATION;
  if (!raw) return DEFAULT_AUTOMATION;

  try {
    const config = JSON.parse(raw) as Record<string, Partial<AutomationSettings>>;
    const override = config[accountId];
    if (!override) return DEFAULT_AUTOMATION;
    return {
      allowPosts: typeof override.allowPosts === 'boolean' ? override.allowPosts : DEFAULT_AUTOMATION.allowPosts,
      allowComments:
        typeof override.allowComments === 'boolean'
          ? override.allowComments
          : DEFAULT_AUTOMATION.allowComments,
      maxPostsPerDay: clampInteger(
        override.maxPostsPerDay,
        DEFAULT_AUTOMATION.maxPostsPerDay,
        1,
        100,
      ),
      minPostIntervalMinutes: clampInteger(
        override.minPostIntervalMinutes,
        DEFAULT_AUTOMATION.minPostIntervalMinutes,
        0,
        24 * 60,
      ),
    };
  } catch {
    return DEFAULT_AUTOMATION;
  }
}

function toRegion(account: {
  countryId: string | null;
  cityId: string | null;
  country: { id: string; name: string; slug: string } | null;
  city: { id: string; name: string; slug: string; countryId: string | null } | null;
}) {
  if (account.city) {
    return {
      id: `city:${account.city.id}`,
      type: 'city' as const,
      name: account.city.name,
      slug: account.city.slug,
      countryId: account.city.countryId ? `country:${account.city.countryId}` : null,
    };
  }
  if (account.country) {
    return {
      id: `country:${account.country.id}`,
      type: 'country' as const,
      name: account.country.name,
      slug: account.country.slug,
      countryId: null,
    };
  }
  return null;
}

async function loadManagedAccount(accountId: string) {
  return prisma.user.findFirst({
    where: {
      id: accountId,
      isManagedAccount: true,
      accountType: { in: ['PERSONA', 'OPERATOR'] },
    },
    select: {
      id: true,
      displayName: true,
      accountType: true,
      isActive: true,
      status: true,
      shortBio: true,
      personaNotes: true,
      toneNotes: true,
      activityNotes: true,
      countryId: true,
      cityId: true,
      country: { select: { id: true, name: true, slug: true } },
      city: { select: { id: true, name: true, slug: true, countryId: true } },
      staffAssignments: {
        select: { role: true, countryId: true, cityId: true },
      },
    },
  });
}

async function allowedCategoriesFor(account: NonNullable<ManagedAccount>) {
  const options = await getPostCreationFormOptions({
    id: account.id,
    status: account.status,
    countryId: account.countryId,
    cityId: account.cityId,
    staffAssignments: account.staffAssignments,
  });

  return options.categories.map((category) => ({
    id: category.id,
    name: category.name,
    type: category.type,
    visibilityMode: category.visibilityMode,
    tags: category.postTagOptions,
  }));
}

export async function getAgentAccounts() {
  const accounts = await prisma.user.findMany({
    where: {
      isManagedAccount: true,
      accountType: { in: ['PERSONA', 'OPERATOR'] },
    },
    orderBy: [{ isActive: 'desc' }, { displayName: 'asc' }],
    select: {
      id: true,
      displayName: true,
      accountType: true,
      isActive: true,
      status: true,
      shortBio: true,
      personaNotes: true,
      toneNotes: true,
      activityNotes: true,
      countryId: true,
      cityId: true,
      country: { select: { id: true, name: true, slug: true } },
      city: { select: { id: true, name: true, slug: true, countryId: true } },
      staffAssignments: { select: { role: true, countryId: true, cityId: true } },
    },
  });

  return Promise.all(
    accounts.map(async (account) => ({
      id: account.id,
      displayName: account.displayName,
      accountType: account.accountType,
      enabled: account.isActive && account.status === 'ACTIVE',
      region: toRegion(account),
      persona: {
        shortBio: account.shortBio,
        personaNotes: account.personaNotes,
        toneNotes: account.toneNotes,
        activityNotes: account.activityNotes,
      },
      allowedCategories: await allowedCategoriesFor(account),
      automation: automationForAccount(account.id),
    })),
  );
}

export async function getAgentAccount(accountId: string) {
  const account = await loadManagedAccount(accountId);
  if (!account) throw new AgentApiError('Managed account not found.', 404, 'account_not_found');

  return {
    id: account.id,
    displayName: account.displayName,
    accountType: account.accountType,
    enabled: account.isActive && account.status === 'ACTIVE',
    region: toRegion(account),
    persona: {
      shortBio: account.shortBio,
      personaNotes: account.personaNotes,
      toneNotes: account.toneNotes,
      activityNotes: account.activityNotes,
    },
    allowedCategories: await allowedCategoriesFor(account),
    automation: automationForAccount(account.id),
  };
}

export async function getAgentCategories() {
  const categories = await prisma.category.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      name: true,
      slug: true,
      type: true,
      visibilityMode: true,
    },
  });
  const tags = await prisma.postTagOption.findMany({
    where: { isActive: true },
    orderBy: [{ categoryType: 'asc' }, { sortOrder: 'asc' }],
    select: { id: true, label: true, slug: true, categoryType: true },
  });

  return categories.map((category) => ({
    ...category,
    tags: tags
      .filter((tag) => tag.categoryType === category.type)
      .map(({ categoryType: _categoryType, ...tag }) => tag),
  }));
}

export async function getAgentRegions() {
  const countries = await prisma.country.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      name: true,
      slug: true,
      cities: {
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        select: { id: true, name: true, slug: true },
      },
    },
  });

  return countries.map((country) => ({
    id: `country:${country.id}`,
    type: 'country' as const,
    name: country.name,
    slug: country.slug,
    cities: country.cities.map((city) => ({
      id: `city:${city.id}`,
      type: 'city' as const,
      name: city.name,
      slug: city.slug,
      countryId: `country:${country.id}`,
    })),
  }));
}

async function resolveRegion(regionId: string | null | undefined, account: NonNullable<ManagedAccount>) {
  if (!regionId) return { countryId: account.countryId, cityId: account.cityId };

  if (regionId.startsWith('country:')) {
    const id = regionId.slice('country:'.length);
    const country = await prisma.country.findFirst({ where: { id, isActive: true }, select: { id: true } });
    if (!country) throw new AgentApiError('Invalid regionId.', 400, 'invalid_region');
    return { countryId: country.id, cityId: null };
  }

  if (regionId.startsWith('city:')) {
    const id = regionId.slice('city:'.length);
    const city = await prisma.city.findFirst({
      where: { id, isActive: true },
      select: { id: true, countryId: true },
    });
    if (!city || !city.countryId) throw new AgentApiError('Invalid regionId.', 400, 'invalid_region');
    return { countryId: city.countryId, cityId: city.id };
  }

  throw new AgentApiError('regionId must use country:<id> or city:<id>.', 400, 'invalid_region');
}

function requiredString(body: Record<string, unknown>, field: string) {
  const value = body[field];
  if (typeof value !== 'string' || !value.trim()) {
    throw new AgentApiError(`${field} is required.`, 400, 'validation_error');
  }
  return value.trim();
}

function optionalString(body: Record<string, unknown>, field: string) {
  const value = body[field];
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') throw new AgentApiError(`${field} must be a string.`, 400, 'validation_error');
  return value.trim() || null;
}

function parseTags(body: Record<string, unknown>) {
  const value = body.tags;
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new AgentApiError('tags must be an array of tag ids or slugs.', 400, 'validation_error');
  }
  return Array.from(new Set(value.map((item) => item.trim()).filter(Boolean)));
}

function normalizeStatus(value: unknown): 'DRAFT' | 'PUBLISHED' {
  if (value === undefined || value === 'draft' || value === 'DRAFT') return 'DRAFT';
  if (value === 'published' || value === 'PUBLISHED') return 'PUBLISHED';
  throw new AgentApiError('status must be draft or published.', 400, 'validation_error');
}

function stableHash(value: unknown) {
  const canonicalize = (input: unknown): unknown => {
    if (Array.isArray(input)) return input.map(canonicalize);
    if (input && typeof input === 'object') {
      return Object.fromEntries(
        Object.entries(input as Record<string, unknown>)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, val]) => [key, canonicalize(val)]),
      );
    }
    return input;
  };
  return createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex');
}

async function validatePostTarget(
  account: NonNullable<ManagedAccount>,
  categoryId: string,
  region: { countryId: string | null; cityId: string | null },
  tags: string[],
) {
  const options = await getPostCreationFormOptions({
    id: account.id,
    status: account.status,
    countryId: account.countryId,
    cityId: account.cityId,
    staffAssignments: account.staffAssignments,
  });
  const category = options.categories.find((item) => item.id === categoryId);
  const allowed = options.allowedTargets.some(
    (target) =>
      target.categoryId === categoryId &&
      target.countryId === region.countryId &&
      target.cityId === region.cityId,
  );
  if (!category || !allowed) {
    throw new AgentApiError('Account is not allowed to post to this category/region.', 403, 'target_not_allowed');
  }

  const tagByIdOrSlug = new Map<string, string>();
  for (const option of category.postTagOptions) {
    tagByIdOrSlug.set(option.id, option.id);
    tagByIdOrSlug.set(option.slug, option.id);
  }
  const tagIds = tags.map((tag) => tagByIdOrSlug.get(tag));
  if (tagIds.some((id) => !id)) {
    throw new AgentApiError('One or more tags are invalid for this category.', 400, 'invalid_tags');
  }

  return { category, tagIds: tagIds as string[] };
}

async function assertPublishBudget(account: NonNullable<ManagedAccount>) {
  const automation = automationForAccount(account.id);
  if (!automation.allowPosts) {
    throw new AgentApiError('Posting is disabled for this account.', 403, 'automation_disabled');
  }

  const since = new Date();
  since.setHours(0, 0, 0, 0);
  const count = await prisma.post.count({
    where: { authorId: account.id, status: 'PUBLISHED', publishedAt: { gte: since } },
  });
  if (count >= automation.maxPostsPerDay) {
    throw new AgentApiError('Daily post limit reached for this account.', 429, 'daily_post_limit');
  }

  if (automation.minPostIntervalMinutes > 0) {
    const last = await prisma.post.findFirst({
      where: { authorId: account.id, status: 'PUBLISHED', publishedAt: { not: null } },
      orderBy: { publishedAt: 'desc' },
      select: { publishedAt: true },
    });
    if (
      last?.publishedAt &&
      Date.now() - last.publishedAt.getTime() < automation.minPostIntervalMinutes * 60_000
    ) {
      throw new AgentApiError('Minimum post interval has not elapsed.', 429, 'post_interval_limit');
    }
  }
}

function postDto(post: {
  id: string;
  authorId: string;
  title: string | null;
  body: string;
  categoryId: string;
  countryId: string | null;
  cityId: string | null;
  status: PostStatus;
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date | null;
  tags: { postTagOption: { id: string; label: string; slug: string } }[];
}) {
  return {
    id: post.id,
    authorAccountId: post.authorId,
    title: post.title,
    body: post.body,
    categoryId: post.categoryId,
    regionId: post.cityId ? `city:${post.cityId}` : post.countryId ? `country:${post.countryId}` : null,
    tags: post.tags.map(({ postTagOption }) => postTagOption),
    status: post.status.toLowerCase(),
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
    publishedAt: post.publishedAt?.toISOString() ?? null,
  };
}

const postInclude = {
  tags: { select: { postTagOption: { select: { id: true, label: true, slug: true } } } },
} satisfies Prisma.PostInclude;

export async function createAgentPost(
  principal: AgentPrincipal,
  idempotencyKey: string,
  body: Record<string, unknown>,
) {
  const authorAccountId = requiredString(body, 'authorAccountId');
  const title = optionalString(body, 'title');
  const postBody = requiredString(body, 'body');
  const categoryId = requiredString(body, 'categoryId');
  const regionId = optionalString(body, 'regionId');
  const tags = parseTags(body);
  const status = normalizeStatus(body.status);
  const externalReferenceId = optionalString(body, 'externalReferenceId');

  const account = await loadManagedAccount(authorAccountId);
  if (!account || !account.isActive || account.status !== 'ACTIVE') {
    throw new AgentApiError('Managed account is not enabled.', 403, 'account_disabled');
  }
  if (!automationForAccount(account.id).allowPosts) {
    throw new AgentApiError('Posting is disabled for this account.', 403, 'automation_disabled');
  }

  const region = await resolveRegion(regionId, account);
  const { tagIds } = await validatePostTarget(account, categoryId, region, tags);
  if (status === 'PUBLISHED') await assertPublishBudget(account);

  const hash = stableHash({ authorAccountId, title, body: postBody, categoryId, regionId, tags, status, externalReferenceId });

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${principal.keyId}:posts.create:${idempotencyKey}:${externalReferenceId ?? ''}`}))`;

    const existing = await tx.$queryRaw<AgentRequestRow[]>`
      SELECT "requestHash", "response"
      FROM "AgentRequest"
      WHERE "agentKeyId" = ${principal.keyId}
        AND "operation" = 'posts.create'
        AND ("idempotencyKey" = ${idempotencyKey}
          OR (${externalReferenceId}::text IS NOT NULL AND "externalReferenceId" = ${externalReferenceId}))
      ORDER BY "createdAt" ASC
      LIMIT 1
    `;
    if (existing[0]) {
      if (existing[0].requestHash !== hash) {
        throw new AgentApiError('Idempotency key or external reference was reused with different content.', 409, 'idempotency_conflict');
      }
      return { replayed: true, post: existing[0].response };
    }

    const post = await tx.post.create({
      data: {
        authorId: account.id,
        createdByUserId: null,
        title,
        body: postBody,
        categoryId,
        countryId: region.countryId,
        cityId: region.cityId,
        status,
        publishedAt: status === 'PUBLISHED' ? new Date() : null,
      },
      include: postInclude,
    });

    if (tagIds.length > 0) {
      await tx.postTag.createMany({ data: tagIds.map((postTagOptionId) => ({ postId: post.id, postTagOptionId })) });
    }

    const fullPost = tagIds.length
      ? await tx.post.findUniqueOrThrow({ where: { id: post.id }, include: postInclude })
      : post;
    const response = postDto(fullPost);

    await tx.$executeRaw`
      INSERT INTO "AgentRequest" (
        "id", "agentKeyId", "operation", "idempotencyKey", "requestHash",
        "externalReferenceId", "postId", "response"
      ) VALUES (
        ${randomUUID()}, ${principal.keyId}, 'posts.create', ${idempotencyKey}, ${hash},
        ${externalReferenceId}, ${post.id}, ${JSON.stringify(response)}::jsonb
      )
    `;

    return { replayed: false, post: response };
  });
}

export async function getAgentPost(postId: string) {
  const post = await prisma.post.findUnique({ where: { id: postId }, include: postInclude });
  if (!post) throw new AgentApiError('Post not found.', 404, 'post_not_found');
  return postDto(post);
}

export async function updateAgentPost(postId: string, body: Record<string, unknown>) {
  const existing = await prisma.post.findUnique({ where: { id: postId }, include: { author: { select: { id: true } } } });
  if (!existing) throw new AgentApiError('Post not found.', 404, 'post_not_found');
  if (existing.status !== 'DRAFT') throw new AgentApiError('Only draft posts can be edited.', 409, 'post_not_draft');

  const account = await loadManagedAccount(existing.authorId);
  if (!account || !account.isActive || account.status !== 'ACTIVE') throw new AgentApiError('Managed account is not enabled.', 403, 'account_disabled');

  const title = body.title === undefined ? existing.title : optionalString(body, 'title');
  const postBody = body.body === undefined ? existing.body : requiredString(body, 'body');
  const categoryId = body.categoryId === undefined ? existing.categoryId : requiredString(body, 'categoryId');
  const currentRegionId = existing.cityId ? `city:${existing.cityId}` : existing.countryId ? `country:${existing.countryId}` : null;
  const regionId = body.regionId === undefined ? currentRegionId : optionalString(body, 'regionId');
  const region = await resolveRegion(regionId, account);
  const tags = body.tags === undefined
    ? (await prisma.postTag.findMany({ where: { postId }, select: { postTagOption: { select: { id: true } } } })).map((tag) => tag.postTagOption.id)
    : parseTags(body);
  const { tagIds } = await validatePostTarget(account, categoryId, region, tags);

  const post = await prisma.$transaction(async (tx) => {
    await tx.post.update({
      where: { id: postId },
      data: { title, body: postBody, categoryId, countryId: region.countryId, cityId: region.cityId },
    });
    await tx.postTag.deleteMany({ where: { postId } });
    if (tagIds.length) await tx.postTag.createMany({ data: tagIds.map((postTagOptionId) => ({ postId, postTagOptionId })) });
    return tx.post.findUniqueOrThrow({ where: { id: postId }, include: postInclude });
  });

  return postDto(post);
}

export async function publishAgentPost(postId: string) {
  const existing = await prisma.post.findUnique({ where: { id: postId } });
  if (!existing) throw new AgentApiError('Post not found.', 404, 'post_not_found');
  if (existing.status === 'PUBLISHED') return getAgentPost(postId);
  if (existing.status !== 'DRAFT') throw new AgentApiError('Only draft posts can be published.', 409, 'post_not_draft');

  const account = await loadManagedAccount(existing.authorId);
  if (!account || !account.isActive || account.status !== 'ACTIVE') throw new AgentApiError('Managed account is not enabled.', 403, 'account_disabled');
  await assertPublishBudget(account);

  const post = await prisma.post.update({
    where: { id: postId },
    data: { status: 'PUBLISHED', publishedAt: new Date() },
    include: postInclude,
  });
  return postDto(post);
}

export async function getAgentAccountPosts(accountId: string, limit: number) {
  const account = await loadManagedAccount(accountId);
  if (!account) throw new AgentApiError('Managed account not found.', 404, 'account_not_found');
  const posts = await prisma.post.findMany({
    where: { authorId: accountId, status: { not: 'DELETED' } },
    orderBy: { createdAt: 'desc' },
    take: Math.max(1, Math.min(limit, 100)),
    include: postInclude,
  });
  return posts.map(postDto);
}

export async function getTrendingTopics(limit: number) {
  const posts = await prisma.post.findMany({
    where: { status: 'PUBLISHED' },
    orderBy: [{ communityScore: 'desc' }, { viewCount: 'desc' }, { createdAt: 'desc' }],
    take: Math.max(1, Math.min(limit, 50)),
    select: {
      id: true,
      title: true,
      category: { select: { id: true, name: true, slug: true } },
      countryId: true,
      cityId: true,
      communityScore: true,
      viewCount: true,
      _count: { select: { comments: true } },
      createdAt: true,
    },
  });
  return posts.map((post) => ({
    postId: post.id,
    title: post.title,
    category: post.category,
    regionId: post.cityId ? `city:${post.cityId}` : post.countryId ? `country:${post.countryId}` : null,
    commentCount: post._count.comments,
    viewCount: post.viewCount,
    score: post.communityScore,
    createdAt: post.createdAt.toISOString(),
  }));
}
