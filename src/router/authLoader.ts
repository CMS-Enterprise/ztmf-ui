/**
 * Auth state loader for react-router data routes.
 * @module router/authLoader
 * @see {@link dashboard/Routes}
 */

const authLoader = async (): Promise<unknown> => {
  return fetch('/whoami')
    .then(async (response) => {
      let body: string | Promise<string>
      if (!response.ok) {
        body = ''
      } else {
        body = await response.text()
      }
      return { ok: response.ok, response: body }
    })
    .catch((e) => console.log(e))
}

export default authLoader
