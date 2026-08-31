export function filterKey(label) {
  return String(label)
    .toLowerCase()
    .replace(/&/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function CategoryFilters({ categories, activeCategory, onChange }) {
  return (
    <div className="filter-row" aria-label="Category filters">
      {categories.map((category) => (
        <button
          key={category}
          data-filter={filterKey(category)}
          className={activeCategory === category ? 'filter active' : 'filter'}
          onClick={() => onChange(category)}
          type="button"
        >
          {category}
        </button>
      ))}
    </div>
  );
}

export default CategoryFilters;
