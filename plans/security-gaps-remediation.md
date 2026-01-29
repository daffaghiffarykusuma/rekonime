# Security Gaps Remediation Plan

## Executive Summary

This document outlines the plan to address critical security gaps identified in the Gap Identification Report. The remediation focuses on three main areas: Content Security Policy (CSP) hardening, URL sanitization improvements, and missing security headers.

---

## 1. Content Security Policy (CSP) Hardening

### Current State (Gap)
```http
Content-Security-Policy: default-src 'self'; base-uri 'self'; object-src 'none'; 
  frame-ancestors 'self'; script-src 'self' 'nonce-rekonime-inline'; 
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; 
  font-src https://fonts.gstatic.com; 
  img-src 'self' https: data:; 
  connect-src 'self' https://api.jikan.moe; 
  frame-src https://www.youtube.com https://www.youtube-nocookie.com
```

### Issues Identified

| Issue | Risk | Location |
|-------|------|----------|
| `'unsafe-inline'` in style-src | XSS via injected styles | index.html:7, bookmarks.html:7, home/index.html:7 |
| `img-src https:` too broad | Data exfiltration via image URLs - allows ANY HTTPS image | All HTML files |
| No form-action directive | Form hijacking possible | N/A |

### Remediation Strategy

#### 1.1 Remove 'unsafe-inline' from style-src
**Approach: Nonce-based CSP for styles**
- Keep existing `nonce-rekonime-inline` approach
- Update CSP to: `style-src 'self' 'nonce-rekonime-inline' https://fonts.googleapis.com`
- Any inline style elements must include `nonce="rekonime-inline"`

**Files to modify:**
- index.html
- bookmarks.html
- home/index.html

#### 1.2 Restrict img-src to Trusted Domains
**Current:** `img-src 'self' https: data:`

**Proposed:** 
```
img-src 'self' 
  https://cdn.myanimelist.net 
  https://via.placeholder.com 
  https://myanimelist.cdn-dena.com
  data: 
  blob:
```

**Rationale:**
- MyAnimeList images primarily served from cdn.myanimelist.net
- Some legacy images may use myanimelist.cdn-dena.com
- Fallback placeholder images from via.placeholder.com
- data: needed for inline SVG/data URIs
- blob: needed for any object URLs

#### 1.3 Add Missing CSP Directives
```http
form-action 'self';
upgrade-insecure-requests;
```

---

## 2. iframe Sandbox for YouTube Embeds

### Current State
YouTube iframes created in js/app.js:3893 without sandbox attributes.

### Remediation
Add sandbox attribute allowing only necessary permissions:
```html
<iframe
  sandbox="allow-scripts allow-same-origin allow-presentation"
  ...
>
```

**Why these permissions:**
- `allow-scripts`: Required for YouTube player to function
- `allow-same-origin`: Required for postMessage communication
- `allow-presentation`: Required for fullscreen/PiP mode

**Explicitly NOT allowed:**
- `allow-forms`: Prevents form submission from iframe
- `allow-popups`: Prevents popup windows
- `allow-top-navigation`: Prevents navigating top window

---

## 3. URL Sanitization Gaps

### 3.1 Cover Image URL Validation

**Current Gap:** `buildImageSrcset()` at js/app.js:4167 returns cover URLs directly without validation.

**Current Code:**
```javascript
buildImageSrcset(coverUrl) {
  if (!coverUrl) return { src: '', srcset: '', sizes: '' };
  return { src: coverUrl, srcset: '', sizes: '' };
}
```

**Remediation:**
```javascript
buildImageSrcset(coverUrl) {
  if (!coverUrl) return { src: '', srcset: '', sizes: '' };
  
  // Validate URL is from trusted domain
  const sanitized = this.sanitizeImageUrl(coverUrl);
  if (!sanitized) {
    console.warn('Rejected untrusted image URL:', coverUrl);
    return { src: '', srcset: '', sizes: '' };
  }
  
  return { src: sanitized, srcset: '', sizes: '' };
}

sanitizeImageUrl(rawUrl) {
  if (!rawUrl) return '';
  
  try {
    const url = new URL(rawUrl);
    
    // Only allow HTTPS
    if (url.protocol !== 'https:') return '';
    
    // Whitelist of allowed image domains
    const allowedHosts = [
      'cdn.myanimelist.net',
      'myanimelist.cdn-dena.com',
      'via.placeholder.com'
    ];
    
    const isAllowed = allowedHosts.some(host => 
      url.hostname === host || url.hostname.endsWith('.' + host)
    );
    
    return isAllowed ? rawUrl : '';
  } catch (error) {
    return '';
  }
}
```

### 3.2 Trailer URL Validation

**Current State:** Trailer URLs are validated via `sanitizeTrailerUrl()` and `sanitizeTrailerEmbedUrl()` at js/app.js:3841-3868.

**Verification Needed:**
- Ensure validation cannot be bypassed via URL encoding
- Check for IDN homograph attacks
- Verify no open redirect vulnerabilities

**Current validation appears adequate but should be enhanced:**
```javascript
sanitizeTrailerUrl(rawUrl) {
  if (!rawUrl) return '';
  
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:') return '';
    
    const host = parsed.hostname.toLowerCase();
    // Strict host matching - no subdomains except youtube-nocookie
    const allowedHosts = ['www.youtube.com', 'youtube.com', 'youtu.be'];
    if (!allowedHosts.includes(host)) return '';
    
    return parsed.toString();
  } catch (error) {
    return '';
  }
}
```

---

## 4. Missing Security Headers

### Headers to Add

| Header | Value | Purpose |
|--------|-------|---------|
| X-Frame-Options | DENY or SAMEORIGIN | Prevent clickjacking |
| X-Content-Type-Options | nosniff | Prevent MIME sniffing |
| Referrer-Policy | strict-origin-when-cross-origin | Control referrer info |
| Permissions-Policy | See below | Restrict browser features |

### Permissions-Policy
```http
Permissions-Policy: 
  camera=(),
  microphone=(),
  geolocation=(),
  payment=(),
  usb=(),
  magnetometer=(),
  gyroscope=(),
  accelerometer=()
```

### Implementation via Meta Tags (for static hosting)
For platforms like Vercel/Netlify without server config, add meta tags:
```html
<meta http-equiv="X-Frame-Options" content="DENY">
<meta http-equiv="X-Content-Type-Options" content="nosniff">
<meta name="referrer" content="strict-origin-when-cross-origin">
```

---

## 5. Subresource Integrity (SRI)

### Current State
Google Fonts loaded without integrity hashes.

### Remediation
Google Fonts CSS cannot use SRI because the CSS content varies by browser (User-Agent sniffing). **Alternative approach:**

1. **Self-host fonts** (Recommended for security)
   - Download fonts from Google Fonts
   - Serve from local `/fonts/` directory
   - Full control + SRI possible

2. **Use font-display: swap and preconnect**
   - Already implemented via preconnect
   - Add `crossorigin` attribute to font requests

**For other CDN resources (if any), add integrity attributes:**
```html
<script src="..." integrity="sha384-..." crossorigin="anonymous"></script>
```

---

## 6. Referrer Policy on External Links

### Current State
External links (YouTube, MAL) don't specify referrer policy.

### Remediation
Add `referrerpolicy` attribute to all external links:
```html
<!-- In renderTrailerSection -->
<a href="${safeUrl}" 
   target="_blank" 
   rel="noopener noreferrer"
   referrerpolicy="strict-origin-when-cross-origin">
   Watch on YouTube
</a>
```

Update js/app.js:
- Line 3890: Trailer external link
- Any other external navigation links

---

## 7. Vercel Configuration

### Update vercel.json
```json
{
  "rewrites": [
    { "source": "/home", "destination": "/index.html" },
    { "source": "/home/", "destination": "/index.html" }
  ],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "Referrer-Policy",
          "value": "strict-origin-when-cross-origin"
        },
        {
          "key": "Permissions-Policy",
          "value": "camera=(), microphone=(), geolocation=(), payment=(), usb=()"
        }
      ]
    }
  ]
}
```

---

## 8. Testing Checklist

After implementing fixes, verify:

- [ ] App loads correctly with new CSP
- [ ] Anime cover images display properly
- [ ] YouTube trailers embed and play correctly
- [ ] Filters and search functionality work
- [ ] Bookmarks page functions correctly
- [ ] No CSP violations in browser console
- [ ] Security headers present in response (Network tab)
- [ ] Fallback images load when MAL images fail
- [ ] Modal interactions (detail view) work properly

---

## Implementation Priority

### Phase 1: Critical (High Risk)
1. Restrict img-src to trusted domains
2. Add X-Frame-Options header
3. Add iframe sandbox attributes
4. Validate cover image URLs

### Phase 2: Important (Medium Risk)
5. Fix CSP 'unsafe-inline' in style-src
6. Add X-Content-Type-Options
7. Add Referrer-Policy
8. Add referrerpolicy to external links

### Phase 3: Hardening (Lower Risk)
9. Implement Permissions-Policy
10. Add form-action CSP directive
11. Consider self-hosting fonts

---

## Files to Modify

| File | Changes |
|------|---------|
| index.html | Update CSP, add meta security headers |
| bookmarks.html | Update CSP, add meta security headers |
| home/index.html | Update CSP, add meta security headers |
| js/app.js | Add image URL sanitization, iframe sandbox, referrerpolicy |
| vercel.json | Add security headers |
