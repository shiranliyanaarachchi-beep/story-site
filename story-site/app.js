function setTheme(next){
  document.documentElement.dataset.theme = next;
  localStorage.setItem("theme", next);
  const btn = document.getElementById("themeBtn");
  if (btn) btn.textContent = next === "light" ? "🌞 Light" : "🌙 Dark";
}

function initTheme(){
  const saved = localStorage.getItem("theme");
  const prefersLight = window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches;
  const theme = saved || (prefersLight ? "light" : "dark");
  setTheme(theme);
}

function escapeHtml(str){
  return String(str)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

async function loadStories(){
  const res = await fetch("stories.json", {cache:"no-store"});
  if (!res.ok) throw new Error("Could not load stories.json");
  return await res.json();
}

// ---------- INDEX ----------
function renderChips(stories){
  const tags = new Set();
  stories.forEach(s => (s.tags||[]).forEach(t => tags.add(t)));
  const chipRow = document.getElementById("chips");
  if (!chipRow) return;

  const allChip = document.createElement("button");
  allChip.className = "chip active";
  allChip.textContent = "All";
  allChip.dataset.tag = "";
  chipRow.appendChild(allChip);

  [...tags].sort().forEach(t=>{
    const b = document.createElement("button");
    b.className = "chip";
    b.textContent = t;
    b.dataset.tag = t;
    chipRow.appendChild(b);
  });
}

function storyCard(s){
  const tags = (s.tags||[]).slice(0,3).map(t => `<span class="badge">${escapeHtml(t)}</span>`).join("");
  return `
  <a class="card" href="story.html?id=${encodeURIComponent(s.id)}">
    <img class="cover" src="${escapeHtml(s.cover||"")}" alt="">
    <div class="card-body">
      <div class="meta">
        <span>${escapeHtml(s.date||"")}</span>
        <span>Read →</span>
      </div>
      <h3 class="title">${escapeHtml(s.title||"Untitled")}</h3>
      <p class="excerpt">${escapeHtml(s.excerpt||"")}</p>
      <div class="badges">${tags}</div>
    </div>
  </a>`;
}

function applyFilters(stories){
  const q = (document.getElementById("search")?.value || "").toLowerCase().trim();
  const activeChip = document.querySelector(".chip.active");
  const tag = activeChip?.dataset.tag || "";

  let out = [...stories];

  if (tag){
    out = out.filter(s => (s.tags||[]).includes(tag));
  }
  if (q){
    out = out.filter(s =>
      (s.title||"").toLowerCase().includes(q) ||
      (s.excerpt||"").toLowerCase().includes(q) ||
      (s.content||[]).join(" ").toLowerCase().includes(q) ||
      (s.tags||[]).join(" ").toLowerCase().includes(q)
    );
  }

  // newest first
  out.sort((a,b)=> (b.date||"").localeCompare(a.date||""));
  return out;
}

function renderIndex(stories){
  renderChips(stories);

  const grid = document.getElementById("grid");
  const count = document.getElementById("count");
  const search = document.getElementById("search");

  function redraw(){
    const filtered = applyFilters(stories);
    if (count) count.textContent = `${filtered.length} story${filtered.length===1?"":"ies"}`;
    if (grid) grid.innerHTML = filtered.map(storyCard).join("");
  }

  document.getElementById("chips")?.addEventListener("click", (e)=>{
    const btn = e.target.closest(".chip");
    if (!btn) return;
    document.querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
    btn.classList.add("active");
    redraw();
  });

  search?.addEventListener("input", redraw);

  redraw();
}

// ---------- STORY PAGE ----------
function getQueryParam(name){
  const url = new URL(window.location.href);
  return url.searchParams.get(name);
}

function likeKey(storyId){ return `liked:${storyId}`; }

function initLikeButton(storyId){
  const btn = document.getElementById("likeBtn");
  if (!btn) return;

  const liked = localStorage.getItem(likeKey(storyId)) === "1";
  if (liked) btn.classList.add("liked");

  btn.addEventListener("click", ()=>{
    const nowLiked = !(localStorage.getItem(likeKey(storyId)) === "1");
    localStorage.setItem(likeKey(storyId), nowLiked ? "1" : "0");
    btn.classList.toggle("liked", nowLiked);
    btn.querySelector(".label").textContent = nowLiked ? "Liked" : "Like";
  });
  btn.querySelector(".label").textContent = liked ? "Liked" : "Like";
}

function renderStory(story){
  document.title = `${story.title} — My Story World`;

  const title = document.getElementById("stTitle");
  const meta = document.getElementById("stMeta");
  const cover = document.getElementById("stCover");
  const content = document.getElementById("stContent");
  const tags = document.getElementById("stTags");

  if (title) title.textContent = story.title || "Untitled";
  if (meta) meta.textContent = `${story.date || ""}`;
  if (cover){
    cover.src = story.cover || "";
    cover.alt = story.title || "";
  }

  if (tags){
    tags.innerHTML = (story.tags||[]).map(t => `<span class="badge">${escapeHtml(t)}</span>`).join("");
  }

  if (content){
    const paras = (story.content || []).map(p => `<p>${escapeHtml(p)}</p>`).join("");
    content.innerHTML = paras;
  }

  initLikeButton(story.id);
  initGiscus(story.id);
}

function initGiscus(storyId){
  const host = document.getElementById("giscusHost");
  if (!host) return;

  // ✅ IMPORTANT: Replace repo settings in story.html (explained below).
  // Here we just pass the per-story term to keep comments separated.
  host.dataset.term = storyId;
}

async function renderStoryPage(){
  const id = getQueryParam("id");
  const stories = await loadStories();
  const story = stories.find(s => s.id === id) || stories[0];

  if (!story){
    document.getElementById("stTitle").textContent = "Story not found";
    return;
  }
  renderStory(story);
}

// ---------- BOOT ----------
document.addEventListener("DOMContentLoaded", async ()=>{
  initTheme();

  const themeBtn = document.getElementById("themeBtn");
  themeBtn?.addEventListener("click", ()=>{
    const current = document.documentElement.dataset.theme || "dark";
    setTheme(current === "dark" ? "light" : "dark");
  });

  try{
    if (document.body.dataset.page === "index"){
      const stories = await loadStories();
      renderIndex(stories);
    }
    if (document.body.dataset.page === "story"){
      await renderStoryPage();
    }
  }catch(err){
    console.error(err);
    const msg = document.getElementById("error");
    if (msg) msg.textContent = "Could not load stories. Please check stories.json and hosting.";
  }
});