import axiosInstance from '@/axiosConfig'

/**
 * Builds the datacall export URL. With no system ids the URL exports every
 * system in the datacall; with ids it scopes the export to those systems.
 * @param {number} datacallId - The datacall to export.
 * @param {Array<number | string>} [fsids] - Optional FISMA system ids to scope to.
 * @returns {string} The export request URL.
 */
export function buildExportUrl(
  datacallId: number,
  fsids?: Array<number | string>
): string {
  let url = `/datacalls/${datacallId}/export`
  if (fsids && fsids.length > 0) {
    url += '?' + fsids.map((id) => `fsids=${id}`).join('&')
  }
  return url
}

/**
 * Requests the datacall export as a blob and triggers a browser download,
 * using the filename from the response's content-disposition header.
 * @param {number} datacallId - The datacall to export.
 * @param {Array<number | string>} [fsids] - Optional FISMA system ids to scope to.
 * @returns {Promise<void>} Resolves once the download has been triggered.
 */
export async function exportSystemAnswers(
  datacallId: number,
  fsids?: Array<number | string>
): Promise<void> {
  const response = await axiosInstance.get(buildExportUrl(datacallId, fsids), {
    responseType: 'blob',
  })
  const [, filename] =
    response.headers['content-disposition'].split('filename=')
  const contentType = response.headers['content-type']
  const data = new Blob([response.data], {
    type: typeof contentType === 'string' ? contentType : undefined,
  })
  const url = window.URL.createObjectURL(data)
  const tempLink = document.createElement('a')
  tempLink.href = url
  tempLink.setAttribute('download', filename)
  tempLink.setAttribute('target', '_blank')
  tempLink.click()
  window.URL.revokeObjectURL(url)
}
