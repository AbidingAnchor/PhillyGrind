function CategoryFilters({ categories, activeCategory, onChange }) {
  return (
    <div className="filter-row" aria-label="Category filters">
      {categories.map((category) => (
        <button
          key={category}
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
