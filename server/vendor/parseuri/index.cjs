/* global module */
/*
 * Compatibility backport for Socket.IO 2.x / Engine.IO 3.x.
 *
 * The parser is based on parseuri 2.0.0 (MIT, Steven Levithan), whose parser
 * replaced the ReDoS-vulnerable expression in parseuri 0.0.6. The returned
 * property names intentionally retain the 0.0.6 CommonJS API expected by the
 * old Socket.IO client, so the Engine.IO v3 wire protocol does not change.
 */

const parser = getParser();

module.exports = function parseuri(input) {
  const source = String(input || '').trim();
  const match = parser.exec(source);
  const groups = match ? match.groups : {};
  const protocol = groups.protocol || '';
  const authority = groups.authority || '';
  const user = groups.username || '';
  const password = groups.password || '';
  const host = groups.hostname || '';
  const port = groups.port || '';
  const path = groups.pathname || '';
  const directory = groups.directory || '';
  const file = groups.filename || '';
  const query = groups.query || '';
  const anchor = groups.fragment || '';
  const relative = `${path}${query ? `?${query}` : ''}${anchor ? `#${anchor}` : ''}`;

  return {
    source,
    protocol,
    authority,
    userInfo: groups.userinfo || '',
    user,
    password,
    host: host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host,
    port,
    relative,
    path,
    directory,
    file,
    query,
    anchor,
    pathNames: pathNames(path),
    queryKey: queryKey(query),
    ...(host.startsWith('[') && host.endsWith(']') ? { ipv6uri: true } : null),
  };
};

function getParser() {
  const authorityDelimiter = String.raw`(?:(?:(?<=^(?:https?|ftp|wss?):):*|^:+)[\\/]*|^[\\/]{2,}|//)`;
  const authorityStart = `(?<hasAuth>${authorityDelimiter}`;
  const authorityEnd = ')?';
  return RegExp(String.raw`^(?<origin>(?:(?<protocol>[a-z][^\s:@\\/?#.]*):)?${authorityStart}(?<authority>(?:(?<userinfo>(?<username>[^:@\\/?#]*)(?::(?<password>[^\\/?#]*))?)?@)?(?<host>(?<hostname>\d{1,3}(?:\.\d{1,3}){3}(?=[:\\/?#]|$)|\[[a-f\d]{0,4}(?::[a-f\d]{0,4}){2,7}(?:%[^\]]*)?\]|(?<subdomain>[^:\\/?#]*?)\.??(?<domain>(?:[^.:\\/?#]*\.)?(?<tld>[^.:\\/?#]*))(?=[:\\/?#]|$))?(?::(?<port>[^:\\/?#]*))?))${authorityEnd})(?<resource>(?<pathname>(?<directory>(?:[^\\/?#]*[\\/])*)(?<filename>(?:[^.?#]+|\.(?![^.?#]+(?:[?#]|$)))*(?:\.(?<suffix>[^.?#]+))?))(?:\?(?<query>[^#]*))?(?:\#(?<fragment>.*))?)`, 'i');
}

function pathNames(path) {
  const names = path.replace(/\/{2,9}/g, '/').split('/');
  if (path.startsWith('/') || path.length === 0) names.splice(0, 1);
  if (path.endsWith('/')) names.splice(names.length - 1, 1);
  return names;
}

function queryKey(query) {
  const data = {};
  for (const part of query.split('&')) {
    if (!part) continue;
    const separator = part.indexOf('=');
    const key = separator === -1 ? part : part.slice(0, separator);
    if (key) data[key] = separator === -1 ? '' : part.slice(separator + 1);
  }
  return data;
}
