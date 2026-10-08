import { db } from "./firebase.js";
import {
  collection,
  onSnapshot,
  deleteDoc,
  doc,
  query,
  orderBy,
  limit,
  where,
  getDocs
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
let allData = [];
let lastDeleted = null;
let deleteTimeout = null;
// Các id đang chờ xóa thật (trong lúc hiện toast Hoàn tác / chờ Firebase xác nhận)
const pendingDeletedIds = new Set();
const tbody = document.getElementById("list");

/* ===== MULTI-SELECT STATE ===== */
let isSelectMode = false;
let selectedIds = new Set();
let filteredCache = null; // dữ liệu đúng 1 ngày đã lọc (từ Firebase)
/* ===== ADMIN (xóa vi phạm) ===== */
const ADMIN_PASSWORD = "kgc2026"; // đổi mật khẩu tại đây
let isAdmin = sessionStorage.getItem("vp_admin") === "1";

function applyAdminUI() {
  const btnTrash = document.getElementById("btnTrash");
  const btnAdmin = document.getElementById("btnAdmin");
  const btnOut = document.getElementById("btnAdminOut");
  const loginBox = document.getElementById("adminLoginBox");

  if (isAdmin) {
    if (btnTrash) btnTrash.style.display = "inline-flex";
    if (btnAdmin) btnAdmin.style.display = "none";
    if (btnOut) btnOut.style.display = "inline-flex";
    if (loginBox) loginBox.style.display = "none";
  } else {
    if (btnTrash) btnTrash.style.display = "none";
    if (btnAdmin) btnAdmin.style.display = "inline-flex";
    if (btnOut) btnOut.style.display = "none";
    if (loginBox) loginBox.style.display = "none";
    if (typeof isSelectMode !== "undefined" && isSelectMode) exitSelectMode();
  }
  renderTable(getCurrentDisplayData());
}
const q = query(
  collection(db, "violations"),
  orderBy("createdAt", "desc"),
  limit(200)
);

function sortByCreatedDesc(list) {
  return list.sort((a, b) => {
    const ta = a.createdAt && a.createdAt.seconds ? a.createdAt.seconds : 0;
    const tb = b.createdAt && b.createdAt.seconds ? b.createdAt.seconds : 0;
    return tb - ta;
  });
}

onSnapshot(q, (snapshot) => {
  const snapItems = [];
  snapshot.forEach(d => {
    snapItems.push({ id: d.id, ...d.data() });
  });

  // Bỏ các bản ghi đang chờ xóa (đang hiện toast Hoàn tác / chờ Firebase xác nhận)
  allData = sortByCreatedDesc(
    snapItems.filter(v => !pendingDeletedIds.has(v.id))
  );

  // Đang lọc ngày: làm mới filteredCache từ snapshot
  // → bản ghi MỚI của ngày này hiện ngay, bản ghi cũ nằm ngoài 200 bản gần nhất vẫn giữ nguyên
  if (isFiltering && filteredCache) {
    const byId = new Map(filteredCache.map(v => [v.id, v]));
    snapItems
      .filter(v => v.ngay === currentFilterDate && !pendingDeletedIds.has(v.id))
      .forEach(v => byId.set(v.id, v));
    filteredCache = sortByCreatedDesc([...byId.values()]);
  }

  // Giữ lại selectedIds còn tồn tại (kể cả bản ghi trong ngày đang lọc)
  const existingIds = new Set(allData.map(v => v.id));
  if (filteredCache) filteredCache.forEach(v => existingIds.add(v.id));
  selectedIds = new Set([...selectedIds].filter(id => existingIds.has(id)));
  updateSelectedCount();

  renderTable(getCurrentDisplayData());
});

/* ===== SINGLE DELETE (giữ nguyên) ===== */
function attachDeleteEvents() {
  document.querySelectorAll(".btn-delete").forEach(btn => {
    btn.onclick = () => {
      const id = btn.dataset.id;

      if (!confirm("Bạn có chắc muốn xóa vi phạm này?")) return;

      // Tìm item trong allData HOẶC filteredCache (khi đang lọc)
      let item = allData.find(v => v.id === id);
      if (!item && filteredCache) {
        item = filteredCache.find(v => v.id === id);
      }
      lastDeleted = item;

      // Đánh dấu "đang chờ xóa" để snapshot không làm bản ghi nhảy lại
      // trong lúc đang hiện toast Hoàn tác
      pendingDeletedIds.add(id);

      // Xóa khỏi allData
      allData = allData.filter(v => v.id !== id);
      // Xóa khỏi filteredCache nếu đang lọc
      if (filteredCache) {
        filteredCache = filteredCache.filter(v => v.id !== id);
      }
      selectedIds.delete(id);
      updateSelectedCount();
      renderTable(getCurrentDisplayData());

      showUndoToast();

      deleteTimeout = setTimeout(async () => {
        try {
          await deleteDoc(doc(db, "violations", id));
        } finally {
          pendingDeletedIds.delete(id);
          if (lastDeleted && lastDeleted.id === id) lastDeleted = null;
        }
      }, 8000);
    };
  });
}

/* ===== MULTI-SELECT EVENTS ===== */
function attachSelectEvents() {
  document.querySelectorAll(".row-checkbox").forEach(cb => {
    cb.onchange = () => {
      const id = cb.dataset.id;
      if (cb.checked) {
        selectedIds.add(id);
        cb.closest("tr").classList.add("selected-row");
      } else {
        selectedIds.delete(id);
        cb.closest("tr").classList.remove("selected-row");
      }
      updateSelectedCount();
      syncSelectAllCheckbox();
    };
  });
}

function updateSelectedCount() {
  const el = document.getElementById("selectedCount");
  if (el) el.innerText = selectedIds.size;
}

function syncSelectAllCheckbox() {
  const headerCb = document.getElementById("selectAllHeader");
  const topCb = document.getElementById("selectAll");
  const rowCbs = document.querySelectorAll(".row-checkbox");
  if (!rowCbs.length) {
    if (headerCb) headerCb.checked = false;
    if (topCb) topCb.checked = false;
    return;
  }
  const allChecked = [...rowCbs].every(cb => cb.checked);
  if (headerCb) headerCb.checked = allChecked;
  if (topCb) topCb.checked = allChecked;
}

function getCurrentDisplayData() {
  if (isFiltering && filteredCache) {
    return filteredCache;
  }
  return allData;
}

function renderTable(data) {
  tbody.innerHTML = "";

  const colCount = 12; // bảng luôn có 12 cột (cột checkbox vẫn giữ chỗ dù ẩn)

  if (data.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="${colCount}" class="empty">
          Không có vi phạm
        </td>
      </tr>
    `;
    return;
  }

  let displayData = data;

  // Chỉ phân trang khi "Tất cả"
  if (!isFiltering) {
    const start = (currentPage - 1) * perPage;
    const end = start + perPage;
    displayData = data.slice(start, end);
  }

  displayData.forEach(v => {
    let time = "—";
    if (v.createdAt) {
      time = v.createdAt.toDate().toLocaleString("vi-VN");
    }

    const isChecked = selectedIds.has(v.id);
    const selectCell = isSelectMode
      ? `<td class="col-select show">
           <input type="checkbox" class="select-checkbox row-checkbox" data-id="${v.id}" ${isChecked ? "checked" : ""}>
         </td>`
      : `<td class="col-select"></td>`;

    const tr = document.createElement("tr");
    if (isChecked) tr.classList.add("selected-row");

        const deleteCell = isAdmin
      ? `<td><button class="btn-delete" data-id="${v.id}">X</button></td>`
      : `<td style="color:#94a3b8;">—</td>`;

    tr.innerHTML = `
      ${selectCell}
      <td>${v.maSV}</td>
      <td>${v.hoTen}</td>
      <td>${v.lop}</td>
      <td>${v.khoaHoc}</td>
      <td>${v.khoa}</td>
      <td>${v.ngay}</td>
      <td>${v.buoi}</td>
      <td>${v.vipham}</td>
      <td>${time}</td>
      <td>${v.nguoiNhap || "—"}</td>
      ${deleteCell}
    `;
    tbody.appendChild(tr);
  });

    if (isAdmin) attachDeleteEvents();
  if (isSelectMode) {
    attachSelectEvents();
    syncSelectAllCheckbox();
  }

  // Chỉ render pagination khi "Tất cả"
  if (!isFiltering) {
    renderPagination(data.length);
  } else {
    document.getElementById("pagination").innerHTML = "";
    document.getElementById("paginationTop").innerHTML = "";
  }
}

/* ===== FILTER (lấy đúng ngày từ Firebase, không chỉ 200 bản gần nhất) ===== */
document.getElementById("btnFilter").onclick = async () => {
  const date = document.getElementById("filterDate").value;
  if (!date) {
    alert("Chọn ngày cần lọc!");
    return;
  }

  isFiltering = true;
  currentFilterDate = date;
  currentPage = 1;
  // Không giữ chọn của ngày trước → tránh "Xóa đã chọn" đụng phải bản ghi đang ẩn
  selectedIds.clear();
  updateSelectedCount();

  try {
    const qf = query(
      collection(db, "violations"),
      where("ngay", "==", date)
    );
    const snap = await getDocs(qf);
    const filtered = [];
    snap.forEach(d => {
      filtered.push({ id: d.id, ...d.data() });
    });

    filtered.sort((a, b) => {
      if (!a.createdAt || !b.createdAt) return 0;
      return (b.createdAt.seconds || 0) - (a.createdAt.seconds || 0);
    });

    filteredCache = filtered;
    renderTable(filtered);
    updateExportButton();
  } catch (e) {
    console.error(e);
    alert(
      "Lỗi lọc ngày. Nếu Firebase yêu cầu tạo index, mở link trong Console (F12).\n" +
      (e.message || e)
    );
  }
};

document.getElementById("btnClear").onclick = () => {
  isFiltering = false;
  currentFilterDate = null;
  filteredCache = null;
  currentPage = 1;
  selectedIds.clear();
  updateSelectedCount();
  document.getElementById("filterDate").value = "";
  renderTable(allData);
  updateExportButton();
};

let currentFilterDate = null;
let currentPage = 1;
const perPage = 50;
let isFiltering = false;

function renderPagination(totalItems) {
  const totalPages = Math.ceil(totalItems / perPage);

  const containerBottom = document.getElementById("pagination");
  const containerTop = document.getElementById("paginationTop");

  containerBottom.innerHTML = "";
  containerTop.innerHTML = "";

  if (totalPages <= 1) return;

  function createBtn(page, text = page) {
    const btn = document.createElement("button");
    btn.innerText = text;

    btn.onclick = () => {
      currentPage = page;
      renderTable(getCurrentDisplayData());
    };

    if (page === currentPage) {
      btn.style.background = "#2563eb";
      btn.style.color = "white";
    }

    return btn;
  }

  function render(container) {
    if (currentPage > 1) {
      container.appendChild(createBtn(currentPage - 1, "←"));
    }

    container.appendChild(createBtn(1));

    if (currentPage > 3) {
      const dot = document.createElement("span");
      dot.innerText = "...";
      container.appendChild(dot);
    }

    for (let i = currentPage - 1; i <= currentPage + 1; i++) {
      if (i > 1 && i < totalPages) {
        container.appendChild(createBtn(i));
      }
    }

    if (currentPage < totalPages - 2) {
      const dot = document.createElement("span");
      dot.innerText = "...";
      container.appendChild(dot);
    }

    if (totalPages > 1) {
      container.appendChild(createBtn(totalPages));
    }

    if (currentPage < totalPages) {
      container.appendChild(createBtn(currentPage + 1, "→"));
    }
  }

  render(containerTop);
  render(containerBottom);
}

/* ===== UNDO (giữ nguyên single delete) ===== */
function showUndoToast() {
  const toast = document.getElementById("undoToast");
  toast.style.display = "block";

  setTimeout(() => {
    toast.style.display = "none";
  }, 5000);
}

window.undoDelete = function () {
  if (!lastDeleted) return;

  clearTimeout(deleteTimeout);
  pendingDeletedIds.delete(lastDeleted.id);

  allData.unshift(lastDeleted);
  // Khôi phục vào filteredCache nếu đang lọc và ngày khớp
  if (filteredCache && lastDeleted.ngay === currentFilterDate) {
    filteredCache.unshift(lastDeleted);
  }
  renderTable(getCurrentDisplayData());

  lastDeleted = null;

  document.getElementById("undoToast").style.display = "none";
};

/* ===== MULTI DELETE UI ===== */
function enterSelectMode() {
  isSelectMode = true;
  selectedIds.clear();
  updateSelectedCount();

  document.getElementById("btnTrash").classList.add("active");
  document.getElementById("btnConfirmDelete").classList.add("show");
  document.getElementById("btnCancelSelect").classList.add("show");
  document.getElementById("selectAllWrap").classList.add("show");
  document.getElementById("thSelect").classList.add("show");
  document.querySelectorAll(".col-select").forEach(el => el.classList.add("show"));

  renderTable(getCurrentDisplayData());
}

function exitSelectMode() {
  isSelectMode = false;
  selectedIds.clear();
  updateSelectedCount();

  document.getElementById("btnTrash").classList.remove("active");
  document.getElementById("btnConfirmDelete").classList.remove("show");
  document.getElementById("btnCancelSelect").classList.remove("show");
  document.getElementById("selectAllWrap").classList.remove("show");
  document.getElementById("thSelect").classList.remove("show");

  const headerCb = document.getElementById("selectAllHeader");
  const topCb = document.getElementById("selectAll");
  if (headerCb) headerCb.checked = false;
  if (topCb) topCb.checked = false;

  renderTable(getCurrentDisplayData());
}

document.getElementById("btnTrash").onclick = () => {
  if (isSelectMode) {
    exitSelectMode();
  } else {
    enterSelectMode();
  }
};

document.getElementById("btnCancelSelect").onclick = () => {
  exitSelectMode();
};

/* Chọn tất cả (header + top) */
function toggleSelectAll(checked) {
  const rowCbs = document.querySelectorAll(".row-checkbox");
  rowCbs.forEach(cb => {
    cb.checked = checked;
    const id = cb.dataset.id;
    if (checked) {
      selectedIds.add(id);
      cb.closest("tr").classList.add("selected-row");
    } else {
      selectedIds.delete(id);
      cb.closest("tr").classList.remove("selected-row");
    }
  });
  updateSelectedCount();
  const headerCb = document.getElementById("selectAllHeader");
  const topCb = document.getElementById("selectAll");
  if (headerCb) headerCb.checked = checked;
  if (topCb) topCb.checked = checked;
}

document.getElementById("selectAllHeader").onchange = (e) => {
  toggleSelectAll(e.target.checked);
};
document.getElementById("selectAll").onchange = (e) => {
  toggleSelectAll(e.target.checked);
};

/* Xóa nhiều đã chọn */
document.getElementById("btnConfirmDelete").onclick = async () => {
  if (selectedIds.size === 0) {
    alert("Chưa chọn vi phạm nào!");
    return;
  }

  const count = selectedIds.size;
  if (!confirm(`Bạn có chắc muốn xóa ${count} vi phạm đã chọn?`)) return;

  const idsToDelete = [...selectedIds];
  const delSet = new Set(idsToDelete);

  // Xóa tạm trên UI
  allData = allData.filter(v => !delSet.has(v.id));
  // Cập nhật filteredCache nếu đang lọc
  if (filteredCache) {
    filteredCache = filteredCache.filter(v => !delSet.has(v.id));
  }
  // Tránh snapshot làm các bản ghi hiện lại trước khi Firebase xác nhận xóa
  idsToDelete.forEach(id => pendingDeletedIds.add(id));
  selectedIds.clear();
  updateSelectedCount();
  renderTable(getCurrentDisplayData());

  // Xóa thật trên Firebase
  try {
    await Promise.all(
      idsToDelete.map(id => deleteDoc(doc(db, "violations", id)))
    );
  } catch (err) {
    console.error("Lỗi xóa nhiều:", err);
    alert("Có lỗi khi xóa một số bản ghi. Vui lòng tải lại trang.");
  } finally {
    // Bản ghi xóa lỗi (nếu có) sẽ tự hiện lại ở lần cập nhật snapshot kế tiếp
    idsToDelete.forEach(id => pendingDeletedIds.delete(id));
  }

  exitSelectMode();
};
/* ===== ADMIN LOGIN ===== */
document.getElementById("btnAdmin").onclick = () => {
  const box = document.getElementById("adminLoginBox");
  const show = box.style.display === "none" || box.style.display === "";
  box.style.display = show ? "block" : "none";
  document.getElementById("adminMsg").textContent = "";
  document.getElementById("adminPassword").value = "";
  if (show) document.getElementById("adminPassword").focus();
};

document.getElementById("btnAdminCancel").onclick = () => {
  document.getElementById("adminLoginBox").style.display = "none";
  document.getElementById("adminMsg").textContent = "";
};

document.getElementById("btnAdminLogin").onclick = () => {
  const pw = document.getElementById("adminPassword").value;
  if (pw === ADMIN_PASSWORD) {
    isAdmin = true;
    sessionStorage.setItem("vp_admin", "1");
    applyAdminUI();
  } else {
    document.getElementById("adminMsg").textContent = "Sai mật khẩu!";
  }
};

document.getElementById("adminPassword").addEventListener("keydown", (e) => {
  if (e.key === "Enter") document.getElementById("btnAdminLogin").click();
});

document.getElementById("btnAdminOut").onclick = () => {
  isAdmin = false;
  sessionStorage.removeItem("vp_admin");
  applyAdminUI();
};

applyAdminUI();
updateExportButton();
function updateExportButton() {
  const btn = document.getElementById("btnExport");
  if (!btn) return;
  // Chỉ hiện khi đang lọc 1 ngày và có dữ liệu
  if (isFiltering && filteredCache && filteredCache.length > 0) {
    btn.style.display = "inline-flex";
  } else {
    btn.style.display = "none";
  }
}
/* ===== XUẤT EXCEL (chỉ ngày đã lọc, không cần Admin) ===== */
document.getElementById("btnExport").onclick = () => {
  if (!isFiltering || !filteredCache) {
    alert("Hãy lọc theo 1 ngày trước khi xuất Excel!");
    return;
  }
  if (filteredCache.length === 0) {
    alert("Ngày này không có dữ liệu để xuất!");
    return;
  }

  const rows = filteredCache.map((v, i) => {
    let time = "";
    if (v.createdAt && v.createdAt.toDate) {
      time = v.createdAt.toDate().toLocaleString("vi-VN");
    }
    return {
      STT: i + 1,
      "Mã SV": v.maSV || "",
      "Họ tên": v.hoTen || "",
      "Lớp": v.lop || "",
      "Khóa": v.khoaHoc || "",
      "Khoa": v.khoa || "",
      "Ngày": v.ngay || "",
      "Buổi": v.buoi || "",
      "Vi phạm": v.vipham || "",
      "Thời gian nhập": time,
      "Người nhập": v.nguoiNhap || ""
    };
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Vi phạm");
  const fileName = "vi_pham_" + currentFilterDate + ".xlsx";
  XLSX.writeFile(wb, fileName);
};