## Summary
- What changed?
- Why now?

## Risk Checklist
- [ ] Security-sensitive files touched (`sw.js`, `vercel.json`, `tools/*`, URL sanitization paths)
- [ ] Data pipeline behavior changed
- [ ] Service worker behavior changed
- [ ] User-visible runtime behavior changed

## Validation Evidence
- [ ] `npm run test:unit`
- [ ] `npm run test:integration`
- [ ] `npm run data:validate`
- [ ] `npm run test:coverage`
- [ ] `npm run check:coverage-thresholds`
- [ ] `npm run check:security`

## Rollout Notes
- Any migration or cleanup required?
- Any known follow-up work?
