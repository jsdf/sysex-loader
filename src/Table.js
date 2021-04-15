import './Table.css';

export default function Table({items, headings, layout, rowRenderer}) {
  return (
    <table className="Table">
      {headings && (
        <thead>
          <tr>
            {headings.map((heading, i) => (
              <th
                key={i}
                className={`Table_col_${i}`}
                style={{
                  width:
                    layout && typeof layout[i] == 'number' ? layout[i] : null,
                }}
              >
                {heading}
              </th>
            ))}
          </tr>
        </thead>
      )}
      <tbody>
        {items.map((item, i) => (
          <tr key={i}>
            {rowRenderer(item, i).map((cell, k) => (
              <td
                className={`${i % 2 === 0 ? 'Table_odd' : null} Table_col_${k}`}
                style={{
                  width:
                    layout && typeof layout[k] == 'number' ? layout[k] : null,
                }}
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
