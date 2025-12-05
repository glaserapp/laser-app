/************************************************************
 * INIT SUPABASE
 ************************************************************/
const SUPABASE_URL = "https://ovylsagjaskidrmiiunu.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_bxs0aUYwP5_l-Vdqc4eNEw_NYTtN5Oy";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/************************************************************
 * GLOBAL STATE
 ************************************************************/
let editMode = false;
let loadedToolData = null;

/************************************************************
 * EDIT / LOCK MODE
 ************************************************************/
function toggleEditMode() {
    const sidebar = document.getElementById("sidebar");
    const btn = document.getElementById("edit-toggle");

    editMode = !editMode;

    if (editMode) {
        btn.textContent = "🔒 Zamknout";
        sidebar.classList.remove("locked");
    } else {
        btn.textContent = "✏️ Editovat";
        sidebar.classList.add("locked");

        if (loadedToolData) restoreLoadedTool();
    }
}

function restoreLoadedTool() {
    const d = loadedToolData;

    document.getElementById("tool-name").value = d.name || "";
    document.getElementById("diameter").value = d.diameter ?? "";
    document.getElementById("length").value = d.length ?? "";
    document.getElementById("customer-tool-id").value = d.customer_tool_id || "";

    document.getElementById("dm-enable").checked = d.dm_enabled;
    document.getElementById("serial-enable").checked = d.serial_enabled;

    document.getElementById("serial-prefix").value = d.serial_prefix || "";
    document.getElementById("dm-content").value = d.dm_code || "";

    updatePreview();
}

/************************************************************
 * AUTOCOMPLETE CUSTOMER
 ************************************************************/
async function searchCustomers(text) {
  if (!text) return [];

  const { data, error } = await supabaseClient.from("customers")
    .select("*")
    .ilike("name", `%${text}%`)
    .order("name");

  return error ? [] : data;
}

function renderSuggestions(list, inputValue) {
  const box = document.getElementById("customer-suggestions");
  box.innerHTML = "";

  if (list.length === 0 && inputValue.length >= 2) {
    box.innerHTML = `<div class="suggestion-new"
       onclick="createNewCustomer('${inputValue}')">
       + Založit nového zákazníka: <b>${inputValue}</b>
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

  box.classList.toggle("hidden", list.length === 0);
}

async function createNewCustomer(name) {
  const prefix = name.substring(0,2).toUpperCase();

  const { data, error } = await supabaseClient
    .from("customers")
    .insert({ name, prefix })
    .select().single();

  if (!error) selectCustomer(data);
}

function selectCustomer(item) {
  document.getElementById("customer-search").value = item.name;
  document.getElementById("customer-prefix").value = item.prefix;
  document.getElementById("serial-prefix").value = item.prefix;
  document.getElementById("customer-suggestions").classList.add("hidden");
}

/************************************************************
 * VYHLEDÁVÁNÍ NÁSTROJŮ
 ************************************************************/
async function searchTools(query, prefix) {
    if (!query || !prefix) return [];

    const { data, error } = await supabaseClient
        .from("tools")
        .select("*")
        .eq("customer_prefix", prefix)
        .or(`name.ilike.%${query}%,customer_tool_id.ilike.%${query}%`)
        .order("name");

    return error ? [] : data;
}

function renderToolSuggestions(list) {
    const box = document.getElementById("tool-suggestions");
    box.innerHTML = "";

    if (list.length === 0) {
        box.classList.add("hidden");
        return;
    }

    list.forEach(tool => {
        const div = document.createElement("div");
        div.className = "tool-suggestion";
        div.textContent = `${tool.name} · ${tool.customer_tool_id || "bez ID"}`;
        div.onclick = () => loadTool(tool);
        box.appendChild(div);
    });

    box.classList.remove("hidden");
}

function loadTool(tool) {
    loadedToolData = tool;

    document.getElementById("tool-name").value = tool.name;
    document.getElementById("diameter").value = tool.diameter || "";
    document.getElementById("length").value = tool.length || "";
    document.getElementById("customer-tool-id").value = tool.customer_tool_id || "";

    document.getElementById("dm-enable").checked = tool.dm_enabled;
    document.getElementById("serial-enable").checked = tool.serial_enabled;

    document.getElementById("serial-prefix").value = tool.serial_prefix || tool.customer_prefix;
    document.getElementById("dm-content").value = tool.dm_code || "";

    document.getElementById("tool-suggestions").classList.add("hidden");

    updatePreview();
}

/************************************************************
 * SERIAL GENERATOR
 ************************************************************/
async function generateSerial() {
  const enableSerial = document.getElementById("serial-enable").checked;
  const dmEnabled = document.getElementById("dm-enable").checked;

  const prefix = document.getElementById("serial-prefix").value.trim();
  const dmBox = document.getElementById("dm-content");

  if (!enableSerial) {
      dmBox.value = dmEnabled ? prefix : "";
      updatePreview();
      return;
  }

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
      await supabaseClient.from("serial_counters")
        .update({ current_serial: next })
        .eq("id", data.id);
  }

  const serial = `${prefix}-${String(next).padStart(4, "0")}`;
  dmBox.value = dmEnabled ? serial : prefix;

  updatePreview();
}

/************************************************************
 * PREVIEW
 ************************************************************/
function updatePreview() {
  const name = document.getElementById("tool-name").value.trim();
  const diameter = parseFloat(document.getElementById("diameter").value) || 10;
  const length = parseFloat(document.getElementById("length").value) || 50;
  const dm = document.getElementById("dm-content").value.trim();
  const toolId = document.getElementById("customer-tool-id").value.trim();

  const pxW = length * 20;
  const pxH = diameter * 20;

  const preview = `
    <div style="
      width:${pxW}px;
      height:${pxH}px;
      border-radius:${pxH/2}px;
      background: radial-gradient(circle at 30% 0%, white, #cfcfcf);
      display:flex; align-items:center; justify-content:center;">
      <div style="width:${pxH*0.4}px; height:${pxH*0.25}px; background:#111;"></div>
    </div>
    <div style="text-align:center; margin-top:10px;">
      <b>${name}</b><br>
      ${toolId}<br>
      DM: ${dm}
    </div>
  `;

  document.getElementById("preview-area").innerHTML = preview;
}

/************************************************************
 * SAVE TOOL
 ************************************************************/
async function saveTool() {
  const obj = {
    customer_prefix: document.getElementById("customer-prefix").value.trim(),
    name: document.getElementById("tool-name").value.trim(),
    diameter: parseFloat(document.getElementById("diameter").value) || null,
    length: parseFloat(document.getElementById("length").value) || null,
    dm_enabled: document.getElementById("dm-enable").checked,
    serial_enabled: document.getElementById("serial-enable").checked,
    serial_prefix: document.getElementById("serial-prefix").value.trim(),
    dm_code: document.getElementById("dm-content").value.trim(),
    customer_tool_id: document.getElementById("customer-tool-id").value.trim()
  };

  const { error } = await supabaseClient.from("tools").insert(obj);

  if (!error) {
    alert("Nástroj uložen.");
    loadedToolData = obj;
    toggleEditMode();
  }
}

/************************************************************
 * INIT
 ************************************************************/
window.addEventListener("DOMContentLoaded", () => {

    document.getElementById("customer-search").addEventListener("input", async e => {
        const txt = e.target.value.trim();
        const res = await searchCustomers(txt);
        renderSuggestions(res, txt);
    });

    document.getElementById("tool-search").addEventListener("input", async () => {
        const q = document.getElementById("tool-search").value.trim();
        const prefix = document.getElementById("customer-prefix").value.trim();

        const results = await searchTools(q, prefix);
        renderToolSuggestions(results);
    });

    ["tool-name","diameter","length","customer-tool-id","dm-content"]
      .forEach(id => document.getElementById(id)
        .addEventListener("input", updatePreview));

    updatePreview();
});
