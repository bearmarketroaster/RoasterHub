// ─────────────────────────────────────────────────────────────────────────────
// Unsaved work — keeps a copy of a page's in-progress form input in this browser
// tab (sessionStorage), so being sent to log in again (session-guard.js), an
// accidental refresh or a dropped connection doesn't lose it.
//
// Each page decides what counts as its unsaved work:
//   • once it knows who's logged in:   UnsavedWork.track(session.user.id, collect_unsaved)
//       collect_unsaved() returns the input worth keeping, or null when there's none
//       (saved or cancelled), which clears the copy
//   • at the end of every render():    UnsavedWork.sync()
//   • after loading data, before the first render:  const saved = UnsavedWork.take()
//
// The copy is also refreshed as the user types or taps (fields write to state
// without a re-render) and when the page is left. It only comes back for the same login,
// within 12 hours, in the same tab. Picked files (PDFs etc.) can't be kept —
// browsers don't allow it — so pages note that they need re-attaching.
// roastery-traceability.html has its own version of this for packing.
// Include in <head>, after config.js.
// ─────────────────────────────────────────────────────────────────────────────
window.UnsavedWork = (function () {
  const MAX_AGE_MS = 12 * 60 * 60 * 1000;
  const key = () => "rh_unsaved:" + location.pathname.split("/").pop();
  let user_id = null;
  let collect = null;
  let ready = false;   // set by take(): never overwrite a copy the page hasn't restored yet

  function save(data) {
    if (!user_id || !ready) return;
    try {
      if (data == null) sessionStorage.removeItem(key());
      else sessionStorage.setItem(key(), JSON.stringify({ saved_at: Date.now(), user_id, data }));
    } catch (_) { /* storage unavailable (private mode etc.) — nothing to keep */ }
  }

  function sync() {
    if (!collect) return;
    try { save(collect()); } catch (e) { console.warn("UnsavedWork: couldn't collect", e); }
  }

  // After the page's own handlers have written the new value into state
  const sync_soon = () => setTimeout(sync, 0);

  return {
    RESTORED_MSG: "Picked up where you left off — check everything is still right before saving.",

    track(uid, collect_fn) {
      user_id = uid;
      collect = collect_fn;
      document.addEventListener("input", sync_soon, true);
      document.addEventListener("change", sync_soon, true);
      document.addEventListener("click", sync_soon, true);   // e.g. tap-to-fill buttons
      window.addEventListener("pagehide", sync);
    },

    sync,

    take() {
      ready = true;
      let d = null;
      try { d = JSON.parse(sessionStorage.getItem(key()) || "null"); } catch (_) {}
      if (!d) return null;
      if (Date.now() - d.saved_at > MAX_AGE_MS || d.user_id !== user_id) {
        try { sessionStorage.removeItem(key()); } catch (_) {}
        return null;
      }
      return d.data;
    },

    // A short notice above whatever is on screen (survives re-renders)
    notice(msg) {
      const t = document.createElement("div");
      t.textContent = msg;
      t.style.cssText = "position:fixed;top:12px;left:50%;transform:translateX(-50%);max-width:92vw;z-index:9999;background:#1a1a1a;color:#fff;padding:10px 16px;border-radius:8px;font-size:14px;font-weight:600;box-shadow:0 4px 16px rgba(0,0,0,0.25);text-align:center";
      document.body.appendChild(t);
      setTimeout(() => t.remove(), 8000);
    },

    // Shallow copy without the keys a form uses for transient status (saving, err, ok…)
    strip(obj, keys) {
      if (!obj || typeof obj !== "object") return obj;
      const out = { ...obj };
      for (const k of keys) delete out[k];
      return out;
    },
  };
})();
