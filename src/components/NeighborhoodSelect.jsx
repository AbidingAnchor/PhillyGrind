import { ALL_NEIGHBORHOODS, HOME_NEIGHBORHOODS } from '../lib/homeNeighborhood.js';

export default function NeighborhoodSelect({
  value,
  onChange,
  allowAll = true,
  id,
  label = 'Neighborhood',
  required = false,
}) {
  const selected = value || (allowAll ? ALL_NEIGHBORHOODS : '');
  const extraOption = selected && selected !== ALL_NEIGHBORHOODS && !HOME_NEIGHBORHOODS.includes(selected)
    ? selected
    : '';

  return (
    <label className="neighborhood-select" htmlFor={id}>
      {label ? <span className="neighborhood-select-label">{label}</span> : null}
      <select
        id={id}
        value={selected}
        onChange={(event) => onChange(event.target.value)}
        required={required}
      >
        {allowAll && <option value={ALL_NEIGHBORHOODS}>All Neighborhoods</option>}
        {!allowAll && <option value="" disabled>Select a neighborhood</option>}
        {extraOption && <option value={extraOption}>{extraOption}</option>}
        {HOME_NEIGHBORHOODS.map((name) => (
          <option key={name} value={name}>{name}</option>
        ))}
      </select>
    </label>
  );
}
