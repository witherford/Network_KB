// Palo Alto and Citrix advisory fetchers. Both vendors publish advisories as
// RSS/Atom or as HTML index pages; neither serves CORS headers, so these are
// Node-only unless wrapped by a user-provided proxy.
//
// Palo Alto: https://security.paloaltonetworks.com/rss.xml   (Atom feed)
// Citrix:    https://support.citrix.com/securitybulletins    (scrape)
//            + https://support.citrix.com/s/article/CTXxxxxxx for each

const PA_FEED = 'https://security.paloaltonetworks.com/rss.xml';
const CITRIX_INDEX = 'https://support.citrix.com/securitybulletins';

// --- Palo Alto ----------------------------------------------------------

export async function fetchPaloAlto({ proxy } = {}) {
  const url = (proxy || '') + PA_FEED;
  const res = await fetch(url, { headers: { 'Accept': 'application/atom+xml, application/rss+xml, application/xml' } });
  if (!res.ok) throw new Error(`Palo Alto feed ${res.status}`);
  const xml = await res.text();
  return parsePaFeed(xml);
}

function parsePaFeed(xml) {
  const entries = xml.split(/<entry\b/).slice(1);
  const out = [];
  for (const block of entries) {
    const entry = '<entry' + block.split('</entry>')[0] + '</entry>';
    const title = unesc(xmlTag(entry, 'title'));
    const updated = xmlTag(entry, 'updated');
    const link = (entry.match(/<link[^>]*href="([^"]+)"/) || [])[1] || '';
    const content = unesc(xmlTag(entry, 'content').replace(/<[^>]+>/g, ' '));
    // Palo Alto advisory IDs are like PAN-SA-2026-0001; CVE ids are embedded.
    const advId = (title.match(/PAN-SA-\d{4}-\d+/) || [])[0] || '';
    const cves = content.match(/CVE-\d{4}-\d+/g) || [];
    const sev = pickSeverityFromText(title + ' ' + content);
    const cvss = pickCvssFromText(content);
    const product = guessPaloProduct(title + ' ' + content);
    // If no CVE ids, emit the advisory itself as one record.
    for (const id of (cves.length ? cves : [advId || title.slice(0, 40)])) {
      out.push({
        id,
        advisoryId: advId,
        severity: sev,
        cvss,
        summary: title,
        published: updated,
        references: [link].filter(Boolean),
        vendor: 'Palo Alto',
        product,
        source: 'paloalto-rss'
      });
    }
  }
  return out;
}

function guessPaloProduct(t) {
  if (/PAN-OS/i.test(t))         return 'PAN-OS';
  if (/GlobalProtect/i.test(t))  return 'GlobalProtect';
  if (/Prisma Access/i.test(t))  return 'Prisma Access';
  if (/Prisma Cloud/i.test(t))   return 'Prisma Cloud';
  if (/Cortex/i.test(t))         return 'Cortex';
  if (/Panorama/i.test(t))       return 'Panorama';
  return 'Palo Alto';
}

// --- Citrix ------------------------------------------------------------

export async function fetchCitrix({ proxy } = {}) {
  const url = (proxy || '') + CITRIX_INDEX;
  const res = await fetch(url, { headers: { 'Accept': 'text/html' } });
  if (!res.ok) throw new Error(`Citrix bulletins ${res.status}`);
  const html = await res.text();
  return parseCitrixIndex(html);
}

function parseCitrixIndex(html) {
  // Citrix surfaces their bulletin titles in anchor text pointing to CTX*
  // article pages. Scrape the title + href + any CVE ids in surrounding text.
  const out = [];
  const seen = new Set();
  const anchorRe = /<a[^>]+href="([^"]*CTX[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = anchorRe.exec(html))) {
    const href = m[1].startsWith('http') ? m[1] : 'https://support.citrix.com' + m[1];
    const title = unesc(m[2].replace(/<[^>]+>/g, '').trim());
    if (!title || seen.has(href)) continue;
    seen.add(href);
    // Slice surrounding 500 chars for CVE/severity hints.
    const ctx = html.slice(Math.max(0, m.index - 200), Math.min(html.length, m.index + 800));
    const cves = ctx.match(/CVE-\d{4}-\d+/g) || [];
    const sev = pickSeverityFromText(title + ' ' + ctx);
    const cvss = pickCvssFromText(ctx);
    const product = guessCitrixProduct(title);
    for (const id of (cves.length ? cves : [title.slice(0, 40)])) {
      out.push({
        id,
        severity: sev,
        cvss,
        summary: title,
        references: [href],
        vendor: 'Citrix',
        product,
        source: 'citrix-bulletins'
      });
    }
  }
  return out;
}

function guessCitrixProduct(t) {
  if (/NetScaler|ADC/i.test(t))        return 'NetScaler ADC';
  if (/Gateway/i.test(t))              return 'NetScaler Gateway';
  if (/Hypervisor|XenServer/i.test(t)) return 'Citrix Hypervisor';
  if (/Virtual Apps|VDA|DaaS/i.test(t)) return 'Citrix Virtual Apps & Desktops';
  if (/ShareFile/i.test(t))            return 'ShareFile';
  return 'Citrix';
}

// --- helpers -----------------------------------------------------------

function xmlTag(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
  return m ? m[1].trim() : '';
}

function unesc(s) {
  return String(s || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

function pickSeverityFromText(t) {
  const s = t.toLowerCase();
  if (s.includes('critical')) return 'critical';
  if (s.includes('high'))     return 'high';
  if (s.includes('medium'))   return 'medium';
  if (s.includes('low'))      return 'low';
  return '';
}

function pickCvssFromText(t) {
  const m = t.match(/CVSS[^0-9]*([0-9]+(?:\.[0-9]+)?)/i);
  return m ? Number(m[1]) : '';
}
