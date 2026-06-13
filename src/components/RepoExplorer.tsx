import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { compareByStarDelta, filterReposForTrendView } from '../lib/trends';
import type { Activity, ManifestRepo } from '../lib/types';
import type { TrendView } from '../lib/trends';

type SortMode = 'stars' | 'updated' | 'growth';

interface Props {
  repos: ManifestRepo[];
  baseUrl: string;
  firstSeenDates: Record<string, string>;
  today: string;
}

const numberFormatter = new Intl.NumberFormat('en', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

const dateFormatter = new Intl.DateTimeFormat('en', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

export default function RepoExplorer({
  repos,
  baseUrl,
  firstSeenDates,
  today,
}: Props) {
  const [view, setView] = useState<TrendView>('all');
  const [language, setLanguage] = useState('all');
  const [topic, setTopic] = useState('all');
  const [activity, setActivity] = useState<Activity | 'all'>('all');
  const [sort, setSort] = useState<SortMode>('stars');

  const languages = useMemo(
    () =>
      uniqueSorted(repos.map((repo) => repo.primaryLanguage).filter(Boolean)),
    [repos],
  );
  const topics = useMemo(
    () => uniqueSorted(repos.flatMap((repo) => repo.topics)).slice(0, 40),
    [repos],
  );
  const activities = useMemo(
    () => uniqueSorted(repos.map((repo) => repo.activity)) as Activity[],
    [repos],
  );
  const trendOptions = useMemo(
    () =>
      [
        { value: 'all', label: 'All', count: repos.length },
        {
          value: 'rising',
          label: 'Rising',
          count: filterReposForTrendView(repos, {
            view: 'rising',
            firstSeenDates,
            today,
          }).length,
        },
        {
          value: 'new-today',
          label: 'New today',
          count: filterReposForTrendView(repos, {
            view: 'new-today',
            firstSeenDates,
            today,
          }).length,
        },
      ] satisfies Array<{ value: TrendView; label: string; count: number }>,
    [firstSeenDates, repos, today],
  );

  const visibleRepos = useMemo(() => {
    return filterReposForTrendView(repos, { view, firstSeenDates, today })
      .filter((repo) => language === 'all' || repo.primaryLanguage === language)
      .filter((repo) => topic === 'all' || repo.topics.includes(topic))
      .filter((repo) => activity === 'all' || repo.activity === activity)
      .toSorted((a, b) => {
        if (view === 'rising' || sort === 'growth') {
          return compareByStarDelta(a, b);
        }

        if (sort === 'updated') {
          return pushedTime(b) - pushedTime(a);
        }

        return b.stars - a.stars;
      });
  }, [activity, firstSeenDates, language, repos, sort, today, topic, view]);

  return (
    <section className="repo-explorer" aria-label="Repository explorer">
      <div className="view-tabs" aria-label="Repository views">
        {trendOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            className={option.value === view ? 'is-active' : undefined}
            aria-pressed={option.value === view}
            onClick={() => {
              setView(option.value);

              if (option.value === 'rising') {
                setSort('growth');
              }
            }}
          >
            <span>{option.label}</span>
            <strong>{option.count.toLocaleString('en')}</strong>
          </button>
        ))}
      </div>

      <div className="filter-bar" aria-label="Repository filters">
        <label>
          <span>Language</span>
          <select
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
          >
            <option value="all">All</option>
            {languages.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Topic</span>
          <select
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
          >
            <option value="all">All</option>
            {topics.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Activity</span>
          <select
            value={activity}
            onChange={(event) =>
              setActivity(event.target.value as Activity | 'all')
            }
          >
            <option value="all">All</option>
            {activities.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Sort</span>
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as SortMode)}
          >
            <option value="stars">Stars</option>
            <option value="growth">7d growth</option>
            <option value="updated">Updated</option>
          </select>
        </label>

        <output>{visibleRepos.length.toLocaleString('en')} repos</output>
      </div>

      <div className="repo-grid">
        {visibleRepos.length > 0 ? (
          visibleRepos.map((repo) => (
            <RepoCard key={repo.id} repo={repo} baseUrl={baseUrl} />
          ))
        ) : (
          <p className="empty-state repo-grid__empty">
            No repositories in this view yet.
          </p>
        )}
      </div>
    </section>
  );
}

function RepoCard({ repo, baseUrl }: { repo: ManifestRepo; baseUrl: string }) {
  const detailHref = `${baseUrl}repos/${repo.slug}/`;
  const repoHref = `https://github.com/${repo.id}`;
  const updatedLabel = repo.pushedAt
    ? dateFormatter.format(new Date(repo.pushedAt))
    : 'Unknown';

  return (
    <article
      className="repo-card"
      style={
        { '--language-color': repo.languageColor ?? '#8b949e' } as CSSProperties
      }
    >
      <div className="repo-card__top">
        {repo.ownerAvatarUrl ? (
          <img
            className="repo-card__avatar"
            src={repo.ownerAvatarUrl}
            alt=""
            width="42"
            height="42"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="repo-card__avatar" aria-hidden="true" />
        )}
        <div className="repo-card__title">
          <h2>
            <a href={detailHref} aria-label={`View ${repo.id} on StarVista`}>
              {repo.id}
            </a>
          </h2>
          <p className="repo-card__owner">{repo.owner}</p>
        </div>
      </div>

      <p className="repo-card__description">
        {repo.description ?? 'No repository description available.'}
      </p>

      <div
        className="repo-card__meta"
        aria-label={`${repo.id} repository metrics`}
      >
        <Metric value={numberFormatter.format(repo.stars)} label="Stars" />
        <Metric value={numberFormatter.format(repo.forks)} label="Forks" />
        <Metric
          value={numberFormatter.format(repo.openIssues)}
          label="Issues"
        />
        <Metric value={updatedLabel} label="Updated" />
      </div>

      <div className="repo-card__footer">
        {repo.primaryLanguage && (
          <span className="badge">
            <span className="badge__dot" aria-hidden="true" />
            {repo.primaryLanguage}
          </span>
        )}
        {repo.license && <span className="badge">{repo.license}</span>}
        <span className="badge badge--activity">{repo.activity}</span>
        {repo.starDelta7d !== null && (
          <span className="badge badge--growth">
            {formatDelta(repo.starDelta7d)} 7d
          </span>
        )}
        <a className="badge" href={repoHref}>
          GitHub
        </a>
      </div>

      {repo.topics.length > 0 && (
        <ul className="repo-card__topics" aria-label={`${repo.id} topics`}>
          {repo.topics.slice(0, 4).map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
    </article>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div className="repo-card__metric">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function uniqueSorted<T extends string>(
  items: Array<T | null | undefined>,
): T[] {
  return [...new Set(items.filter((item): item is T => Boolean(item)))].sort(
    (a, b) => a.localeCompare(b),
  );
}

function pushedTime(repo: ManifestRepo): number {
  return repo.pushedAt ? Date.parse(repo.pushedAt) : 0;
}

function formatDelta(delta: number): string {
  const prefix = delta > 0 ? '+' : '';

  return `${prefix}${numberFormatter.format(delta)}`;
}
