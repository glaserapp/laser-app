/************************************************************
 * SUPABASE INIT
 ************************************************************/
const SUPABASE_URL = "https://ovylsagjaskidrmiiunu.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_bxs0aUYwP5_l-Vdqc4eNEw_NYTtN5Oy";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/************************************************************
 * AUTOCOMPLETE – SEARCH CUSTOMERS
 ************************************************************/
async function searchCustomers(text) {
  const { data, error } = await supabaseClient
    .from("customers")
    .select("*")
    .ilike("name", `%${text}%`)
    .order("name");

  if (error) {
    console.error("Chyba vyhledávání:", error);
    return [];
  }

  return data || [];
}

function renderSuggestions(list, inputValue) {
  const box = document.getElementById("customer-suggestions");
  box.innerHTML = "";

  if (list.length === 0 && inputValue.length >= 2) {
    box.innerHTML = `
      <div class="suggestion-new" onclick="createNewCustomer('${inputValue}')">
        + Založit nového zákazníka: <strong>${inputValue}</strong>
      </div>`;
    box.classList.remove("hidden");
    return;
  }

  list.forEach(item => {
    const row = document.createElement("div");
    row.className = "suggestion-item";
    row.textContent = `${item.name} (${item.prefix})`;
    row.onclick = () => selectCustomer(item);
    box.appendChild(row);
  });

  box.classList.remove("hidden");
}

async function createNewCustomer(name) {
  const prefix = generatePrefix(name);

  const { data, error } = await supabaseClient
    .from("customers")
    .insert({ name, prefix })
    .select()
    .single();

  if (error) {
    console.error("Chyba zakládání zákazníka:", error);
    alert("Chyba zakládání zákazníka");
    return;
  }

  document.getElementById("customer-search").value = data.name;
  document.getElementById("customer-prefix").value = data.prefix;
  document.getElementById("customer-suggestions").classList.add("hidden");
}

function generatePrefix(name) {
  const clean = name.replace(/[^A-Za-z]/g, "").toUpperCase();
  return clean.substring(0, 2) + String(Math.floor(Math.random() * 90 + 10));
}

function selectCustomer(item) {
  document.getElementById("customer-search").value = item.name;
  document.getElementById("customer-prefix").value = item.prefix;
  document.getElementById("customer-suggestions").classList.add("hidden");
}

/************************************************************
 * SERIAL GENERATION
 ************************************************************/
async function generateSerial() {
  const prefix = document.getElementById("serial-prefix").value.trim();
  const serialEnabled = document.getElementById("serial-enable").checked;
  const dmEnabled = document.getElementById("dm-enable").checked;

  if (!prefix) {
    alert("Zadej prefix pro sériové číslo.");
    return;
  }

  // pokud nechceme sériové číslo, jen DM = prefix
  if (!serialEnabled) {
    document.getElementById("dm-content").value = dmEnabled ? prefix : "";
    updatePreview();
    return;
  }

  const { data, error } = await supabaseClient
    .from("serial_counters")
    .select("*")
    .eq("prefix", prefix)
    .maybeSingle();

  if (error) {
    console.error("Chyba při čtení serial_counters:", error);
  }

  let next = data ? data.current_serial + 1 : 1;

  if (!data) {
    await supabaseClient
      .from("serial_counters")
      .insert({ prefix, current_serial: 1 });
  } else {
    await supabaseClient
      .from("serial_counters")
      .update({ current_serial: next })
      .eq("id", data.id);
  }

  const serial = `${prefix}-${String(next).padStart(4, "0")}`;

  document.getElementById("dm-content").value = dmEnabled ? serial : prefix;
  updatePreview();
}

/************************************************************
 * PREVIEW – GEOMETRIE STOPKY + DM KÓDU
 ************************************************************/
function updatePreview() {
  const toolName = document.getElementById("tool-name").value.trim();
  const diameterMm =
    parseFloat(document.getElementById("diameter").value) || 10;   // průměr stopky
  const lengthMm =
    parseFloat(document.getElementById("length").value) || 50;     // délka stopky
  const dmContent = document.getElementById("dm-content").value.trim();
  const customerToolId =
    document.getElementById("customer-tool-id").value.trim() || "";

  const preview = document.getElementById("preview-area");

  // základní scale: 1 mm = 20 px, ale omezíme velikost náhledu
  const PX_PER_MM_BASE = 20;
  const MAX_W = 260;
  const MAX_H = 400;

  let scale = PX_PER_MM_BASE;
  if (diameterMm * scale > MAX_W || lengthMm * scale > MAX_H) {
    const sW = MAX_W / diameterMm;
    const sH = MAX_H / lengthMm;
    scale = Math.min(sW, sH);
  }

  const shaftWidth = diameterMm * scale;
  const shaftHeight = lengthMm * scale;

  // DM kód jako obdélník: výška max 60 % průměru, max 4 mm
  const dmHeightMm = Math.min(diameterMm * 0.6, 4);
  const dmWidthMm = dmHeightMm * 3; // obdélník, 3:1
  const dmW = dmWidthMm * scale;
  const dmH = dmHeightMm * scale;

  // střed obdélníku na šířku stopky, zhruba uprostřed délky
  const dmTop = shaftHeight / 2 - dmH / 2;
  const dmLeft = shaftWidth / 2 - dmW / 2;

  preview.innerHTML = `
    <div class="shaft" style="width:${shaftWidth}px; height:${shaftHeight}px;">
      <div class="dm-code"
           style="
             width:${dmW}px;
             height:${dmH}px;
             top:${dmTop}px;
             left:${dmLeft}px;
           ">
      </div>
    </div>

    <div class="label-text">
      ${toolName ? `<div>${toolName}</div>` : ""}
      ${customerToolId ? `<div>${customerToolId}</div>` : ""}
      ${dmContent ? `<div><strong>DM:</strong> ${dmContent}</div>` : ""}
    </div>
  `;
}

/************************************************************
 * SAVE TOOL
 ************************************************************/
async function saveTool() {
  const insertData = {
    customer_prefix: document.getElementById("customer-prefix").value.trim(),
    name: document.getElementById("tool-name").value.trim(),
    diameter: parseFloat(document.getElementById("diameter").value) || null,
    length: parseFloat(document.getElementById("length").value) || null,
    dm_code: document.getElementById("dm-content").value.trim(),
    dm_enabled: document.getElementById("dm-enable").checked,
    serial_enabled: document.getElementById("serial-enable").checked,
    customer_tool_id:
      document.getElementById("customer-tool-id").value.trim() || null
  };

  const { error } = await supabaseClient.from("tools").insert(insertData);

  if (error) {
    console.error("Chyba ukládání:", error);
    alert("Chyba ukládání.");
  } else {
    alert("Nástroj uložen!");
  }
}

/************************************************************
 * EXPORT LABEL (placeholder)
 ************************************************************/
function exportLabel() {
  alert("Export není zatím implementován.");
}

/************************************************************
 * INIT
 ************************************************************/
window.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("customer-search");

  input.addEventListener("input", async () => {
    const text = input.value.trim();
    if (text.length < 1) {
      document.getElementById("customer-suggestions").classList.add("hidden");
      return;
    }
    const res = await searchCustomers(text);
    renderSuggestions(res, text);
  });

  // při psaní parametrů hned aktualizuj náhled
  ["tool-name", "diameter", "length", "dm-content", "customer-tool-id"].forEach(
    id => {
      const el = document.getElementById(id);
      el.addEventListener("input", updatePreview);
    }
  );

  updatePreview();
});
