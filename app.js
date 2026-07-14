(function () {
  "use strict";

  // ─── Αρχικοποίηση σελίδας ─────────────────────────────────────────────────
  document.getElementById("couple-names").textContent = CONFIG.coupleNames;
  if (CONFIG.childName) {
    document.getElementById("child-name").textContent = CONFIG.childName;
    document.getElementById("christening").hidden = false;
  }
  const dateEl = document.getElementById("wedding-date");
  if (CONFIG.weddingDate) {
    dateEl.textContent = new Date(CONFIG.weddingDate).toLocaleDateString("el-GR", {
      day: "numeric", month: "long", year: "numeric",
    });
  }
  document.title = "Οι αναμνήσεις μας — " + CONFIG.coupleNames;

  const uploadUrl =
    "https://api.cloudinary.com/v1_1/" + CONFIG.cloudinaryCloudName + "/auto/upload";

  const fileInput = document.getElementById("file-input");
  const guestNameInput = document.getElementById("guest-name");
  const uploadsEl = document.getElementById("uploads");
  const toastEl = document.getElementById("toast");

  function showToast(message, ms) {
    toastEl.textContent = message;
    toastEl.hidden = false;
    clearTimeout(showToast._t);
    showToast._t = setTimeout(function () { toastEl.hidden = true; }, ms || 3500);
  }

  function configMissing() {
    return (
      CONFIG.cloudinaryCloudName === "YOUR_CLOUD_NAME" ||
      CONFIG.cloudinaryUploadPreset === "YOUR_UPLOAD_PRESET"
    );
  }

  // ─── Ανέβασμα αρχείων ─────────────────────────────────────────────────────
  function createUploadItem(displayName) {
    const item = document.createElement("div");
    item.className = "upload-item";
    item.innerHTML =
      '<div class="row"><span class="name"></span><span class="status">0%</span></div>' +
      '<div class="progress"><div></div></div>';
    item.querySelector(".name").textContent = displayName;
    uploadsEl.prepend(item);
    return item;
  }

  function uploadFile(file, displayName) {
    if (configMissing()) {
      showToast("Η σελίδα δεν έχει ρυθμιστεί ακόμα (config.js).");
      return;
    }
    if (file.size > CONFIG.maxFileSizeMB * 1024 * 1024) {
      showToast("Το «" + displayName + "» ξεπερνά τα " + CONFIG.maxFileSizeMB + "MB.");
      return;
    }

    const item = createUploadItem(displayName);
    const statusEl = item.querySelector(".status");
    const barEl = item.querySelector(".progress > div");

    const form = new FormData();
    form.append("file", file);
    form.append("upload_preset", CONFIG.cloudinaryUploadPreset);
    const guestName = guestNameInput.value.trim();
    if (guestName) {
      form.append("context", "guest=" + guestName.replace(/[|=]/g, " "));
    }

    const xhr = new XMLHttpRequest();
    xhr.open("POST", uploadUrl);
    xhr.upload.onprogress = function (e) {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 100);
        statusEl.textContent = pct + "%";
        barEl.style.width = pct + "%";
      }
    };
    xhr.onload = function () {
      if (xhr.status >= 200 && xhr.status < 300) {
        item.classList.add("done");
        statusEl.textContent = "✓ Στάλθηκε";
        barEl.style.width = "100%";
      } else {
        fail();
      }
    };
    xhr.onerror = fail;

    function fail() {
      item.classList.add("error");
      statusEl.textContent = "Απέτυχε — δοκιμάστε ξανά";
    }

    xhr.send(form);
  }

  fileInput.addEventListener("change", function () {
    Array.from(fileInput.files).forEach(function (file) {
      uploadFile(file, file.name);
    });
    fileInput.value = "";
  });

  // ─── Ηχογράφηση ευχής ─────────────────────────────────────────────────────
  const recordBtn = document.getElementById("record-btn");
  const recorderEl = document.getElementById("recorder");
  const previewEl = document.getElementById("preview");
  const previewAudio = document.getElementById("preview-audio");
  const timerEl = document.getElementById("rec-timer");

  let mediaRecorder = null;
  let chunks = [];
  let timerInterval = null;
  let recordedBlob = null;
  let discarded = false;

  function pickMimeType() {
    const candidates = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"];
    for (let i = 0; i < candidates.length; i++) {
      if (window.MediaRecorder && MediaRecorder.isTypeSupported(candidates[i])) {
        return candidates[i];
      }
    }
    return "";
  }

  function startTimer() {
    const start = Date.now();
    timerInterval = setInterval(function () {
      const s = Math.floor((Date.now() - start) / 1000);
      timerEl.textContent = Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
      if (s >= 180) stopRecording(); // όριο 3 λεπτών
    }, 250);
  }

  function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== "inactive") mediaRecorder.stop();
  }

  recordBtn.addEventListener("click", async function () {
    if (!window.MediaRecorder || !navigator.mediaDevices) {
      showToast("Η ηχογράφηση δεν υποστηρίζεται σε αυτή τη συσκευή.");
      return;
    }
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      showToast("Χρειάζεται πρόσβαση στο μικρόφωνο για την ηχητική ευχή.");
      return;
    }

    chunks = [];
    discarded = false;
    const mimeType = pickMimeType();
    mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType: mimeType } : undefined);

    mediaRecorder.ondataavailable = function (e) {
      if (e.data.size > 0) chunks.push(e.data);
    };

    mediaRecorder.onstop = function () {
      clearInterval(timerInterval);
      stream.getTracks().forEach(function (t) { t.stop(); });
      recorderEl.hidden = true;
      recordBtn.hidden = false;
      if (discarded || chunks.length === 0) return;
      recordedBlob = new Blob(chunks, { type: mediaRecorder.mimeType || "audio/webm" });
      previewAudio.src = URL.createObjectURL(recordedBlob);
      previewEl.hidden = false;
    };

    timerEl.textContent = "0:00";
    recordBtn.hidden = true;
    recorderEl.hidden = false;
    previewEl.hidden = true;
    mediaRecorder.start();
    startTimer();
  });

  document.getElementById("rec-stop").addEventListener("click", stopRecording);

  document.getElementById("rec-cancel").addEventListener("click", function () {
    discarded = true;
    stopRecording();
  });

  document.getElementById("preview-send").addEventListener("click", function () {
    if (!recordedBlob) return;
    const ext = recordedBlob.type.indexOf("mp4") !== -1 ? "m4a" : "webm";
    const guestName = guestNameInput.value.trim() || "καλεσμένος";
    const file = new File([recordedBlob], "ευχή-" + guestName + "." + ext, {
      type: recordedBlob.type,
    });
    uploadFile(file, "🎙️ Ηχητική ευχή");
    previewEl.hidden = true;
    recordedBlob = null;
  });

  document.getElementById("preview-discard").addEventListener("click", function () {
    previewEl.hidden = true;
    recordedBlob = null;
  });
})();
