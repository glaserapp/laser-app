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
        btn.textContent = "🔒 Zamknout parametry";
        sidebar.classList.remove("locked");
    } else {
        btn.textContent = "✏️ Editovat parametry";
        sidebar.classList.add("locked");

        if (loadedToolData) restoreLoadedTool();
    }
}

function restoreLoadedTool() {
    const t = loadedToolData;

    document.getElementById("tool-name").value = t.name;
    document.getElementById("diameter").value = t.diameter ?? "";
    document.getElementById("length").value = t.length ?? "";
    document.getElementById("customer-tool-id").value = t.customer_tool_id ?? "";
    document.getElementById("dm-enable").checked = t.dm_enabled;
    document.getElementById("serial-enable").checked = t.serial_enabled;
    document.getElementById("serial-prefix").value = t.serial_prefix || t.customer_prefix;
    document.getElementById("dm-content").value = t.dm_code ?? "";

    updatePreview();
}

/************************************************************
 * CUSTOMER SEARCH
 ************************************************************/
async function searchCustomers(text) {
    if (!text) return [];

    const { data } = await supabaseClient
        .from("customers")
        .select("*")
        .ilike("name", `%${text}%`)
        .order("name");

    return data || [];
}

function renderCustomerSuggestions(list, input) {
    const box = document.getElementById("customer-suggestions");
    box.innerHTML = "";

    if (list.length === 0 && input.length >= 2) {
        box.innerHTML = `
            <div onclick="createNewCustomer('${input}')">
                + Založit zákazníka: <b>${input}</b>
            </div>`;
        box.style.display = "block";
        return;
    }

    list.forEach(c => {
        const div = document.createElement("div");
        div.textContent = `${c.name} (${c.prefix})`;
        div.onclick = () => selectCustomer(c);
        box.appendChild(div);
    });

    box.style.display = list.length ? "block" : "none";
}

async function createNewCustomer(name) {
    const prefix = name.substring(0,2).toUpperCase();

    const { data } = await supabaseClient
        .from("customers")
        .insert({ name, prefix })
        .select()
        .single();

    selectCustomer(data);
}

function selectCustomer(item) {
    document.getElementById("customer-search").value = item.name;
    document.getElementById("customer-prefix").value = item.prefix;
    document.getElementById("serial-prefix").value = item.prefix;

    document.getElementById("customer-suggestions").style.display = "none";
}

/************************************************************
 * TOOL SEARCH
 ************************************************************/
async function searchTools(q, prefix) {
    if (!q || !prefix) return [];

    const { data } = await supabaseClient
        .from("tools")
        .select("*")
        .eq("customer_prefix", prefix)
        .or(`name.ilike.%${q}%,customer_tool_id.ilike.%${q}%`)
        .order("name");

    return data || [];
}

function renderToolSuggestions(list) {
    const box = document.getElementById("tool-suggestions");
    box.innerHTML = "";

    if (!list.length) {
        box.style.display = "none";
        return;
    }

    list.forEach(t => {
        const div = document.createElement("div");
        div.className = "tool-suggestion";
        div.textContent = `${t.name} · ${t.customer_tool_id || "bez ID"}`;
        div.onclick = () => loadTool(t);
        box.appendChild(div);
    });

    box.style.display = "block";
}

function loadTool(tool) {
    loadedToolData = tool;

    document.getElementById("tool-name").value = tool.name;
    document.getElementById("diameter").value = tool.diameter ?? "";
    document.getElementById("length").value = tool.length ?? "";
    document.getElementById("customer-tool-id").value = tool.customer_tool_id ?? "";
    document.getElementById("dm-enable").checked = tool.dm_enabled;
    document.getElementById("serial-enable").checked = tool.serial_enabled;
    document.getElementById("serial-prefix").value = tool.serial_prefix || tool.customer_prefix;
    document.getElementById("dm-content").value = tool.dm_code ?? "";

    document.getElementById("tool-suggestions").style.display = "none";

    updatePreview();
}

/************************************************************
 * SERIAL GENERATION
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
        await supabaseClient.from("serial_counters").insert({ prefix, current_serial: 1 });
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
 * PREVIEW RENDER
 ************************************************************/
function updatePreview() {
    const name = document.getElementById("tool-name").value;
    const diameter = parseFloat(document.getElementById("diameter").value) || 10;
    const length = parseFloat(document.getElementById("length").value) || 50;
    const dm = document.getElementById("dm-content").value;
    const id = document.getElementById("customer-tool-id").value;

    const pxW = length * 18;
    const pxH = diameter * 18;

    document.getElementById("preview-area").innerHTML = `
        <div style="width:${pxW}px;height:${pxH}px;border-radius:${pxH/2}px;
            background: radial-gradient(circle at 30% 0%, white, #d0d0d0);
            display:flex;align-items:center;justify-content:center;">
            <div style="width:${pxH*0.4}px;height:${pxH*0.25}px;background:black;"></div>
        </div>
        <div style="text-align:center;margin-top:10px">
            <b>${name}</b><br>
            ${id}<br>
            DM: ${dm}
        </div>`;
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
 * EVENT INIT
 ************************************************************/
window.addEventListener("DOMContentLoaded", () => {

    document.getElementById("customer-search").addEventListener("input", async e => {
        const txt = e.target.value.trim();
        renderCustomerSuggestions(await searchCustomers(txt), txt);
    });

    document.getElementById("tool-search").addEventListener("input", async () => {
        const q = document.getElementById("tool-search").value.trim();
        const prefix = document.getElementById("customer-prefix").value.trim();
        renderToolSuggestions(await searchTools(q, prefix));
    });

    ["tool-name","diameter","length","customer-tool-id","dm-content"]
        .forEach(id => document.getElementById(id).addEventListener("input", updatePreview));

    updatePreview();
});
