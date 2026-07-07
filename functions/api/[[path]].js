export async function onRequest(context) {
  const { request, env, params } = context;

  const backend = (env.VUE_APP_API_BASE_URL || '').replace(/\/+$/, '');
  if (!backend) {
    return new Response('VUE_APP_API_BASE_URL env var is not configured', { status: 500 });
  }

  const url = new URL(request.url);
  const path = Array.isArray(params.path) ? params.path.join('/') : (params.path || '');
  const target = `${backend}/api/${path}${url.search}`;

  const proxied = new Request(target, request);
  proxied.headers.set('Host', new URL(backend).host);

  return fetch(proxied);
}
