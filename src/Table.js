import './Table.css';

export default function Table({items, headings, layout, rowRenderer}) {
  return (
    <table className="Table">
      <thead>
        {headings && (
          <tr>
            {headings.map((heading, i) => (
              <th
                key={i}
                style={{width: typeof layout[i] == 'number' ? layout[i] : null}}
              >
                {heading}
              </th>
            ))}
          </tr>
        )}
      </thead>
      <tbody>
        {items.map((item, i) => (
          <tr key={i}>
            {rowRenderer(item).map((cell, k) => (
              <td
                className={i % 2 === 0 ? 'Table_odd' : null}
                style={{width: typeof layout[k] == 'number' ? layout[k] : null}}
                key={k}
              >
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
