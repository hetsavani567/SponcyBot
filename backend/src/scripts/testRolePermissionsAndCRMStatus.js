const assert = require("assert");
const fs = require("fs");
const path = require("path");

console.log("--- Starting Role Permissions & CRM Status Tests ---\n");

async function runTests() {
  const { deleteCompany } = require("../controllers/companyController");
  const { deleteOutreach } = require("../controllers/outreachController");

  // Mock Request/Response helper
  const createMockReqRes = (params, headers = {}, role = null) => {
    const req = {
      params,
      headers: { ...headers, ...(role ? { "x-user-role": role } : {}) },
      query: {},
      body: {}
    };

    let statusCode = 200;
    let jsonBody = null;

    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(body) {
        jsonBody = body;
        return this;
      },
      setHeader() {},
      send(body) {
        jsonBody = body;
        return this;
      }
    };

    return { req, res, getResult: () => ({ statusCode, jsonBody }) };
  };

  // -------------------------------------------------------------
  // Test 1: Only Organizer can delete sponsors
  // -------------------------------------------------------------
  console.log("Test 1: Sponsor deletion role enforcement");

  // 1a. Outreach Coordinator attempting to delete a sponsor
  const attemptCoordinator = createMockReqRes({ id: "mock_comp_123" }, {}, "Outreach Coordinator");
  await deleteCompany(attemptCoordinator.req, attemptCoordinator.res);
  const resCoord = attemptCoordinator.getResult();
  assert.strictEqual(resCoord.statusCode, 403, "Outreach Coordinator must be blocked with 403 when deleting sponsor");
  assert(resCoord.jsonBody.message.includes("Only Organizers can remove sponsor companies"), "Must explain only Organizers can remove sponsors");
  console.log("  ✓ Outreach Coordinator strictly blocked from deleting sponsor (403)");

  // 1b. Volunteer / Viewer attempting to delete a sponsor
  const attemptViewer = createMockReqRes({ id: "mock_comp_123" }, {}, "Volunteer");
  await deleteCompany(attemptViewer.req, attemptViewer.res);
  const resViewer = attemptViewer.getResult();
  assert.strictEqual(resViewer.statusCode, 403, "Volunteer must be blocked with 403 when deleting sponsor");
  console.log("  ✓ Unprivileged role strictly blocked from deleting sponsor (403)");

  // 1c. Missing role / unauthenticated attempting to delete a sponsor
  const attemptMissing = createMockReqRes({ id: "mock_comp_123" }, {}, null);
  await deleteCompany(attemptMissing.req, attemptMissing.res);
  const resMissing = attemptMissing.getResult();
  assert.strictEqual(resMissing.statusCode, 403, "Missing role must be blocked with 403 when deleting sponsor");
  console.log("  ✓ Missing role strictly blocked from deleting sponsor (403)");

  // 1d. Organizer allowed to delete sponsor
  const attemptOrganizer = createMockReqRes({ id: "mock_comp_123" }, {}, "Organizer");
  await deleteCompany(attemptOrganizer.req, attemptOrganizer.res);
  const resOrg = attemptOrganizer.getResult();
  assert.strictEqual(resOrg.statusCode, 200, "Organizer must succeed (200) when deleting sponsor");
  assert.strictEqual(resOrg.jsonBody.success, true);
  console.log("  ✓ Organizer successfully permitted to delete sponsor (200)");

  // 1e. Sponsorship Lead / Admin allowed to delete sponsor
  const attemptLead = createMockReqRes({ id: "mock_comp_123" }, {}, "Sponsorship Lead");
  await deleteCompany(attemptLead.req, attemptLead.res);
  const resLead = attemptLead.getResult();
  assert.strictEqual(resLead.statusCode, 200, "Sponsorship Lead must succeed (200) when deleting sponsor");
  console.log("  ✓ Sponsorship Lead successfully permitted to delete sponsor (200)");

  // -------------------------------------------------------------
  // Test 2: Only Outreach Coordinator can remove outreach CRM records
  // -------------------------------------------------------------
  console.log("\nTest 2: Outreach CRM deletion role enforcement");

  // 2a. Organizer attempting to delete CRM record
  const attemptOrgOnCRM = createMockReqRes({ id: "mock_outreach_123" }, {}, "Organizer");
  await deleteOutreach(attemptOrgOnCRM.req, attemptOrgOnCRM.res);
  const resOrgCRM = attemptOrgOnCRM.getResult();
  assert.strictEqual(resOrgCRM.statusCode, 403, "Organizer must be blocked with 403 when deleting outreach CRM");
  assert(resOrgCRM.jsonBody.message.includes("Only Outreach Coordinators can remove outreach CRM records"), "Must explain only Outreach Coordinators can remove CRM records");
  console.log("  ✓ Organizer strictly blocked from deleting outreach CRM record (403)");

  // 2b. Sponsorship Lead attempting to delete CRM record
  const attemptLeadOnCRM = createMockReqRes({ id: "mock_outreach_123" }, {}, "Sponsorship Lead");
  await deleteOutreach(attemptLeadOnCRM.req, attemptLeadOnCRM.res);
  const resLeadCRM = attemptLeadOnCRM.getResult();
  assert.strictEqual(resLeadCRM.statusCode, 403, "Sponsorship Lead must be blocked with 403 when deleting outreach CRM");
  console.log("  ✓ Sponsorship Lead strictly blocked from deleting outreach CRM record (403)");

  // 2c. Volunteer attempting to delete CRM record
  const attemptViewerOnCRM = createMockReqRes({ id: "mock_outreach_123" }, {}, "Volunteer");
  await deleteOutreach(attemptViewerOnCRM.req, attemptViewerOnCRM.res);
  const resViewerCRM = attemptViewerOnCRM.getResult();
  assert.strictEqual(resViewerCRM.statusCode, 403, "Volunteer must be blocked with 403 when deleting outreach CRM");
  console.log("  ✓ Volunteer strictly blocked from deleting outreach CRM record (403)");

  // 2d. Outreach Coordinator allowed to delete CRM record
  const attemptCoordinatorOnCRM = createMockReqRes({ id: "mock_outreach_123" }, {}, "Outreach Coordinator");
  await deleteOutreach(attemptCoordinatorOnCRM.req, attemptCoordinatorOnCRM.res);
  const resCoordCRM = attemptCoordinatorOnCRM.getResult();
  assert.strictEqual(resCoordCRM.statusCode, 200, "Outreach Coordinator must succeed (200) when deleting outreach CRM");
  assert.strictEqual(resCoordCRM.jsonBody.success, true);
  console.log("  ✓ Outreach Coordinator successfully permitted to delete CRM record (200)");

  // -------------------------------------------------------------
  // Test 3: OutreachTab.jsx verified: Select list option removed
  // -------------------------------------------------------------
  console.log("\nTest 3: OutreachTab.jsx verified clean of status select dropdown");
  const outreachTabSource = fs.readFileSync(
    path.join(__dirname, "../../../frontend/src/components/OutreachTab.jsx"),
    "utf8"
  );
  assert(!outreachTabSource.includes("<select"), "OutreachTab.jsx must not contain any <select> elements for status");
  assert(outreachTabSource.includes("{o.status}"), "OutreachTab.jsx must render status badge cleanly");
  console.log("  ✓ Verified: Select list dropdown of status has been removed from CRM");

  // -------------------------------------------------------------
  // Test 4: SponsorsTab.jsx verified: AI Research loading spinner
  // -------------------------------------------------------------
  console.log("\nTest 4: SponsorsTab.jsx AI Research loading symbol verification");
  const sponsorsTabSource = fs.readFileSync(
    path.join(__dirname, "../../../frontend/src/components/SponsorsTab.jsx"),
    "utf8"
  );
  assert(sponsorsTabSource.includes("researchingCompanyId"), "SponsorsTab must accept and track researchingCompanyId");
  assert(sponsorsTabSource.includes("animate-spin"), "SponsorsTab must render spinning loading symbol on AI research");
  assert(sponsorsTabSource.includes("Researching..."), "SponsorsTab button must show Researching... when in flight");
  console.log("  ✓ Verified: AI Research button displays loading symbol during research");

  // -------------------------------------------------------------
  // Test 5: Navbar.jsx verified clean of role switcher buttons
  // -------------------------------------------------------------
  console.log("\nTest 5: Navbar.jsx verified clean of nav role switcher buttons");
  const navbarSource = fs.readFileSync(
    path.join(__dirname, "../../../frontend/src/components/Navbar.jsx"),
    "utf8"
  );
  assert(!navbarSource.includes("onSwitchRole"), "Navbar.jsx must not have onSwitchRole prop or callers");
  assert(!navbarSource.includes("Active Role Quick Switcher"), "Navbar.jsx must not have Active Role Quick Switcher");
  console.log("  ✓ Verified: 👑 Organizer and 📋 Outreach Coordinator switcher removed from Navbar");

  // -------------------------------------------------------------
  // Test 6: AuthModal.jsx & Auth Controller signin role selection
  // -------------------------------------------------------------
  console.log("\nTest 6: AuthModal.jsx role selection and signin integration");
  const authModalSource = fs.readFileSync(
    path.join(__dirname, "../../../frontend/src/components/modals/AuthModal.jsx"),
    "utf8"
  );
  assert(authModalSource.includes("signinRole"), "AuthModal.jsx must have signinRole state");
  assert(authModalSource.includes("Select Your Role"), "AuthModal.jsx must display role selection in signin mode");
  assert(authModalSource.includes("api.signin(usernameOrEmail, password, signinRole)"), "AuthModal.jsx must pass signinRole to api.signin");

  // Test signin with chosen role via authController
  const { signin } = require("../controllers/authController");
  const signinReq = {
    body: {
      usernameOrEmail: "organizer",
      password: "password123",
      role: "Outreach Coordinator"
    }
  };
  let signinResult = null;
  const signinRes = {
    status(code) { return this; },
    json(data) { signinResult = data; return this; }
  };
  await signin(signinReq, signinRes);
  assert.strictEqual(signinResult?.success, true);
  assert.strictEqual(signinResult?.data?.user?.role, "Outreach Coordinator", "User role must reflect chosen role on signin");
  console.log("  ✓ Verified: User chooses role when signing in and session role updates accurately");

  console.log("\n🎉 ALL ROLE PERMISSION, AI RESEARCH & CRM STATUS TESTS PASSED!\n");
}

runTests().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
