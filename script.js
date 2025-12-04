/************************************************************
 * SUPABASE INIT
 ************************************************************/
const SUPABASE_URL = "https://ovylsagjaskidrmiiunu.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_bxs0aUYwP5_l-Vdqc4eNEw_NYTtN5Oy";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/************************************************************
 * AUTOCOMPLETE – SEARCH CUSTOMERS
 ************************************************************/
async function searchCustomers(query) {
    if (!query) return [];

    const { data, error } = await supabaseClient
        .from("customers")
        .select("*")
        .or(`name.ilike.%${query}%,prefix.ilike.%${query}%`)
        .order("name");

    if (error) {
        console.error("Chyba hledání zákazníka:", error);
        return [];
    }

    return data;
}

function renderSuggestions(list, query) {
    const box = document.getElementById("customer-suggestions");
    box.innerHTML = "";

    if (list.length === 0) {
        box.innerHTML = `
            <div class="suggestion-new" onclick="createNewCustomer('${query}')">
                ➕ Založit nového zákazníka: <strong>${query}</strong>
            </div>
        `;
        box.classList.remove("hidden");
        return;
    }

    list.forEach(cust => {
        const row = document.createElement("div");
        row.className = "suggestion-item";
        row.innerHTML = `
            <strong>${cust.name}</strong><br>
            <small>Prefix: ${cust.prefix}</small>
        `;
        row.onclick = () => selectCustomer(cust);
        box.appendChild(row);
    });

    box.classList.remove("hidden");
}

function selectCustomer(cust) {
    document.getElementById("customer-search").value = cust.name;
    document.getElementById("serial-prefix").value = cust.prefix;
    document.getElementById("customer-suggestions").classList.add("hidden");
}

async function createNewCustomer(name) {
    const clean = name.trim();

    // prefix = první 3 znaky + číslo
    let base = clean.substring(0, 3).toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!base) base = "CUST";

    let prefix = base;
    let counter = 1;
    let exists = true;

    while (exists) {
        let trial = prefix + (counter === 1 ? "" : counter);

        const { data } = await supabaseClient
            .from("customers")
            .select("prefix")
            .eq("prefix", trial)
            .maybeSingle();

        if (!data) {
            prefix = trial;
            exists = false;
        } else {
            counter++;
        }
    }

    const { data, error } = await supabaseClient
        .from("customers")
        .insert({ name: clean, prefix })
        .select()
        .single();

    if (error) {
        alert("Chyba ukládání nového zákazníka");
        console.error(error);
        return;
    }

    selectCustomer(data);
}

/************************************************************
 * GENERATE SERIAL + DM
 ************************************************************/
async function generateSerial() {
    const prefix = document.getElementById("serial-prefix").value.trim();
    const serialEnabled = document.getElementById("serial-enable").checked;
    const dmEnabled = document.getElementById("dm-enable").checked;

    if (!serialEnabled) {
        document.getElementById("dm-content").value = dmEnabled ? prefix : "";
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
        await supabaseClient.from("serial_counters")
            .insert({ prefix, current_serial: 1 });
    } else {
        await supabaseClient.from("serial_counters")
            .update({ current_serial: next })
            .eq("id", data.id);
    }

    const serial = `${prefix}-${String(next).padStart(4, "0")}`;
    document.getElementById("dm-content").value = dmEnabled ? serial : prefix;

    updatePreview();
}

/************************************************************
 * PREVIEW
 ************************************************************/
function updatePreview() {
    const name = document.getElementById("tool-name").value;
    const d = document.getElementById("diameter").value;
    const L = document.getElementById("length").value;
    const dm = document.getElementById("dm-content").value;

    document.getElementById("preview-area").innerHTML = `
        <strong>${name}</strong><br>
        Ø${d} × ${L} mm<br><br>
        ${dm ? `<strong>DM:</strong> ${dm}` : ""}
    `;
}

/************************************************************
 * SAVE TOOL
 ************************************************************/
async function saveTool() {
    const insert = {
        customer_prefix: document.getElementById("serial-prefix").value.trim(),
        name: document.getElementById("tool-name").value.trim(),
        diameter: parseFloat(document.getElementById("diameter").value) || null,
        length: parseFloat(document.getElementById("length").value) || null,
        dm_code: document.getElementById("dm-content").value.trim(),
        dm_enabled: document.getElementById("dm-enable").checked,
        serial_enabled: document.getElementById("serial-enable").checked,
        customer_tool_id: document.getElementById("customer-tool-id").value.trim() || null
    };

    const { error } = await supabaseClient.from("tools").insert(insert);

    if (error) alert("Chyba ukládání nástroje");
    else alert("Nástroj byl uložen!");
}

/************************************************************
 * INIT
 ************************************************************/
window.addEventListener("DOMContentLoaded", () => {
    const input = document.getElementById("customer-search");

    input.addEventListener("input", async () => {
        const q = input.value.trim();
        if (q.length < 1) {
            document.getElementById("customer-suggestions").classList.add("hidden");
            return;
        }
        const res = await searchCustomers(q);
        renderSuggestions(res, q);
    });

    updatePreview();
});
