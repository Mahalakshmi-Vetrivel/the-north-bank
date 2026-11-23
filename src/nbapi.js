// Client for The North Bank's OWN backend (server/). This is separate from the shared Worker (live-api.js).
// Set VITE_NB_API_URL when the backend is hosted somewhere other than the developer's laptop.
export const nbBase = (import.meta.env.VITE_NB_API_URL || 'http://localhost:8787').replace(/\/$/, '');

export async function nbApi(path, { method, token, data, signal } = {}) {
  const headers = new Headers();
  if (token) headers.set('Authorization', 'Bearer ' + token);
  if (data) headers.set('Content-Type', 'application/json');
  const timeout = AbortSignal.timeout(15_000);
  let response;
  try {
    response = await fetch(nbBase + '/api' + path, {
      method: method || (data ? 'POST' : 'GET'), headers, signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      credentials: 'omit', ...(data && { body: JSON.stringify(data) }),
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error(timeout.aborted ? 'The bank server took too long to answer. Try again.'
      : 'Cannot reach the bank server. Make sure it is running (see server/README.md).');
  }
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(result.error?.message || 'The bank server returned HTTP ' + response.status + '.');
    error.status = response.status;
    error.code = result.error?.code;
    throw error;
  }
  return result;
}
