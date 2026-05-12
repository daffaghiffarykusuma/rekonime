## Summary
- What changed?
- Why now?

## Risk Checklist
- [ ] Security-sensitive files touched (`sw.js`, `vercel.json`, `tools/*`, URL sanitization paths)
- [ ] Data pipeline behavior changed
- [ ] Service worker behavior changed
- [ ] User-visible runtime behavior changed

## Validation Evidence
- [ ] `bun run test:unit`
- [ ] `bun run test:integration`
- [ ] `bun run data:validate`
- [ ] `bun run test:coverage`
- [ ] `bun run check:coverage-thresholds`
- [ ] `bun run check:security`

## Rollout Notes
- Any migration or cleanup required?
- Any known follow-up work?
