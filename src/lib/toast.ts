// toast ultra simple (pas de provider, pas de lib externe)
export function toast(msg: string, ms = 1800) {
  const el = document.createElement("div");
  el.textContent = msg;
  el.style.position = "fixed";
  el.style.left = "50%";
  el.style.bottom = "24px";
  el.style.transform = "translateX(-50%)";
  el.style.padding = "10px 14px";
  el.style.borderRadius = "10px";
  el.style.background = "rgba(31,41,55,.95)";      // charcoal
  el.style.color = "#fff";
  el.style.fontSize = "14px";
  el.style.boxShadow = "0 8px 24px rgba(0,0,0,.2)";
  el.style.zIndex = "9999";
  el.style.opacity = "0";
  el.style.transition = "opacity .15s ease";
  document.body.appendChild(el);
  requestAnimationFrame(() => (el.style.opacity = "1"));
  setTimeout(() => {
    el.style.opacity = "0";
    setTimeout(() => el.remove(), 150);
  }, ms);
}
