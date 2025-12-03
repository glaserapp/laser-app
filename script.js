/************************************************************
 * SUPABASE – INIT
 ************************************************************/
const SUPABASE_URL = "https://ovylsagjaskidrmiiunu.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_bxs0aUYwP5_l-Vdqc4eNEw_NYTtN5Oy";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/************************************************************
 * LOAD CUSTOMERS FROM DB
 ************************************************************/
async function loadCustomers() {
  const { data, error } = await supabaseClient
    .from("customers")
    .select("prefix, name")
    .order("name", { ascending: true });

  if (error) {
    console.error("❌ Chyba načítání zákazníků:", error);
    return;
  }

  const select = document.getElementById("customer-select");
  select.innerHTML = "";

  data.forEach(c => {
    const option = document.createElement("option");
    option.value = c.prefix;
    option.textContent = `${c.name} (${c.prefix})`;
    select.appendChild(option);
  });
}

/************************************************************
 * GENERATE SERIAL
 ************************************************************/
async function generateSerial() {
  console.log("▶ generateSerial() spuštěno");

  const prefix = document.getElementById("serial-prefix").value.trim();
  const dmEnabled = document.getElementById("dm-enable").checked;
  const serialEnabled = document.getElementById("serial-enable").checked;

  if (!prefix) {
    alert("Chybí prefix zákazníka.");
    return;
  }

  let finalSerial = "";
  let finalDM = "";

  // SERIAL vypnutý
  if (!serialEnabled) {
    finalSerial = "";
  }

  // SERIAL zapnutý
  else {
    const { data } = await supabaseClient
      .from("serial_counters")
      .select("*")
      .eq("prefix", prefix)
      .maybeSingle();

    let next = 1;

    if (!data) {
      // nový prefix
      await supabaseClient
        .from("serial_counters")
        .insert({ prefix, current_serial: 1 });

      next = 1;
    } else {
      // prefix existuje
      next = data.current_serial + 1;

      await supabaseClient
        .from("serial_counters")
        .update({ current_serial: next })
        .eq("id", data.id);
    }

    finalSerial = `${prefix}-${String(next).padStart(4, "0")}`;
  }

  // DM kód
  finalDM = dmEnabled
    ? (serialEnabled ? finalSerial : prefix)
    : "";

  document.getElementById("dm-content").value = finalDM;
  updatePreview();
}

/************************************************************
 * UPDATE PREVIEW
 ************************************************************/
function updatePreview() {
  const toolName = document.getElementById("tool-name").value;
  const diameter = document.getElementById("diameter").value;
  const length = document.getElementById("length").value;
  const dmContent = document.getElementById("dm-content").value;

  const preview = document.getElementById("preview-area");
  preview.innerHTML = `
    <div style="padding:20px; font-size:18px;">
      <strong>${toolName}</strong><br>
      Ø${diameter} × ${length} mm<br><br>
      ${dmContent ? `<div>DM: <strong>${dmContent}</strong></div>` : ""}
    </div>
  `;
}

/************************************************************
 * SAVE TOOL TO DATABASE
 ************************************************************/
async function saveTool() {
  console.log("▶ saveTool() spuštěno");

  const customerPrefix = document.getElementById("customer-select").value;
  const name = document.getElementById("tool-name").value.trim();
  const diameter = parseFloat(document.getElementById("diameter").value);
  const length = parseFloat(document.getElementById("length").value);
  const serialEnabled = document.getElementById("serial-enable").checked;
  const dmEnabled = document.getElementById("dm-enable").checked;
  const dmContent = document.getElementById("dm-content").value.trim();

  if (!name) {
    alert("Musíš zadat název nástroje.");
    return;
  }

  const insertData = {
    customer_prefix: customerPrefix,
    name,
    diameter,
    length,
    serial_enabled: serialEnabled,
    dm_enabled: dmEnabled,
    dm_code: dmContent
  };

  const { error } = await supabaseClient
    .from("tools")
    .insert(insertData);

  if (error) {
    console.error("❌ Chyba při ukládání:", error);
    alert("⚠️ Chyba ukládání do databáze.");
  } else {
    alert("✅ Nástroj úspěšně uložen!");
  }
}

/************************************************************
 * EXPORT LABEL
 ************************************************************/
function exportLabel() {
  alert("Export zatím není implementován.");
}

/************************************************************
 * INIT
 ************************************************************/
window.addEventListener("DOMContentLoaded", () => {
  loadCustomers();

  ["tool-name","diameter","length","dm-content"]
    .forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener("input", updatePreview);
    });

  updatePreview();
});
