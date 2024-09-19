import { FismaSystemType } from '@/types'
import { DataGrid, GridColDef } from '@mui/x-data-grid'
import { Box } from '@mui/material'
import { useState } from 'react'

import Link from '@mui/material/Link'
import QuestionnareModal from '../QuestionnareModal/QuestionnareModal'
import { first } from 'lodash'
type FismaTable2Props = {
  fismaSystems: FismaSystemType[]
  scores: Record<number, number>
}
export default function FismaTable({ fismaSystems, scores }: FismaTable2Props) {
  const [open, setOpen] = useState<boolean>(false)
  const [selectedRow, setSelectedRow] = useState<FismaSystemType | null>(null)
  const handleOpenModal = (row: FismaSystemType) => {
    setSelectedRow(row)
    setOpen(true)
  }
  const handleCloseModal = () => {
    setOpen(false)
    setSelectedRow(null)
  }
  const columns: GridColDef[] = [
    {
      field: 'fismaname',
      headerName: 'System Name',
      width: 430,
      hideable: false,
    },
    {
      field: 'issoemail',
      headerName: 'ISSO Name',
      flex: 1,
      hideable: false,
      valueGetter: (value) => {
        const name = value.row.issoemail.split('@')
        const fullName = name[0].replace(/[0-9]/g, '').split('.')
        return fullName.length > 1
          ? `${fullName[0]} ${fullName[1]}`
          : fullName[0]
      },
      renderCell: (params) => {
        const name = params.row.issoemail.split('@')
        const fullName = name[0].replace(/[0-9]/g, '').split('.')
        const firstName = fullName[0][0].toUpperCase() + fullName[0].slice(1)
        const lastName = fullName[1][0].toUpperCase() + fullName[1].slice(1)
        return fullName.length > 1 ? `${firstName} ${lastName}` : fullName[0]
      },
    },
    {
      field: 'Score',
      headerName: 'Zero Trust Score',
      type: 'number',
      flex: 1,
      align: 'center',
      hideable: false,
      valueGetter: (value) => {
        if (!scores[value.row.fismasystemid]) {
          return 0
        }
        return scores[value.row.fismasystemid].toFixed(2)
      },
      renderCell: (params) => {
        let score: number = 0
        let backgroundColor: string = ''
        if (scores[params.row.fismasystemid]) {
          score = scores[params.row.fismasystemid]
          if (score >= 1 && score <= 1.74) {
            backgroundColor = '#DAA9EC'
          } else if (score >= 1.75 && score <= 2.74) {
            backgroundColor = '#FFD5A5'
          } else if (score >= 2.75 && score <= 3.65) {
            backgroundColor = '#F2FBC4'
          } else if (score >= 3.66) {
            backgroundColor = '#93F0ED'
          }
        }
        return (
          <Box
            sx={{
              border: 1,
              p: 1,
              px: 4,
              borderRadius: 2,
              borderColor: 'darkgray',
              backgroundColor: backgroundColor,
            }}
          >
            {score.toFixed(2)}
          </Box>
        )
      },
    },
    {
      field: 'datacenterenvironment',
      headerName: 'Data Center Environment',
      flex: 1,
      hideable: false,
    },
    {
      field: 'actions',
      headerName: 'Actions',
      headerAlign: 'center',
      align: 'center',
      flex: 1,
      hideable: false,
      sortable: false,
      disableColumnMenu: true,
      renderCell: (params) => (
        <Link
          component="button"
          variant="body2"
          onClick={() => handleOpenModal(params.row as FismaSystemType)}
        >
          View Questionnare
        </Link>
      ),
    },
  ]

  return (
    <div style={{ height: 600, width: '100%' }}>
      <DataGrid
        rows={fismaSystems}
        columns={columns}
        getRowId={(row) => row.fismasystemid}
        slotProps={{
          filterPanel: {
            sx: {
              '& .MuiFormLabel-root': {
                marginTop: 1,
              },
            },
          },
        }}
        disableColumnSelector
        sx={{
          '& .MuiDataGrid-columnHeaders': {
            backgroundColor: '#004297',
            color: '#fff',
          },
          '& .MuiDataGrid-menuIconButton': {
            color: '#fff',
          },
          '& .MuiDataGrid-menuIcon': {
            color: '#fff',
          },
          '& .MuiDataGrid-sortIcon': {
            color: '#fff',
          },
          '& .MuiFormControl-root.MuiTextField-root': {
            marginTop: 0,
          },
          '& .MuiTablePagination-selectLabel': {
            marginBottom: 2,
          },
          '& .MuiTablePagination-displayedRows': {
            marginBottom: 2,
          },
        }}
      />
      <QuestionnareModal
        open={open}
        onClose={handleCloseModal}
        system={selectedRow}
      />
    </div>
  )
}
