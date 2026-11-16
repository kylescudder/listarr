import { createFileRoute } from '@tanstack/react-router'
import { ClerkProvider, SignInButton, UserButton, useAuth } from '@clerk/react'
import { useEffect, useState } from 'react'
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
type Result = Movie & { name?: string; profile_path?: string | null }
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
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState('movie')
  const [genre, setGenre] = useState('')
  const [year, setYear] = useState('')
  const [sort, setSort] = useState('popularity.desc')
  const [results, setResults] = useState<Result[]>([])
  const [radarrFiltered, setRadarrFiltered] = useState(false)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [endpoint, setEndpoint] = useState('/api/search')
  const [params, setParams] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [heading, setHeading] = useState('Popular pictures')
  const [resultKind, setResultKind] = useState('movie')
  const [picks, setPicks] = useState<Movie[]>([])
  const [name, setName] = useState('My picture programme')
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
        setRadarrFiltered(Boolean(data.radarrFiltered))
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
  function search(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    setResults([])
    setEndpoint('/api/search')
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
    setHeading(query ? `Results for “${query}”` : 'Discover pictures')
  }
  function expand(item: Result) {
    setLoading(true)
    setResults([])
    setEndpoint(`/api/${resultKind}/${item.id}`)
    setParams('')
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
        'A programme can contain up to 100 films. Remove one to add another.'
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
          ? 'This programme is already in Radarr.'
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
  return (
    <div className='app'>
      <header className='topbar'>
        <a href='/' className='brand'>
          <img src='/icon.svg' alt='' />
          Listarr
        </a>
        <span className='house'>Scudder Picture House</span>
        <div className='account'>
          {account}
          <a href='https://github.com/kylescudder/listarr'>GitHub</a>
        </div>
      </header>
      <main>
        <section className='marquee'>
          <div className='bulbs' />
          <div className='letterboard'>
            <p>A double bill? A whole season? Your call.</p>
            <h1>
              Good pictures.
              <br />
              Your programme.
            </h1>
            <p>
              Find films on TMDB. Put them on the bill. Make a list for Radarr.
            </p>
          </div>
          <div className='bulbs' />
        </section>
        <div className='workspace'>
          <section className='browse' aria-label='Find films'>
            <form onSubmit={search} className='search-form'>
              <label className='search-input'>
                Search TMDB
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder='A film, a favourite actor, a collection…'
                  maxLength={150}
                />
              </label>
              <label>
                Look for
                <select
                  aria-label='Look for'
                  value={kind}
                  onChange={(e) => setKind(e.target.value)}
                >
                  <option value='movie'>Films</option>
                  <option value='person'>People</option>
                  <option value='collection'>Collections</option>
                </select>
              </label>
              <button className='gold' type='submit'>
                Search
              </button>
              <details className='filters'>
                <summary>Discover by genre, year & rating</summary>
                <p>Leave the search box empty to explore with these filters.</p>
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
                </div>
                <button type='submit' className='quiet'>
                  Discover films
                </button>
              </details>
            </form>
            <div className='results-heading'>
              <h2>{heading}</h2>
              <span>
                {loading ? 'Loading…' : `${results.length} on this page`}
              </span>
            </div>
            {!loading && !error && radarrFiltered && (
              <p>Films already in Radarr are hidden.</p>
            )}
            {error ? (
              <div role='alert' className='error'>
                <h3>Projection paused</h3>
                <p>{error}</p>
                <button
                  onClick={() => setParams(`${params}&retry=${Date.now()}`)}
                >
                  Try again
                </button>
              </div>
            ) : loading ? (
              <div className='empty' role='status'>
                Finding your next picture…
              </div>
            ) : results.length === 0 ? (
              <div className='empty'>
                <h3>No pictures found</h3>
                <p>
                  Try another title, person or collection, or broaden your
                  filters.
                </p>
              </div>
            ) : (
              <div className='films'>
                {results.map((item) => {
                  const picked = picks.some((p) => p.id === item.id)
                  const title = item.title || item.name || 'Untitled'
                  const image = item.poster_path || item.profile_path
                  return (
                    <article
                      className={`film ${picked ? 'picked' : ''}`}
                      key={item.id}
                    >
                      <div className='poster'>
                        {image ? (
                          <img
                            src={`https://image.tmdb.org/t/p/w342${image}`}
                            alt=''
                            loading='lazy'
                          />
                        ) : (
                          <span className='poster-placeholder'>
                            Picture
                            <br />
                            House
                          </span>
                        )}
                        {resultKind === 'movie' && (
                          <button
                            className='pick'
                            aria-label={`${picked ? 'Remove' : 'Add'} ${title}`}
                            aria-pressed={picked}
                            onClick={() => toggle(item)}
                          >
                            {picked ? '✓' : '+'}
                          </button>
                        )}
                      </div>
                      <div className='film-info'>
                        <p className='film-meta'>
                          {item.release_date?.slice(0, 4) ||
                            (resultKind === 'person'
                              ? 'Filmography'
                              : resultKind === 'collection'
                                ? 'Collection'
                                : 'Year unknown')}
                          {!!item.vote_average &&
                            ` / ★ ${item.vote_average.toFixed(1)}`}
                        </p>
                        <h3>{title}</h3>
                        {resultKind !== 'movie' && (
                          <button
                            className='quiet'
                            onClick={() => expand(item)}
                          >
                            Explore films
                          </button>
                        )}
                      </div>
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
                <button
                  disabled={page === pages}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </button>
              </nav>
            )}
          </section>
          <aside className='ticket' aria-labelledby='ticket-heading'>
            <div className='ticket-top'>
              <span>Scudder Picture House</span>
              <span>Admit all</span>
            </div>
            <h2 id='ticket-heading'>Your programme</h2>
            <p className='ticket-intro'>
              A hand-picked bill, ready for Radarr.
            </p>
            <label>
              Programme name
              <input
                value={name}
                maxLength={80}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <div className='ticket-count'>
              <strong>{String(picks.length).padStart(2, '0')}</strong>
              <span>
                of 100 films
                <br />
                on the bill
              </span>
            </div>
            {picks.length ? (
              <ol className='picks'>
                {picks.map((movie) => (
                  <li key={movie.id}>
                    <span>{movie.title}</span>
                    <button
                      aria-label={`Remove ${movie.title} from programme`}
                      onClick={() => toggle(movie)}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ol>
            ) : (
              <div className='ticket-empty'>
                The bill is yours to fill.
                <br />
                Pick a film with the + button.
              </div>
            )}
            <div className='ticket-stub'>
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
                Creates an import list. Automatic search stays off. Your draft
                is saved in this browser.
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
          </aside>
        </div>
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
          <a href='https://github.com/kylescudder/sortarr'>
            Also at the Picture House: Sortarr
          </a>
        </footer>
      </main>
    </div>
  )
}
