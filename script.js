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
let loadedToolData = null;   // null = volný režim bez zamykání

/************************************************************
 * UNLOCK WHEN NO TOOL SELECTED
 ************************************************************/
function unlockForNewEntry() {
    loadedToolData = null;
    editMode = false;

    document.getElementById("sidebar").classList.remove("locked");
    document.getElementById("edit-toggle").style.display = "none";
}

/************************************************************
 * CHECK
 ************************************************************/
function isToolLoaded() {
    return !!loadedToolData;
}

/************************************************************
 * EDIT / LOCK MODE
 ************************************************************/
function toggleEditMode() {
    if (!isToolLoaded()) {
        alert("EDIT je dostupný pouze po načtení uloženého nástroje.");
        return;
    }

    const sidebar = document.getElementById("sidebar");
    const btn = document.getElementById("edit-toggle");

    editMode = !editMode;

    if (editMode) {
        btn.textContent = "🔒 Zamknout parametry";
        sidebar.classList.remove("locked");
    } else {
        btn.textContent = "✏️ Editovat parametry";
        sidebar.classList.add("locked");
        restoreLoadedTool();
    }
}

function restoreLoadedTool() {
    const t = loadedToolData;
    if (!t) return;

    document.getElementById("tool-name").value = t.name || "";
    document.getElementById("diameter").value = t.diameter ?? "";
    document.getElementById("length").value = t.length ?? "";
    document.getElementById("customer-tool-id").value = t.customer_tool_id ?? "";
    document.getElementById("dm-enable").checked = !!t.dm_enabled;
    document.getElementById("serial-enable").checked = !!t.serial_enabled;
    document.getElementById("serial-prefix").value = t.serial_prefix || t.customer_prefix || "";
    document.getElementById("dm-content").value = t.dm_code ?? "";

    updatePreview();
}

/************************************************************
 * CUSTOMER AUTOCOMPLETE
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

async function generateCustomerPrefix(name) {
    const clean = (name || "")
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^A-Za-z]/g, "")
        .toUpperCase();

    let base = clean.slice(0,2) || "CU";

    const low = name.toLowerCase();
    if (low === "šablona" || low === "sablona" || low.includes("template")) {
        base = "TM";
    }

    for (let i = 1; i < 99; i++) {
        const prefix = base + String(i).padStart(2, "0");

        const { data } = await supabaseClient
            .from("customers")
            .select("id")
            .eq("prefix", prefix)
            .maybeSingle();

        if (!data) return prefix;
    }

    return base + String(Math.floor(Math.random()*90+10));
}

async function createNewCustomer(name) {
    const prefix = await generateCustomerPrefix(name);

    const { data, error } = await supabaseClient
        .from("customers")
        .insert({ name, prefix })
        .select()
        .single();

    if (error) {
        alert("Nelze založit zákazníka.");
        return;
    }

    selectCustomer(data);
}

function renderCustomerSuggestions(list, text) {
    const box = document.getElementById("customer-suggestions");
    box.innerHTML = "";

    if (!list.length && text.length >= 2) {
        const d = document.createElement("div");
        d.textContent = `+ Založit zákazníka: ${text}`;
        d.onclick = () => createNewCustomer(text);
        box.appendChild(d);
        box.style.display = "block";
        return;
    }

    list.forEach(c => {
        const d = document.createElement("div");
        d.textContent = `${c.name} (${c.prefix})`;
        d.onclick = () => selectCustomer(c);
        box.appendChild(d);
    });

    box.style.display = list.length ? "block" : "none";
}

function selectCustomer(cust) {
    unlockForNewEntry();  // ← NEZAMYKAT, jsme jen ve volném režimu

    document.getElementById("customer-search").value = cust.name;
    document.getElementById("customer-prefix").value = cust.prefix;
    document.getElementById("serial-prefix").value = cust.prefix;

    document.getElementById("customer-suggestions").style.display = "none";
}

/************************************************************
 * TOOL SEARCH
 ************************************************************/
async function searchTools(q, prefix) {
    if (!q) return [];

    let query = supabaseClient
        .from("tools")
        .select("*")
        .or(`name.ilike.%${q}%,customer_tool_id.ilike.%${q}%`)
        .order("name");

    if (prefix) {
        query = query.eq("customer_prefix", prefix);
    }

    const { data } = await query;
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
        div.textContent = `${t.name} · ${t.customer_tool_id || "bez ID"}`;
        div.onclick = () => loadTool(t);
        box.appendChild(div);
    });

    box.style.display = "block";
}

async function loadTool(tool) {
    loadedToolData = tool;
    editMode = false;

    const sidebar = document.getElementById("sidebar");
    const btn = document.getElementById("edit-toggle");

    sidebar.classList.add("locked");
    btn.style.display = "block";
    btn.textContent = "✏️ Editovat parametry";

    document.getElementById("tool-name").value = tool.name;
    document.getElementById("diameter").value = tool.diameter ?? "";
    document.getElementById("length").value = tool.length ?? "";
    document.getElementById("customer-tool-id").value = tool.customer_tool_id ?? "";
    document.getElementById("dm-enable").checked = !!tool.dm_enabled;
    document.getElementById("serial-enable").checked = !!tool.serial_enabled;
    document.getElementById("serial-prefix").value = tool.serial_prefix || tool.customer_prefix;
    document.getElementById("dm-content").value = tool.dm_code ?? "";

    // zákazník podle prefixu
    if (tool.customer_prefix) {
        const { data } = await supabaseClient
            .from("customers")
            .select("*")
            .eq("prefix", tool.customer_prefix)
            .maybeSingle();

        if (data) {
            document.getElementById("customer-search").value = data.name;
            document.getElementById("customer-prefix").value = data.prefix;
        }
    }

    document.getElementById("tool-suggestions").style.display = "none";

    updatePreview();
}

/************************************************************
 * SERIAL GENERATOR
 ************************************************************/
async function generateSerial() {
    const serialEnabled = document.getElementById("serial-enable").checked;
    const dmEnabled = document.getElementById("dm-enable").checked;

    const prefix = document.getElementById("serial-prefix").value.trim();
    const dmBox = document.getElementById("dm-content");

    if (!serialEnabled) {
        dmBox.value = dmEnabled ? prefix : "";
        updatePreview();
        return;
    }

    if (!prefix) {
        alert("Prefix musí být vyplněn.");
        return;
    }

    const { data } = await supabaseClient
        .from("serial_counters")
        .select("*")
        .eq("prefix", prefix)
        .maybeSingle();

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
    dmBox.value = dmEnabled ? serial : prefix;

    updatePreview();
}

/************************************************************
 * PREVIEW
 ************************************************************/
function updatePreview() {
    const name = document.getElementById("tool-name").value;
    const diameter = parseFloat(document.getElementById("diameter").value) || 10;
    const length = parseFloat(document.getElementById("length").value) || 50;
    const dm = document.getElementById("dm-content").value;
    const id = document.getElementById("customer-tool-id").value;

    let pxW = length * 18;
    let pxH = diameter * 18;

    const maxDim = 400;
    const currentMax = Math.max(pxW, pxH);

    if (currentMax > maxDim) {
        const factor = maxDim / currentMax;
        pxW *= factor;
        pxH *= factor;
    }

    document.getElementById("preview-area").innerHTML = `
        <div style="
            width:${pxW}px;
            height:${pxH}px;
            border-radius:${pxH/2}px;
            background: radial-gradient(circle at 30% 0%, white, #d0d0d0);
            display:flex;align-items:center;justify-content:center;
            box-shadow:0 6px 18px rgba(0,0,0,0.15);
        ">
            <div style="
                width:${pxH*0.4}px;
                height:${pxH*0.25}px;
                background:black;
                border-radius:6px;
            "></div>
        </div>
        <div style="text-align:center;margin-top:10px">
            <b>${name || "&nbsp;"}</b><br>
            ${id || "&nbsp;"}<br>
            <span style="opacity:0.7;">DM: ${dm || "&nbsp;"}</span>
        </div>
    `;
}

/************************************************************
 * SAVE TOOL
 ************************************************************/
async function saveTool() {
    const prefix = document.getElementById("customer-prefix").value.trim();
    const name = document.getElementById("tool-name").value.trim();

    if (!name) {
        alert("Název nástroje je povinný.");
        return;
    }

    const obj = {
        customer_prefix: prefix,
        name,
        diameter: parseFloat(document.getElementById("diameter").value) || null,
        length: parseFloat(document.getElementById("length").value) || null,
        dm_enabled: document.getElementById("dm-enable").checked,
        serial_enabled: document.getElementById("serial-enable").checked,
        serial_prefix: document.getElementById("serial-prefix").value.trim(),
        dm_code: document.getElementById("dm-content").value.trim(),
        customer_tool_id: document.getElementById("customer-tool-id").value.trim()
    };

    const { error } = await supabaseClient.from("tools").insert(obj);

    if (error) {
        alert("Nástroj se nepodařilo uložit!");
        return;
    }

    alert("✅ Nástroj uložen.");
}

/************************************************************
 * INIT EVENTS
 ************************************************************/
window.addEventListener("DOMContentLoaded", () => {

    unlockForNewEntry();   // ← VOLNÝ REŽIM PŘI STARTU

    // zákazník
    document.getElementById("customer-search").addEventListener("input", async e => {
        const text = e.target.value.trim();
        const list = await searchCustomers(text);
        renderCustomerSuggestions(list, text);
    });

    // nástroj
    document.getElementById("tool-search").addEventListener("input", async () => {
        const q = document.getElementById("tool-search").value.trim();
        const prefix = document.getElementById("customer-prefix").value.trim();

        if (!q) {
            unlockForNewEntry();  // ← vrátíme volný režim
        }

        const list = await searchTools(q, prefix);
        renderToolSuggestions(list);
    });

    // preview update
    ["tool-name","diameter","length","customer-tool-id","dm-content"]
        .forEach(id => document.getElementById(id).addEventListener("input", updatePreview));

    updatePreview();
});
