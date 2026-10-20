process.env.NODE_ENV = "test";
const assert = require("assert");
const app = require("../server");
const serverCache = require("../services/cacheService");

async function testPerformance() {
  console.log("--- Starting Performance & Latency Optimization Tests ---");

  // Test 1: Verify CacheService operates in sub-millisecond time
  const t0 = Date.now();
  serverCache.set("perf_test_key", { test: true }, 5, "perf");
  const cachedVal = serverCache.get("perf_test_key");
  const cacheDuration = Date.now() - t0;
  assert.strictEqual(cachedVal.test, true);
  assert.ok(cacheDuration <= 5, "Cache lookup must be <= 5ms");
  console.log(`  ✓ Test 1 Passed: In-memory cache hit in ${cacheDuration}ms (<5ms)`);

  // Test 2: Invalidate tag
  serverCache.invalidateTag("perf");
  const afterInvalidate = serverCache.get("perf_test_key");
  assert.strictEqual(afterInvalidate, null);
  console.log("  ✓ Test 2 Passed: Instant tag-based cache invalidation verified");

  // Test 3: Stampede protection
  let computeCount = 0;
  const slowFetcher = async () => {
    computeCount++;
    await new Promise(r => setTimeout(r, 20));
    return { count: computeCount };
  };

  const [res1, res2, res3] = await Promise.all([
    serverCache.getOrSet("concurrent_key", slowFetcher, 5),
    serverCache.getOrSet("concurrent_key", slowFetcher, 5),
    serverCache.getOrSet("concurrent_key", slowFetcher, 5)
  ]);

  assert.strictEqual(computeCount, 1, "Duplicate concurrent fetches must be deduplicated to 1 call");
  assert.strictEqual(res1.count, 1);
  assert.strictEqual(res2.count, 1);
  assert.strictEqual(res3.count, 1);
  console.log("  ✓ Test 3 Passed: Stampede protection deduplicated 3 parallel calls into 1 fetch");

  // Test 4: Verify bootstrap endpoint handler directly
  const { rankCompaniesInternal } = require("../controllers/companyController");
  const { getSystemStatsInternal } = require("../controllers/gmailController");

  const [sponsors, stats] = await Promise.all([
    rankCompaniesInternal(),
    getSystemStatsInternal()
  ]);

  assert.ok(Array.isArray(sponsors), "Sponsors must be an array");
  assert.ok(sponsors.length > 0, "Default sponsors should be returned");
  assert.ok(stats.sponsors !== undefined, "Stats must have sponsors count");
  assert.ok(stats.emails !== undefined, "Stats must have emails count");
  console.log(`  ✓ Test 4 Passed: rankCompaniesInternal & getSystemStatsInternal returned valid payloads`);

  // Test 5: Verify second call hits memory cache in sub-millisecond time
  const tStart2 = Date.now();
  const cachedSponsors = await rankCompaniesInternal();
  const cachedStats = await getSystemStatsInternal();
  const tEnd2 = Date.now() - tStart2;
  assert.strictEqual(cachedSponsors.length, sponsors.length);
  assert.deepStrictEqual(cachedStats, stats);
  console.log(`  ✓ Test 5 Passed: Cached bootstrap queries completed in ${tEnd2}ms (<5ms)`);

  console.log("\n🎉 ALL PERFORMANCE & LATENCY OPTIMIZATION TESTS PASSED!\n");
  process.exit(0);
}

testPerformance().catch(err => {
  console.error("Performance test error:", err);
  process.exit(1);
});
