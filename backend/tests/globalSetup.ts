export default async function globalSetup(): Promise<void> {
  // Tests are integration tests: they need Postgres + Redis reachable.
  // No global fixtures needed here; each suite manages its own data.
}
