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
let loadedToolData = null;   // null = volný režim, jinak je načtený uložený nástroj

let customerHoverIndex = -1;
let toolHoverIndex = -1;

/************************************************************
 * HELPERS
 ************************************************************/
function isToolLoaded() {
    return !!loadedToolData;
}

/************************************************************
 * EDIT / LOCK MODE
 ************************************************************/
function toggleEditMode() {
    if (!isToolLoaded()) {
        alert("Nejprve načti uložený nástroj (vyhledáním) – teprve pak má EDIT smysl.");
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
        if (loadedToolData) restoreLoadedTool();
    }
}

function restoreLoadedTool() {
    const t = loadedToolData;
    if (!t) return;

    document.getElementById("tool-name").value        = t.name || "";
    document.getElementById("diameter").value         = t.diameter ?? "";
    document.getElementById("length").value           = t.length ?? "";
    document.getElementById("customer-tool-id").value = t.customer_tool_id ?? "";
    document.getElementById("dm-enable").checked      = !!t.dm_enabled;
    document.getElementById("serial-enable").checked  = !!t.serial_enabled;
    document.getElementById("serial-prefix").value    = t.serial_prefix || t.customer_prefix || "";
    document.getElementById("dm-content").value       = t.dm_code ?? "";

    updatePreview();
}

/************************************************************
 * RESET FORM
 ************************************************************/
function resetAll() {
    const sidebar = document.getElementById("sidebar");
    const editBtn = document.getElementById("edit-toggle");

    loadedToolData = null;
    editMode = false;

    sidebar.classList.remove("locked");
    editBtn.style.display = "none";
    editBtn.textContent = "✏️ Editovat parametry";

    // Vyčistit všechna textová a číselná pole
    const inputs = sidebar.querySelectorAll("input[type='text'], input[type='number']");
    inputs.forEach(el => el.value = "");

    // Checkboxy
    document.getElementById("dm-enable").checked = false;
    document.getElementById("serial-enable").checked = false;

    // Dropdowny schovat
    document.getElementById("customer-suggestions").style.display = "none";
    document.getElementById("tool-suggestions").style.display = "none";

    customerHoverIndex = -1;
    toolHoverIndex = -1;

    updatePreview();
}

/************************************************************
 * CUSTOMER SEARCH
 ************************************************************/
async function searchCustomers(text) {
    if (!text) return [];

    const { data, error } = await supabaseClient
        .from("customers")
        .select("*")
        .ilike("name", `%${text}%`)
        .order("name");

    if (error) {
        console.error("Chyba při hledání zákazníka:", error);
        return [];
    }
    return data || [];
}

function renderCustomerSuggestions(list, inputText) {
    const box = document.getElementById("customer-suggestions");
    box.innerHTML = "";
    customerHoverIndex = -1;

    if (!list.length && inputText.length >= 2) {
        const div = document.createElement("div");
        div.className = "dropdown-item new-item";
        div.innerHTML = `+ Založit zákazníka: <b>${inputText}</b>`;
        div.onclick = () => createNewCustomer(inputText);
        box.appendChild(div);
        box.style.display = "block";
        return;
    }

    list.forEach(c => {
        const div = document.createElement("div");
        div.className = "dropdown-item";
        div.textContent = `${c.name} (${c.prefix})`;
        div.onclick = () => selectCustomer(c);
        box.appendChild(div);
    });

    box.style.display = list.length ? "block" : "none";
}

// 2 písmena + 2 čísla, + speciál pro „šablona“ (TMP01…)
async function generateCustomerPrefix(name) {
    const clean = (name || "")
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^A-Za-z]/g, "")
        .toUpperCase();

    let base = clean.slice(0, 2) || "CU";

    const lower = name.toLowerCase().trim();
    if (lower === "šablona" || lower === "sablona") {
        base = "TMP";   // TMP01, TMP02…
    }

    for (let i = 1; i <= 99; i++) {
        const candidate = base + String(i).padStart(2, "0");

        const { data, error } = await supabaseClient
            .from("customers")
            .select("id")
            .eq("prefix", candidate)
            .maybeSingle();

        if (error) {
            console.error("Chyba při ověřování prefixu:", error);
            break;
        }

        if (!data) return candidate;
    }

    return base + String(Math.floor(Math.random() * 90 + 10));
}

async function createNewCustomer(name) {
    const prefix = await generateCustomerPrefix(name);

    const { data, error } = await supabaseClient
        .from("customers")
        .insert({ name, prefix })
        .select()
        .single();

    if (error) {
        console.error("Chyba při zakládání zákazníka:", error);
        alert("Nepodařilo se založit zákazníka.");
        return;
    }

    selectCustomer(data);
}

function selectCustomer(item) {
    document.getElementById("customer-search").value = item.name;
    document.getElementById("customer-prefix").value = item.prefix;
    document.getElementById("serial-prefix").value   = item.prefix;

    const box = document.getElementById("customer-suggestions");
    box.style.display = "none";
    customerHoverIndex = -1;
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

    const { data, error } = await query;

    if (error) {
        console.error("Chyba při hledání nástrojů:", error);
        return [];
    }
    return data || [];
}

function renderToolSuggestions(list) {
    const box = document.getElementById("tool-suggestions");
    box.innerHTML = "";
    toolHoverIndex = -1;

    if (!list.length) {
        box.style.display = "none";
        return;
    }

    list.forEach(t => {
        const div = document.createElement("div");
        div.className = "dropdown-item tool-suggestion";
        div.textContent = `${t.name} · ${t.customer_tool_id || "bez ID"}`;
        div.onclick = () => loadTool(t);
        box.appendChild(div);
    });

    box.style.display = "block";
}

async function loadTool(tool) {
    const sidebar = document.getElementById("sidebar");
    const editBtn = document.getElementById("edit-toggle");

    loadedToolData = tool;
    editMode = false;

    // zamknout parametry (lockable-field)
    sidebar.classList.add("locked");

    // zobrazit EDIT tlačítko
    editBtn.style.display = "block";
    editBtn.textContent = "✏️ Editovat parametry";

    // parametry nástroje
    document.getElementById("tool-name").value        = tool.name || "";
    document.getElementById("diameter").value         = tool.diameter ?? "";
    document.getElementById("length").value           = tool.length ?? "";
    document.getElementById("customer-tool-id").value = tool.customer_tool_id ?? "";
    document.getElementById("dm-enable").checked      = !!tool.dm_enabled;
    document.getElementById("serial-enable").checked  = !!tool.serial_enabled;
    document.getElementById("serial-prefix").value    = tool.serial_prefix || tool.customer_prefix || "";
    document.getElementById("dm-content").value       = tool.dm_code ?? "";

    document.getElementById("customer-prefix").value  = tool.customer_prefix || "";

    // doplnit jméno zákazníka podle prefixu
    if (tool.customer_prefix) {
        const { data, error } = await supabaseClient
            .from("customers")
            .select("*")
            .eq("prefix", tool.customer_prefix)
            .maybeSingle();

        if (!error && data) {
            document.getElementById("customer-search").value = data.name;
        }
    }

    document.getElementById("tool-suggestions").style.display = "none";
    toolHoverIndex = -1;

    updatePreview();
}

/************************************************************
 * DROPDOWN NAVIGATION (klávesnice)
 ************************************************************/
function handleDropdownKey(e, type) {
    const box = document.getElementById(
        type === "customer" ? "customer-suggestions" : "tool-suggestions"
    );
    const items = box.querySelectorAll(".dropdown-item");
    if (!items.length) return;

    let idx = type === "customer" ? customerHoverIndex : toolHoverIndex;

    if (e.key === "ArrowDown") {
        e.preventDefault();
        idx = (idx + 1 + items.length) % items.length;
    } else if (e.key === "ArrowUp") {
        e.preventDefault();
        idx = (idx - 1 + items.length) % items.length;
    } else if (e.key === "Enter") {
        e.preventDefault();
        if (idx >= 0 && idx < items.length) {
            items[idx].click();
        }
        return;
    } else {
        return;
    }

    // vizuální zvýraznění
    items.forEach((el, i) => el.classList.toggle("hover", i === idx));

    if (type === "customer") {
        customerHoverIndex = idx;
    } else {
        toolHoverIndex = idx;
    }
}

/************************************************************
 * SERIAL GENERATION
 ************************************************************/
async function generateSerial() {
    const enableSerial = document.getElementById("serial-enable").checked;
    const dmEnabled    = document.getElementById("dm-enable").checked;
    const prefixInput  = document.getElementById("serial-prefix");
    const dmBox        = document.getElementById("dm-content");

    const prefix = prefixInput.value.trim();

    if (!enableSerial) {
        dmBox.value = dmEnabled ? prefix : "";
        updatePreview();
        return;
    }

    if (!prefix) {
        alert("Pro generování sériového čísla musí být vyplněn prefix, nebo vypni použití sériového čísla.");
        return;
    }

    const { data, error } = await supabaseClient
        .from("serial_counters")
        .select("*")
        .eq("prefix", prefix)
        .maybeSingle();

    if (error) {
        console.error("Chyba při čtení serial_counters:", error);
        alert("Nepodařilo se vygenerovat sériové číslo.");
        return;
    }

    let next = data ? data.current_serial + 1 : 1;

    if (!data) {
        const { error: insErr } = await supabaseClient
            .from("serial_counters")
            .insert({ prefix, current_serial: 1 });
        if (insErr) {
            console.error("Chyba při insertu serial_counters:", insErr);
            alert("Nepodařilo se uložit sériový čítač.");
            return;
        }
    } else {
        const { error: updErr } = await supabaseClient
            .from("serial_counters")
            .update({ current_serial: next })
            .eq("id", data.id);
        if (updErr) {
            console.error("Chyba při update serial_counters:", updErr);
            alert("Nepodařilo se aktualizovat sériový čítač.");
            return;
        }
    }

    const serial = `${prefix}-${String(next).padStart(4, "0")}`;
    dmBox.value = dmEnabled ? serial : prefix;

    updatePreview();
}

/************************************************************
 * PREVIEW RENDER
 ************************************************************/
function updatePreview() {
    const name = document.getElementById("tool-name").value || "";
    const diameter = parseFloat(document.getElementById("diameter").value) || 10;
    const length   = parseFloat(document.getElementById("length").value) || 50;
    const dm       = document.getElementById("dm-content").value || "";
    const id       = document.getElementById("customer-tool-id").value || "";

    let pxW = length * 18;
    let pxH = diameter * 18;

    const maxDim = 400;
    const maxCurrent = Math.max(pxW, pxH);
    if (maxCurrent > maxDim) {
        const factor = maxDim / maxCurrent;
        pxW *= factor;
        pxH *= factor;
    }

    document.getElementById("preview-area").innerHTML = `
        <div style="
            width:${pxW}px;
            height:${pxH}px;
            border-radius:${pxH/2}px;
            background: radial-gradient(circle at 30% 0%, white, #d0d0d0);
            display:flex;
            align-items:center;
            justify-content:center;
            box-shadow:0 6px 18px rgba(0,0,0,0.15);
        ">
            <div style="
                width:${pxH * 0.4}px;
                height:${pxH * 0.25}px;
                background:black;
                border-radius:6px;
            "></div>
        </div>
        <div style="text-align:center;margin-top:10px;font-size:14px;">
            <b>${name || "&nbsp;"}</b><br>
            ${id || "&nbsp;"}<br>
            <span style="opacity:0.7;">DM: ${dm || "&nbsp;"}</span>
        </div>`;
}

/************************************************************
 * SAVE TOOL
 ************************************************************/
async function saveTool() {
    const customer_prefix = document.getElementById("customer-prefix").value.trim();
    const name            = document.getElementById("tool-name").value.trim();

    if (!customer_prefix) {
        if (!confirm("Není vybraný žádný zákazník.\nChceš uložit nástroj bez přiřazeného zákazníka?")) {
            return;
        }
    }

    if (!name) {
        alert("Název nástroje je povinný.");
        return;
    }

    const obj = {
        customer_prefix,
        name,
        diameter: parseFloat(document.getElementById("diameter").value) || null,
        length:   parseFloat(document.getElementById("length").value)   || null,
        dm_enabled:      document.getElementById("dm-enable").checked,
        serial_enabled:  document.getElementById("serial-enable").checked,
        serial_prefix:   document.getElementById("serial-prefix").value.trim(),
        dm_code:         document.getElementById("dm-content").value.trim(),
        customer_tool_id:document.getElementById("customer-tool-id").value.trim()
    };

    const { error } = await supabaseClient.from("tools").insert(obj);

    if (error) {
        console.error("Chyba při ukládání nástroje:", error);
        alert("Nástroj se nepodařilo uložit.");
        return;
    }

    alert("✅ Nástroj uložen.");
}

/************************************************************
 * EXPORT (zatím stub)
 ************************************************************/
function exportLabel() {
    alert("Export štítku zatím není implementován. Budeme řešit později 🙂");
}

/************************************************************
 * EVENT INIT
 ************************************************************/
window.addEventListener("DOMContentLoaded", () => {
    const editBtn = document.getElementById("edit-toggle");
    editBtn.style.display = "none"; // dokud není načtený nástroj, EDIT neukazujeme

    // Zákazník – autocomplete + šipky
    const customerInput = document.getElementById("customer-search");
    customerInput.addEventListener("input", async e => {
        const txt = e.target.value.trim();
        const list = await searchCustomers(txt);
        renderCustomerSuggestions(list, txt);
    });
    customerInput.addEventListener("keydown", e => handleDropdownKey(e, "customer"));

    // Nástroj – vyhledávání + šipky
    const toolInput = document.getElementById("tool-search");
    toolInput.addEventListener("input", async () => {
        const q      = document.getElementById("tool-search").value.trim();
        const prefix = document.getElementById("customer-prefix").value.trim();
        const list   = await searchTools(q, prefix);
        renderToolSuggestions(list);
    });
    toolInput.addEventListener("keydown", e => handleDropdownKey(e, "tool"));

    // Live preview
    ["tool-name","diameter","length","customer-tool-id","dm-content"]
        .forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener("input", updatePreview);
        });

    updatePreview();
});
