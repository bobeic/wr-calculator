import type { ReactNode } from 'react'

export interface Column<Row> {
  key: string
  label: string
  numeric?: boolean
  render: (row: Row) => ReactNode
}

/** A plain data table; every list on the site uses it so a design pass styles one component. */
export function StatTable<Row>({ rows, columns, rowKey, caption }: {
  rows: readonly Row[]
  columns: readonly Column<Row>[]
  rowKey: (row: Row) => string
  caption?: string
}) {
  return (
    <div className="table-wrap">
      <table>
        {caption !== undefined && <caption className="note">{caption}</caption>}
        <thead>
          <tr>{columns.map((column) => <th key={column.key} className={column.numeric ? 'num' : undefined} scope="col">{column.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)}>
              {columns.map((column) => <td key={column.key} className={column.numeric ? 'num' : undefined}>{column.render(row)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
