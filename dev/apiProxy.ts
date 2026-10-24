import { TLSSocket } from 'node:tls';
import type { ProxyOptions } from 'vite';

/** Only the local HTTP dev proxy relaxes the API's Secure session cookie. */
export function adaptSessionCookie(cookie: string, https: boolean): string {
  if (https || cookie.slice(0, cookie.indexOf('=')) !== 'gkfeed.session') return cookie;
  return cookie.replace(/;\s*Secure\s*(?=;|$)/gi, '');
}

export function createDevApiProxy(target = 'https://feed.gws.freemyip.com'): ProxyOptions {
  return {
    target,
    // Changes Host for upstream routing. Origin must reach the API unchanged.
    changeOrigin: true,
    configure(proxy) {
      proxy.on('proxyRes', (response, request) => {
        const cookies = response.headers['set-cookie'];
        if (!cookies) return;
        // Use the actual browser connection, never an untrusted forwarded header.
        const https = request.socket instanceof TLSSocket && request.socket.encrypted;
        response.headers['set-cookie'] = cookies.map((cookie) => adaptSessionCookie(cookie, https));
      });
    },
  };
}
