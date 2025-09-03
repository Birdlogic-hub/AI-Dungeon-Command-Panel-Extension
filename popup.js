// default seed if user has none (you can change freely)
const DEFAULTS = [
  { label: "Recruit",   insert: "/recruit ", hint: "Species, Name, Nature" },
  { label: "Bench",     insert: "/bench ",   hint: "id" },
  { label: "Call",      insert: "/call ",    hint: "id" },
  { label: "Swap",      insert: "/swap ",    hint: "id1,id2" },
  { label: "Release",   insert: "/release ", hint: "id" },
  { label: "Team",      insert: "/team",     hint: "" }
];

const QS = sel => document.querySelector(sel);
const listEl = QS("#list");
const filterEl = QS("#filter");
const addBtn = QS("#add");
const editBtn = QS("#edit");
const exportBtn = QS("#export");
const importBtn = QS("#import");
const resetBtn = QS("#reset");

let commands = [];
let editMode = false;
let view = [];

init();

async function init(){
  commands = await load() || DEFAULTS.slice();
  render();
  wireEvents();
}

function wireEvents(){
  filterEl.addEventListener("input", render);
  addBtn.addEventListener("click", onAdd);
  editBtn.addEventListener("click", () => { editMode = !editMode; editBtn.textContent = editMode ? "Done" : "Edit"; render(); });
  exportBtn.addEventListener("click", onExport);
  importBtn.addEventListener("click", onImport);
  resetBtn.addEventListener("click", async () => { if (confirm("Reset to defaults?")) { commands = DEFAULTS.slice(); await save(); render(); } });
}

function filtered(){
  const s = filterEl.value.trim().toLowerCase();
  if (!s) return commands.map((c,i)=>({c,i}));
  return commands
    .map((c,i)=>({c,i}))
    .filter(({c}) => (c.label+c.insert+(c.hint||"")).toLowerCase().includes(s));
}

function render(){
  view = filtered();
  listEl.innerHTML = "";
  view.forEach(({c,i}) => {
    const row = document.createElement("div");
    row.className = "row";
    const btn = document.createElement("button");
    btn.innerHTML = `${escapeHtml(c.label)}<span class="hint">${escapeHtml(c.insert+(c.hint?c.hint:""))}</span>`;
    btn.addEventListener("click", () => editMode ? onEdit(i) : onInsert(c.insert));
    row.appendChild(btn);
    if (editMode) {
      const del = document.createElement("button");
      del.textContent = "✕";
      del.title = "Delete";
      del.style.flex = "0 0 auto";
      del.addEventListener("click", async (e) => { e.stopPropagation(); await onDelete(i); });
      row.appendChild(del);
    }
    listEl.appendChild(row);
  });
}

function escapeHtml(s){ return String(s).replace(/[&<>"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m])); }

async function onAdd(){
  const label = prompt("Button label:");
  if (!label) return;
  const insert = prompt("Text to insert (e.g., /team or /swap ):");
  if (!insert) return;
  const hint = prompt("Hint (optional):") || "";
  commands.push({ label, insert, hint });
  await save();
  render();
}

async function onEdit(index){
  const c = commands[index]; if (!c) return;
  const label = prompt("Edit label:", c.label); if (!label) return;
  const insert = prompt("Edit insert text:", c.insert); if (!insert) return;
  const hint = prompt("Edit hint (optional):", c.hint || "") || "";
  commands[index] = { label, insert, hint };
  await save();
  render();
}

async function onDelete(index){
  commands.splice(index, 1);
  await save();
  render();
}

async function onExport(){
  const json = JSON.stringify(commands, null, 2);
  await navigator.clipboard.writeText(json);
  alert("Commands copied to clipboard.");
}

async function onImport(){
  const json = prompt("Paste JSON array of commands:");
  if (!json) return;
  try {
    const arr = JSON.parse(json);
    if (!Array.isArray(arr)) throw new Error("Not an array");
    // basic shape check
    commands = arr.map(x => ({ label: String(x.label||""), insert: String(x.insert||""), hint: String(x.hint||"") }))
                  .filter(x => x.label && x.insert);
    await save();
    render();
  } catch (e) {
    alert("Invalid JSON.");
  }
}

async function onInsert(text){
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  chrome.tabs.sendMessage(tab.id, { type: "AID_INSERT", text });
  window.close();
}

function load(){ return new Promise(res => chrome.storage.sync.get({ commands: null }, o => res(o.commands))); }
function save(){ return new Promise(res => chrome.storage.sync.set({ commands }, res)); }
