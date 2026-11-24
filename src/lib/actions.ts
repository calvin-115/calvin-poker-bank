import { getAuthToken } from 'deepspace'

/** Calls a server action from src/actions and returns its data, or throws its error. */
export async function callAction<T>(name: string, params: Record<string, unknown>): Promise<T> {
  const res = await fetch(`/api/actions/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await getAuthToken()}` },
    body: JSON.stringify(params),
  })
  const body = (await res.json()) as { success?: boolean; data?: T; error?: string }
  if (!body.success) throw new Error(body.error ?? `Something went wrong (${res.status}).`)
  return body.data as T
}
