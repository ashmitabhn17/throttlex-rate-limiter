export default async function globalTeardown(): Promise<void> {
  // Individual suites disconnect their own clients in afterAll.
}
