import { createFileRoute } from '@tanstack/react-router'
import { ClerkProvider, SignInButton, UserButton, useAuth } from '@clerk/react'
import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { listUrl } from '../list'
import type { Movie } from '../list'
export const Route = createFileRoute('/')({ component: Home })
const key = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY
function Home() {
  return key ? (
    <ClerkProvider publishableKey={key}>
      <MemberApp />
    </ClerkProvider>
  ) : (
    <Programme />
  )
}
function MemberApp() {
  const { getToken, isSignedIn } = useAuth()
  return (
    <Programme
      getToken={getToken}
      account={
        isSignedIn ? (
          <UserButton />
        ) : (
          <SignInButton mode='modal'>
            <button className='quiet'>Sign in</button>
          </SignInButton>
        )
      }
    />
  )
}
type Result = Movie & {
  name?: string
  profile_path?: string | null
  logo_path?: string | null
  known_for_department?: string
  known_for?: Movie[]
}
async function json(url: string, init?: RequestInit) {
  const res = await fetch(url, init)
  const data = await res.json()
  if (!res.ok)
    throw new Error(data.error || 'Could not load this request. Try again.')
  return data
}
function Programme({
  getToken,
  account
}: {
  getToken?: () => Promise<string | null>
  account?: React.ReactNode
}) {
  const listDialog = useRef<HTMLDialogElement>(null)
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState('person')
  const [genre, setGenre] = useState('')
  const [year, setYear] = useState('')
  const [sort, setSort] = useState('popularity.desc')
  const [results, setResults] = useState<Result[]>([])
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [endpoint, setEndpoint] = useState('/api/search')
  const [params, setParams] = useState('kind=person')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [heading, setHeading] = useState('People to explore')
  const [resultKind, setResultKind] = useState('person')
  const [creditRole, setCreditRole] = useState('all')
  const [profile, setProfile] = useState<Result | null>(null)
  const [picks, setPicks] = useState<Movie[]>([])
  const [name, setName] = useState('My film list')
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [feed, setFeed] = useState('')
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('listarr-draft') || 'null')
      if (
        saved &&
        Array.isArray(saved.picks) &&
        saved.picks.length <= 100 &&
        saved.picks.every(
          (m: Movie) =>
            Number.isInteger(m.id) && m.id > 0 && typeof m.title === 'string'
        )
      ) {
        setPicks(saved.picks)
        if (typeof saved.name === 'string') setName(saved.name.slice(0, 80))
      }
    } catch {
      /* A damaged draft must not block search. */
    }
    setReady(true)
  }, [])
  useEffect(() => {
    if (ready)
      try {
        localStorage.setItem('listarr-draft', JSON.stringify({ name, picks }))
      } catch {
        /* Browsing and exporting still work when storage is full. */
      }
    setFeed('')
    setNotice('')
  }, [name, picks, ready])
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    json(`${endpoint}?${params}&page=${page}`, { signal: controller.signal })
      .then((data) => {
        setResults(data.results)
        setPages(Math.min(data.total_pages || 1, 500))
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setError(err.message)
          setResults([])
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [endpoint, params, page])
  function search(event?: FormEvent) {
    event?.preventDefault()
    setLoading(true)
    setResults([])
    setEndpoint('/api/search')
    setProfile(null)
    setCreditRole('all')
    setParams(
      new URLSearchParams({
        q: query,
        kind,
        genre,
        year,
        sort,
        request: String(Date.now())
      }).toString()
    )
    setPage(1)
    setResultKind(kind)
    setHeading(
      query
        ? `Results for “${query}”`
        : kind === 'person'
          ? 'People to explore'
          : kind === 'company'
            ? 'Find a studio by name'
            : 'Discover films'
    )
  }
  function expand(item: Result) {
    setLoading(true)
    setResults([])
    setEndpoint(`/api/${resultKind}/${item.id}`)
    setParams('')
    setProfile(item)
    setCreditRole('all')
    setPage(1)
    setResultKind('movie')
    setHeading(item.name || item.title)
  }
  function toggle(movie: Movie) {
    setNotice('')
    if (picks.some((p) => p.id === movie.id))
      setPicks(picks.filter((p) => p.id !== movie.id))
    else if (picks.length < 100) setPicks([...picks, movie])
    else
      setNotice(
        'A list can contain up to 100 films. Remove one to add another.'
      )
  }
  async function copy() {
    const url = listUrl(
      window.location.origin,
      picks.map((m) => m.id)
    )
    setFeed(url)
    try {
      await navigator.clipboard.writeText(url)
      setNotice(
        'List URL copied. Add it in Radarr → Settings → Import Lists → Custom Lists.'
      )
    } catch {
      setNotice(
        'Copy the list URL below into Radarr → Settings → Import Lists → Custom Lists.'
      )
    }
  }
  async function create() {
    setBusy(true)
    setNotice('')
    try {
      const token = await getToken?.()
      if (!token)
        throw new Error(
          key
            ? 'Sign in first, then create your list.'
            : 'Configure Clerk to create lists directly. You can still copy a list URL.'
        )
      const data = await json('/api/lists', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ name, ids: picks.map((m) => m.id) })
      })
      setFeed(data.url)
      setNotice(
        data.existing
          ? 'This list is already in Radarr.'
          : 'List created in Radarr. Films will be added on its next list sync; automatic search is off.'
      )
    } catch (err) {
      setNotice(
        err instanceof Error ? err.message : 'Could not create the list.'
      )
    } finally {
      setBusy(false)
    }
  }
  const browsingPeople = resultKind === 'person'
  const browsingEntries = resultKind !== 'movie'
  const noun = browsingPeople
    ? 'people'
    : resultKind === 'company'
      ? 'studios'
      : resultKind === 'collection'
        ? 'collections'
        : 'films'
  return (
    <div className='app'>
      <header className='masthead'>
        <a href='/' className='brand'>
          <img src='/icon.svg' alt='' />
          Listarr
        </a>
        <form onSubmit={search} className='search-form' role='search'>
          <label className='search-input'>
            <span className='sr-only'>Search TMDB</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                kind === 'person'
                  ? 'Search actors and directors'
                  : kind === 'company'
                    ? 'Search studios, e.g. A24'
                    : kind === 'collection'
                      ? 'Search collections'
                      : 'Search films, or leave empty to discover'
              }
              maxLength={150}
            />
          </label>
          <select
            aria-label='Look for'
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          >
            <option value='person'>People</option>
            <option value='movie'>Films</option>
            <option value='company'>Studios</option>
            <option value='collection'>Collections</option>
          </select>
          <button className='search-submit' type='submit'>
            Search
          </button>
          {kind === 'movie' && (
            <details className='filters'>
              <summary>Discover by genre, year & rating</summary>
              <div className='filter-fields'>
                <label>
                  Genre
                  <select
                    aria-label='Genre'
                    value={genre}
                    onChange={(e) => setGenre(e.target.value)}
                  >
                    <option value=''>All genres</option>
                    {[
                      [28, 'Action'],
                      [12, 'Adventure'],
                      [16, 'Animation'],
                      [35, 'Comedy'],
                      [80, 'Crime'],
                      [99, 'Documentary'],
                      [18, 'Drama'],
                      [14, 'Fantasy'],
                      [27, 'Horror'],
                      [10749, 'Romance'],
                      [878, 'Science fiction'],
                      [53, 'Thriller']
                    ].map(([id, label]) => (
                      <option key={id} value={id}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Release year
                  <input
                    inputMode='numeric'
                    pattern='[0-9]{4}'
                    placeholder='Any year'
                    value={year}
                    maxLength={4}
                    onChange={(e) => setYear(e.target.value)}
                  />
                </label>
                <label>
                  Sort by
                  <select
                    aria-label='Sort by'
                    value={sort}
                    onChange={(e) => setSort(e.target.value)}
                  >
                    <option value='popularity.desc'>Popular first</option>
                    <option value='vote_average.desc'>Highest rated</option>
                    <option value='primary_release_date.desc'>
                      Newest first
                    </option>
                  </select>
                </label>
                <button type='submit' className='discover-submit'>
                  Discover films
                </button>
              </div>
            </details>
          )}
        </form>
        <button
          className='list-open'
          aria-haspopup='dialog'
          onClick={() => listDialog.current?.showModal()}
        >
          Your list
          <span key={picks.length} className='list-count'>
            {picks.length}
          </span>
        </button>
        <div className='account'>{account}</div>
      </header>
      <main>
        {profile && (
          <section className='profile' aria-label='Profile'>
            <button className='back' onClick={() => search()}>
              Back to results
            </button>
            <div className='profile-card'>
              <div className='profile-portrait' aria-hidden='true'>
                {profile.profile_path || profile.logo_path ? (
                  <img
                    src={`https://image.tmdb.org/t/p/w342${profile.profile_path || profile.logo_path}`}
                    alt=''
                  />
                ) : (
                  <span>{initials(profile.name || profile.title)}</span>
                )}
              </div>
              <div className='profile-text'>
                <p className='profile-role'>
                  {(profile.known_for_department &&
                    (departments[profile.known_for_department] ||
                      profile.known_for_department)) ||
                    (endpoint.includes('/company/')
                      ? 'Studio'
                      : endpoint.includes('/collection/')
                        ? 'Collection'
                        : 'Filmography')}
                </p>
                <h1 className='profile-name'>
                  <Name
                    text={profile.name || profile.title}
                    split={endpoint.includes('/person/')}
                  />
                </h1>
                {endpoint.includes('/person/') && (
                  <div
                    className='credit-tabs'
                    role='group'
                    aria-label='Filmography credits'
                  >
                    {[
                      ['all', 'All films'],
                      ['acting', 'Acting'],
                      ['directing', 'Directing']
                    ].map(([value, label]) => (
                      <button
                        key={value}
                        aria-pressed={creditRole === value}
                        onClick={() => {
                          setCreditRole(value)
                          setParams(`role=${value}`)
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>
        )}
        <div className='results-heading'>
          {profile ? (
            <h2>Films</h2>
          ) : (
            <h1 className='directory-heading'>{heading}</h1>
          )}
          <span>
            {loading
              ? 'Loading…'
              : results.length
                ? `${results.length} ${results.length === 1 ? singular[noun] : noun}${pages > 1 ? `, page ${page}` : ''}`
                : ''}
          </span>
        </div>
        {error ? (
          <div role='alert' className='message'>
            <h3>Could not load the directory</h3>
            <p>{error}</p>
            <button onClick={() => setParams(`${params}&retry=${Date.now()}`)}>
              Try again
            </button>
          </div>
        ) : loading ? (
          <div className='message' role='status'>
            Searching the directory…
          </div>
        ) : results.length === 0 ? (
          <div className='message'>
            <h3>No results found</h3>
            <p>
              Check the spelling, or search for{' '}
              {kind === 'person' ? 'a film or studio' : 'a person'} instead.
            </p>
          </div>
        ) : browsingEntries ? (
          <div className={`directory ${browsingPeople ? 'faces' : 'names'}`}>
            {results.map((item) => {
              const title = item.name || item.title || 'Untitled'
              const image = item.profile_path || item.logo_path
              const credits = item.known_for
                ?.map((film) => film.title)
                .filter(Boolean)
                .join(', ')
              return (
                <article className='entry' key={item.id}>
                  {browsingPeople && (
                    <div className='headshot' aria-hidden='true'>
                      {image ? (
                        <img
                          src={`https://image.tmdb.org/t/p/w342${image}`}
                          alt=''
                          loading='eager'
                        />
                      ) : (
                        <span>{initials(title)}</span>
                      )}
                    </div>
                  )}
                  <h3>
                    <button className='entry-name' onClick={() => expand(item)}>
                      <Name text={title} split={browsingPeople} />
                    </button>
                  </h3>
                  {browsingPeople && item.known_for_department && (
                    <p className='entry-role'>
                      {departments[item.known_for_department] ||
                        item.known_for_department}
                    </p>
                  )}
                  {credits && <p className='entry-credits'>{credits}</p>}
                  {!browsingPeople && (
                    <p className='entry-credits'>View films</p>
                  )}
                </article>
              )
            })}
          </div>
        ) : (
          <div className='films'>
            {results.map((item) => {
              const picked = picks.some((p) => p.id === item.id)
              const title = item.title || item.name || 'Untitled'
              return (
                <article
                  className={`film ${picked ? 'picked' : ''}`}
                  key={item.id}
                >
                  <div className='poster'>
                    {item.poster_path ? (
                      <img
                        src={`https://image.tmdb.org/t/p/w342${item.poster_path}`}
                        alt=''
                        loading='eager'
                      />
                    ) : (
                      <span>{initials(title)}</span>
                    )}
                    <button
                      className='pick'
                      aria-label={`${picked ? 'Remove' : 'Add'} ${title}`}
                      aria-pressed={picked}
                      onClick={() => toggle(item)}
                    >
                      {picked ? '✓' : '+'}
                    </button>
                  </div>
                  <h3>{title}</h3>
                  <p className='film-meta'>
                    {item.release_date?.slice(0, 4) || 'Year unknown'}
                    {!!item.vote_average && (
                      <span>★ {item.vote_average.toFixed(1)}</span>
                    )}
                  </p>
                </article>
              )
            })}
          </div>
        )}
        {!error && !loading && pages > 1 && (
          <nav className='pagination' aria-label='Result pages'>
            <button disabled={page === 1} onClick={() => setPage(page - 1)}>
              Previous
            </button>
            <span>
              Page {page} of {pages}
            </span>
            <button disabled={page === pages} onClick={() => setPage(page + 1)}>
              Next
            </button>
          </nav>
        )}
      </main>
      <dialog
        ref={listDialog}
        className='list-drawer'
        aria-labelledby='list-heading'
        onClick={(event) => {
          if (event.target === event.currentTarget) event.currentTarget.close()
        }}
      >
        <div className='drawer'>
          <div className='drawer-head'>
            <h2 id='list-heading'>Your list</h2>
            <button
              className='close'
              aria-label='Close list'
              onClick={() => listDialog.current?.close()}
            >
              ×
            </button>
          </div>
          <label>
            List name
            <input
              value={name}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <p className='drawer-count'>
            {picks.length} of 100 films. Saved in this browser.
          </p>
          {picks.length ? (
            <ol className='picks'>
              {picks.map((movie) => (
                <li key={movie.id}>
                  <span>
                    {movie.title}
                    {movie.release_date && (
                      <small>{movie.release_date.slice(0, 4)}</small>
                    )}
                  </span>
                  <button
                    aria-label={`Remove ${movie.title} from list`}
                    onClick={() => toggle(movie)}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ol>
          ) : (
            <p className='picks-empty'>
              Open someone’s films and press + on a poster to add it here.
            </p>
          )}
          <div className='drawer-actions'>
            <button
              className='create'
              disabled={!picks.length || !name.trim() || busy}
              onClick={create}
            >
              {busy ? 'Creating list…' : 'Create list in Radarr'}
            </button>
            <button className='copy' disabled={!picks.length} onClick={copy}>
              Copy Radarr list URL
            </button>
            <p>
              Radarr adds these films on its next list sync. It won’t search for
              them automatically.
            </p>
            {notice && (
              <p role='status' className='notice'>
                {notice}
              </p>
            )}
            {feed && (
              <label>
                List URL
                <input
                  readOnly
                  value={feed}
                  onFocus={(e) => e.target.select()}
                />
              </label>
            )}
          </div>
        </div>
      </dialog>
      <footer>
        <a href='https://www.themoviedb.org/' className='tmdb'>
          <svg
            viewBox='0 0 120 18'
            width='100'
            role='img'
            aria-label='The Movie Database'
          >
            <text x='0' y='15' fill='#90cea1' fontSize='18' fontWeight='bold'>
              TMDB
            </text>
            <rect x='62' y='2' width='55' height='14' rx='7' fill='#01b4e4' />
          </svg>
        </a>
        <p>
          This product uses the TMDB API but is not endorsed or certified by
          TMDB.
        </p>
        <a href='https://github.com/kylescudder/listarr'>GitHub</a>
      </footer>
    </div>
  )
}
const singular: Record<string, string> = {
  people: 'person',
  studios: 'studio',
  collections: 'collection',
  films: 'film'
}
const departments: Record<string, string> = {
  Acting: 'Actor',
  Directing: 'Director',
  Writing: 'Writer',
  Production: 'Producer',
  Camera: 'Cinematographer',
  Editing: 'Editor',
  Sound: 'Sound',
  Art: 'Production design',
  'Costume & Make-Up': 'Costume & make-up',
  'Visual Effects': 'Visual effects',
  Crew: 'Crew'
}
function initials(text: string) {
  return text
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
}
/** Directory style: family name set large, given names beneath it. */
function Name({ text, split }: { text: string; split: boolean }) {
  const parts = text.trim().split(/\s+/)
  if (!split || parts.length < 2) return <span className='family'>{text}</span>
  return (
    <>
      <span className='given'>{parts.slice(0, -1).join(' ')}</span>{' '}
      <span className='family'>{parts.at(-1)}</span>
    </>
  )
}
