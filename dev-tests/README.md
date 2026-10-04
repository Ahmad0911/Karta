# Logic tests

Plain Node scripts that exercise the real stores and rules (no browser needed):
vendor onboarding, admin verification, storefront visibility, payments →
orders, reviews, recommendations and authentication.

    node --import ./dev-tests/register.mjs dev-tests/test.mjs
    node --import ./dev-tests/register.mjs dev-tests/test2.mjs
    node --import ./dev-tests/register.mjs dev-tests/test3.mjs

Run from the project root. Requires Node 22+.
