import * as React from 'react'
import Paper from '@mui/material/Paper'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TablePagination from '@mui/material/TablePagination'
import TableRow from '@mui/material/TableRow'
import { FismaSystemType } from '@/types'
import { useEffect, useState } from 'react'
import axiosInstance from '@/axiosConfig'
import { TableSortLabel } from '@mui/material'
import QuestionnareModal from '../QuestionnareModal/QuestionnareModal'
import Link from '@mui/material/Link'
type ColumnData = {
  dataKey: keyof FismaSystemType
  label: string
  numeric?: boolean
  width: number
  align?: 'center' | 'left' | 'right'
  disablePadding?: boolean
}

const columns: ColumnData[] = [
  {
    width: 10,
    label: 'Acronym',
    dataKey: 'fismaacronym',
    disablePadding: false,
    align: 'left',
  },
  {
    width: 20,
    label: 'System Name',
    dataKey: 'fismaname',
    disablePadding: false,
    align: 'left',
  },
  {
    width: 10,
    label: 'Data Center Environment',
    dataKey: 'datacenterenvironment',
    disablePadding: false,
    align: 'left',
    numeric: false,
  },
  {
    width: 5,
    label: 'Details',
    dataKey: 'fismauid',
    disablePadding: false,
    align: 'center',
  },
]

function descendingComparator<T>(a: T, b: T, orderBy: keyof T) {
  if (b[orderBy] < a[orderBy]) {
    return -1
  }
  if (b[orderBy] > a[orderBy]) {
    return 1
  }
  return 0
}

type Order = 'asc' | 'desc'

function getComparator<Key extends keyof FismaSystemType>(
  order: Order,
  orderBy: Key
): (
  a: { [key in Key]: number | string },
  b: { [key in Key]: number | string }
) => number {
  return order === 'desc'
    ? (a, b) => descendingComparator(a, b, orderBy)
    : (a, b) => -descendingComparator(a, b, orderBy)
}

function stableSort<T>(array: T[], comparator: (a: T, b: T) => number): T[] {
  return array.slice().sort(comparator)
}

type EnhancedTableProps = {
  onRequestSort: (
    event: React.MouseEvent<unknown>,
    property: keyof FismaSystemType
  ) => void
  order: Order
  orderBy: keyof FismaSystemType
}

function EnhancedTableHead(props: EnhancedTableProps) {
  const { order, orderBy, onRequestSort } = props
  const createSortHandler =
    (property: keyof FismaSystemType) => (event: React.MouseEvent<unknown>) => {
      if (property !== 'fismauid') {
        onRequestSort(event, property)
      }
    }

  return (
    <TableHead>
      <TableRow>
        {columns.map((headCell) => (
          <TableCell
            key={headCell.dataKey}
            align={'left'}
            padding={'normal'}
            sx={{
              minWidth: `${headCell.width}%`,
              width: `${headCell.width}%`,
              backgroundColor: 'rgb(13, 36, 153)',
              color: 'white',
            }}
            sortDirection={orderBy === headCell.dataKey ? order : false}
          >
            {headCell.dataKey !== 'fismauid' ? (
              <TableSortLabel
                active={orderBy === headCell.dataKey}
                direction={orderBy === headCell.dataKey ? order : 'asc'}
                onClick={createSortHandler(headCell.dataKey)}
                sx={{
                  color: 'white', // Set default color to white
                  '&.Mui-active': {
                    color: 'white', // Ensure it stays white when active
                  },
                  '&:hover': {
                    color: 'white', // Ensure it stays white on hover
                  },
                  '& .MuiTableSortLabel-icon': {
                    color: 'white !important', // Set the icon color to white
                  },
                }}
              >
                {headCell.label}
              </TableSortLabel>
            ) : (
              headCell.label
            )}
          </TableCell>
        ))}
      </TableRow>
    </TableHead>
  )
}

export default function FismaTable() {
  const [fismaSystems, setFismaSystems] = useState<FismaSystemType[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [order, setOrder] = useState<Order>('asc')
  const [orderBy, setOrderBy] = useState<keyof FismaSystemType>('fismaacronym')
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false)
  const [selectedSystem, setSelectedSystem] = useState<FismaSystemType | null>(
    null
  )

  const handleOpenModal = (system: FismaSystemType) => {
    setSelectedSystem(system)
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
  }
  const handleRequestSort = (
    _event: React.MouseEvent<unknown>,
    property: keyof FismaSystemType
  ) => {
    const isAsc = orderBy === property && order === 'asc'
    setOrder(isAsc ? 'desc' : 'asc')
    setOrderBy(property)
  }

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage)
  }

  const handleChangeRowsPerPage = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setRowsPerPage(+event.target.value)
    setPage(0)
  }

  useEffect(() => {
    const fetchFismaSystems = async () => {
      try {
        const fismaSystems = await axiosInstance.get('/fismasystems')
        if (fismaSystems.status !== 200) {
          throw new Error('Failed to fetch data. Status was not 200')
        }
        setFismaSystems(fismaSystems.data.data)
      } catch (error) {
        console.log(error)
      } finally {
        setLoading(false)
      }
    }
    fetchFismaSystems()
  }, [])

  if (loading) {
    return <p>Loading ...</p>
  }

  return (
    <Paper style={{ height: 500, width: '100%', marginBottom: '5vh' }}>
      <TableContainer sx={{ maxHeight: 440 }}>
        <Table stickyHeader aria-label="sticky table">
          <EnhancedTableHead
            order={order}
            orderBy={orderBy}
            onRequestSort={handleRequestSort}
          />
          <TableBody>
            {fismaSystems ? (
              stableSort(fismaSystems, getComparator(order, orderBy))
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map((system) => {
                  return (
                    <TableRow
                      hover
                      role="checkbox"
                      tabIndex={-1}
                      key={system.fismasystemid}
                    >
                      {columns.map((column) => {
                        const value = system[column.dataKey]
                        if (column.dataKey === 'fismauid') {
                          return (
                            <TableCell
                              key={column.dataKey}
                              align={column.align}
                            >
                              <Link
                                component="button"
                                variant="body2"
                                onClick={() => handleOpenModal(system)}
                              >
                                View Questionnare
                              </Link>
                            </TableCell>
                          )
                        }

                        return (
                          <TableCell key={column.dataKey} align={column.align}>
                            {value}
                          </TableCell>
                        )
                      })}
                    </TableRow>
                  )
                })
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length}>
                  No data available
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination
        rowsPerPageOptions={[10, 25, 100]}
        component="div"
        count={fismaSystems.length}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={handleChangePage}
        onRowsPerPageChange={handleChangeRowsPerPage}
        sx={{
          '& .MuiTablePagination-toolbar p': {
            marginTop: 0,
          },
        }}
      />
      <QuestionnareModal
        open={isModalOpen}
        onClose={handleCloseModal}
        system={selectedSystem}
      />
    </Paper>
  )
}
