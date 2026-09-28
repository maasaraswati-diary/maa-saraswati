import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Icon from '../components/Icons';
import ProductCard from '../components/ProductCard';
import {
  CardSkeleton,
  EmptyState,
  ErrorState,
  PageHeader,
} from '../components/Feedback';
import { getProducts, getCategories } from '../catalogue';
import { compareByPrice } from '../api';
import { useDebounced, useFetch, usePageMeta } from '../hooks';

const SORTS = [
  { value: 'popular', label: 'Most Popular' },
  { value: 'price-asc', label: 'Price: Low to High' },
  { value: 'price-desc', label: 'Price: High to Low' },
  { value: 'rating', label: 'Top Rated' },
  { value: 'name', label: 'Name: A to Z' },
];

export default function Products() {
  usePageMeta({
    title: 'Our Products',
    description:
      'Browse the full Maa Saraswati range: milk, paneer, cheese, curd, cream, butter, ghee and rose lassi. Honest labelling, small batches, delivered fresh in Gurdaspur.',
  });
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState(params.get('q') || '');
  const [sort, setSort] = useState('popular');

  const category = params.get('category') || 'All';
  const debouncedQuery = useDebounced(query, 320);

  const catQuery = category === 'All' ? {} : { category };
  const { data, loading, error, reload } = useFetch(
    () => getProducts({ params: { ...catQuery, q: debouncedQuery } }),
    [category, debouncedQuery]
  );

  const catData = useFetch(() => getCategories(), []);

  // Keep the URL and the search box in sync.
  useEffect(() => {
    const next = {};
    if (category !== 'All') next.category = category;
    if (debouncedQuery) next.q = debouncedQuery;
    setParams(next, { replace: true });
  }, [category, debouncedQuery, setParams]);

  const setCategory = (name) => {
    const next = {};
    if (name !== 'All') next.category = name;
    if (debouncedQuery) next.q = debouncedQuery;
    setParams(next, { replace: true });
  };

  const products = useMemo(() => {
    const list = [...(data?.products || [])];
    switch (sort) {
      // Unpriced products go last in both directions, so they are not led to the
      // front of the page as the cheapest thing on it.
      case 'price-asc':
        return list.sort((a, b) => compareByPrice(a, b, 1));
      case 'price-desc':
        return list.sort((a, b) => compareByPrice(a, b, -1));
      case 'rating':
        return list.sort((a, b) => b.rating - a.rating);
      case 'name':
        return list.sort((a, b) => a.name.localeCompare(b.name));
      default:
        return list.sort(
          (a, b) => Number(b.featured) - Number(a.featured) || b.rating - a.rating
        );
    }
  }, [data, sort]);

  const categories = catData.data?.categories || [];
  const hasFilters = category !== 'All' || debouncedQuery;

  return (
    <>
      <PageHeader
        eyebrow="Our Catalogue"
        title={
          <>
            Everything we make, <span className="serif-it hl">fresh daily</span>
          </>
        }
        subtitle="Milk, paneer, curd, ghee and more — all made in small batches from our own milk, and dispatched the same day."
      >
        <div className="cat-tabs">
          {(categories.length ? categories : [{ name: 'All', count: 0 }]).map(
            (c, i) => (
              <button
                key={c.name}
                className={`cat-tab reveal reveal-d${i + 1} ${
                  category === c.name ? 'active' : ''
                }`}
                onClick={() => setCategory(c.name)}
              >
                {c.name}
                <span className="pill-count">{c.count}</span>
              </button>
            )
          )}
        </div>
      </PageHeader>

      <section className="section-sm">
        <div className="container">
          <div className="toolbar reveal">
            <div className="search-box">
              <Icon.Search size={19} className="search-icon" />
              <input
                className="search-input"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search milk, paneer, ghee…"
                aria-label="Search products"
              />
              {query && (
                <button
                  className="search-clear"
                  onClick={() => setQuery('')}
                  aria-label="Clear search"
                >
                  <Icon.X size={16} />
                </button>
              )}
            </div>

            <div className="toolbar-right">
              <span className="result-count">
                {loading ? 'Loading…' : `${products.length} product${products.length === 1 ? '' : 's'}`}
              </span>
              <div className="sort-box">
                <label htmlFor="sort" className="sr-only">
                  Sort products
                </label>
                <select
                  id="sort"
                  className="select"
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                >
                  {SORTS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {hasFilters && (
            <div className="active-filters reveal">
              <span className="muted">Filtering by:</span>
              {category !== 'All' && (
                <button className="filter-chip" onClick={() => setCategory('All')}>
                  {category} <Icon.X size={14} />
                </button>
              )}
              {debouncedQuery && (
                <button className="filter-chip" onClick={() => setQuery('')}>
                  “{debouncedQuery}” <Icon.X size={14} />
                </button>
              )}
              <button
                className="filter-clear"
                onClick={() => {
                  setCategory('All');
                  setQuery('');
                }}
              >
                Clear all
              </button>
            </div>
          )}

          {loading && <CardSkeleton count={6} />}
          {error && <ErrorState message={error} onRetry={reload} />}

          {!loading && !error && products.length === 0 && (
            <EmptyState
              title="No products found"
              message={`We could not find anything matching “${debouncedQuery}”. Try a different word, or browse the full catalogue.`}
              action={
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    setCategory('All');
                    setQuery('');
                  }}
                >
                  <Icon.Refresh size={16} /> Reset filters
                </button>
              }
            />
          )}

          {!loading && !error && products.length > 0 && (
            <div className="grid grid-products" key={`${category}-${debouncedQuery}-${sort}`}>
              {products.map((p, i) => (
                <ProductCard key={p.id} product={p} index={i + 1} headingLevel={2} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Enquiry strip */}
      <section className="section-sm">
        <div className="container">
          <div className="enq-strip reveal">
            <div className="enq-strip-icon">
              <Icon.Phone size={28} />
            </div>
            <div className="enq-strip-copy">
              <h3 className="h3">Need it in bulk?</h3>
              <p className="muted">
                Shops, hotels, offices and events — tell us your daily
                requirement and we will set up a delivery schedule.
              </p>
            </div>
            <Link to="/contact" className="btn btn-red">
              Request a Quote <Icon.ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
