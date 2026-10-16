/**
 * End-to-end test script for the three fixes:
 *
 * 1. GET /emails/pending-approval — must NOT be intercepted by /:id
 * 2. Follow-up context auto-retrieval — followup1/followup2 must auto-load
 *    previousSubject/previousBody from the DB when not explicitly supplied
 * 3. Dynamic eventDetails — custom event name, dates, etc. accepted via req.body
 * 4. PATCH /emails/:id/approve and /emails/:id/reject — approval queue actions
 *
 * Usage:
 *   node src/scripts/testApprovalFlow.js
 *
 * Requires the server to be running on http://localhost:5000
 */

const BASE = process.env.BASE_URL || "http://localhost:5000";

async function request(method, path, body = null) {
  const url = `${BASE}${path}`;
  const opts = {
    method,
    headers: { "Content-Type": "application/json" }
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(url, opts);
  const data = await res.json();
  return { status: res.status, data };
}

function assert(condition, label) {
  if (!condition) {
    console.error(`  ❌ FAIL: ${label}`);
    process.exitCode = 1;
  } else {
    console.log(`  ✅ PASS: ${label}`);
  }
}

async function main() {
  console.log("\n=== Fix 1: GET /emails/pending-approval ===\n");

  const pendingRes = await request("GET", "/emails/pending-approval");
  assert(pendingRes.status === 200, `Status is 200 (got ${pendingRes.status})`);
  assert(pendingRes.data.success === true, "Response has success: true");
  assert(Array.isArray(pendingRes.data.data), "Response data is an array");
  assert(typeof pendingRes.data.count === "number", "Response includes count");
  console.log(`  ℹ️  ${pendingRes.data.count} email(s) pending approval\n`);

  console.log("=== Fix 2: Follow-up auto-context ===\n");

  // Generate an initial email first (using mock company)
  const genRes = await request("POST", "/emails/generate", {
    companyId: "ExampleTech Pvt Ltd",
    type: "initial"
  });
  assert(genRes.status === 201, `Initial email generated (status ${genRes.status})`);

  if (genRes.status === 201) {
    const initialEmail = genRes.data.data.email;
    console.log(`  ℹ️  Initial email ID: ${initialEmail._id}`);
    console.log(`  ℹ️  Subject: ${initialEmail.subject}`);

    // Now generate a followup1 WITHOUT passing previousSubject/previousBody
    const fu1Res = await request("POST", "/emails/generate", {
      companyId: "ExampleTech Pvt Ltd",
      type: "followup1"
      // No previousSubject or previousBody — should auto-fetch from DB
    });
    assert(fu1Res.status === 201, `Follow-up 1 generated without explicit context (status ${fu1Res.status})`);
    if (fu1Res.status === 201) {
      console.log(`  ℹ️  Follow-up 1 subject: ${fu1Res.data.data.email.subject}\n`);
    } else {
      console.log(`  ℹ️  Follow-up 1 error: ${fu1Res.data.message}\n`);
    }
  } else {
    console.log(`  ⚠️  Skipping follow-up test (initial generation failed: ${genRes.data.message})\n`);
  }

  console.log("=== Fix 3: Dynamic eventDetails ===\n");

  const customRes = await request("POST", "/emails/generate", {
    companyId: "SnackCo Foods",
    type: "initial",
    eventDetails: {
      eventName: "HackFest 2026 Custom",
      eventDates: "December 1-3, 2026",
      deckLink: "https://example.com/custom-deck"
    }
  });
  assert(customRes.status === 201, `Email with custom eventDetails generated (status ${customRes.status})`);
  if (customRes.status === 201) {
    console.log(`  ℹ️  Subject: ${customRes.data.data.email.subject}\n`);
  } else {
    console.log(`  ℹ️  Error: ${customRes.data.message}\n`);
  }

  console.log("=== Fix 4: Approve / Reject endpoints ===\n");

  // Use a pending email from earlier, or find one
  const pendingList = await request("GET", "/emails/pending-approval");
  if (pendingList.data.count > 0) {
    const testEmail = pendingList.data.data[0];
    const emailId = testEmail._id;

    // Test approval
    const approveRes = await request("PATCH", `/emails/${emailId}/approve`);
    assert(approveRes.status === 200, `Approve returned 200 (got ${approveRes.status})`);
    assert(approveRes.data.data?.email?.status === "APPROVED", "Email status is APPROVED");

    // Try to approve again — should get 409
    const doubleApprove = await request("PATCH", `/emails/${emailId}/approve`);
    assert(doubleApprove.status === 409, `Double-approve returns 409 (got ${doubleApprove.status})`);

    // Find another pending email for reject test
    const pendingList2 = await request("GET", "/emails/pending-approval");
    if (pendingList2.data.count > 0) {
      const rejectEmail = pendingList2.data.data[0];
      const rejectRes = await request("PATCH", `/emails/${rejectEmail._id}/reject`, {
        reason: "Needs a stronger opening hook"
      });
      assert(rejectRes.status === 200, `Reject returned 200 (got ${rejectRes.status})`);
      assert(rejectRes.data.data?.email?.status === "DRAFT", "Rejected email status is DRAFT");
      console.log(`  ℹ️  Rejection reason: ${rejectRes.data.data?.reason}`);
    } else {
      console.log("  ⚠️  No more pending emails to test reject\n");
    }
  } else {
    console.log("  ⚠️  No pending emails available to test approve/reject\n");
  }

  console.log("\n=== All tests complete ===\n");
}

main().catch((err) => {
  console.error("Test script crashed:", err.message);
  process.exitCode = 1;
});
