// ─────────────────────────────────────────────────────────────────────────────
// Session guard — notices when this login has ended and sends the user to log in,
// bringing them back to this page afterwards.
//
// Logging out anywhere ends an account's login on every device (Supabase's global
// sign-out), but an open page only finds out when its hourly token renewal fails.
// Until then its saves are rejected by the database's row-level security. This
// checks with Supabase every minute and whenever the tab comes back into view.
//
// Include AFTER the page's main script: it reuses that script's `supabaseClient`
// (a second client would race the first one's token renewals). Pages that hold
// unsaved work should keep a copy in sessionStorage so it survives the trip —
// see the "UNSAVED WORK" section of roastery-traceability.html.
// ─────────────────────────────────────────────────────────────────────────────
(function () {
  const CHECK_EVERY_MS = 60 * 1000;
  const client = typeof supabaseClient !== "undefined" ? supabaseClient : null;
  if (!client) return;

  let leaving = false;

  // The page's own Log Out button is a deliberate exit, not an expired login
  document.addEventListener("click", e => {
    if (e.target.closest && e.target.closest("#logout-btn, #auth-btn")) leaving = true;
  }, true);

  function to_login() {
    if (leaving) return;
    leaving = true;
    const here = location.pathname.split("/").pop() + location.search;
    location.replace("login.html?expired=1&next=" + encodeURIComponent(here));
  }

  async function check() {
    if (leaving || document.hidden) return;
    const { data: { session } } = await client.auth.getSession();
    if (!session) return to_login();
    // getSession only reads the copy saved in the browser; getUser asks Supabase,
    // which knows if the account was signed out elsewhere. Only a definite "not
    // logged in" sends the user away — a network blip or offline moment doesn't.
    const { error } = await client.auth.getUser();
    if (error && (error.status === 401 || error.status === 403 || error.name === "AuthSessionMissingError")) to_login();
  }

  client.auth.onAuthStateChange(event => { if (event === "SIGNED_OUT") to_login(); });
  setInterval(check, CHECK_EVERY_MS);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) check(); });
  window.addEventListener("focus", check);
  window.addEventListener("online", check);
})();
