const POLICY_NAME = 'rekonime-html';

let htmlPolicy = null;

const canUseTrustedTypes = () => {
  return typeof window !== 'undefined' &&
    window.trustedTypes &&
    typeof window.trustedTypes.createPolicy === 'function';
};

const getHtmlPolicy = () => {
  if (!canUseTrustedTypes()) {
    return null;
  }
  if (htmlPolicy) {
    return htmlPolicy;
  }
  try {
    htmlPolicy = window.trustedTypes.createPolicy(POLICY_NAME, {
      createHTML: (value) => String(value ?? ''),
      createScript: (value) => String(value ?? ''),
      createScriptURL: (value) => String(value ?? '')
    });
  } catch {
    htmlPolicy = null;
  }
  return htmlPolicy;
};

const toTrustedHTML = (value) => {
  const html = String(value ?? '');
  const policy = getHtmlPolicy();
  return policy ? policy.createHTML(html) : html;
};

const toTrustedScript = (value) => {
  const script = String(value ?? '');
  const policy = getHtmlPolicy();
  return policy?.createScript ? policy.createScript(script) : script;
};

const toTrustedScriptURL = (value) => {
  const scriptUrl = String(value ?? '');
  const policy = getHtmlPolicy();
  return policy?.createScriptURL ? policy.createScriptURL(scriptUrl) : scriptUrl;
};

const setHTML = (element, value) => {
  if (!element) return;
  element.innerHTML = toTrustedHTML(value);
};

const replaceOuterHTML = (element, value) => {
  if (!element) return;
  element.outerHTML = toTrustedHTML(value);
};

const insertHTML = (element, position, value) => {
  if (!element) return;
  element.insertAdjacentHTML(position, toTrustedHTML(value));
};

const setScriptText = (element, value) => {
  if (!element) return;
  element.textContent = toTrustedScript(value);
};

const setScriptSource = (element, value) => {
  if (!element) return;
  element.src = toTrustedScriptURL(value);
};

export {
  POLICY_NAME,
  toTrustedHTML,
  toTrustedScript,
  toTrustedScriptURL,
  setHTML,
  replaceOuterHTML,
  insertHTML,
  setScriptText,
  setScriptSource
};
