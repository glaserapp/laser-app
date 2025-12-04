/************************************************************
 * SUPABASE – INIT
 ************************************************************/
const SUPABASE_URL = "https://ovylsagjaskidrmiiunu.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_bxs0aUYwP5_l-Vdqc4eNEw_NYTtN5Oy";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);


/************************************************************
 * LOAD ALL CUSTOMERS INTO MEMORY
 ************************************************************/
let ALL_CUSTOMERS = [];

async function loadCustomers() {
  const { data, error } = await supabaseClient
    .from("customers")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    console.error("❌ Chyba načítání zákazníků:", error);
    return;
  }

  ALL_CUSTOMERS = data || [];
}


/************************************************************
 * AUTOCOMPLETE — hledání zákazníků podle psaní
 ************************************************************/
function searchCustomers(query) {
  query = query.toLowerCase();

  return ALL_CUSTOMERS.filter(c =>
    c.name.toLowerCase().includes(query) ||
    c.prefix.toLowerCase().includes(query)
  );
}


/************************************************************
 * VYKRESLENÍ NÁVRHŮ POD INPUT
 ************************************************************/
function renderSuggestions(matches, query) {
  const box = document.getElementById("customer-suggestions");
  box.innerHTML = "";

  // Pokud nic nenapsal
  if (!query) return;

  // Existující shody
  matches.forEach(c => {
    const div = document.createElement("div");
    div.className = "suggestion-item";
    div.textContent = `${c.name} (${c.prefix})`;

    div.onclick = () => {
      document.getElementById("customer-search").value = c.name;
      document.getElementById("serial-prefix").value = c.prefix;
      box.innerHTML = "";
      console.log("✔ Vybrán zákazník:", c);
    };

    box.appendChild(div);
  });

  // Pokud nejsou shody → nabídnout vytvoření
  if (matches.length === 0) {
    const div = document.createElement("div");
    div.className = "suggestion-new";
    div.innerHTML = `➕ Založit nového zákazníka „<strong>${query}</strong>“`;
    div.onclick = () => createNewCustomer(query);
    box.appendChild(div);
  }
}


/************************************************************
 * VYTVOŘENÍ NOVÉHO ZÁKAZNÍKA
 ************************************************************/
async function createNewCustomer(name) {
  console.log("🆕 Zakládám nového zákazníka:", name);

  // Vygenerovat prefix = první 2 písmena + 01, 02…
  const base = name
    .replace(/[^A-Za-z0-9]/g, "")
    .substring(0, 2)
    .toUpperCase();

  // zjistit existující prefixy
  const existing = ALL_CUSTOMERS.filter(c => c.prefix.startsWith(base));
  const number = (existing.length + 1).toString().padStart(2, "0");
  const prefix = base + number;

  // uložit do DB
  const { data, error } = await supabaseClient
    .from("customers")
    .insert({ name, prefix })
    .select()
    .single();

  if (error) {
    alert("Chyba při zakládání zákazníka.");
    console.error(error);
    return;
  }

  // přidat do paměti
  ALL_CUSTOMERS.push(data);

  // nastavit jako aktivního
  document.getElementById("customer-search").value = data.name;
  document.getElementById("serial-prefix").value = data.prefix;

  document.getElementById("customer-suggestions").innerHTML = "";

  alert(`✔ Zákazník „${name}“ byl vytvořen (prefix ${prefix})`);
}


/************************************************************
 * GENERATE SERIAL
 ************************************************************/
async function generateSerial() {
  const prefix = document.getElementById("serial-prefix").value.trim();
  const dmEnabled = document.getElementById("dm-enable").checked;
  const serialEnabled = document.getElementById("serial-enable").checked;

  if (!prefix) {
    alert("Chybí prefix zákazníka.");
    return;
  }

  let finalSerial = "";
  let finalDM = "";

  if (serialEnabled) {
    const { data } = await supabaseClient
      .from("serial_counters")
      .select("*")
      .eq("prefix", prefix)
      .maybeSingle();

    let next = data ? data.current_serial + 1 : 1;

    if (!data) {
      await supabaseClient.from("serial_counters").insert({
        prefix,
        current_serial: 1
      });
    } else {
      await supabaseClient
        .from("serial_counters")
        .update({ current_serial: next })
        .eq("id", data.id);
    }

    finalSerial = `${prefix}-${String(next).padStart(4, "0")}`;
  }

  finalDM = dmEnabled ? (serialEnabled ? finalSerial : prefix) : "";

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

  document.getElementById("preview-area").innerHTML = `
    <div style="padding:20px; font-size:18px;">
      <strong>${toolName}</strong><br>
      Ø${diameter} × ${length} mm<br><br>
      ${dmContent ? `DM: <strong>${dmContent}</strong>` : ""}
    </div>
  `;
}


/************************************************************
 * SAVE TOOL – with customer_tool_id
 ************************************************************/
async function saveTool() {
  const customerName = document.getElementById("customer-search").value.trim();
  const prefix = document.getElementById("serial-prefix").value.trim();

  const name = document.getElementById("tool-name").value.trim();
  const diameter = parseFloat(document.getElementById("diameter").value);
  const length = parseFloat(document.getElementById("length").value);

  const serialEnabled = document.getElementById("serial-enable").checked;
  const dmEnabled = document.getElementById("dm-enable").checked;
  const dmContent = document.getElementById("dm-content").value.trim();

  const customerToolId =
    document.getElementById("customer-tool-id")?.value.trim() || null;

  if (!customerName || !prefix) {
    alert("Musíš vybrat nebo založit zákazníka.");
    return;
  }

  if (!name) {
    alert("Musíš zadat název nástroje.");
    return;
  }

  const insertData = {
    customer_name: customerName,
    customer_prefix: prefix,
    name,
    diameter: diameter || null,
    length: length || null,
    serial_enabled: serialEnabled,
    dm_enabled: dmEnabled,
    dm_code: dmContent || null,
    customer_tool_id: customerToolId
  };

  const { error } = await supabaseClient.from("tools").insert(insertData);

  if (error) {
    alert("Chyba ukládání do databáze.");
    console.error(error);
  } else {
    alert("✔ Nástroj uložen!");
  }
}


/************************************************************
 * INIT
 ************************************************************/
window.addEventListener("DOMContentLoaded", async () => {
  await loadCustomers();

  const input = document.getElementById("customer-search");
  const suggestions = document.getElementById("customer-suggestions");

  input.addEventListener("input", () => {
    const q = input.value.trim();
    const matches = searchCustomers(q);
    renderSuggestions(matches, q);
  });

  updatePreview();
});
