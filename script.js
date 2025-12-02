// === Laser Label Builder – flexibilní základ ===

document.addEventListener("DOMContentLoaded", () => {
  const customerSelect = document.getElementById("customer-select");
  const toolNameInput = document.getElementById("tool-name");
  const diameterInput = document.getElementById("diameter");
  const lengthInput = document.getElementById("length");
  const regrindsInput = document.getElementById("regrinds");
  const serialPrefixInput = document.getElementById("serial-prefix");
  const serialStartInput = document.getElementById("serial-start");
  const previewArea = document.getElementById("preview-area");

  function escapeHtml(str) {
    if (!str) return "";
    return str.replace(/[&<>"']/g, (s) => {
      const map = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      };
      return map[s] || s;
    });
  }

  function buildModel() {
    const toolName = toolNameInput.value.trim();
    const dia = parseFloat((diameterInput.value || "").toString().replace(",", "."));
    const len = parseFloat((lengthInput.value || "").toString().replace(",", "."));
    const regrinds = regrindsInput.value === "" ? null : parseInt(regrindsInput.value, 10);

    const prefixRaw = (serialPrefixInput.value || customerSelect.value || "").trim();
    const serialStart = parseInt(serialStartInput.value, 10) || 1;

    const serialText = prefixRaw
      ? `${prefixRaw}-${String(serialStart).padStart(4, "0")}`
      : String(serialStart).padStart(4, "0");

    const dimParts = [];
    if (!Number.isNaN(dia)) dimParts.push(`D${dia.toFixed(2)}`);
    if (!Number.isNaN(len)) dimParts.push(`${len.toFixed(1)}`);

    let dimLine = "";
    if (dimParts.length) {
      dimLine = dimParts.join("×");
    }

    const segments = [];

    if (toolName) {
      segments.push({ slot: "main", type: "tool", text: toolName });
    }

    if (dimLine) {
      segments.push({ slot: "sub", type: "dimensions", text: dimLine });
    }

    if (regrinds !== null) {
      segments.push({
        slot: "meta",
        type: "regrinds",
        text: `Max. přebroušení: ${regrinds}`,
      });
    }

    segments.push({
      slot: "serial",
      type: "serial",
      text: serialText,
      prefix: prefixRaw,
      rawNumber: serialStart,
    });

    return {
      customerPrefix: customerSelect.value,
      toolName,
      diameter: Number.isNaN(dia) ? null : dia,
      length: Number.isNaN(len) ? null : len,
      regrinds,
      segments,
    };
  }

  function renderPreview() {
    const model = buildModel();

    const mainSeg = model.segments.find((s) => s.slot === "main");
    const subSeg = model.segments.find((s) => s.slot === "sub");
    const metaSeg = model.segments.find((s) => s.slot === "meta");
    const serialSeg = model.segments.find((s) => s.slot === "serial");

    previewArea.innerHTML = `
      <div class="label-surface">
        <div class="label-lines">
          <div class="label-main">
            ${escapeHtml(mainSeg ? mainSeg.text : "Zadej název nástroje")}
          </div>
          ${
            subSeg
              ? `<div class="label-sub">${escapeHtml(subSeg.text)}</div>`
              : ""
          }
          ${
            metaSeg
              ? `<div class="label-meta">${escapeHtml(metaSeg.text)}</div>`
              : ""
          }
        </div>
        <div class="label-serial">
          <div class="serial-tag">SER</div>
          <div class="serial-value">
            ${escapeHtml(serialSeg ? serialSeg.text : "")}
          </div>
        </div>
      </div>
    `;
  }

  // Funkce pro tlačítka v HTML (musí být globálně)
  window.generateSerial = function generateSerial() {
    const current = parseInt(serialStartInput.value, 10) || 1;
    serialStartInput.value = String(current + 1);
    renderPreview();
  };

  window.exportLabel = function exportLabel() {
    const model = buildModel();
    const json = JSON.stringify(model, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  };

  // Přepočítávání při změně vstupů
  [
    customerSelect,
    toolNameInput,
    diameterInput,
    lengthInput,
    regrindsInput,
    serialPrefixInput,
    serialStartInput,
  ].forEach((el) => {
    el.addEventListener("input", renderPreview);
  });

  // První vykreslení
  renderPreview();
});
