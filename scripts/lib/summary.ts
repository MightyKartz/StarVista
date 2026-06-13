import { createHash } from 'node:crypto';
import type { ManifestRepo, RepoSummary } from '../../src/lib/types';
import { createTemplateSummary } from './normalize';

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';
const DEFAULT_OPENAI_MODEL = 'gpt-5.5';
const MAX_SUMMARY_TOKENS = 120;

type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

interface ResolveRepoSummaryOptions {
  repo: ManifestRepo;
  readmeExcerpt: string | null;
  readmeHash: string | null;
  existingSummary?: RepoSummary;
  apiKey?: string;
  model?: string;
  fetchImpl?: FetchLike;
}

interface OpenAIResponsePayload {
  output_text?: unknown;
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: unknown;
    }>;
  }>;
}

interface RequestLlmSummaryOptions {
  repo: ManifestRepo;
  readmeExcerpt: string | null;
  readmeHash: string;
  apiKey: string;
  model: string;
  fetchImpl: FetchLike;
}

export function createReadmeHash(markdown: string | null): string | null {
  if (!markdown) {
    return null;
  }

  return `sha256:${createHash('sha256').update(markdown).digest('hex')}`;
}

export function shouldRequestLlmSummary(
  existingSummary: RepoSummary | undefined,
  readmeHash: string | null,
  apiKey: string | undefined,
): boolean {
  if (!apiKey || !readmeHash) {
    return false;
  }

  return !(
    existingSummary?.mode === 'llm' && existingSummary.readmeHash === readmeHash
  );
}

export async function resolveRepoSummary({
  repo,
  readmeExcerpt,
  readmeHash,
  existingSummary,
  apiKey,
  model = DEFAULT_OPENAI_MODEL,
  fetchImpl = fetch,
}: ResolveRepoSummaryOptions): Promise<RepoSummary> {
  if (
    !apiKey ||
    !readmeHash ||
    !shouldRequestLlmSummary(existingSummary, readmeHash, apiKey)
  ) {
    if (
      apiKey &&
      existingSummary?.mode === 'llm' &&
      existingSummary.readmeHash === readmeHash
    ) {
      return existingSummary;
    }

    return createTemplateSummary(repo);
  }

  try {
    return await requestLlmSummary({
      repo,
      readmeExcerpt,
      readmeHash,
      apiKey,
      model,
      fetchImpl,
    });
  } catch (error) {
    console.warn(`${repo.id} LLM summary unavailable: ${formatError(error)}`);
    return createTemplateSummary(repo);
  }
}

async function requestLlmSummary({
  repo,
  readmeExcerpt,
  readmeHash,
  apiKey,
  model,
  fetchImpl,
}: RequestLlmSummaryOptions): Promise<RepoSummary> {
  const response = await fetchImpl(OPENAI_RESPONSES_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      input: buildSummaryPrompt(repo, readmeExcerpt),
      max_output_tokens: MAX_SUMMARY_TOKENS,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API returned ${response.status}`);
  }

  const payload = (await response.json()) as OpenAIResponsePayload;
  const text = extractResponseText(payload);

  if (!text) {
    throw new Error('OpenAI API returned no summary text');
  }

  return {
    mode: 'llm',
    text,
    readmeHash,
  };
}

function buildSummaryPrompt(
  repo: ManifestRepo,
  readmeExcerpt: string | null,
): string {
  return [
    'Write one concise, factual English sentence summarizing this GitHub repository for a developer discovery site.',
    'Do not mention stars, forks, GitHub, or that you are an AI.',
    `Repository: ${repo.id}`,
    `Primary language: ${repo.primaryLanguage ?? 'unknown'}`,
    `Description: ${repo.description ?? 'none'}`,
    `Topics: ${repo.topics.slice(0, 8).join(', ') || 'none'}`,
    `README excerpt: ${readmeExcerpt ?? 'none'}`,
  ].join('\n');
}

function extractResponseText(payload: OpenAIResponsePayload): string | null {
  if (typeof payload.output_text === 'string') {
    return normalizeSummaryText(payload.output_text);
  }

  for (const output of payload.output ?? []) {
    for (const content of output.content ?? []) {
      if (content.type === 'output_text' && typeof content.text === 'string') {
        return normalizeSummaryText(content.text);
      }
    }
  }

  return null;
}

function normalizeSummaryText(text: string): string | null {
  const normalized = text.replace(/\s+/g, ' ').trim();

  return normalized.length > 0 ? normalized : null;
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
