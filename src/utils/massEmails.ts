import { useMutation } from '@tanstack/react-query'
import axiosInstance from '@/axiosConfig'
import { apiPaths } from '@/api/keys'

/** Request body for POST /massemails. */
export type MassEmailInput = {
  /** Role group to send to, such as ISSO or SYSTEM_DELEGATE. */
  group: string
  subject: string
  body: string
}

/**
 * Sends one mass email to a role group.
 *
 * @param input - The group, subject and body to send.
 * @returns The addresses the backend actually sent to, for the receipt the
 *   modal shows afterwards.
 */
export async function sendMassEmail(input: MassEmailInput): Promise<string[]> {
  const res = await axiosInstance.post<{ data: string[] | null }>(
    apiPaths.massEmails,
    input
  )
  return res.data.data ?? []
}

/**
 * Mutation that sends a mass email.
 *
 * Nothing is invalidated. The send changes no server state this app reads,
 * and the recipient list comes back in the response rather than from a
 * refetch. Error handling stays with the caller, which shows one toast.
 *
 * @returns The mutation, taking a MassEmailInput and resolving to the
 *   addresses that were sent to.
 */
export function useSendMassEmail() {
  return useMutation({ mutationFn: sendMassEmail })
}
