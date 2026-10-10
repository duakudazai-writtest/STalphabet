const letters = {
a:["λ","Oh-ne"],b:["♧","Toh-vu"],c:["∴","Si"],d:["∷","Dah"],e:["⋊","Fuh"],f:["╫","Eck"],g:["◉","Vech"],h:["⊥","Hah"],i:["‡","Tz"],j:["☾","Juh"],k:["⋈","Kah"],l:["♩","Luh"],m:["⋏","Mih"],
n:["⋋","Neh"],o:["◯","Oo"],p:["ϯ","Pah"],q:["◇","Kuh"],r:["¿","Ruh"],s:["≋","Seh"],t:["⟁","Tuh"],u:["÷","Vuh"],v:["Ⅴ","Vee"],w:["☉","Wah"],x:["✳","Xeh"],y:["ψ","Yuh"],z:["卌","Zeh"]
};
const digits = {"0":"◇","1":"Ⅰ","2":"☾","3":"≋","4":"∴","5":"◉","6":"⋈","7":"♧","8":"⊙","9":"↗"};
const reverseLetters = Object.fromEntries(Object.entries(letters).map(([k,v])=>[v[0],k]));
const reverseDigits = Object.fromEntries(Object.entries(digits).map(([k,v])=>[v,k]));
const source = document.querySelector("#sourceText"), output = document.querySelector("#outputText");
let mode = "english";

const PHRASE_STORAGE_KEY = "stringAlphabet.personalPhrases.v1";
let savedPhrases = loadLocalPhrases();
let supabaseClient = null;
let authUser = null;
let currentAuthUserId = "__uninitialized__";
let cloudReady = false;

function loadLocalPhrases(){
  try {
    const saved = JSON.parse(localStorage.getItem(PHRASE_STORAGE_KEY) || "[]");
    return Array.isArray(saved) ? saved.filter(item => item && typeof item.key === "string" && typeof item.meaning === "string") : [];
  } catch { return []; }
}
function saveLocalPhrases(){
  try { localStorage.setItem(PHRASE_STORAGE_KEY, JSON.stringify(savedPhrases)); return true; }
  catch { return false; }
}
function normalizePhrase(value){ return value.trim().toLocaleLowerCase(); }
function findSavedPhrase(value){
  const normalized = normalizePhrase(value);
  return savedPhrases.find(item => normalizePhrase(item.key) === normalized);
}
function setSyncStatus(message, signedIn = Boolean(authUser)){
  const status = document.querySelector("#syncStatus");
  status.textContent = message;
  status.closest(".sync-status-line")?.classList.toggle("is-connected", signedIn);
}
function updateAuthControls(){
  const signedIn = Boolean(authUser);
  document.querySelector("#signInBtn").hidden = signedIn;
  document.querySelector("#signUpBtn").hidden = signedIn;
  document.querySelector("#signOutBtn").hidden = !signedIn;
  document.querySelector("#authEmail").disabled = signedIn;
  document.querySelector("#authPassword").disabled = signedIn;
  document.querySelector("#importLocalBtn").hidden = !supabaseClient || loadLocalPhrases().length === 0;
  document.querySelector("#authHint").textContent = signedIn
    ? `Signed in as ${authUser.email || "your account"}. Your phrases are private to your account.`
    : "Sign in to view and manage your private online phrases. Your phrases are not shared with other accounts.";
}
function localEntriesToRows(entries){
  return entries.map(item => ({
    user_id: authUser.id,
    phrase_key: item.key,
    phrase_key_normalized: normalizePhrase(item.key),
    meaning: item.meaning
  }));
}
async function loadCloudPhrases(){
  if(!supabaseClient) return;
  const { data, error } = await supabaseClient
    .from("personal_phrases")
    .select("id, phrase_key, phrase_key_normalized, meaning, created_at, user_id")
    .order("created_at", { ascending: false });
  if(error){
    setSyncStatus(`Cloud sync error: ${error.message}. Check the SQL setup and Row Level Security policies.`, true);
    document.querySelector("#phraseStatus").textContent = "Could not load cloud phrases.";
    return;
  }
  savedPhrases = (data || []).map(row => ({
    id: row.id,
    key: row.phrase_key,
    normalized: row.phrase_key_normalized,
    meaning: row.meaning,
    user_id: row.user_id
  }));
  cloudReady = true;
  renderSavedPhrases();
  translate();
  setSyncStatus(authUser
    ? `Private phrase dictionary loaded for ${authUser.email || "this account"}.`
    : "Please sign in to load your private online phrases.", Boolean(authUser));
  document.querySelector("#phraseStatus").textContent = "Your online phrases are private to your account.";
  updateAuthControls();
}
async function applyAuthSession(session){
  const nextUser = session?.user || null;
  const nextId = nextUser?.id || null;
  if(nextId === currentAuthUserId){
    authUser = nextUser;
    updateAuthControls();
    return;
  }
  currentAuthUserId = nextId;
  authUser = nextUser;
  cloudReady = false;
  updateAuthControls();
  if(supabaseClient && !authUser){
    savedPhrases = [];
    renderSavedPhrases();
    translate();
    setSyncStatus("Sign in to access your private online phrases.", false);
    document.querySelector("#phraseStatus").textContent = "Your private phrases are hidden while signed out.";
    updateAuthControls();
    return;
  }
  if(supabaseClient){
    setSyncStatus(authUser ? "Signed in. Loading your private phrase dictionary…" : "Sign in to load your private phrase dictionary…", Boolean(authUser));
    await loadCloudPhrases();
  } else {
    savedPhrases = loadLocalPhrases();
    renderSavedPhrases();
    translate();
    setSyncStatus("Local mode: configure Supabase to sync private phrases across your devices.", false);
    document.querySelector("#phraseStatus").textContent = "Not signed in. Sign in to access your private online phrases.";
    updateAuthControls();
  }
}
function renderSavedPhrases(){
  const list = document.querySelector("#savedPhraseList");
  const count = document.querySelector("#savedPhraseCount");
  if(!list || !count) return;
  count.textContent = `${savedPhrases.length} entr${savedPhrases.length === 1 ? "y" : "ies"}`;
  list.replaceChildren();
  if(savedPhrases.length === 0){
    const empty = document.createElement("p");
    empty.className = "saved-phrase-empty";
    empty.textContent = authUser
      ? "Your private dictionary is empty. Add your first phrase above."
      : (supabaseClient ? "Sign in to see your private online dictionary." : "Sign in to access your private online dictionary.");
    list.appendChild(empty);
    return;
  }
  savedPhrases.forEach((item) => {
    const card = document.createElement("article"); card.className = "saved-phrase-card";
    const details = document.createElement("div"); details.className = "saved-phrase-details";
    const key = document.createElement("strong"); key.textContent = item.key;
    const meaning = document.createElement("span"); meaning.textContent = `means: ${item.meaning}`;
    details.append(key, meaning);
    const actions = document.createElement("div"); actions.className = "saved-phrase-card-actions";
    const use = document.createElement("button"); use.className = "text-action"; use.textContent = "USE ↗";
    use.addEventListener("click", () => { source.value = item.key; setMode("english"); translate(); document.querySelector("#translator").scrollIntoView({behavior:"smooth",block:"start"}); });
    const remove = document.createElement("button"); remove.className = "text-action"; remove.textContent = "DELETE ×";
    remove.addEventListener("click", async () => {
      if(supabaseClient){
        if(!authUser || item.user_id !== authUser.id){
          setSyncStatus("Sign in to manage your private phrases.", Boolean(authUser));
          return;
        }
        const { error } = await supabaseClient.from("personal_phrases").delete().eq("id", item.id).eq("user_id", authUser.id);
        if(error){ setSyncStatus(`Could not delete private phrase: ${error.message}`, true); return; }
        await loadCloudPhrases();
      } else {
        savedPhrases = savedPhrases.filter(entry => normalizePhrase(entry.key) !== normalizePhrase(item.key));
        if(!saveLocalPhrases()) setSyncStatus("Could not save changes in browser storage.", false);
        renderSavedPhrases();
        translate();
      }
    });
    actions.append(use, remove); card.append(details, actions); list.appendChild(card);
  });
}
async function savePhraseEntry(){
  const key = document.querySelector("#phraseKey").value.trim();
  const meaning = document.querySelector("#phraseMeaning").value.trim();
  const status = document.querySelector("#phraseStatus");
  if(!key || !meaning){ status.textContent = "Enter both a phrase and its English meaning."; return; }
  if(supabaseClient){
    if(!authUser){ status.textContent = "Sign in first to save phrases privately online."; return; }
    const normalized = normalizePhrase(key);
    const existing = savedPhrases.find(item => normalizePhrase(item.key) === normalized);
    if(existing){
      if(authUser && existing.user_id === authUser.id){
        const { error } = await supabaseClient.from("personal_phrases")
          .update({ phrase_key:key, phrase_key_normalized:normalized, meaning })
          .eq("id", existing.id);
        if(error){ status.textContent = `Could not update private phrase: ${error.message}`; return; }
        status.textContent = "Your private phrase was updated.";
        await loadCloudPhrases();
      } else {
        status.textContent = "That phrase already exists in your private dictionary. Use a different phrase or update your existing entry.";
      }
      return;
    }
    const row = {
      phrase_key: key,
      phrase_key_normalized: normalized,
      meaning,
      user_id: authUser.id
    };
    const { error } = await supabaseClient.from("personal_phrases").insert(row);
    if(error){
      status.textContent = `Could not save private phrase: ${error.message}. Check the private-table SQL policies.`;
      return;
    }
    status.textContent = "Phrase saved privately to your online account.";
    await loadCloudPhrases();
  } else {
    const index = savedPhrases.findIndex(item => normalizePhrase(item.key) === normalizePhrase(key));
    if(index >= 0) savedPhrases[index] = {key, meaning}; else savedPhrases.push({key, meaning});
    if(saveLocalPhrases()){
      status.textContent = "Saved only in this browser. Sign in to sync private phrases across devices.";
      renderSavedPhrases();
      translate();
    } else status.textContent = "Could not save in this browser. Check browser storage settings.";
  }
}
async function importLocalPhrases(){
  if(!supabaseClient || !authUser) { setAuthHint("Sign in before importing phrases to your private account."); return; }
  const localEntries = loadLocalPhrases();
  if(localEntries.length === 0){
    document.querySelector("#authHint").textContent = "There are no local phrases to import from this browser.";
    return;
  }
  const ok = window.confirm(`Import ${localEntries.length} phrase(s) from this browser into your private online dictionary? Only your account will be able to access them.`);
  if(!ok) return;
  let added = 0, skipped = 0;
  for(const item of localEntries){
    const normalized = normalizePhrase(item.key);
    if(savedPhrases.some(entry => normalizePhrase(entry.key) === normalized)){ skipped++; continue; }
    const { error } = await supabaseClient.from("personal_phrases").insert({
      phrase_key: item.key,
      phrase_key_normalized: normalized,
      meaning: item.meaning,
      user_id: authUser.id
    });
    if(error){
      setSyncStatus(`Private import stopped after ${added} added: ${error.message}`, Boolean(authUser));
      return;
    }
    added++;
  }
  await loadCloudPhrases();
  document.querySelector("#authHint").textContent = `Import complete: ${added} private phrase(s) added; ${skipped} duplicate(s) skipped.`;
}
function encode(text){
  const trimmed = text.trim();
  const personalPhrase = authUser ? findSavedPhrase(trimmed) : null;
  if(personalPhrase) return encodeLetters(personalPhrase.meaning);
  if(/^\d{2}\/\d{2}\/\d{4}\s*,\s*\d+$/.test(trimmed)) return encodeLetters("I LOVE YOU");
  return encodeLetters(text);
}
function encodeLetters(text){return [...text].map(ch=>{const low=ch.toLowerCase();if(letters[low])return letters[low][0];if(digits[ch])return digits[ch];return ch;}).join("");}
function decode(text){
  const personalMeaning = authUser ? savedPhrases.find(item => encodeLetters(item.meaning) === text.trim()) : null;
  if(personalMeaning) return personalMeaning.meaning;
  const personalPhrase = authUser ? findSavedPhrase(text) : null;
  if(personalPhrase) return personalPhrase.meaning;
  const result=[...text].map(ch=>reverseLetters[ch]||reverseDigits[ch]||ch).join("");
  if(result.replace(/\s+/g," ").trim().toLowerCase()==="i love you") return "I LOVE YOU";
  return result;
}
function translate(){
  const val=source.value;
  if(mode==="english"){
    output.textContent=encode(val);
    document.querySelector("#outputLabel").innerHTML='STRING TRANSLATION <span>02</span>';
    document.querySelector("#translationNote").textContent="A message between the lines.";
  }else{
    output.textContent=decode(val);
    document.querySelector("#outputLabel").innerHTML='ENGLISH READING <span>02</span>';
    document.querySelector("#translationNote").textContent="Decoded using the current cipher key.";
  }
  document.querySelector("#charCount").textContent=`${val.length} character${val.length===1?"":"s"}`;
}
function setMode(next){
  mode=next;
  document.querySelectorAll(".lang").forEach(b=>b.classList.toggle("active",b.dataset.mode===mode));
  document.querySelector("#sourceLabel").innerHTML=(mode==="english"?'YOUR MESSAGE':'STRING GLYPHS')+' <span>01</span>';
  document.querySelector("#modeNote").textContent=mode==="english"?"Letters become symbols. The meaning may become something more.":"Read the symbols back into letters—or try the archive's date legend.";
  translate();
}
function setAuthHint(message){ document.querySelector("#authHint").textContent = message; }
function configLooksReady(config){
  return config && typeof config.url === "string" && /^https:\/\/.+/.test(config.url)
    && typeof config.anonKey === "string" && config.anonKey.length > 20
    && !config.url.includes("YOUR_SUPABASE") && !config.anonKey.includes("YOUR_SUPABASE");
}
async function initSupabase(){
  const config = window.STRING_ALPHABET_SUPABASE_CONFIG;
  if(!window.supabase?.createClient || !configLooksReady(config)){
    setSyncStatus("Cloud sync isn't configured yet. Local phrase saving still works.", false);
    setAuthHint("To enable sync, follow SETUP.md and fill in supabase-config.js with your Supabase project URL and public anon/publishable key.");
    document.querySelector("#signInBtn").disabled = true;
    document.querySelector("#signUpBtn").disabled = true;
    return;
  }
  try {
    supabaseClient = window.supabase.createClient(config.url, config.anonKey);
    const { data: { session }, error } = await supabaseClient.auth.getSession();
    if(error) throw error;
    await applyAuthSession(session);
    supabaseClient.auth.onAuthStateChange((_event, nextSession) => {
      // Avoid awaiting network calls inside Supabase's auth callback.
      Promise.resolve().then(() => applyAuthSession(nextSession));
    });
  } catch(error){
    setSyncStatus(`Could not initialize cloud sync: ${error.message}`, false);
  }
}
document.querySelectorAll(".lang").forEach(b=>b.addEventListener("click",()=>setMode(b.dataset.mode)));
document.querySelector("#swapBtn").addEventListener("click",()=>setMode(mode==="english"?"string":"english"));
document.querySelector("#translateBtn").addEventListener("click",translate);
source.addEventListener("input",translate);
document.querySelector("#clearBtn").addEventListener("click",()=>{source.value="";translate();source.focus();});
document.querySelector("#copyBtn").addEventListener("click",async()=>{try{await navigator.clipboard.writeText(output.textContent);document.querySelector("#copyBtn").textContent="COPIED ✓";setTimeout(()=>document.querySelector("#copyBtn").textContent="COPY ↗",1300);}catch(e){document.querySelector("#copyBtn").textContent="SELECT TO COPY";}});
document.querySelectorAll("[data-example]").forEach(b=>b.addEventListener("click",()=>{source.value=b.dataset.example;setMode("english");translate();document.querySelector("#translator").scrollIntoView({behavior:"smooth",block:"start"});}));
document.querySelector("#themeToggle").addEventListener("click",()=>document.body.classList.toggle("light"));
document.querySelector("#savePhraseBtn")?.addEventListener("click",savePhraseEntry);
document.querySelector("#signUpBtn").addEventListener("click", async()=>{
  if(!supabaseClient) return;
  const email = document.querySelector("#authEmail").value.trim();
  const password = document.querySelector("#authPassword").value;
  if(!email || password.length < 8){ setAuthHint("Enter a valid email and a password with at least 8 characters."); return; }
  const { data, error } = await supabaseClient.auth.signUp({ email, password });
  if(error){ setAuthHint(`Could not create account: ${error.message}`); return; }
  if(data.session){
    setAuthHint("Account created. You can contribute to the shared phrase dictionary.");
    await applyAuthSession(data.session);
  } else {
    setAuthHint("Account created. Check your email for the confirmation link, then return here and sign in.");
  }
});
document.querySelector("#signInBtn").addEventListener("click", async()=>{
  if(!supabaseClient) return;
  const email = document.querySelector("#authEmail").value.trim();
  const password = document.querySelector("#authPassword").value;
  if(!email || !password){ setAuthHint("Enter your email and password."); return; }
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if(error){ setAuthHint(`Sign-in failed: ${error.message}`); return; }
  await applyAuthSession(data.session);
  setAuthHint("Signed in. Your private online dictionary is ready.");
});
document.querySelector("#signOutBtn").addEventListener("click", async()=>{
  if(!supabaseClient) return;
  const { error } = await supabaseClient.auth.signOut();
  if(error){ setAuthHint(`Could not sign out: ${error.message}`); return; }
  await applyAuthSession(null);
  setAuthHint("Signed out. Your online phrases are hidden until you sign in again.");
});
document.querySelector("#importLocalBtn").addEventListener("click", importLocalPhrases);

const alphaGrid=document.querySelector("#alphabetGrid");
Object.entries(letters).forEach(([letter,data])=>{const el=document.createElement("div");el.className="glyph-card";el.innerHTML=`<span class="glyph-letter">${letter.toUpperCase()}</span><span class="glyph-symbol">${data[0]}</span><span class="glyph-pronounce">${data[1]}</span>`;alphaGrid.appendChild(el);});
const numGrid=document.querySelector("#numberGrid");
Object.entries(digits).forEach(([num,symbol])=>{const el=document.createElement("div");el.className="glyph-card";el.innerHTML=`<span class="glyph-letter">${num}</span><span class="glyph-symbol">${symbol}</span>`;numGrid.appendChild(el);});
renderSavedPhrases();
translate();
initSupabase();
