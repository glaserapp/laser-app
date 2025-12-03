/************************************************************
 * 1) SUPABASE INIT
 ************************************************************/
const SUPABASE_URL = "https://ovylsagjaskidrmiiunu.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_bxs0aUYwP5_l-Vdqc4eNEw_NYTtN5Oy";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);


/************************************************************
 * 2) NAČTENÍ ZÁKAZNÍKŮ DO SELECTU
 ************************************************************/
async function loadCustomers() {
  const { data, error } = await supabaseClient
    .from("customers")
    .select("prefix, name")
    .order("name", { ascending: true });

  if (error) {
    console.error("❌ Chyba při načítání zákazníků:", error);
    return;
  }

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
 * 3) GENEROVÁNÍ SERIÁLOVÉHO ČÍSLA (prefix-0001)
 ************************************************************/
async function generateSerial() {
  const prefix = document.getElementById("serial-prefix").value.trim();
  const dmEnabled = document.getElementById("dm-enable").checked;
  const serialEnabled = document.getElementById("serial-enable").checked;

  if (!prefix) {
    alert("Musíš zadat prefix seriového čísla.");
    return;
  }

  // 🔥 1) Pokud sériové číslo není povolené
  if (!serialEnabled) {
    document.getElementById("dm-content").value = "";
    updatePreview();
    return;
  }

  // 🔥 2) Dotaz do databáze
  let { data, error } = await supabaseClient
    .from("serial_counters")
    .select("*")
    .eq("prefix", prefix)
    .maybeSingle();

  let nextSerial = 1;

  if (error) {
    console.error("Chyba načítání serialu:", error);
    return;
  }

  // 🔥 3) prefix ještě neexistuje
  if (!data) {
    const { data: inserted, error: insertErr } = await supabaseClient
      .from("serial_counters")
      .insert({ prefix, current_serial: 1 })
      .select()
      .single();

    if (insertErr) {
      console.error("Chyba při vytváření nového prefixu:", insertErr);
      return;
    }

    nextSerial = 1;
  } else {
    // 🔥 existuje → navýšit counter
    nextSerial = data.current_serial + 1;

    const { error: updateErr } = await supabaseClient
      .from("serial_counters")
      .update({ current_serial: nextSerial })
      .eq("id", data.id);

    if (updateErr) {
      console.error("Chyba update serialu:", updateErr);
      return;
    }
  }

  const fullSerial = `${prefix}-${String(nextSerial).padStart(4, "0")}`;

  // 🔥 4) DM obsah = seriál (pokud je DM zapnuto)
  if (dmEnabled) {
    document.getElementById("dm-content").value = fullSerial;
  }

  updatePreview();
}


/************************************************************
 * 4) PREVIEW ŠTÍTKU
 ************************************************************/
function updatePreview() {
  const toolName = document.getElementById("tool-name").value;
  const diameter = document.getElementById("diameter").value;
  const length = document.getElementById("length").value;
  const regrinds = document.getElementById("regrinds").value;

  const dmContent = document.getElementById("dm-content").value;

  const preview = document.getElementById("preview-area");

  preview.innerHTML = `
    <div style="padding:20px; font-size:18px;">
      <strong>${toolName || ""}</strong><br>
      Ø${diameter || "-"} × ${length || "-"} mm<br>
      Max. přebroušení: ${regrinds || "-"}<br><br>
      ${dmContent ? `<div>DM: <strong>${dmContent}</strong></div>` : ""}
    </div>
  `;
}


/************************************************************
 * 5) ULOŽENÍ NÁSTROJE DO DB (tabulka tools)
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

  const newTool = {
    customer_prefix: customerPrefix,
    name,
    diameter,
    length,
    regrinds,
    serial_enabled: serialEnabled,
    dm_enabled: dmEnabled,
    dm_code: dmContent || null
  };

  console.log("📦 Data posílaná do DB:", newTool);

  const { data, error } = await supabaseClient
    .from("tools")
    .insert(newTool);

  if (error) {
    console.error("❌ Chyba při ukládání:", error);
    alert("⚠ Chyba ukládání do databáze.");
  } else {
    console.log("✅ Uloženo:", data);
    alert("✅ Nástroj úspěšně uložen!");
  }
}


/************************************************************
 * 6) EXPORT ŠTÍTKU JAKO JSON
 ************************************************************/
function exportLabel() {
  const json = JSON.stringify(
    {
      toolName: document.getElementById("tool-name").value,
      diameter: document.getElementById("diameter").value,
      length: document.getElementById("length").value,
      regrinds: document.getElementById("regrinds").value,
      dm: document.getElementById("dm-content").value
    },
    null,
    2
  );

  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
}


/************************************************************
 * 7) INIT – PO NAČTENÍ STRÁNKY
 ************************************************************/
window.addEventListener("DOMContentLoaded", () => {
  loadCustomers();
  updatePreview();

  [
    "tool-name",
    "diameter",
    "length",
    "regrinds",
    "dm-content",
    "dm-enable",
    "serial-enable"
  ].forEach(id => {
    document.getElementById(id).addEventListener("input", updatePreview);
  });
});
