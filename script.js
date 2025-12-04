/************************************************************
 * SUPABASE INIT
 ************************************************************/
const SUPABASE_URL = "https://ovylsagjaskidrmiiunu.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_bxs0aUYwP5_l-Vdqc4eNEw_NYTtN5Oy";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/************************************************************
 * AUTOCOMPLETE – ZÁKAZNÍK
 ************************************************************/
async function searchCustomers(text) {
  if (!text) return [];

  const { data, error } = await supabaseClient
    .from("customers")
    .select("*")
    .ilike("name", `%${text}%`)
    .order("name");

  if (error) {
    console.error("❌ Chyba vyhledávání zákazníků:", error);
    return [];
  }

  return data || [];
}

function renderSuggestions(list, inputValue) {
  const box = document.getElementById("customer-suggestions");
  box.innerHTML = "";

  // žádný výsledek → nabídni založení nového
  if (list.length === 0 && inputValue.length >= 2) {
    box.innerHTML = `
      <div class="suggestion-new" onclick="createNewCustomer('${inputValue.replace(/'/g, "\\'")}')">
        + Založit nového zákazníka: <strong>${inputValue}</strong>
      </div>`;
    box.classList.remove("hidden");
    return;
  }

  // výpis nalezených zákazníků
  list.forEach(item => {
    const row = document.createElement("div");
    row.className = "suggestion-item";
    row.textContent = `${item.name} (${item.prefix})`;
    row.onclick = () => selectCustomer(item);
    box.appendChild(row);
  });

  if (list.length > 0) {
    box.classList.remove("hidden");
  } else {
    box.classList.add("hidden");
  }
}

function generatePrefix(name) {
  const clean = name.replace(/[^A-Za-z]/g, "").toUpperCase();
  if (!clean) return "CUST" + String(Math.floor(Math.random() * 90 + 10));
  return clean.substring(0, 2) + String(Math.floor(Math.random() * 90 + 10));
}

async function createNewCustomer(name) {
  const prefix = generatePrefix(name);

  const { data, error } = await supabaseClient
    .from("customers")
    .insert({ name, prefix })
    .select()
    .single();

  if (error) {
    console.error("❌ Chyba zakládání zákazníka:", error);
    alert("Chyba při zakládání zákazníka.");
    return;
  }

  selectCustomer(data); // znovu využijeme stejnou logiku
}

function selectCustomer(item) {
  const searchInput = document.getElementById("customer-search");
  const prefixInput = document.getElementById("customer-prefix");
  const serialPrefixInput = document.getElementById("serial-prefix");

  searchInput.value = item.name;
  prefixInput.value = item.prefix;
  serialPrefixInput.value = item.prefix;        // 🔁 AUTOFILL prefixu pro sériové číslo

  document.getElementById("customer-suggestions").classList.add("hidden");
}

/************************************************************
 * GENEROVÁNÍ SÉRIOVÉHO ČÍSLA + DM
 ************************************************************/
async function generateSerial() {
  const serialEnabled = document.getElementById("serial-enable").checked;
  const dmEnabled = document.getElementById("dm-enable").checked;

  const serialPrefixInput = document.getElementById("serial-prefix");
  const customerPrefixInput = document.getElementById("customer-prefix");

  // když není vyplněn prefix pro sérii, zkus prefix zákazníka
  if (!serialPrefixInput.value.trim() && customerPrefixInput.value.trim()) {
    serialPrefixInput.value = customerPrefixInput.value.trim();
  }

  const prefix = serialPrefixInput.value.trim();
  const dmContentInput = document.getElementById("dm-content");

  // pokud sériové číslo nepoužíváme
  if (!serialEnabled) {
    dmContentInput.value = dmEnabled ? prefix : "";
    updatePreview();
    return;
  }

  if (!prefix) {
    alert("Zadej prefix pro sériové číslo.");
    return;
  }

  // načti / navýš counter pro daný prefix
  const { data, error } = await supabaseClient
    .from("serial_counters")
    .select("*")
    .eq("prefix", prefix)
    .maybeSingle();

  if (error) {
    console.error("❌ Chyba při čtení serial_counters:", error);
    alert("Chyba při generování sériového čísla.");
    return;
  }

  let next = data ? data.current_serial + 1 : 1;

  if (!data) {
    const { error: insErr } = await supabaseClient
      .from("serial_counters")
      .insert({ prefix, current_serial: 1 });

    if (insErr) {
      console.error("❌ Chyba insert serial_counters:", insErr);
      alert("Chyba při generování sériového čísla.");
      return;
    }
  } else {
    const { error: updErr } = await supabaseClient
      .from("serial_counters")
      .update({ current_serial: next })
      .eq("id", data.id);

    if (updErr) {
      console.error("❌ Chyba update serial_counters:", updErr);
      alert("Chyba při generování sériového čísla.");
      return;
    }
  }

  const serial = `${prefix}-${String(next).padStart(4, "0")}`;
  dmContentInput.value = dmEnabled ? serial : prefix;

  updatePreview();
}

/************************************************************
 * NÁHLED ŠTÍTKU
 ************************************************************/
function updatePreview() {
  const toolName = document.getElementById("tool-name").value.trim();
  const diameter = parseFloat(document.getElementById("diameter").value) || 0;
  const length = parseFloat(document.getElementById("length").value) || 0;
  const dmContent = document.getElementById("dm-content").value.trim();

  const preview = document.getElementById("preview-area");

  // přepočet mm → px (1 mm = 20 px)
  const scale = 20;
  let pxWidth = length * scale;
  let pxHeight = diameter * scale;

  // kdyby to bylo extrémně velké, trochu stáhneme měřítko
  const maxPx = 400;
  const maxDim = Math.max(pxWidth, pxHeight);
  if (maxDim > maxPx && maxDim > 0) {
    const factor = maxPx / maxDim;
    pxWidth = pxWidth * factor;
    pxHeight = pxHeight * factor;
  }

  const dmSize = Math.min(pxHeight * 0.6, pxWidth * 0.4); // obdélník ~ uprostřed

  preview.innerHTML = `
    <div style="
      width:${pxWidth || 200}px;
      height:${pxHeight || 120}px;
      border-radius:${pxHeight / 2 || 60}px;
      background: radial-gradient(circle at 30% 0%, #ffffff, #cfcfcf);
      margin:auto;
      position:relative;
      display:flex;
      align-items:center;
      justify-content:center;
      box-shadow: 0 8px 24px rgba(0,0,0,0.12);
    ">
      <!-- DM obdélník -->
      <div style="
        width:${dmSize || 80}px;
        height:${dmSize * 0.6 || 48}px;
        background:#111;
        border-radius:6px;
      "></div>
    </div>

    <div style="text-align:center; margin-top:16px; font-size:14px;">
      <div style="font-weight:600;">${toolName || "&nbsp;"}</div>
      <div>${document.getElementById("customer-tool-id").value.trim() || "&nbsp;"}</div>
      <div style="margin-top:4px;">
        <strong>DM:</strong> ${dmContent || "&nbsp;"}
      </div>
    </div>
  `;
}

/************************************************************
 * ULOŽENÍ NÁSTROJE
 ************************************************************/
async function saveTool() {
  const name = document.getElementById("tool-name").value.trim();
  if (!name) {
    alert("Musíš zadat název nástroje.");
    return;
  }

  const insertData = {
    customer_prefix: document.getElementById("customer-prefix").value.trim(),
    name,
    diameter: parseFloat(document.getElementById("diameter").value) || null,
    length: parseFloat(document.getElementById("length").value) || null,
    serial_enabled: document.getElementById("serial-enable").checked,
    dm_enabled: document.getElementById("dm-enable").checked,
    dm_code: document.getElementById("dm-content").value.trim() || null,
    customer_tool_id: document.getElementById("customer-tool-id").value.trim() || null
  };

  const { error } = await supabaseClient.from("tools").insert(insertData);

  if (error) {
    console.error("❌ Chyba ukládání:", error);
    alert("Chyba ukládání: " + (error.message || ""));
  } else {
    alert("✅ Nástroj uložen.");
  }
}

/************************************************************
 * EXPORT – zatím jen placeholder
 ************************************************************/
function exportLabel() {
  alert("Export štítku zatím není implementovaný.");
}

/************************************************************
 * INIT
 ************************************************************/
window.addEventListener("DOMContentLoaded", () => {
  const searchInput = document.getElementById("customer-search");

  searchInput.addEventListener("input", async () => {
    const text = searchInput.value.trim();
    if (!text) {
      document.getElementById("customer-suggestions").classList.add("hidden");
      return;
    }
    const res = await searchCustomers(text);
    renderSuggestions(res, text);
  });

  // aktualizace náhledu při změně polí
  ["tool-name", "diameter", "length", "customer-tool-id", "dm-content"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("input", updatePreview);
  });

  updatePreview();
});
