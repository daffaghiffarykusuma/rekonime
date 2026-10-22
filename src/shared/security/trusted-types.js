import createDOMPurify from 'dompurify';
import { sanitizeTrailerEmbedUrl } from './trailer-url-policy.ts';
import { isBoundedImportText } from './import-limits.ts';

const POLICY_NAME = 'rekonime-html';
const PARSER_POLICY_NAME = 'rekonime-parser';
const runtimes = new WeakMap();

const scriptUrl = (value) => {
  const url = String(value ?? '');
  // These are the only executable resources selected by application code.
  if (url !== '/sw.js' && url !== '/js/data.js' && url !== 'js/data.js') {
    throw new TypeError('Script URL is not an application asset.');
  }
  return url;
};

const jsonLd = (value) => {
  const data = JSON.parse(String(value));
  if (!data || data['@context'] !== 'https://schema.org' || !Array.isArray(data['@graph'])) {
    throw new TypeError('Only application JSON-LD is allowed as script text.');
  }
  return JSON.stringify(data);
};

const getRuntime = () => {
  if (typeof window === 'undefined' || !window.document) throw new TypeError('A browser document is required.');
  const cached = runtimes.get(window);
  if (cached && cached.trustedTypes === window.trustedTypes) return cached;

  // Raw TrustedHTML stays private and is consumed only by inert DOM parsers.
  // DOMPurify needs this separate policy to parse input without recursing into
  // the sanitizing output policy. Neither policy exposes arbitrary script URLs.
  const parserPolicy = window.trustedTypes?.createPolicy(PARSER_POLICY_NAME, {
    createHTML: value => String(value ?? ''),
    createScriptURL: () => { throw new TypeError('The parser cannot load scripts.'); }
  }) || null;
  const purifier = createDOMPurify(window);
  purifier.addHook('uponSanitizeAttribute', (node, attribute) => {
    if (node.nodeName.toLowerCase() === 'iframe' && attribute.attrName === 'src' && attribute.attrValue === 'about:blank') {
      attribute.forceKeepAttr = true;
    }
  });
  purifier.addHook('afterSanitizeAttributes', (node) => {
    if (node.nodeName.toLowerCase() !== 'iframe') return;
    const source = node.getAttribute('src');
    const safeSource = source === 'about:blank' ? source : sanitizeTrailerEmbedUrl(source);
    if (!safeSource) { node.remove(); return; }
    node.setAttribute('src', safeSource);
    node.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-presentation');
    const embed = node.getAttribute('data-embed-src');
    if (embed) {
      const safeEmbed = sanitizeTrailerEmbedUrl(embed);
      if (safeEmbed) node.setAttribute('data-embed-src', safeEmbed);
      else node.removeAttribute('data-embed-src');
    }
  });
  const sanitize = value => purifier.sanitize(String(value ?? ''), {
    USE_PROFILES: { html: true, svg: true },
    ADD_TAGS: ['iframe'],
    ADD_ATTR: ['sandbox', 'allow', 'allowfullscreen', 'loading', 'decoding', 'fetchpriority', 'inert'],
    FORBID_TAGS: ['script', 'style', 'foreignObject'],
    FORBID_ATTR: ['srcdoc'],
    RETURN_TRUSTED_TYPE: false,
    TRUSTED_TYPES_POLICY: parserPolicy
  });
  const policy = window.trustedTypes?.createPolicy(POLICY_NAME, {
    createHTML: sanitize,
    createScript: jsonLd,
    createScriptURL: scriptUrl
  }) || null;
  const runtime = { trustedTypes: window.trustedTypes, parserPolicy, policy, sanitize };
  runtimes.set(window, runtime);
  return runtime;
};

const toTrustedHTML = (value) => {
  const runtime = getRuntime();
  return runtime.policy ? runtime.policy.createHTML(value) : runtime.sanitize(value);
};

const parseXmlDocument = (value) => {
  if (!isBoundedImportText(value) || /<!\s*(DOCTYPE|ENTITY)\b/i.test(value)) {
    throw new TypeError('Unsupported XML document.');
  }
  const { parserPolicy } = getRuntime();
  const Parser = globalThis.DOMParser || window.DOMParser;
  return new Parser().parseFromString(parserPolicy ? parserPolicy.createHTML(value) : value, 'application/xml');
};

const toTrustedScriptURL = (value) => {
  const safeUrl = scriptUrl(value);
  const { policy } = getRuntime();
  return policy ? policy.createScriptURL(safeUrl) : safeUrl;
};

const setHTML = (element, value) => {
  if (element) element.innerHTML = toTrustedHTML(value);
};
const replaceOuterHTML = (element, value) => {
  if (element) element.outerHTML = toTrustedHTML(value);
};
const insertHTML = (element, position, value) => {
  if (element) element.insertAdjacentHTML(position, toTrustedHTML(value));
};
const setScriptText = (element, value) => {
  if (!element) return;
  if (element.tagName !== 'SCRIPT' || element.type !== 'application/ld+json') {
    throw new TypeError('Only a JSON-LD script element can receive script text.');
  }
  const safeJson = jsonLd(value);
  const { policy } = getRuntime();
  element.textContent = policy ? policy.createScript(safeJson) : safeJson;
};
const setScriptSource = (element, value) => {
  if (element) element.src = toTrustedScriptURL(value);
};

export { POLICY_NAME, PARSER_POLICY_NAME, toTrustedHTML, parseXmlDocument, toTrustedScriptURL,
  setHTML, replaceOuterHTML, insertHTML, setScriptText, setScriptSource };
