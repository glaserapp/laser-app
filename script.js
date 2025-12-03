/************************************************************
 * SUPABASE – INITIALIZATION
 ************************************************************/

// Sem vlož své klíče:
const SUPABASE_URL = https://ovylsagjaskidrmiiunu.supabase.co;
const SUPABASE_ANON_KEY = sb_publishable_bxs0aUYwP5_l-Vdqc4eNEw_NYTtN5Oy;

// Vytvoření klienta
const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/************************************************************
 * FETCH – ZÍSKÁNÍ ZÁKAZNÍKŮ Z DB
 ************************************************************/
async function loadCustomers() {
    const { data, error } = await db
        .from("customers")
        .select("prefix, name")
        .order("name", { ascending: true });

    if (error) {
        console.error("Chyba při načítání zákazníků:", error);
        return;
    }

    // naplnění selectu v UI
    const select = document.getElementById("customer-select");
    select.innerHTML = "";

    data.forEach(c => {
        const opt = document.createElement("option");
        opt.value = c.prefix;
        opt.textContent = `${c.name} (${c.prefix})`;
        select.appendChild(opt);
    });
}

/************************************************************
 * SERIAL NUMBER GENERATOR – z tabulky serial_counters
 ************************************************************/
async function generateSerial(prefix) {

    // 1) Načti aktuální counter
    let { data, error } = await db
        .from("serial_counters")
        .select("*")
        .eq("prefix", prefix)
        .maybeSingle();

    if (error) {
        console.error("Chyba načítání counter:", error);
        return null;
    }

    // pokud neexistuje → vytvoř nový
    if (!data) {
        const { data: insertData, error: insertErr } = await db
            .from("serial_counters")
            .insert({ prefix: prefix, gtin: "NONE", current_serial: 1 })
            .select()
            .single();

        if (insertErr) {
            console.error("Chyba při zakládání counteru:", insertErr);
            return null;
        }

        data = insertData;
    }

    const next = data.current_serial + 1;

    // 2) zapiš zvýšenou hodnotu
    const { error: updateErr } = await db
        .from("serial_counters")
        .update({ current_serial: next })
        .eq("id", data.id);

    if (updateErr) {
        console.error("Chyba update counter:", updateErr);
        return null;
    }

    // 3) vrať formát „PREFIX-0001“
    return `${prefix}-${String(next).padStart(4, "0")}`;
}

/************************************************************
 * SAVE MARKING JOB – uloží popis / šablonu do DB
 ************************************************************/
async function saveMarkingJob(jobData) {

    const { error } = await db
        .from("marking_jobs")
        .insert(jobData);

    if (error) {
        console.error("Chyba ukládání úlohy:", error);
        return false;
    }

    return true;
}

// Po načtení stránky načti zákazníky
window.addEventListener("DOMContentLoaded", loadCustomers);// === Laser Label Builder – flexibilní základ ===

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
async function generateSerial() {
  const prefix = document.getElementById("serial-prefix").value.trim();
  const startNum = parseInt(document.getElementById("serial-start").value);
  const toolName = document.getElementById("tool-name").value.trim();
  const dmEnabled = document.getElementById("dm-enable").checked;
  const serialEnabled = document.getElementById("serial-enable").checked;

  let finalSerial = "";
  let finalDM = "";

  // --- 1) Pokud je SERIAL vypnutý ---
  if (!serialEnabled) {
    finalSerial = "";
  } 
  // --- 2) SERIAL zapnutý → generujeme přes databázi ---
  else {
    const { data, error } = await supabase
      .from("serial_counters")
      .select("current_serial")
      .eq("prefix", prefix)
      .single();

    let nextSerial = 1;

    if (data) {
      nextSerial = data.current_serial + 1;

      await supabase
        .from("serial_counters")
        .update({ current_serial: nextSerial })
        .eq("prefix", prefix);

    } else {
      await supabase
        .from("serial_counters")
        .insert({ prefix: prefix, current_serial: startNum });

      nextSerial = startNum;
    }

    finalSerial = `${prefix}-${String(nextSerial).padStart(4, "0")}`;
  }

  // --- 3) DM logika ---
  if (!dmEnabled) {
    finalDM = "";
  } else {
    if (serialEnabled) {
      finalDM = finalSerial;
    } else {
      finalDM = `${toolName}`;
    }
  }

  // Zapsání do formuláře
  document.getElementById("dm-content").value = finalDM;

  updatePreview();
    function updatePreview() {
  const preview = document.getElementById("preview-area");

  const toolName = document.getElementById("tool-name").value;
  const diameter = document.getElementById("diameter").value;
  const length = document.getElementById("length").value;
  const regrinds = document.getElementById("regrinds").value;

  const dmContent = document.getElementById("dm-content").value;

  preview.innerHTML = `
    <div style="padding:20px; font-size:18px;">
      <strong>${toolName}</strong><br>
      Ø${diameter} × ${length} mm<br>
      Max. přebroušení: ${regrinds}<br><br>
      ${dmContent ? `<div>DM kód: <strong>${dmContent}</strong></div>` : ""}
    </div>
  `;
document.getElementById("dm-enable").addEventListener("change", updatePreview);
document.getElementById("serial-enable").addEventListener("change", updatePreview);
document.getElementById("dm-content").addEventListener("input", updatePreview);

document.getElementById("tool-name").addEventListener("input", updatePreview);
document.getElementById("diameter").addEventListener("input", updatePreview);
document.getElementById("length").addEventListener("input", updatePreview);
document.getElementById("regrinds").addEventListener("input", updatePreview);
        async function saveTool() {
  const customerPrefix = document.getElementById("customer-select").value;
  const name = document.getElementById("tool-name").value.trim();
  const diameter = parseFloat(document.getElementById("diameter").value);
  const length = parseFloat(document.getElementById("length").value);
  const regrinds = parseInt(document.getElementById("regrinds").value);

  const serialEnabled = document.getElementById("serial-enable").checked;
  const dmEnabled = document.getElementById("dm-enable").checked;
  const dmContent = document.getElementById("dm-content").value.trim();

  if (!name) {
    alert("❗ Musíš zadat název nástroje.");
    return;
  }

  const insertData = {
    customer_prefix: customerPrefix,
    name: name,
    diameter: diameter,
    length: length,
    regrinds: regrinds,
    dm_enabled: dmEnabled,
    serial_enabled: serialEnabled,
    dm_code: dmContent
  };

  const { data, error } = await supabase
    .from("tools")
    .insert(insertData);

  if (error) {
    console.error(error);
    alert("⚠ Chyba při ukládání nástroje.");
  } else {
    alert("✅ Nástroj úspěšně uložen!");
  }
}
    }
}
/************************************************************
 * ULOŽENÍ NÁSTROJE DO SUPABASE (tabulka tools)
 ************************************************************/

async function saveTool() {

  console.log("▶ saveTool() spuštěno");

  const customerPrefix = document.getElementById("customer-select").value;
  const name = document.getElementById("tool-name").value.trim();
  const diameter = parseFloat(document.getElementById("diameter").value);
  const length = parseFloat(document.getElementById("length").value);
  const regrinds = parseInt(document.getElementById("regrinds").value);

  const serialEnabled = document.getElementById("serial-enable").checked;
  const dmEnabled = document.getElementById("dm-enable").checked;
  const dmContent = document.getElementById("dm-content").value.trim();

  if (!name) {
    alert("❗ Musíš zadat název nástroje.");
    return;
  }

  const insertData = {
    customer_prefix: customerPrefix,
    name: name,
    diameter: diameter,
    length: length,
    regrinds: regrinds,
    serial_enabled: serialEnabled,
    dm_enabled: dmEnabled,
    dm_code: dmContent
  };

  console.log("📦 Odesílám do Supabase:", insertData);

  const { data, error } = await supabase
    .from("tools")
    .insert(insertData);

  if (error) {
    console.error("❌ Chyba při ukládání:", error);
    alert("⚠ Chyba při ukládání nástroje.");
  } else {
    console.log("✅ Uloženo:", data);
    alert("✅ Nástroj úspěšně uložen!");
  }
}
