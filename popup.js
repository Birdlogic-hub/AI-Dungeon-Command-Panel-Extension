// default seed if user has none (you can change freely)
const DEFAULTS = [
  { label: "Example", insert: "/example ", hint: "(This is an example command.)" },
];

const QS = sel => document.querySelector(sel);
const listEl   = QS("#list");
const filterEl = QS("#filter");
const addBtn   = QS("#add");
const editBtn  = QS("#edit");
const exportBtn= QS("#export");
const importBtn= QS("#import");
const resetBtn = QS("#reset");
const fileEl   = QS("#file");   // hidden file input for JSON import

let commands = [];
let editMode = false;
let view = [];

init();

async function init(){
  commands = await load() || DEFAULTS.slice();
  render();
  wireEvents();
}

function wireEvents() {
  filterEl.addEventListener("input", render);
  addBtn.addEventListener("click", onAdd);
  editBtn.addEventListener("click", () => {
    editMode = !editMode;
    editBtn.textContent = editMode ? "Done" : "Edit";
    render();
  });
  exportBtn.addEventListener("click", onExportFile);
  importBtn.addEventListener("click", () => fileEl && fileEl.click());
  fileEl && fileEl.addEventListener("change", onImportFile);
  resetBtn.addEventListener("click", async () => {
    if (confirm("Reset to defaults?")) {
      commands = DEFAULTS.slice();
      await save();
      render();
    }
  });
}

function filtered(){
  const s = (filterEl.value || "").trim().toLowerCase();
  if (!s) return commands.map((c,i)=>({c,i}));
  return commands
    .map((c,i)=>({c,i}))
    .filter(({c}) => (c.label + c.insert + (c.hint||"")).toLowerCase().includes(s));
}

function render() {
  view = filtered();
  listEl.innerHTML = "";

  view.forEach(({ c, i }) => {
    const row = document.createElement("div");
    row.className = "row";

    const btn = document.createElement("button");
    btn.innerHTML =
      `${escapeHtml(c.label)}<span class="hint">` +
      `${escapeHtml(c.insert)}${c.hint ? " " + escapeHtml(c.hint) : ""}</span>`;
    btn.addEventListener("click", () => editMode ? onEdit(i) : onInsert(c.insert));
    row.appendChild(btn);

    if (editMode) {
      const del = document.createElement("button");
      del.textContent = "✕";
      del.title = "Delete";
      del.style.flex = "0 0 auto";
      del.addEventListener("click", async (e) => {
        e.stopPropagation();
        await onDelete(i);
      });
      row.appendChild(del);

      // Drag & drop reordering
      row.draggable = true;
      row.dataset.index = i;

      row.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("text/plain", String(i));
        row.style.opacity = "0.6";
      });
      row.addEventListener("dragend", () => { row.style.opacity = ""; });
      row.addEventListener("dragover", (e) => {
        e.preventDefault();
        row.style.outline = "1px dashed #aaa";
      });
      row.addEventListener("dragleave", () => { row.style.outline = ""; });
      row.addEventListener("drop", async (e) => {
        e.preventDefault();
        row.style.outline = "";
        const from = +e.dataTransfer.getData("text/plain");
        const to = +row.dataset.index;
        if (Number.isNaN(from) || Number.isNaN(to) || from === to) return;
        const item = commands.splice(from, 1)[0];
        commands.splice(to, 0, item);
        await save();
        render();
      });
    }

    listEl.appendChild(row);
  });
}

function escapeHtml(s){
  return String(s).replace(/[&<>"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
}

async function onAdd(){
  const label  = prompt("Button label:");
  if (!label) return;
  const insert = prompt("Text to insert (e.g., /team or /swap ):");
  if (!insert) return;
  const hint   = prompt("Hint (optional):") || "";
  commands.push({ label, insert, hint });
  await save();
  render();
}

async function onEdit(index){
  const c = commands[index]; if (!c) return;
  const label  = prompt("Edit label:", c.label);   if (!label)  return;
  const insert = prompt("Edit insert text:", c.insert); if (!insert) return;
  const hint   = prompt("Edit hint (optional):", c.hint || "") || "";
  commands[index] = { label, insert, hint };
  await save();
  render();
}

async function onDelete(index){
  commands.splice(index, 1);
  await save();
  render();
}

// ---- File Export (.json download)
async function onExportFile(){
  const json = JSON.stringify(commands, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url;
  a.download = "aid-commands.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ---- File Import (.json upload)
async function onImportFile(evt){
  const file = evt.target.files && evt.target.files[0];
  evt.target.value = ""; // allow re-selecting same file next time
  if (!file) return;

  try {
    const text = await file.text();
    const arr  = JSON.parse(text);
    if (!Array.isArray(arr)) throw new Error("JSON is not an array.");

    const cleaned = arr
      .map(x => ({
        label: String(x.label || "").trim(),
        insert: String(x.insert || "").trim(),
        hint: String(x.hint || "")
      }))
      .filter(x => x.label && x.insert);

    if (!cleaned.length) throw new Error("No valid command entries found.");

    commands = cleaned;
    await save();
    render();
    alert(`Imported ${commands.length} commands.`);
  } catch (e) {
    alert("Import failed: " + (e?.message || e));
  }
}

async function onInsert(text){
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  chrome.tabs.sendMessage(tab.id, { type: "AID_INSERT", text });
  window.close();
}

function load(){
  return new Promise(res => chrome.storage.sync.get({ commands: null }, o => res(o.commands)));
}
function save(){
  return new Promise(res => chrome.storage.sync.set({ commands }, res));
}
