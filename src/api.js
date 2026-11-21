// Small helpers for the REST routes. Paths start with /api, which Vite
// proxies to Express in development. The browser sends the guest cookie
// automatically because it's the same address as the page.

async function request(path, { method = "GET", body } = {}) {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  createSession: (body) => request("/sessions", { method: "POST", body }),
  getSession: (id) => request(`/sessions/${encodeURIComponent(id)}`),
  joinSession: (id, name) =>
    request(`/sessions/${encodeURIComponent(id)}/join`, { method: "POST", body: { name } }),
  geocode: (query) => request(`/places/geocode?q=${encodeURIComponent(query)}`),
};
