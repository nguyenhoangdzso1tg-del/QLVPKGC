import { db } from "./firebase.js";

import {
  collection,
  query,
  where,
  getDocs
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";


// 2. Khởi tạo các biến cho lịch

let selectedDates = []; 
// mỗi phần tử: { day, month, year }

let today = new Date();
let currentMonth = today.getMonth();    // 0 = Tháng 1
let currentYear = today.getFullYear();

const monthYearLabel = document.getElementById('monthYear');
const calendarBody = document.getElementById('calendar-body');

const months = [
    "Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4",
    "Tháng 5", "Tháng 6", "Tháng 7", "Tháng 8",
    "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12"
];

// 3. Hàm hiển thị lịch cho tháng, năm cho trước
function renderCalendar(month, year) {
    calendarBody.innerHTML = '';
    // Xác định ngày đầu tiên của tháng (0=CN)
    let firstDay = new Date(year, month, 1).getDay();
    // Số ngày trong tháng đó
    let daysInMonth = new Date(year, month + 1, 0).getDate();

    let date = 1;
    // Tạo 6 hàng (đủ cho 5-6 tuần)
    for (let i = 0; i < 6; i++) {
        let row = document.createElement('tr');
        for (let j = 0; j < 7; j++) {
            let cell = document.createElement('td');
            if (i === 0 && j < firstDay) {
                // Các ô trước ngày 1
                cell.classList.add('inactive');
            } else if (date > daysInMonth) {
                // Các ô sau khi hết ngày tháng
                cell.classList.add('inactive');
            } else {
    // 1. Hiển thị số ngày
    cell.innerText = date;

    // 2. Gắn dữ liệu ngày / tháng / năm vào ô
    cell.dataset.day = date;
    cell.dataset.month = month + 1;
    cell.dataset.year = year;

    // 3. GẮN CLICK CHO Ô NGÀY (BẠN ĐANG THIẾU DÒNG NÀY)
    cell.addEventListener("click", () => {
        handleDateClick(cell);
    });

    // 4. Tăng ngày
    date++;
}

            row.appendChild(cell);
        }
        calendarBody.appendChild(row);
    }
    monthYearLabel.innerText = months[month] + ' ' + year;
}
const VIOLATION_TYPES = [
  "Đi trễ",
  "Hút thuốc",
  "Mang dép",
  "Sai đồng phục",
  "Không thẻ sinh viên",
  "Vắng có phép",
  "Vắng không phép"
];



// 4. Xử lý nút chuyển tháng
document.getElementById('prevMonth').addEventListener('click', function() {
    currentMonth--;
    if (currentMonth < 0) {
        currentYear--;
        currentMonth = 11;
    }
    renderCalendar(currentMonth, currentYear);
});
document.getElementById('nextMonth').addEventListener('click', function() {
    currentMonth++;
    if (currentMonth > 11) {
        currentYear++;
        currentMonth = 0;
    }
    renderCalendar(currentMonth, currentYear);
});




// 7. Khởi tạo lịch khi vừa load trang
renderCalendar(currentMonth, currentYear);
function aggregateOne(v) {
  const result = {
    maSV: v.maSV,
    hoTen: v.hoTen,
    lop: v.lop,
    khoa: v.khoa,
    khoaHoc: v.khoaHoc,
    ngay: v.ngay
  };

  // mặc định = 0
  VIOLATION_TYPES.forEach(type => {
    result[type] = 0;
  });

  // tách lỗi
  const list = String(v.vipham || "").split(",").map(x => x.trim()).filter(Boolean);

  list.forEach(l => {
    if (result[l] !== undefined) {
      result[l]++;
    }
  });

  result.tong = list.length;
  return result;
}
function groupViolations(data) {
  const map = {};

  data.forEach(v => {
    const key = v.maSV + "_" + v.ngay;

    if (!map[key]) {
      map[key] = aggregateOne(v);
    } else {
      const temp = aggregateOne(v);
      VIOLATION_TYPES.forEach(t => {
        map[key][t] += temp[t];
      });
      map[key].tong += temp.tong;
    }
  });

  return Object.values(map);
}
function renderTable(list) {
  const tbody = document.getElementById("calendarViolationList");

  tbody.innerHTML = "";

  list.forEach((v, i) => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${i + 1}</td>
      <td>${v.maSV}</td> 
      <td>${v.hoTen}</td>
      <td>${v.lop}</td>
      <td>${v.khoaHoc}</td>
      <td>${v.khoa}</td>
      <td>${v.ngay}</td>
      <td>${v["Mang dép"]}</td>
      <td>${v["Đi trễ"]}</td>
      <td>${v["Hút thuốc"]}</td>
      <td>${v["Sai đồng phục"]}</td>
      <td>${v["Không thẻ sinh viên"]}</td>
      <td>${v["Vắng có phép"]}</td>
      <td>${v["Vắng không phép"]}</td>
      <td><b>${v.tong}</b></td>
    `;

    tbody.appendChild(tr);
  });

  document.getElementById("totalCount").innerText =
    "Tổng số lỗi: " + list.reduce((s, v) => s + v.tong, 0);
}

async function loadMultiDays() {
  if (selectedDates.length === 0) {
    document.getElementById("calendarViolationList").innerHTML = "";
    document.getElementById("totalCount").innerText = "";
    return;
  }

  let allData = [];

  for (const d of selectedDates) {
    const q = query(
      collection(db, "violations"),
      where("year", "==", d.year),
      where("month", "==", d.month),
      where("day", "==", d.day)
    );

    const snap = await getDocs(q);
    allData = allData.concat(snap.docs.map(doc => doc.data()));
  }

  const grouped = groupViolations(allData);
  renderTable(grouped);
}

function handleDateClick(cell) {
  const day = Number(cell.dataset.day);
  const month = Number(cell.dataset.month);
  const year = Number(cell.dataset.year);

  // Tạo key để so sánh
  const key = `${year}-${month}-${day}`;

  // Kiểm tra ngày này đã được chọn chưa
  const index = selectedDates.findIndex(
    d => `${d.year}-${d.month}-${d.day}` === key
  );

  if (index >= 0) {
    // 👉 ĐÃ CHỌN → BỎ CHỌN
    selectedDates.splice(index, 1);
    cell.classList.remove("active");
  } else {
    // 👉 CHƯA CHỌN → THÊM
    selectedDates.push({ day, month, year });
    cell.classList.add("active");
  }

  console.log("Selected dates:", selectedDates);

  // Load dữ liệu theo nhiều ngày
  updateSelectedDaysLabel();

  loadMultiDays();
}

function updateSelectedDaysLabel() {
  const label = document.getElementById("selectedDaysLabel");

  if (selectedDates.length === 0) {
    label.innerText = "Các ngày đã chọn: —";
    return;
  }

  // Sắp xếp ngày tăng dần
  const sorted = [...selectedDates].sort((a, b) => {
    const d1 = new Date(a.year, a.month - 1, a.day);
    const d2 = new Date(b.year, b.month - 1, b.day);
    return d1 - d2;
  });

  // Định dạng dd/mm/yyyy
  const text = sorted
    .map(d =>
      `${String(d.day).padStart(2, "0")}/${String(d.month).padStart(2, "0")}/${d.year}`
    )
    .join(", ");

  label.innerText = "Các ngày đã chọn: " + text;
}
document.getElementById("exportExcelBtn").addEventListener("click", () => {
    const table = document.getElementById("violationTable");

    if (!table || table.rows.length <= 1) {
        alert("Không có dữ liệu để xuất!");
        return;
    }

    const workbook = XLSX.utils.table_to_book(table, { sheet: "Vi phạm" });

    const fileName = "vi_pham_" + new Date().toISOString().slice(0,10) + ".xlsx";
    XLSX.writeFile(workbook, fileName);
});
function groupMultiDays(data) {
  const map = {};

  data.forEach(v => {
    const key = v.maSV + "_" + v.lop + "_" + v.khoa + "_" + v.khoaHoc;

    const temp = aggregateOne(v);

    if (!map[key]) {
      map[key] = {
        maSV: v.maSV,
        hoTen: v.hoTen,
        lop: v.lop,
        khoa: v.khoa,
        khoaHoc: v.khoaHoc,
        tong: 0
      };

      // init = 0
      VIOLATION_TYPES.forEach(t => {
        map[key][t] = 0;
      });
    }

    VIOLATION_TYPES.forEach(t => {
      map[key][t] += temp[t];
    });

    map[key].tong += temp.tong;
  });

  return Object.values(map);
}
function renderMergeTable(list) {
  const tbody = document.getElementById("mergeList");
  tbody.innerHTML = "";

  list.forEach((v, i) => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${i + 1}</td>
      <td>${v.maSV}</td>
      <td>${v.hoTen}</td>
      <td>${v.lop}</td>
      <td>${v.khoaHoc}</td>
      <td>${v.khoa}</td>
      <td>${v["Mang dép"]}</td>
      <td>${v["Đi trễ"]}</td>
      <td>${v["Hút thuốc"]}</td>
      <td>${v["Sai đồng phục"]}</td>
      <td>${v["Không thẻ sinh viên"]}</td>
      <td>${v["Vắng có phép"]}</td>
      <td>${v["Vắng không phép"]}</td>
      <td><b>${v.tong}</b></td>
    `;

    tbody.appendChild(tr);
  });
}
document.getElementById("mergeBtn").addEventListener("click", async () => {

  if (selectedDates.length === 0) {
    alert("Hãy chọn ngày trước!");
    return;
  }

  let allData = [];

  for (const d of selectedDates) {
    const q = query(
      collection(db, "violations"),
      where("year", "==", d.year),
      where("month", "==", d.month),
      where("day", "==", d.day)
    );

    const snap = await getDocs(q);
    allData = allData.concat(snap.docs.map(doc => doc.data()));
  }

  const merged = groupMultiDays(allData);

  renderMergeTable(merged);
});
document.getElementById("exportExcelBtn2").addEventListener("click", () => {
    const table = document.getElementById("mergeTable");

    if (!table || table.rows.length <= 1) {
        alert("Không có dữ liệu để xuất!");
        return;
    }

    const workbook = XLSX.utils.table_to_book(table, { sheet: "Bảng gộp" });

    const fileName = "bang_gop_" + new Date().toISOString().slice(0,10) + ".xlsx";
    XLSX.writeFile(workbook, fileName);
});