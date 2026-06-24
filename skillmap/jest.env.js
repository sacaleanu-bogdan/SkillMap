// Set required environment variables before any modules are loaded.
// This prevents auth.ts and neo4j.ts from throwing on import in tests that
// mock those modules at the jest.mock() level — but the env vars also cover
// tests that do load the real modules (e.g. neo4j.test.ts, validation.test.ts).
process.env.NEXTAUTH_SECRET = 'test-secret-value-that-is-at-least-32-chars!!'
process.env.NEO4J_URI = 'bolt://localhost:7687'
process.env.NEO4J_USER = 'neo4j'
process.env.NEO4J_PASSWORD = 'testpassword'
process.env.ADMIN_EMAILS = 'admin@example.com'
process.env.NODE_ENV = 'test'
