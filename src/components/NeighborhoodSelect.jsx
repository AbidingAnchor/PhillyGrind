import { ALL_NEIGHBORHOODS, HOME_NEIGHBORHOODS } from '../lib/homeNeighborhood.js';

export default function NeighborhoodSelect({
  value,
  onChange,
  allowAll = true,
  id,
  label = 'Neighborhood',
}) {
  return (
    <label className="neighborhood-select" htmlFor={id}>
      {label ? <span className="neighborhood-select-label">{label}</span> : null}
      <select
        id={id}
        value={value || (allowAll ? ALL_NEIGHBORHOODS : '')}
        onChange={(event) => onChange(event.target.value)}
      >
        {allowAll && <option value={ALL_NEIGHBORHOODS}>All Neighborhoods</option>}
        {HOME_NEIGHBORHOODS.map((name) => (
          <option key={name} value={name}>{name}</option>
        ))}
      </select>
    </label>
  );
}
