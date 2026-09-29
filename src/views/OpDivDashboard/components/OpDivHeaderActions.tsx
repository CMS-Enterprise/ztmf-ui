/**
 * OpDiv-scoped actions in the dashboard header.
 *
 * Each action is gated to the tier the backend actually accepts, so nothing on
 * offer here can 403. See EditOpDivModal for the two distinct write gates that
 * meet inside settings.
 *
 * @module views/OpDivDashboard/components/OpDivHeaderActions
 */
import { useState } from 'react'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import Button from '@mui/material/Button'
import ListSubheader from '@mui/material/ListSubheader'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Tooltip from '@mui/material/Tooltip'
import AddIcon from '@mui/icons-material/Add'
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined'
import MailOutlineIcon from '@mui/icons-material/MailOutline'
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined'
import EditSystemModal from '@/views/EditSystemModal/EditSystemModal'
import { EMPTY_SYSTEM } from '@/views/EditSystemModal/emptySystem'
import {
  collectExportCallIds,
  deriveExportCallId,
} from '@/views/Home/exportCall'
import { exportSystemAnswers } from '@/utils/exportSystems'
import { ERROR_MESSAGES } from '@/constants'
import { Routes } from '@/router/constants'
import { isAuthHandled, notify } from '@/utils/notify'
import { isAdmin, isUnscopedWriteAdmin } from '@/utils/userRoles'
import { useContextProp } from '@/views/Title/Context'
import EditOpDivModal from './EditOpDivModal'
import { buildOpDivMailto } from '../opdivMailto'
import type { DashboardMaps } from '@/views/Home/aggregateScores'
import type { FismaSystemType, OpDiv } from '@/types'

/** Props for {@link OpDivHeaderActions}. */
export type OpDivHeaderActionsProps = {
  /** Null in the aggregate view. */
  opdiv: OpDiv | null
  /** True when the page covers every OpDiv the caller can see. */
  isAggregate?: boolean
  /** The OpDiv's active systems, for export scope and mail recipients. */
  systems: FismaSystemType[]
  maps: DashboardMaps
}

/**
 * Renders the header action row for one OpDiv.
 * @param {OpDivHeaderActionsProps} props - The OpDiv and its systems.
 * @returns {JSX.Element} The actions.
 */
export default function OpDivHeaderActions({
  opdiv,
  isAggregate = false,
  systems,
  maps,
}: OpDivHeaderActionsProps) {
  const navigate = useNavigate()
  const {
    userInfo,
    latestDataCallId,
    selectedDatacall,
    datacalls,
    datacenterEnvironments,
    opdivs,
    setFismaSystems,
  } = useContextProp()

  const [exporting, setExporting] = useState(false)
  const [exportAnchor, setExportAnchor] = useState<null | HTMLElement>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const canAddSystem = isAdmin(userInfo)
  const canManageOpDivs = isUnscopedWriteAdmin(userInfo)
  const isOwner = userInfo.role === 'OWNER'
  // Settings is worth offering when at least one of its controls is live.
  // Settings edits ONE OpDiv's record, so it has nothing to act on when the
  // page covers all of them.
  const canOpenSettings = !isAggregate && (isOwner || canManageOpDivs)

  const systemIds = systems.map((s) => s.fismasystemid)
  const activeDataCallId = selectedDatacall?.datacallid ?? latestDataCallId
  // The export endpoint is per-call. FY26 onward runs one call per year, so
  // this normally resolves to a single id and exports directly; the earlier
  // multi-call years stay viewable though, and there the button offered no
  // target at all. Offer the choice rather than disabling.
  const exportCallIds = collectExportCallIds(
    systemIds,
    maps.systemCallMap,
    maps.chosenCallMap
  )
  const singleExportCallId = deriveExportCallId(
    systemIds,
    maps.systemCallMap,
    maps.chosenCallMap,
    activeDataCallId
  )
  const callName = (id: number) =>
    datacalls.find((dc) => dc.datacallid === id)?.datacall ?? `Call ${id}`
  const hasSystems = systemIds.length > 0

  const runExport = async (callId: number) => {
    setExporting(true)
    try {
      await exportSystemAnswers(callId, systemIds)
    } catch (error) {
      if (!isAuthHandled(error)) {
        notify(ERROR_MESSAGES.tryAgain, 'warning', { autoHideDuration: 4000 })
      }
    } finally {
      setExporting(false)
    }
  }

  const handleExportClick = (event: React.MouseEvent<HTMLElement>) => {
    if (exportCallIds.length > 1) {
      setExportAnchor(event.currentTarget)
      return
    }
    if (singleExportCallId) void runExport(singleExportCallId)
  }

  const scopeLabel = isAggregate ? 'all OpDivs' : opdiv?.code ?? ''
  const mailto = buildOpDivMailto(
    systems,
    isAggregate ? 'HHS' : opdiv?.code ?? ''
  )

  // The promised escape hatch for the truncation case: the addresses are all
  // on the client, so losing them to a URL length limit would be gratuitous.
  const handleCopyAddresses = async () => {
    try {
      await navigator.clipboard.writeText(mailto.addresses.join(', '))
      notify(`Copied ${mailto.count} addresses`, 'success')
    } catch {
      notify('Could not copy to the clipboard', 'error')
    }
  }

  const handleCloseAdd = (created: FismaSystemType) => {
    if (created && created.fismasystemid) {
      setFismaSystems((prev) => [...prev, created])
    }
    setAddOpen(false)
  }

  return (
    <>
      {/* Tooltip wraps a span, not the button: a disabled element fires no
          pointer events, so a native title on it never appears - which left
          the one state that needs explaining silently unexplained. */}
      <Tooltip
        title={
          !hasSystems
            ? 'This OpDiv has no active systems to export'
            : exportCallIds.length > 1
              ? 'Choose which data call to export'
              : `Export all ${systemIds.length} systems in ${scopeLabel}`
        }
      >
        <span>
          <Button
            variant="outlined"
            color="primary"
            startIcon={<FileDownloadOutlinedIcon />}
            endIcon={
              exportCallIds.length > 1 ? <ArrowDropDownIcon /> : undefined
            }
            onClick={handleExportClick}
            disabled={exporting || !hasSystems}
            aria-haspopup={exportCallIds.length > 1 ? 'menu' : undefined}
          >
            {exporting ? 'Exporting…' : 'Export'}
          </Button>
        </span>
      </Tooltip>
      <Menu
        anchorEl={exportAnchor}
        open={Boolean(exportAnchor)}
        onClose={() => setExportAnchor(null)}
      >
        <ListSubheader sx={{ fontSize: 11, lineHeight: 2.4 }}>
          Export answers for
        </ListSubheader>
        {exportCallIds.map((callId) => (
          <MenuItem
            key={callId}
            onClick={() => {
              setExportAnchor(null)
              void runExport(callId)
            }}
          >
            {callName(callId)}
          </MenuItem>
        ))}
      </Menu>

      {/* mailto rather than the mass-email endpoint: that endpoint takes a
          global recipient group with no per-OpDiv scoping and rejects
          OpDiv-scoped admins outright, so it cannot honor this page's scope.

          Three distinct states, because a disabled anchor is not reliably
          inert and a too-long mailto is silently truncated by mail clients -
          losing recipients without telling anyone. Only the middle case is a
          link at all. */}
      {mailto.count === 0 ? (
        <Button
          variant="outlined"
          color="primary"
          startIcon={<MailOutlineIcon />}
          disabled
          title={`No ISSO or data-call contact addresses are recorded for ${scopeLabel}`}
        >
          Email
        </Button>
      ) : mailto.truncated ? (
        <Button
          variant="outlined"
          color="primary"
          startIcon={<ContentCopyIcon />}
          onClick={handleCopyAddresses}
          title={`Too many recipients for a mail link - copy all ${mailto.count} addresses instead`}
        >
          Copy {mailto.count} addresses
        </Button>
      ) : (
        <Button
          variant="outlined"
          color="primary"
          startIcon={<MailOutlineIcon />}
          component="a"
          href={mailto.href}
          title={`Compose an email to ${mailto.count} ${
            mailto.count === 1 ? 'contact' : 'contacts'
          } in ${scopeLabel}`}
        >
          Email
        </Button>
      )}

      <Button
        component={RouterLink}
        // No OpDiv param in the aggregate - the unfiltered roster IS the
        // aggregate's roster.
        to={
          isAggregate
            ? Routes.USERS
            : `${Routes.USERS}?opdiv=${opdiv?.opdiv_id}`
        }
        variant="outlined"
        color="primary"
      >
        Users
      </Button>

      {canManageOpDivs && (
        <Button
          component={RouterLink}
          to={Routes.OPDIVS_MANAGE}
          variant="outlined"
        >
          Manage OpDivs
        </Button>
      )}

      {canOpenSettings && (
        <Button
          variant="outlined"
          color="primary"
          startIcon={<SettingsOutlinedIcon />}
          onClick={() => setSettingsOpen(true)}
        >
          Settings
        </Button>
      )}

      {canAddSystem && (
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={() => setAddOpen(true)}
        >
          Add system
        </Button>
      )}

      {canAddSystem && (
        <EditSystemModal
          title="Add"
          open={addOpen}
          onClose={handleCloseAdd}
          // No OpDiv to prefill in the aggregate; the modal's own picker
          // still requires one before the create can be submitted.
          system={{ ...EMPTY_SYSTEM, opdiv_id: opdiv?.opdiv_id }}
          mode="create"
          datacenterEnvironments={datacenterEnvironments}
          // Required: without the catalog the modal's OpDiv dropdown renders
          // empty and the prefilled id has nothing to display against.
          opdivs={opdivs}
        />
      )}

      {canOpenSettings && opdiv && (
        <EditOpDivModal
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          opdiv={opdiv}
          canManage={isOwner}
          canToggleDelegate={canManageOpDivs}
          // A deactivated OpDiv leaves the switcher, so staying on its
          // dashboard would strand the user on a page they can no longer reach.
          onDeactivated={() => navigate(Routes.OPDIVS, { replace: true })}
        />
      )}
    </>
  )
}
