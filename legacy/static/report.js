/* LeakDetector report form — pin drop, duplicate check, submit. */
const NZ = { lat: -41.3, lon: 174.8 };
const map = L.map("map").setView([NZ.lat, NZ.lon], 5);
L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  maxZoom: 19,
}).addTo(map);

let marker = null;
let selectedCat = null;
let selectedSize = "unknown";
const submitBtn = document.getElementById("submit");
const msg = document.getElementById("msg");

function setPin(lat, lon) {
  if (marker) marker.setLatLng([lat, lon]);
  else {
    marker = L.marker([lat, lon], { draggable: true }).addTo(map);
    marker.on("dragend", () => {
      const p = marker.getLatLng();
      checkDups(p.lat, p.lng);
    });
  }
  map.setView([lat, lon], Math.max(map.getZoom(), 17));
  submitBtn.disabled = !(selectedCat && marker);
  submitBtn.textContent = selectedCat ? "Send report" : "Pick the leak spot type";
  checkDups(lat, lon);
}

map.on("click", (e) => setPin(e.latlng.lat, e.latlng.lng));

document.getElementById("locate").addEventListener("click", () => {
  if (!navigator.geolocation) return flash("Geolocation not available on this device.", true);
  navigator.geolocation.getCurrentPosition(
    (pos) => setPin(pos.coords.latitude, pos.coords.longitude),
    () => flash("Could not get your location — tap the map instead.", true),
    { enableHighAccuracy: true, timeout: 10000 }
  );
});

function chips(id, cb) {
  document.getElementById(id).addEventListener("click", (e) => {
    const b = e.target.closest(".chip");
    if (!b) return;
    document.querySelectorAll(`#${id} .chip`).forEach((c) => c.classList.remove("sel"));
    b.classList.add("sel");
    cb(b.dataset.v);
  });
}
chips("cats", (v) => {
  selectedCat = v;
  submitBtn.disabled = !marker;
  submitBtn.textContent = "Send report";
});
chips("sizes", (v) => (selectedSize = v));

async function checkDups(lat, lon) {
  const box = document.getElementById("dups");
  const list = document.getElementById("dup-list");
  try {
    const r = await fetch(`/api/reports/nearby?lat=${lat}&lon=${lon}&radius=30`);
    const dups = await r.json();
    if (!dups.length) { box.hidden = true; return; }
    box.hidden = false;
    list.innerHTML = dups
      .map(
        (d) => `<div class="dup"><b>${d.category} leak, ${d.distance_m}m away</b>
        <span class="badge b-${d.status}">${d.status.replace("_", " ")}</span>
        reported ${new Date(d.created_at * 1000).toLocaleDateString()} · ${d.confirmations} others confirmed
        <br><button class="link" type="button" onclick="sameLeak('${d.id}')">✓ same leak — count me in</button></div>`
      )
      .join("");
  } catch {
    box.hidden = true;
  }
}

window.sameLeak = async (id) => {
  const r = await fetch(`/api/reports/${id}/confirm`, { method: "POST" });
  if (r.ok) flash("Thanks — we counted your sighting on the existing report.", false);
  else flash("Could not record that — you can still submit a new report.", true);
};

document.getElementById("form").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!marker || !selectedCat) return;
  submitBtn.disabled = true;
  submitBtn.textContent = "Sending…";
  const p = marker.getLatLng();
  const fd = new FormData();
  fd.append("lat", p.lat);
  fd.append("lon", p.lng);
  fd.append("category", selectedCat);
  fd.append("size", selectedSize);
  fd.append("description", document.getElementById("desc").value);
  fd.append("reporter_contact", document.getElementById("contact").value);
  const files = document.getElementById("photo").files;
  for (const f of Array.from(files).slice(0, 3)) fd.append("photos", f);
  try {
    const r = await fetch("/api/reports", { method: "POST", body: fd });
    const data = await r.json();
    if (!r.ok) throw new Error(data.detail || "submit failed");
    flash(`Report received — ref ${data.id}. Track it on the public map.`, false);
    e.target.reset();
    marker.remove(); marker = null;
    selectedCat = null;
    document.querySelectorAll(".chip.sel").forEach((c) => c.classList.remove("sel"));
    submitBtn.textContent = "Drop a pin on the map first";
  } catch (err) {
    flash(`Submit failed: ${err.message}`, true);
    submitBtn.disabled = false;
    submitBtn.textContent = "Send report";
  }
});

function flash(text, isErr) {
  msg.textContent = text;
  msg.className = isErr ? "err" : "ok";
}
