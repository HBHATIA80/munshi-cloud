"use client";

export function showAlert(title: string, message: string, icon = "ℹ️") {
  const ov = document.createElement("div");
  ov.className = "alert-ovl";
  ov.innerHTML =
    '<div class="alert-box">' +
      '<div class="ai">' + icon + '</div>' +
      '<div class="at">' + title + '</div>' +
      '<div class="am">' + message + '</div>' +
      '<button class="btn pri" style="margin-top:14px">OK</button>' +
    '</div>';
  ov.addEventListener("mousedown", e => {
    if (e.target === ov || (e.target as HTMLElement).tagName === "BUTTON") { ov.remove(); }
  });
  document.body.appendChild(ov);
}

export function showConfirm(title: string, message: string): Promise<boolean> {
  return new Promise(resolve => {
    const ov = document.createElement("div");
    ov.className = "alert-ovl";
    ov.innerHTML =
      '<div class="alert-box">' +
        '<div class="ai">⚠️</div>' +
        '<div class="at">' + title + '</div>' +
        '<div class="am">' + message + '</div>' +
        '<div style="display:flex;gap:8px;justify-content:center;margin-top:14px">' +
          '<button class="btn" data-no>Cancel</button>' +
          '<button class="btn dng" data-yes>Confirm</button>' +
        '</div>' +
      '</div>';
    ov.querySelector("[data-no]")!.addEventListener("click", () => { ov.remove(); resolve(false); });
    ov.querySelector("[data-yes]")!.addEventListener("click", () => { ov.remove(); resolve(true); });
    document.body.appendChild(ov);
  });
}