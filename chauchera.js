// Behaviour shared by the design test pages: the waiting list and the withholding calculator (the same 2026 rules as
// the app's salary.py and the home page). A page reacts in its own style through window.chauchera.onJoined / onCalc.
(() => {
  const TABLE_2026 = [[0, 0, 0], [12208, 0, 5], [15549, 167, 10], [20188, 631, 12], [26700, 1412, 15],
                      [35136, 2678, 20], [46575, 4965, 25], [62005, 8823, 30], [82679, 15025, 35], [109956, 24572, 37]];
  const CANASTA = 821.80, CANASTAS = [7, 9, 11, 14, 17, 20], REBATE = 0.18, IESS = 0.0945;
  const cents = (x) => Math.round((x + Number.EPSILON) * 100) / 100;
  const hooks = (window.chauchera = window.chauchera || {});

  function taxDue(base) {
    let row = TABLE_2026[0];
    for (const r of TABLE_2026) if (base > r[0]) row = r;
    return cents(row[1] + (base - row[0]) * row[2] / 100);
  }
  function withholding(salary, gastos, cargas) {
    const iess = cents(salary * IESS);
    const tax = taxDue(cents((salary - iess) * 12));
    const rebate = Math.min(cents(Math.min(gastos, CANASTAS[Math.min(cargas, 5)] * CANASTA) * REBATE), tax);
    const wh = cents((tax - rebate) / 12);
    return { iess, tax, rebate, wh, net: cents(salary - iess - wh) };
  }
  // "1.500,00", "2.000", "1500.5", "1,500.00" → number
  function amount(text) {
    let t = String(text).trim().replace(/[$\s]/g, "");
    if (!t) return null;
    const comma = t.lastIndexOf(","), dot = t.lastIndexOf(".");
    if (comma > dot) t = t.replace(/\./g, "").replace(",", ".");
    else if (comma === -1 && /^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, "");
    else t = t.replace(/,/g, "");
    const n = Number(t);
    return Number.isFinite(n) && n >= 0 && n < 1e7 ? n : null;
  }
  const fmt = (n) => "$" + n.toLocaleString("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  hooks.fmt = fmt;
  const $ = (id) => document.getElementById(id);

  function update() {
    if (!$("salary")) return;
    const s = amount($("salary").value);
    const set = (id, v) => { if ($(id)) $(id).textContent = v; };
    const verdict = $("verdict");
    if (s === null || s === 0) {
      for (const id of ["r-iess", "r-tax", "r-rebate", "r-wh", "r-net"]) set(id, "—");
      if (verdict) verdict.hidden = true;
      hooks.onCalc?.(null);
      return;
    }
    const r = withholding(s, amount($("gastos")?.value ?? "") ?? 0, Number($("cargas")?.value ?? 0));
    set("r-iess", "−" + fmt(r.iess)); set("r-tax", fmt(r.tax)); set("r-rebate", (r.rebate > 0 ? "−" : "") + fmt(r.rebate));
    set("r-wh", fmt(r.wh)); set("r-net", fmt(r.net));
    const rol = amount($("rol")?.value ?? "");
    let state = null;
    if (verdict) {
      verdict.hidden = rol === null;
      if (rol !== null) {
        const diff = cents(rol - r.wh);
        state = Math.abs(diff) <= 1 ? "ok" : "bad";
        verdict.dataset.state = state;
        verdict.textContent = Math.abs(diff) <= 1 ? "Coincide: tu empleador te retiene lo correcto."
          : diff > 0 ? `Te retienen ${fmt(diff)} más al mes de lo que deberían: entrégale tu Formulario SRI-GP o pregúntale.`
          : `Te retienen ${fmt(-diff)} menos al mes: podrías tener que pagarlo al declarar.`;
      }
    }
    hooks.onCalc?.({ ...r, salary: s, verdict: state });
  }
  for (const id of ["salary", "gastos", "cargas", "rol"]) $(id)?.addEventListener("input", update);
  update();

  $("lista-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = $("lista-msg"), btn = $("lista-btn");
    const email = $("lista-email").value.trim(), consent = $("lista-consent").checked;
    msg.dataset.state = "";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email)) { msg.textContent = "Revisa tu correo: no parece una dirección válida."; msg.dataset.state = "bad"; $("lista-email").focus(); return; }
    if (!consent) { msg.textContent = "Marca la casilla para que podamos escribirte."; msg.dataset.state = "bad"; return; }
    btn.disabled = true;
    btn.dataset.busy = "1";
    try {
      const r = await fetch("/api/lista", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, consent, website: $("lista-website").value }) });
      const d = await r.json();
      msg.textContent = d.message; msg.dataset.state = d.ok ? "ok" : "bad";
      if (d.ok) { hooks.onJoined?.(email); e.target.reset(); }
    } catch {
      msg.textContent = "No pudimos enviar tu correo: revisa tu conexión y vuelve a intentar."; msg.dataset.state = "bad";
    }
    btn.disabled = false;
    delete btn.dataset.busy;
  });
})();
