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

  // možnost vytvořit nového zákazníka
  if (list.length === 0 && inputValue.length >= 2) {
    box.innerHTML = `
      <div class="suggestion-new" onclick="createNewCustomer('${inputValue.replace(/'/g, "\\'")}')">
        + Založit nového zákazníka: <strong>${inputValue}</strong>
      </div>`;
    box.classList.remove("hidden");
    return;
  }

  // seznam nalezených firem
  list.forEach(item => {
    const row = document.createElement("div");
    row.className = "suggestion-item";
    row.textContent = `${item.name} (${item.prefix})`;
    row.onclick = () => selectCustomer(item);
    box.appendChild(row);
  });

  box.classList.toggle("hidden", list.length === 0);
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

  selectCustomer(data);
}

function selectCustomer(item) {
  document.getElementById("customer-search").value = item.name;
  document.getElementById("customer-prefix").value = item.prefix;

  // automatické vyplnění prefixu pro sériové číslo
  document.getElementById("serial-prefix").value = item.prefix;

  document.getElementById("customer-suggestions").classList.add("hidden");
}

/************************************************************
 * GENEROVÁNÍ SÉRIOVÉHO ČÍSLA – TABULKA serial_counters
 ************************************************************/
async function generateSerial() {
  const serialEnabled = document.getElementById("serial-enable").checked;
  const dmEnabled = document.getElementById("dm-enable").checked;

  const prefixInput = document.getElementById("serial-prefix");
  const customerPrefix = document.getElementById("customer-prefix").value.trim();
  const dmContentInput = document.getElementById("dm-content");

  // automatické doplnění prefixu
  if (!prefixInput.value.trim() && customerPrefix) {
    prefixInput.value = customerPrefix;
  }

  const prefix = prefixInput.value.trim();

  if (!serialEnabled) {
    dmContentInput.value = dmEnabled ? prefix : "";
    updatePreview();
    return;
  }

  if (!prefix) {
    alert("Zadej prefix pro sériové číslo.");
    return;
  }

  // načti counter
  const { data, error } = await supabaseClient
    .from("serial_counters")
    .select("*")
    .eq("prefix", prefix)
    .maybeSingle();

  if (error) {
    console.error("❌ Chyba SELECT serial_counters:", error);
    alert("Chyba při generování sériového čísla.");
    return;
  }

  let next = data ? data.current_serial + 1 : 1;

  if (!data) {
    // nový prefix
    const { error: insErr } = await supabaseClient
      .from("serial_counters")
      .insert({ prefix, current_serial: 1 });

    if (insErr) {
      console.error("❌ Chyba INSERT serial_counters:", insErr);
      alert("Chyba při generování sériového čísla.");
      return;
    }
  } else {
    // aktualizace existujícího prefixu
    const { error: updErr } = await supabaseClient
      .from("serial_counters")
      .update({ current_serial: next })
      .eq("id", data.id);

    if (updErr) {
      console.error("❌ Chyba UPDATE serial_counters:", updErr);
      alert("Chyba při generování sériového čísla.");
      return;
    }
  }

  const serial = `${prefix}-${String(next).padStart(4, "0")}`;
  dmContentInput.value = dmEnabled ? serial : prefix;

  updatePreview();
}

/************************************************************
 * NÁHLED ŠTÍTKU (vizuální simulace stopky)
 ************************************************************/
function updatePreview() {
  const toolName = document.getElementById("tool-name").value.trim();
  const diameter = parseFloat(document.getElementById("diameter").value) || 10;
  const length = parseFloat(document.getElementById("length").value) || 50;
  const dmContent = document.getElementById("dm-content").value.trim();
  const toolId = document.getElementById("customer-tool-id").value.trim();

  const preview = document.getElementById("preview-area");

  // mm → px
  const scale = 20;
  let pxWidth = length * scale;
  let pxHeight = diameter * scale;

  const maxPx = 400;
  const maxDim = Math.max(pxWidth, pxHeight);
  if (maxDim > maxPx) {
    const factor = maxPx / maxDim;
    pxWidth *= factor;
    pxHeight *= factor;
  }

  const dmSize = Math.min(pxHeight * 0.6, pxWidth * 0.4);

  preview.innerHTML = `
    <div style="
      width:${pxWidth}px;
      height:${pxHeight}px;
      border-radius:${pxHeight / 2}px;
      background: radial-gradient(circle at 30% 0%, #ffffff, #cfcfcf);
      margin:auto;
      display:flex;
      align-items:center;
      justify-content:center;
      position:relative;
      box-shadow:0 8px 24px rgba(0,0,0,0.12);
    ">
      <div style="
        width:${dmSize}px;
        height:${dmSize * 0.6}px;
        background:#111;
        border-radius:6px;
      "></div>
    </div>

    <div style="text-align:center; margin-top:16px; font-size:14px;">
      <div style="font-weight:600;">${toolName || "&nbsp;"}</div>
      <div>${toolId || "&nbsp;"}</div>
      <div style="margin-top:4px;"><strong>DM:</strong> ${dmContent || "&nbsp;"}</div>
    </div>
  `;
}

/************************************************************
 * ULOŽENÍ NÁSTROJE DO DB
 ************************************************************/
async function saveTool() {
  const name = document.getElementById("tool-name").value.trim();
  if (!name) return alert("Musíš zadat název nástroje.");

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
    alert("Chyba ukládání: " + error.message);
  } else {
    alert("✅ Nástroj uložen.");
  }
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

  // realtime náhled
  ["tool-name", "diameter", "length", "customer-tool-id", "dm-content"]
    .forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener("input", updatePreview);
    });

  updatePreview();
});
