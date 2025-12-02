// === Laser Label Builder – základní logika ===

// Uložit zákazníka
document.getElementById("customer-select").addEventListener("change", (e) => {
  console.log("Zákazník změněn na:", e.target.value);
});

// Náhled hodnot (placeholder — bude se rozšiřovat)
function updatePreview() {
  const diameter = document.getElementById("diameter").value;
  const angle = document.getElementById("angle").value;
  const coating = document.getElementById("coating").value;

  const preview = document.getElementById("preview-area");

  preview.innerHTML = `
    <strong>Náhled popisu:</strong><br>
    Průměr: ${diameter} mm<br>
    Úhel: ${angle}°<br>
    Povlak: ${coating}
  `;
}

// Event Listeners
["diameter", "angle", "coating"].forEach(id => {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener("input", updatePreview);
  }
});

// První vykreslení
updatePreview();
